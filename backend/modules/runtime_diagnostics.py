from __future__ import annotations

import ctypes
import glob
import os
import platform
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from importlib import metadata
from pathlib import Path
from typing import Any, Dict, List, Optional

import modules.globals as G
import modules.metadata as META
from modules.paths import MODELS_DIR


def _version(package: str) -> Optional[str]:
    try:
        return metadata.version(package)
    except Exception:
        return None


def _run_command(args: List[str], timeout: float = 3.0) -> Dict[str, Any]:
    try:
        creationflags = 0
        if sys.platform == "win32" and hasattr(subprocess, "CREATE_NO_WINDOW"):
            creationflags = subprocess.CREATE_NO_WINDOW
        result = subprocess.run(
            args,
            capture_output=True,
            text=True,
            timeout=timeout,
            creationflags=creationflags,
        )
        return {
            "ok": result.returncode == 0,
            "returncode": result.returncode,
            "stdout": (result.stdout or "").strip(),
            "stderr": (result.stderr or "").strip(),
        }
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def _onnxruntime_info() -> Dict[str, Any]:
    info: Dict[str, Any] = {
        "installed": False,
        "version": _version("onnxruntime-gpu")
        or _version("onnxruntime-directml")
        or _version("onnxruntime-silicon")
        or _version("onnxruntime"),
        "available_providers": [],
        "active_providers": list(G.execution_providers or []),
        "has_preload_dlls": False,
    }
    try:
        import onnxruntime as ort

        info["installed"] = True
        info["version"] = getattr(ort, "__version__", info["version"])
        info["available_providers"] = list(ort.get_available_providers())
        info["has_preload_dlls"] = hasattr(ort, "preload_dlls")
    except Exception as exc:
        info["error"] = str(exc)
    return info


def _torch_info() -> Dict[str, Any]:
    info: Dict[str, Any] = {
        "installed": False,
        "version": _version("torch"),
        "cuda_available": False,
        "device_count": 0,
        "devices": [],
    }
    try:
        import torch

        info["installed"] = True
        info["version"] = getattr(torch, "__version__", info["version"])
        info["cuda_available"] = bool(torch.cuda.is_available())
        info["cuda_version"] = getattr(torch.version, "cuda", None)
        try:
            info["cudnn_version"] = torch.backends.cudnn.version()
        except Exception:
            info["cudnn_version"] = None
        if info["cuda_available"]:
            count = int(torch.cuda.device_count())
            info["device_count"] = count
            devices = []
            for index in range(count):
                props = torch.cuda.get_device_properties(index)
                devices.append(
                    {
                        "index": index,
                        "name": props.name,
                        "total_memory_mb": round(props.total_memory / 1024 / 1024),
                        "capability": f"{props.major}.{props.minor}",
                    }
                )
            info["devices"] = devices
    except Exception as exc:
        info["error"] = str(exc)
    return info


def _nvidia_smi_info() -> Dict[str, Any]:
    exe = shutil.which("nvidia-smi")
    if not exe and sys.platform == "win32":
        candidate = Path(os.environ.get("SystemRoot", r"C:\Windows")) / "System32" / "nvidia-smi.exe"
        if candidate.exists():
            exe = str(candidate)
    if not exe:
        return {"available": False, "gpus": []}

    query = _run_command(
        [
            exe,
            "--query-gpu=name,driver_version,memory.total,compute_cap",
            "--format=csv,noheader,nounits",
        ]
    )
    gpus = []
    if query.get("ok") and query.get("stdout"):
        for index, line in enumerate(query["stdout"].splitlines()):
            parts = [part.strip() for part in line.split(",")]
            gpus.append(
                {
                    "index": index,
                    "name": parts[0] if len(parts) > 0 else "",
                    "driver_version": parts[1] if len(parts) > 1 else "",
                    "memory_total_mb": _to_int(parts[2]) if len(parts) > 2 else None,
                    "compute_capability": parts[3] if len(parts) > 3 else "",
                }
            )

    version = _run_command([exe, "--version"])
    return {
        "available": True,
        "path": exe,
        "gpus": gpus,
        "query_error": None if query.get("ok") else query.get("stderr") or query.get("error"),
        "version_output": version.get("stdout") if version.get("ok") else None,
    }


def _to_int(value: Any) -> Optional[int]:
    try:
        return int(float(str(value).strip()))
    except Exception:
        return None


