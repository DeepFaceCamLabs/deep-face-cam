"""Model manifest, status, and download helpers.

Model binaries are intentionally not part of the app bundle. This module keeps
all model files in modules.paths.MODELS_DIR and verifies downloads before the
inference code attempts to load them.
"""

from __future__ import annotations

import hashlib
import json
import os
import ssl
import shutil
import tempfile
from urllib.parse import quote
import urllib.request
import zipfile
from dataclasses import dataclass
from typing import Any, Callable, Dict, Iterable, List, Optional

from modules.paths import MODELS_DIR, ROOT_DIR

ProgressCallback = Callable[[Dict[str, Any]], None]

INSIGHTFACE_BUFFALO_ID = "insightface_buffalo_l"
MODEL_BASE_URL_ENV = "DEEPFACECAM_MODEL_BASE_URL"


@dataclass(frozen=True)
class ModelSpec:
    id: str
    filename: str
    purpose: str
    required: bool
    size_bytes: int
    sha256: str
    source_url: Optional[str]
    source_page: Optional[str]

    @classmethod
    def from_json(cls, raw: Dict[str, Any]) -> "ModelSpec":
        return cls(
            id=str(raw["id"]),
            filename=str(raw["filename"]),
            purpose=str(raw.get("purpose", "")),
            required=bool(raw.get("required", False)),
            size_bytes=int(raw.get("size_bytes", 0)),
            sha256=str(raw.get("sha256", "")),
            source_url=raw.get("source_url"),
            source_page=raw.get("source_page"),
        )


def manifest_candidates() -> List[str]:
    env = os.environ.get("DEEPFACECAM_MODEL_MANIFEST")
    candidates = []
    if env:
        candidates.append(os.path.abspath(os.path.expanduser(env)))
    candidates.extend(
        [
            os.path.join(ROOT_DIR, "models", "manifest.json"),
            os.path.join(os.path.dirname(ROOT_DIR), "models", "manifest.json"),
        ]
    )
    return candidates


def manifest_path() -> Optional[str]:
    for path in manifest_candidates():
        if os.path.isfile(path):
            return path
    return None


def load_manifest() -> Dict[str, Any]:
    path = manifest_path()
    if not path:
        return {"schema_version": 1, "models": []}
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data


def list_specs() -> List[ModelSpec]:
    return [ModelSpec.from_json(item) for item in load_manifest().get("models", [])]


def get_spec(model_id: str) -> Optional[ModelSpec]:
    for spec in list_specs():
        if spec.id == model_id:
            return spec
    return None


def model_path(spec_or_id: ModelSpec | str) -> str:
    spec = get_spec(spec_or_id) if isinstance(spec_or_id, str) else spec_or_id
    if spec is None:
        raise KeyError(f"unknown model: {spec_or_id}")
    return os.path.join(MODELS_DIR, spec.filename)


def download_url(spec: ModelSpec) -> Optional[str]:
    base_url = os.environ.get(MODEL_BASE_URL_ENV, "").strip().rstrip("/")
    if base_url:
        return f"{base_url}/{quote(spec.filename)}"
    return spec.source_url


def insightface_root() -> str:
    return os.path.join(MODELS_DIR, "insightface")


def insightface_model_dir() -> str:
    return os.path.join(insightface_root(), "models", "buffalo_l")


def _sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _dir_has_onnx(path: str) -> bool:
    return os.path.isdir(path) and any(
        name.endswith(".onnx") for name in os.listdir(path)
    )


def _ensure_insightface_layout(spec: ModelSpec) -> bool:
    """Make buffalo_l available at the path InsightFace actually reads.

    InsightFace's FaceAnalysis(name="buffalo_l", root=...) resolves models to
    {root}/models/buffalo_l. Older local copies in this repo used
    {MODELS_DIR}/insightface/buffalo_l, so we normalize both layouts here.
    """
    desired = insightface_model_dir()
    if _dir_has_onnx(desired):
        return True

    zip_path = model_path(spec)
    if os.path.isfile(zip_path):
        os.makedirs(desired, exist_ok=True)
        with zipfile.ZipFile(zip_path) as zf:
            zf.extractall(desired)
        return _dir_has_onnx(desired)

    for candidate in (
        os.path.join(MODELS_DIR, "insightface", "buffalo_l"),
        os.path.join(MODELS_DIR, "models", "buffalo_l"),
    ):
        if not _dir_has_onnx(candidate):
            continue
        os.makedirs(os.path.dirname(desired), exist_ok=True)
        try:
            rel = os.path.relpath(candidate, os.path.dirname(desired))
            os.symlink(rel, desired, target_is_directory=True)
        except OSError:
            shutil.copytree(candidate, desired, dirs_exist_ok=True)
        return _dir_has_onnx(desired)

    return False


def is_present(spec: ModelSpec, verify: bool = False) -> bool:
    path = model_path(spec)
    if os.path.isfile(path):
        if spec.size_bytes and os.path.getsize(path) != spec.size_bytes:
            return False
        if verify and spec.sha256 and _sha256_file(path) != spec.sha256:
            return False
        return True

    # InsightFace may be distributed as an extracted buffalo_l folder instead
    # of a zip file. Treat that as present for status purposes.
    if spec.id == INSIGHTFACE_BUFFALO_ID:
        for candidate in (
            os.path.join(MODELS_DIR, "insightface", "models", "buffalo_l"),
            os.path.join(MODELS_DIR, "insightface", "buffalo_l"),
            os.path.join(MODELS_DIR, "models", "buffalo_l"),
        ):
            if _dir_has_onnx(candidate):
                return True
    return False


def status(verify: bool = False) -> Dict[str, Any]:
    specs = list_specs()
    items = []
    for spec in specs:
        path = model_path(spec)
        present = is_present(spec, verify=verify)
        items.append(
            {
                "id": spec.id,
                "filename": spec.filename,
                "purpose": spec.purpose,
                "required": spec.required,
                "present": present,
                "downloadable": bool(download_url(spec)),
                "size_bytes": spec.size_bytes,
                "path": path,
                "source_page": spec.source_page,
            }
        )
    return {
        "models_dir": MODELS_DIR,
        "manifest_path": manifest_path(),
        "models": items,
        "missing_required": [m["id"] for m in items if m["required"] and not m["present"]],
    }


def _emit(callback: Optional[ProgressCallback], payload: Dict[str, Any]) -> None:
    if callback:
        callback(payload)


def download_model(model_id: str, callback: Optional[ProgressCallback] = None) -> Dict[str, Any]:
    spec = get_spec(model_id)
    if spec is None:
        return {"ok": False, "error": f"unknown model: {model_id}"}
    if is_present(spec, verify=False):
        return {"ok": True, "id": spec.id, "path": model_path(spec), "skipped": True}
    source_url = download_url(spec)
    if not source_url:
        return {"ok": False, "id": spec.id, "error": "model has no download URL"}

    os.makedirs(MODELS_DIR, exist_ok=True)
    final_path = model_path(spec)
    fd, part_path = tempfile.mkstemp(
        prefix=f".{spec.filename}.", suffix=".part", dir=MODELS_DIR
    )
    os.close(fd)

    try:
        _emit(callback, {"event": "model_download_start", "id": spec.id})
        context = ssl.create_default_context()
        request = urllib.request.Request(
            source_url,
            headers={"User-Agent": "DeepFaceCam/0.1"},
        )
        with urllib.request.urlopen(request, context=context, timeout=60) as response:
            total = int(response.headers.get("Content-Length", spec.size_bytes or 0))
            read = 0
            h = hashlib.sha256()
            with open(part_path, "wb") as f:
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    f.write(chunk)
                    h.update(chunk)
                    read += len(chunk)
                    _emit(
                        callback,
                        {
                            "event": "model_download_progress",
                            "id": spec.id,
                            "bytes": read,
                            "total": total,
                        },
                    )

        digest = h.hexdigest()
        if spec.size_bytes and os.path.getsize(part_path) != spec.size_bytes:
            raise RuntimeError(
                f"size mismatch for {spec.filename}: "
                f"{os.path.getsize(part_path)} != {spec.size_bytes}"
            )
        if spec.sha256 and digest != spec.sha256:
            raise RuntimeError(
                f"sha256 mismatch for {spec.filename}: {digest} != {spec.sha256}"
            )
        os.replace(part_path, final_path)
        if spec.id == INSIGHTFACE_BUFFALO_ID and not _ensure_insightface_layout(spec):
            raise RuntimeError("downloaded buffalo_l.zip but could not extract InsightFace models")
        _emit(callback, {"event": "model_download_done", "id": spec.id})
        return {"ok": True, "id": spec.id, "path": final_path}
    except Exception as exc:
        try:
            if os.path.exists(part_path):
                os.remove(part_path)
        finally:
            _emit(callback, {"event": "model_download_error", "id": spec.id, "error": str(exc)})
        return {"ok": False, "id": spec.id, "error": str(exc)}


def ensure_models(
    model_ids: Optional[Iterable[str]] = None,
    required_only: bool = False,
    callback: Optional[ProgressCallback] = None,
) -> Dict[str, Any]:
    specs = list_specs()
    wanted = set(model_ids or [])
    results = []
    for spec in specs:
        if wanted and spec.id not in wanted:
            continue
        if required_only and not spec.required:
            continue
        if is_present(spec, verify=False):
            if spec.id == INSIGHTFACE_BUFFALO_ID:
                ok = _ensure_insightface_layout(spec)
                results.append(
                    {
                        "ok": ok,
                        "id": spec.id,
                        "skipped": ok,
                        "path": insightface_model_dir(),
                        "error": None if ok else "InsightFace model layout is invalid",
                    }
                )
            else:
                results.append({"ok": True, "id": spec.id, "skipped": True, "path": model_path(spec)})
            continue
        results.append(download_model(spec.id, callback=callback))
    return {"ok": all(r.get("ok") for r in results), "results": results, "status": status()}


def ensure_model(model_id: str, callback: Optional[ProgressCallback] = None) -> bool:
    if get_spec(model_id) is None:
        return False
    result = ensure_models([model_id], callback=callback)
    return bool(result.get("ok"))