def _site_roots() -> List[Path]:
    roots = set()
    if hasattr(sys, "_MEIPASS"):
        roots.add(Path(getattr(sys, "_MEIPASS")))
    roots.add(Path(sys.executable).resolve().parent)
    for raw in sys.path:
        if not raw:
            continue
        path = Path(raw)
        if path.name == "site-packages" or "site-packages" in path.parts:
            roots.add(path)
    roots.add(Path(sys.prefix) / "Lib" / "site-packages")
    return [root for root in roots if root.exists()]


def _cuda_candidate_dirs() -> List[str]:
    dirs: List[str] = []
    for root in _site_roots():
        for pattern in (
            root / "onnxruntime" / "capi",
            root / "torch" / "lib",
        ):
            if pattern.exists():
                dirs.append(str(pattern))
        for path in glob.glob(str(root / "nvidia" / "*" / "bin")):
            if os.path.isdir(path):
                dirs.append(path)
        for path in glob.glob(str(root / "nvidia" / "*" / "lib")):
            if os.path.isdir(path):
                dirs.append(path)
    return sorted(set(dirs))


def _find_dll(name: str, extra_dirs: List[str]) -> Optional[str]:
    search_path = os.pathsep.join(extra_dirs + [os.environ.get("PATH", "")])
    found = shutil.which(name, path=search_path)
    if found:
        return found
    for directory in extra_dirs:
        candidate = os.path.join(directory, name)
        if os.path.exists(candidate):
            return candidate
    return None


def _windows_cuda_dlls() -> Dict[str, Any]:
    if sys.platform != "win32":
        return {"checked": False, "dlls": [], "candidate_dirs": []}
    dirs = _cuda_candidate_dirs()
    dll_dir_handles = []
    for directory in dirs:
        try:
            dll_dir_handles.append(os.add_dll_directory(directory))
        except (AttributeError, OSError):
            pass
    dll_names = [
        "onnxruntime_providers_cuda.dll",
        "onnxruntime_providers_shared.dll",
        "cudart64_12.dll",
        "cublas64_12.dll",
        "cublasLt64_12.dll",
        "cudnn64_9.dll",
    ]
    dlls = []
    for name in dll_names:
        path = _find_dll(name, dirs)
        can_load = False
        error = None
        if path:
            try:
                ctypes.WinDLL(path)
                can_load = True
            except Exception as exc:
                error = str(exc)
        dlls.append(
            {
                "name": name,
                "found": bool(path),
                "path": path,
                "loadable": can_load,
                "error": error,
            }
        )
    return {"checked": True, "dlls": dlls, "candidate_dirs": dirs}


def _session_providers(session: Any) -> List[str]:
    if session is None:
        return []
    try:
        return list(session.get_providers())
    except Exception:
        pass
    underlying = getattr(session, "_underlying", None)
    if underlying is not None:
        try:
            return list(underlying.get_providers())
        except Exception:
            pass
    return []


def _session_path(owner: Any) -> Optional[str]:
    for attr in ("model_file", "model_path"):
        value = getattr(owner, attr, None)
        if value:
            return os.path.basename(str(value))
    return None


def _session_entry(name: str, session: Any, owner: Any = None) -> Dict[str, Any]:
    return {
        "name": name,
        "loaded": session is not None,
        "providers": _session_providers(session),
        "model": _session_path(owner if owner is not None else session),
    }


def _model_sessions() -> List[Dict[str, Any]]:
    sessions: List[Dict[str, Any]] = []

    face_analyser_module = sys.modules.get("modules.face_analyser")
    analyser = getattr(face_analyser_module, "FACE_ANALYSER", None) if face_analyser_module else None
    if analyser is not None:
        det_model = getattr(analyser, "det_model", None)
        sessions.append(_session_entry("face_detection", getattr(det_model, "session", None), det_model))
        models = getattr(analyser, "models", {}) or {}
        rec_model = models.get("recognition")
        landmark_model = models.get("landmark_2d_106")
        sessions.append(_session_entry("face_recognition", getattr(rec_model, "session", None), rec_model))
        sessions.append(_session_entry("face_landmark", getattr(landmark_model, "session", None), landmark_model))
    else:
        sessions.extend(
            [
                _session_entry("face_detection", None),
                _session_entry("face_recognition", None),
                _session_entry("face_landmark", None),
            ]
        )

    swapper_module = sys.modules.get("modules.processors.frame.face_swapper")
    swapper = getattr(swapper_module, "FACE_SWAPPER", None) if swapper_module else None
    sessions.append(_session_entry("face_swapper", getattr(swapper, "session", None), swapper))

    for module_name, attr, label in (
        ("modules.processors.frame.face_enhancer", "FACE_ENHANCER", "gfpgan_enhancer"),
        ("modules.processors.frame.face_enhancer_gpen256", "ENHANCER", "gpen_256_enhancer"),
        ("modules.processors.frame.face_enhancer_gpen512", "ENHANCER", "gpen_512_enhancer"),
    ):
        module = sys.modules.get(module_name)
        session = getattr(module, attr, None) if module else None
        sessions.append(_session_entry(label, session))

    return sessions


def _model_files() -> Dict[str, Any]:
    fp16 = os.path.join(MODELS_DIR, "inswapper_128_fp16.onnx")
    fp32 = os.path.join(MODELS_DIR, "inswapper_128.onnx")
    return {
        "inswapper_fp16_present": os.path.exists(fp16),
        "inswapper_fp32_present": os.path.exists(fp32),
    }


def _warnings(
    onnx_info: Dict[str, Any],
    torch_info: Dict[str, Any],
    nvidia_info: Dict[str, Any],
    dll_info: Dict[str, Any],
    sessions: List[Dict[str, Any]],
    live: Optional[Dict[str, Any]],
) -> List[str]:
    warnings: List[str] = []
    available = onnx_info.get("available_providers") or []
    active = onnx_info.get("active_providers") or []
    has_nvidia_gpu = bool(nvidia_info.get("gpus"))

    if has_nvidia_gpu and "CUDAExecutionProvider" not in available:
        warnings.append("NVIDIA GPU detected, but ONNX Runtime CUDA provider is not available.")
    if "CUDAExecutionProvider" in available and "CUDAExecutionProvider" not in active:
        warnings.append("CUDA provider is available but not selected as the active backend.")
    if "CUDAExecutionProvider" in active and not torch_info.get("cuda_available"):
        warnings.append("CUDA is active for ONNX Runtime, but torch CUDA is unavailable; FP16 swapper and some CUDA post-processing paths may be disabled.")

    if dll_info.get("checked") and "CUDAExecutionProvider" in active:
        missing = [item["name"] for item in dll_info.get("dlls", []) if not item.get("found")]
        unloadable = [item["name"] for item in dll_info.get("dlls", []) if item.get("found") and not item.get("loadable")]
        if missing:
            warnings.append("Missing CUDA/cuDNN DLLs: " + ", ".join(missing))
        if unloadable:
            warnings.append("CUDA/cuDNN DLLs were found but could not be loaded: " + ", ".join(unloadable))

    loaded_sessions = [item for item in sessions if item.get("loaded")]
    if loaded_sessions and "CUDAExecutionProvider" in active:
        non_cuda = [
            item["name"]
            for item in loaded_sessions
            if "CUDAExecutionProvider" not in (item.get("providers") or [])
        ]
        if non_cuda:
            warnings.append("Some loaded models are not using CUDA: " + ", ".join(non_cuda))

    if live and live.get("running"):
        fps = live.get("fps")
        if isinstance(fps, (int, float)) and fps > 0 and fps < 10:
            warnings.append("Live FPS is low. Check the per-stage timings and actual model providers below.")

    return warnings


def collect_runtime_diagnostics(live: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    onnx_info = _onnxruntime_info()
    torch_info = _torch_info()
    nvidia_info = _nvidia_smi_info()
    dll_info = _windows_cuda_dlls()
    sessions = _model_sessions()

    diagnostics = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "app": {
            "name": META.name,
            "version": META.version,
            "edition": META.edition,
        },
        "platform": {
            "system": platform.system(),
            "release": platform.release(),
            "version": platform.version(),
            "machine": platform.machine(),
            "processor": platform.processor(),
        },
        "python": {
            "version": platform.python_version(),
            "implementation": platform.python_implementation(),
            "frozen": bool(getattr(sys, "frozen", False)),
        },
        "package": {
            "variant": os.environ.get("DEEPFACECAM_WINDOWS_VARIANT")
            or os.environ.get("DEEPFACECAM_PACKAGE_VARIANT")
            or "unknown",
        },
        "onnxruntime": onnx_info,
        "torch": torch_info,
        "nvidia": nvidia_info,
        "cuda_dlls": dll_info,
        "models": _model_files(),
        "sessions": sessions,
        "live": live or {"running": False},
    }
    diagnostics["warnings"] = _warnings(
        onnx_info, torch_info, nvidia_info, dll_info, sessions, live
    )
    return diagnostics
