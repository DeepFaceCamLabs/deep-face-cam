"""Headless JSON-RPC + HTTP server that drives the existing Deep-Live-Cam
face-swap engine from a separate UI front-end (React / Tauri).

Endpoints
---------
WebSocket  /rpc            JSON-RPC 2.0 + server-pushed events
HTTP GET   /preview.mjpeg  Live webcam preview as motion-JPEG
HTTP GET   /preview.jpg    Single processed preview frame (image/video)
HTTP GET   /thumb          Thumbnail for an arbitrary file (?path=...)
HTTP GET   /video_thumb    First-frame thumbnail of a video (?path=...)
HTTP GET   /health         Health probe

The intent is feature parity with `modules/ui.py` (PySide6 GUI). Every
state field and every action exposed by that UI has a corresponding
RPC method here.
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import json
import os
import platform
import queue
import re
import shutil
import subprocess
import sys
import threading
import time
import traceback
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable, Dict, List, Optional

import cv2
import numpy as np

# ── 1. install the UI shim BEFORE anything imports modules.ui ─────────
from modules import backend_ui_shim

sys.modules["modules.ui"] = backend_ui_shim

# ── 2. now safe to import the engine ──────────────────────────────────
import modules.globals as G
import modules.metadata as META
from modules import core as engine
from modules.capturer import get_video_frame, get_video_frame_total
from modules.face_analyser import (
    add_blank_map,
    detect_many_faces_fast,
    detect_one_face_fast,
    get_one_face,
    get_unique_faces_from_target_image,
    get_unique_faces_from_target_video,
    has_valid_map,
    simplify_maps,
)
from modules.gpu_processing import gpu_flip
from modules import model_manager
from modules.paths import (
    APP_DATA_DIR,
    CACHE_DIR,
    MODELS_DIR,
    OUTPUTS_DIR,
    ROOT_DIR,
    SWITCH_STATE_PATH,
    UPLOADS_DIR,
    ensure_runtime_dirs,
)
from modules.processors.frame.core import get_frame_processors_modules
from modules.utilities import has_image_extension, is_image, is_video, normalize_output_path
from modules.video_capture import VideoCapturer

# aiohttp is the only new third-party dependency
try:
    from aiohttp import WSMsgType, web
except ImportError as exc:  # pragma: no cover
    print("\n[backend_server] missing dependency: aiohttp\n"
          "Install with: python -m pip install 'aiohttp>=3.9'\n",
          file=sys.stderr)
    raise


# ─── persistence (mirrors modules/ui.py) ─────────────────────────────────


def _clean_name(path: Optional[str], fallback: str) -> str:
    if not path:
        return fallback
    name, _ = os.path.splitext(os.path.basename(path))
    name = re.sub(r"[^A-Za-z0-9._-]+", "-", name).strip(".-")
    return name or fallback


def _default_output_path() -> str:
    os.makedirs(OUTPUTS_DIR, exist_ok=True)
    ext = ".mp4" if G.target_path and is_video(G.target_path) else ".png"
    stamp = time.strftime("%Y%m%d-%H%M%S")
    source = _clean_name(G.source_path, "source")
    target = _clean_name(G.target_path, "target")
    return os.path.join(OUTPUTS_DIR, f"{stamp}-{source}-to-{target}{ext}")


def _current_output_file() -> Optional[str]:
    if G.output_path and os.path.isfile(G.output_path):
        return G.output_path
    return None


def save_switch_states() -> None:
    state = {
        "keep_fps": G.keep_fps,
        "keep_audio": G.keep_audio,
        "keep_frames": G.keep_frames,
        "many_faces": G.many_faces,
        "map_faces": G.map_faces,
        "poisson_blend": G.poisson_blend,
        "color_correction": G.color_correction,
        "nsfw_filter": G.nsfw_filter,
        "live_mirror": G.live_mirror,
        "live_resizable": G.live_resizable,
        "fp_ui": G.fp_ui,
        "show_fps": G.show_fps,
        "mouth_mask": G.mouth_mask,
        "show_mouth_mask_box": G.show_mouth_mask_box,
        "mouth_mask_size": G.mouth_mask_size,
        "opacity": G.opacity,
        "sharpness": G.sharpness,
        "video_encoder": G.video_encoder,
        "video_quality": G.video_quality,
    }
    try:
        with open(SWITCH_STATE_PATH, "w") as f:
            json.dump(state, f)
    except OSError:
        pass


def load_switch_states() -> None:
    try:
        with open(SWITCH_STATE_PATH, "r") as f:
            state = json.load(f)
    except (FileNotFoundError, OSError, json.JSONDecodeError):
        return
    G.keep_fps = state.get("keep_fps", True)
    G.keep_audio = state.get("keep_audio", True)
    G.keep_frames = state.get("keep_frames", False)
    G.many_faces = state.get("many_faces", False)
    G.map_faces = state.get("map_faces", False)
    G.poisson_blend = state.get("poisson_blend", False)
    G.color_correction = state.get("color_correction", False)
    G.nsfw_filter = state.get("nsfw_filter", False)
    G.live_mirror = state.get("live_mirror", False)
    G.live_resizable = state.get("live_resizable", True)
    G.fp_ui = state.get("fp_ui", {"face_enhancer": False,
                                  "face_enhancer_gpen256": False,
                                  "face_enhancer_gpen512": False})
    G.show_fps = state.get("show_fps", False)
    G.mouth_mask_size = state.get("mouth_mask_size", 0.0)
    G.mouth_mask = G.mouth_mask_size > 0
    G.show_mouth_mask_box = False
    G.opacity = state.get("opacity", 1.0)
    G.sharpness = state.get("sharpness", 0.0)
    if state.get("video_encoder"):
        G.video_encoder = state["video_encoder"]
    if state.get("video_quality") is not None:
        G.video_quality = state["video_quality"]


# ─── helpers ─────────────────────────────────────────────────────────────


def _frame_processors_from_fp_ui() -> List[str]:
    """Translate fp_ui toggles to a frame-processor pipeline list."""
    procs = ["face_swapper"]
    for key in ("face_enhancer", "face_enhancer_gpen256", "face_enhancer_gpen512"):
        if G.fp_ui.get(key, False):
            procs.append(key)
    return procs


def _enhancer_choice() -> str:
    if G.fp_ui.get("face_enhancer", False):
        return "GFPGAN"
    if G.fp_ui.get("face_enhancer_gpen512", False):
        return "GPEN-512"
    if G.fp_ui.get("face_enhancer_gpen256", False):
        return "GPEN-256"
    return "None"


def _set_enhancer_choice(value: str) -> None:
    key_map = {
        "None": None,
        "GFPGAN": "face_enhancer",
        "GPEN-512": "face_enhancer_gpen512",
        "GPEN-256": "face_enhancer_gpen256",
    }
    for key in ("face_enhancer", "face_enhancer_gpen256", "face_enhancer_gpen512"):
        G.fp_ui[key] = False
    selected = key_map.get(value)
    if selected:
        G.fp_ui[selected] = True
    G.frame_processors = _frame_processors_from_fp_ui()


def _list_cameras() -> List[Dict[str, Any]]:
    if platform.system() == "Windows":
        try:
            from pygrabber.dshow_graph import FilterGraph
            graph = FilterGraph()
            names = graph.get_input_devices()
        except Exception:
            names = []
        return [{"index": i, "name": n} for i, n in enumerate(names)] \
            or [{"index": 0, "name": "No cameras found", "disabled": True}]

    if platform.system() == "Darwin":
        return [{"index": 0, "name": "Camera 0"}, {"index": 1, "name": "Camera 1"}]

    # Linux: probe 0-9
    found: List[Dict[str, Any]] = []
    for i in range(10):
        cap = cv2.VideoCapture(i)
        if cap.isOpened():
            found.append({"index": i, "name": f"Camera {i}"})
            cap.release()
    return found or [{"index": 0, "name": "No cameras found", "disabled": True}]


def _encode_jpeg(bgr: np.ndarray, quality: int = 85) -> bytes:
    ok, buf = cv2.imencode(".jpg", bgr, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    if not ok:
        return b""
    return buf.tobytes()


def _fit(bgr: np.ndarray, max_w: int, max_h: int) -> np.ndarray:
    h, w = bgr.shape[:2]
    ratio = min(max_w / w, max_h / h, 1.0)
    if ratio >= 1.0:
        return bgr
    new = (max(1, int(w * ratio)), max(1, int(h * ratio)))
    return cv2.resize(bgr, new, interpolation=cv2.INTER_AREA)


# ─── live preview workers (mirrors PySide6 implementation) ───────────────


class _LiveSession:
    """Captures from a webcam, runs the swap pipeline, exposes JPEG frames."""

    def __init__(self, camera_index: int):
        self.camera_index = camera_index
        self.cap = VideoCapturer(camera_index)
        ok = self.cap.start(960, 540, 60)
        if not ok:
            raise RuntimeError("Failed to open camera")
        self.actual_fps = self.cap.actual_fps or 30.0
        self._stop = threading.Event()
        self._raw_q: queue.Queue = queue.Queue(maxsize=2)
        self._out_q: queue.Queue = queue.Queue(maxsize=2)
        self._latest_jpeg: bytes = b""
        self._latest_lock = threading.Lock()
        self._listeners: List[threading.Event] = []

        self._t_capture = threading.Thread(target=self._run_capture,
                                           daemon=True, name="dlc-capture")
        self._t_process = threading.Thread(target=self._run_process,
                                           daemon=True, name="dlc-process")
        self._t_encode = threading.Thread(target=self._run_encode,
                                          daemon=True, name="dlc-encode")
        self._t_capture.start()
        self._t_process.start()
        self._t_encode.start()

    # ── thread loops ──────────────────────────────────────────────────

    def _run_capture(self) -> None:
        while not self._stop.is_set():
            ret, frame = self.cap.read()
            if not ret or frame is None:
                self._stop.set()
                break
            self._push(self._raw_q, frame)

    def _run_process(self) -> None:
        frame_processors = get_frame_processors_modules(G.frame_processors or ["face_swapper"])
        source_image = None
        last_source_path = None
        prev_time = time.time()
        fps_update_interval = 0.5
        frame_count = 0
        fps = 0.0
        det_count = 0
        cached_target_face = None
        cached_many_faces = None
        det_interval = max(1, round(self.actual_fps * 0.08))

        while not self._stop.is_set():
            try:
                frame = self._raw_q.get(timeout=0.05)
            except queue.Empty:
                continue

            temp_frame = frame
            if G.live_mirror:
                temp_frame = gpu_flip(temp_frame, 1)

            if not G.map_faces:
                if G.source_path and G.source_path != last_source_path:
                    last_source_path = G.source_path
                    source_image = get_one_face(cv2.imread(G.source_path))

                det_count += 1
                if det_count % det_interval == 0:
                    if G.many_faces:
                        cached_target_face = None
                        cached_many_faces = detect_many_faces_fast(temp_frame)
                    else:
                        cached_target_face = detect_one_face_fast(temp_frame)
                        cached_many_faces = None

                cached_faces = None
                if cached_many_faces:
                    cached_faces = cached_many_faces
                elif cached_target_face is not None:
                    cached_faces = [cached_target_face]

                for fp in frame_processors:
                    if fp.NAME == "DLC.FACE-ENHANCER":
                        if G.fp_ui.get("face_enhancer", False):
                            temp_frame = fp.process_frame(None, temp_frame,
                                                          detected_faces=cached_faces)
                    elif fp.NAME == "DLC.FACE-ENHANCER-GPEN256":
                        if G.fp_ui.get("face_enhancer_gpen256", False):
                            temp_frame = fp.process_frame(None, temp_frame,
                                                          detected_faces=cached_faces)
                    elif fp.NAME == "DLC.FACE-ENHANCER-GPEN512":
                        if G.fp_ui.get("face_enhancer_gpen512", False):
                            temp_frame = fp.process_frame(None, temp_frame,
                                                          detected_faces=cached_faces)
                    elif fp.NAME == "DLC.FACE-SWAPPER":
                        swapped_bboxes = []
                        if G.many_faces and cached_many_faces:
                            result = temp_frame.copy()
                            for t_face in cached_many_faces:
                                result = fp.swap_face(source_image, t_face, result)
                                if hasattr(t_face, "bbox") and t_face.bbox is not None:
                                    swapped_bboxes.append(t_face.bbox.astype(int))
                            temp_frame = result
                        elif cached_target_face is not None and source_image is not None:
                            temp_frame = fp.swap_face(source_image,
                                                      cached_target_face, temp_frame)
                            if (hasattr(cached_target_face, "bbox")
                                    and cached_target_face.bbox is not None):
                                swapped_bboxes.append(cached_target_face.bbox.astype(int))
                        temp_frame = fp.apply_post_processing(temp_frame, swapped_bboxes)
                    else:
                        temp_frame = fp.process_frame(source_image, temp_frame)
            else:
                G.target_path = None
                for fp in frame_processors:
                    if fp.NAME == "DLC.FACE-ENHANCER":
                        if G.fp_ui.get("face_enhancer", False):
                            temp_frame = fp.process_frame_v2(temp_frame)
                    elif fp.NAME in ("DLC.FACE-ENHANCER-GPEN256", "DLC.FACE-ENHANCER-GPEN512"):
                        fp_key = fp.NAME.split(".")[-1].lower().replace("-", "_")
                        if G.fp_ui.get(fp_key, False):
                            temp_frame = fp.process_frame_v2(temp_frame)
                    else:
                        temp_frame = fp.process_frame_v2(temp_frame)

            current_time = time.time()
            frame_count += 1
            if current_time - prev_time >= fps_update_interval:
                fps = frame_count / (current_time - prev_time)
                frame_count = 0
                prev_time = current_time

            if G.show_fps:
                cv2.putText(temp_frame, f"FPS: {fps:.1f}", (10, 30),
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

            self._push(self._out_q, temp_frame)

    def _run_encode(self) -> None:
        while not self._stop.is_set():
            try:
                frame = self._out_q.get(timeout=0.1)
            except queue.Empty:
                continue
            frame = _fit(frame, 1280, 720)
            buf = _encode_jpeg(frame, quality=80)
            if not buf:
                continue
            with self._latest_lock:
                self._latest_jpeg = buf
            for ev in list(self._listeners):
                ev.set()

    # ── public API ────────────────────────────────────────────────────

    @staticmethod
    def _push(q: queue.Queue, frame) -> None:
        try:
            q.put_nowait(frame)
        except queue.Full:
            try:
                q.get_nowait()
            except queue.Empty:
                pass
            try:
                q.put_nowait(frame)
            except queue.Full:
                pass

    def latest_jpeg(self) -> bytes:
        with self._latest_lock:
            return self._latest_jpeg

    def wait_for_frame(self, timeout: float = 1.0) -> bytes:
        ev = threading.Event()
        self._listeners.append(ev)
        try:
            if not self.latest_jpeg():
                ev.wait(timeout=timeout)
            return self.latest_jpeg()
        finally:
            try:
                self._listeners.remove(ev)
            except ValueError:
                pass

    def stop(self) -> None:
        self._stop.set()
        try:
            self.cap.release()
        except Exception:
            pass


# ─── server state container ──────────────────────────────────────────────


class Server:
    def __init__(self):
        self.executor = ThreadPoolExecutor(max_workers=2,
                                           thread_name_prefix="dlc-job")
        self.live: Optional[_LiveSession] = None
        self.live_lock = threading.Lock()
        self.processing = False
        self.processing_lock = threading.Lock()
        self.ws_clients: List[web.WebSocketResponse] = []
        self.loop: Optional[asyncio.AbstractEventLoop] = None
        self.cameras = _list_cameras()
        self.providers = engine.suggest_execution_providers()

    # ── status routing ────────────────────────────────────────────────

    def install_status_sink(self) -> None:
        backend_ui_shim.set_status_sink(self._on_status)

    def _on_status(self, text: str) -> None:
        print(f"[STATUS] {text}", flush=True)
        if self.loop is None:
            return
        asyncio.run_coroutine_threadsafe(
            self._broadcast({"event": "status", "text": text}),
            self.loop,
        )

    async def _broadcast(self, message: Dict[str, Any]) -> None:
        data = json.dumps(message)
        stale: List[web.WebSocketResponse] = []
        for ws in list(self.ws_clients):
            if ws.closed:
                stale.append(ws)
                continue
            try:
                await ws.send_str(data)
            except ConnectionResetError:
                stale.append(ws)
            except Exception:
                stale.append(ws)
        for ws in stale:
            if ws in self.ws_clients:
                self.ws_clients.remove(ws)


SRV = Server()


# ─── RPC method registry ─────────────────────────────────────────────────


RPC: Dict[str, Callable[..., Any]] = {}


def rpc(name: str):
    def deco(fn):
        RPC[name] = fn
        return fn
    return deco


def _state_dict() -> Dict[str, Any]:
    return {
        "name": META.name,
        "version": META.version,
        "edition": META.edition,
        "source_path": G.source_path,
        "target_path": G.target_path,
        "output_path": G.output_path,
        "keep_fps": G.keep_fps,
        "keep_audio": G.keep_audio,
        "keep_frames": G.keep_frames,
        "many_faces": G.many_faces,
        "map_faces": G.map_faces,
        "poisson_blend": G.poisson_blend,
        "color_correction": G.color_correction,
        "nsfw_filter": G.nsfw_filter,
        "live_mirror": G.live_mirror,
        "live_resizable": G.live_resizable,
        "show_fps": G.show_fps,
        "mouth_mask": G.mouth_mask,
        "show_mouth_mask_box": G.show_mouth_mask_box,
        "mouth_mask_size": G.mouth_mask_size,
        "opacity": G.opacity,
        "sharpness": G.sharpness,
        "video_encoder": G.video_encoder or "libx264",
        "video_quality": G.video_quality if G.video_quality is not None else 18,
        "enable_interpolation": G.enable_interpolation,
        "interpolation_weight": G.interpolation_weight,
        "fp_ui": G.fp_ui,
        "enhancer": _enhancer_choice(),
        "execution_providers": engine.encode_execution_providers(G.execution_providers),
        "available_providers": SRV.providers,
        "execution_threads": G.execution_threads,
        "max_memory": G.max_memory,
        "cameras": SRV.cameras,
        "processing": SRV.processing,
        "live_running": SRV.live is not None,
        "is_target_image": is_image(G.target_path) if G.target_path else False,
        "is_target_video": is_video(G.target_path) if G.target_path else False,
        "runtime_paths": {
            "backend_root": ROOT_DIR,
            "app_data_dir": APP_DATA_DIR,
            "models_dir": MODELS_DIR,
            "outputs_dir": OUTPUTS_DIR,
            "cache_dir": CACHE_DIR,
        },
    }


@rpc("get_state")
async def _get_state() -> Dict[str, Any]:
    return _state_dict()


@rpc("get_runtime_paths")
async def _get_runtime_paths() -> Dict[str, str]:
    return {
        "backend_root": ROOT_DIR,
        "app_data_dir": APP_DATA_DIR,
        "models_dir": MODELS_DIR,
        "outputs_dir": OUTPUTS_DIR,
        "cache_dir": CACHE_DIR,
        "uploads_dir": UPLOADS_DIR,
        "switch_state_path": SWITCH_STATE_PATH,
        "model_manifest": model_manager.manifest_path() or "",
        "ffmpeg": shutil.which("ffmpeg") or "",
        "ffprobe": shutil.which("ffprobe") or "",
    }


@rpc("model_status")
async def _model_status(verify: bool = False) -> Dict[str, Any]:
    return model_manager.status(verify=verify)


@rpc("download_models")
async def _download_models(
    ids: Optional[List[str]] = None,
    required_only: bool = False,
) -> Dict[str, Any]:
    def emit(payload: Dict[str, Any]) -> None:
        if SRV.loop is not None:
            phase = payload.get("event")
            event_payload = {k: v for k, v in payload.items() if k != "event"}
            asyncio.run_coroutine_threadsafe(
                SRV._broadcast({
                    "event": "model_download",
                    "phase": phase,
                    **event_payload,
                }),
                SRV.loop,
            )

    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        SRV.executor,
        lambda: model_manager.ensure_models(ids, required_only, callback=emit),
    )


_BOOL_FIELDS = {
    "keep_fps", "keep_audio", "keep_frames", "many_faces", "map_faces",
    "poisson_blend", "color_correction", "nsfw_filter", "live_mirror",
    "live_resizable", "show_fps", "mouth_mask", "show_mouth_mask_box",
    "enable_interpolation",
}
_FLOAT_FIELDS = {"opacity", "sharpness", "mouth_mask_size", "interpolation_weight"}
_INT_FIELDS = {"video_quality", "execution_threads", "max_memory"}
_STR_FIELDS = {"video_encoder"}


@rpc("set_state")
async def _set_state(patch: Dict[str, Any]) -> Dict[str, Any]:
    for key, value in patch.items():
        if key in _BOOL_FIELDS:
            setattr(G, key, bool(value))
        elif key in _FLOAT_FIELDS:
            setattr(G, key, float(value))
        elif key in _INT_FIELDS:
            setattr(G, key, int(value) if value is not None else None)
        elif key in _STR_FIELDS:
            setattr(G, key, str(value) if value is not None else None)
        elif key == "enhancer":
            _set_enhancer_choice(str(value))
        elif key == "execution_providers":
            G.execution_providers = engine.decode_execution_providers(list(value))
        elif key == "fp_ui":
            G.fp_ui.update(value)

    # Mouth mask derived flag
    if "mouth_mask_size" in patch:
        G.mouth_mask = G.mouth_mask_size > 0
        if G.mouth_mask_size <= 0:
            G.show_mouth_mask_box = False

    save_switch_states()
    return _state_dict()


@rpc("set_source_path")
async def _set_source_path(path: Optional[str]) -> Dict[str, Any]:
    if path and not is_image(path):
        return {"ok": False, "error": "Not an image"}
    G.source_path = path or None
    G.output_path = None
    return {"ok": True, "state": _state_dict()}


@rpc("set_target_path")
async def _set_target_path(path: Optional[str]) -> Dict[str, Any]:
    if path and not (is_image(path) or is_video(path)):
        return {"ok": False, "error": "Not an image or video"}
    G.target_path = path or None
    G.output_path = None
    return {"ok": True, "state": _state_dict()}


@rpc("set_output_path")
async def _set_output_path(path: Optional[str]) -> Dict[str, Any]:
    G.output_path = path or None
    return {"ok": True, "state": _state_dict()}


@rpc("save_output_as")
async def _save_output_as(path: str) -> Dict[str, Any]:
    src = _current_output_file()
    if not src:
        return {"ok": False, "error": "No generated output to save"}
    if not path:
        return {"ok": False, "error": "No save path selected"}
    dest = os.path.abspath(os.path.expanduser(path))
    parent = os.path.dirname(dest)
    if parent:
        os.makedirs(parent, exist_ok=True)
    if os.path.abspath(src) != dest:
        shutil.copy2(src, dest)
    G.output_path = dest
    return {"ok": True, "path": dest, "state": _state_dict()}


@rpc("reveal_output")
async def _reveal_output() -> Dict[str, Any]:
    path = _current_output_file()
    if not path:
        return {"ok": False, "error": "No generated output to show"}
    try:
        system = platform.system()
        if system == "Darwin":
            subprocess.Popen(["open", "-R", path])
        elif system == "Windows":
            subprocess.Popen(["explorer", f"/select,{path}"])
        else:
            subprocess.Popen(["xdg-open", os.path.dirname(path)])
        return {"ok": True}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


@rpc("swap_paths")
async def _swap_paths() -> Dict[str, Any]:
    sp, tp = G.source_path, G.target_path
    if not (sp and tp and is_image(sp) and is_image(tp)):
        return {"ok": False, "error": "Both source and target must be images"}
    G.source_path, G.target_path = tp, sp
    G.output_path = None
    return {"ok": True, "state": _state_dict()}


@rpc("random_face")
async def _random_face() -> Dict[str, Any]:
    import urllib.request
    try:
        req = urllib.request.Request(
            "https://thispersondoesnotexist.com/",
            headers={"User-Agent": "Mozilla/5.0"},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            content = resp.read()
        os.makedirs(UPLOADS_DIR, exist_ok=True)
        temp_path = os.path.join(UPLOADS_DIR, "deep_live_cam_random_face.jpg")
        with open(temp_path, "wb") as f:
            f.write(content)
        G.source_path = temp_path
        G.output_path = None
        return {"ok": True, "path": temp_path, "state": _state_dict()}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


@rpc("list_cameras")
async def _list_cameras_rpc() -> List[Dict[str, Any]]:
    SRV.cameras = _list_cameras()
    return SRV.cameras


@rpc("video_frame_count")
async def _video_frame_count(path: Optional[str] = None) -> int:
    p = path or G.target_path
    if not (p and is_video(p)):
        return 0
    return get_video_frame_total(p)


# ─── start (image / video processing) ────────────────────────────────────


def _check_nsfw_path(path: str) -> bool:
    if not G.nsfw_filter:
        return False
    try:
        from modules.predicter import predict_image, predict_video
        check = predict_image if has_image_extension(path) else predict_video
        return bool(check(path))
    except Exception as exc:
        print(f"[backend] NSFW check failed: {exc}")
        return False


def _run_engine_start() -> None:
    """Blocking — runs in a worker thread."""
    try:
        G.frame_processors = _frame_processors_from_fp_ui()
        if G.execution_threads is None:
            G.execution_threads = engine.suggest_execution_threads()
        if G.max_memory is None:
            G.max_memory = engine.suggest_max_memory()
        if not G.execution_providers:
            G.execution_providers = engine.decode_execution_providers(
                [engine.suggest_default_execution_provider()]
            )
        engine.limit_resources()
        engine.start()
    except Exception as exc:
        backend_ui_shim.update_status(f"Processing failed: {exc}")
        traceback.print_exc()
    finally:
        with SRV.processing_lock:
            SRV.processing = False
        if SRV.loop is not None:
            asyncio.run_coroutine_threadsafe(
                SRV._broadcast({"event": "processing_done"}),
                SRV.loop,
            )


@rpc("start")
async def _start(auto_output: bool = False) -> Dict[str, Any]:
    if not G.source_path or not G.target_path:
        return {"ok": False, "error": "Select source and target first"}
    if auto_output or not G.output_path:
        G.output_path = _default_output_path()
    with SRV.processing_lock:
        if SRV.processing:
            return {"ok": False, "error": "Already processing"}
        SRV.processing = True
    SRV.executor.submit(_run_engine_start)
    return {"ok": True, "output_path": G.output_path, "state": _state_dict()}


@rpc("destroy")
async def _destroy() -> Dict[str, Any]:
    # Stop live and any temp cleanup, but do NOT call sys.exit (that
    # would kill the server). The front-end can quit its own window.
    await _stop_live()
    try:
        engine.destroy(to_quit=False)
    except Exception:
        pass
    return {"ok": True}


# ─── single-frame preview (image or scrubbed video frame) ────────────────


_preview_lock = threading.Lock()
_preview_jpeg: bytes = b""


def _render_preview_frame(frame_number: int = 0) -> bytes:
    if not (G.source_path and G.target_path):
        return b""
    G.frame_processors = _frame_processors_from_fp_ui()
    try:
        if is_image(G.target_path):
            temp_frame = cv2.imread(G.target_path)
        else:
            temp_frame = get_video_frame(G.target_path, frame_number)
        if temp_frame is None:
            return b""
        if G.nsfw_filter:
            from modules.predicter import predict_frame
            if predict_frame(temp_frame):
                return b""
        for fp in get_frame_processors_modules(G.frame_processors):
            temp_frame = fp.process_frame(
                get_one_face(cv2.imread(G.source_path)), temp_frame
            )
        temp_frame = _fit(temp_frame, 1280, 720)
        return _encode_jpeg(temp_frame, quality=90)
    except Exception as exc:
        traceback.print_exc()
        backend_ui_shim.update_status(f"Preview failed: {exc}")
        return b""


@rpc("preview_frame")
async def _preview_frame(frame_number: int = 0) -> Dict[str, Any]:
    loop = asyncio.get_running_loop()
    jpeg = await loop.run_in_executor(
        SRV.executor, _render_preview_frame, int(frame_number)
    )
    if not jpeg:
        return {"ok": False, "error": "Preview unavailable"}
    with _preview_lock:
        global _preview_jpeg
        _preview_jpeg = jpeg
    return {"ok": True, "size": len(jpeg)}


# ─── live preview ────────────────────────────────────────────────────────


async def _stop_live() -> Dict[str, Any]:
    with SRV.live_lock:
        if SRV.live is not None:
            SRV.live.stop()
            SRV.live = None
    return {"ok": True}


@rpc("start_live")
async def _start_live(camera_index: int = 0) -> Dict[str, Any]:
    # In non-map_faces mode, require a source image.
    if not G.map_faces and not G.source_path:
        return {"ok": False, "error": "Please select a source image first"}
    await _stop_live()
    try:
        loop = asyncio.get_running_loop()
        sess = await loop.run_in_executor(
            SRV.executor, _LiveSession, int(camera_index)
        )
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
    with SRV.live_lock:
        SRV.live = sess
    return {"ok": True}


@rpc("stop_live")
async def _stop_live_rpc() -> Dict[str, Any]:
    return await _stop_live()


# ─── mapping (image/video unique faces + live source/target pairs) ───────


def _map_thumb_b64(entry_kind_obj: Dict[str, Any]) -> Optional[str]:
    cv2_img = entry_kind_obj.get("cv2")
    if cv2_img is None or not isinstance(cv2_img, np.ndarray) or cv2_img.size == 0:
        return None
    cv2_img = _fit(cv2_img, 160, 160)
    buf = _encode_jpeg(cv2_img, quality=85)
    if not buf:
        return None
    return "data:image/jpeg;base64," + base64.b64encode(buf).decode("ascii")


def _serialize_map() -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for item in G.source_target_map:
        out.append({
            "id": item["id"],
            "source": _map_thumb_b64(item["source"]) if "source" in item else None,
            "target": _map_thumb_b64(item["target"]) if "target" in item else None,
        })
    return out


@rpc("mapping_extract")
async def _mapping_extract() -> Dict[str, Any]:
    """Detect unique faces in the current target (image or video)."""
    if not G.target_path:
        return {"ok": False, "error": "No target selected"}
    loop = asyncio.get_running_loop()

    def _do() -> None:
        G.source_target_map = []
        if is_image(G.target_path):
            get_unique_faces_from_target_image()
        elif is_video(G.target_path):
            get_unique_faces_from_target_video()

    try:
        await loop.run_in_executor(SRV.executor, _do)
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
    return {"ok": True, "map": _serialize_map()}


@rpc("mapping_set_source")
async def _mapping_set_source(row: int, path: str) -> Dict[str, Any]:
    if not is_image(path):
        return {"ok": False, "error": "Not an image"}
    cv2_img = cv2.imread(path)
    if cv2_img is None:
        return {"ok": False, "error": "Could not read image"}
    face = get_one_face(cv2_img)
    if face is None:
        return {"ok": False, "error": "Face could not be detected"}
    x_min, y_min, x_max, y_max = face["bbox"]
    for item in G.source_target_map:
        if item["id"] == row:
            item["source"] = {
                "cv2": cv2_img[int(y_min):int(y_max), int(x_min):int(x_max)],
                "face": face,
            }
            return {"ok": True, "map": _serialize_map()}
    return {"ok": False, "error": "row not found"}


@rpc("mapping_set_target")
async def _mapping_set_target(row: int, path: str) -> Dict[str, Any]:
    if not is_image(path):
        return {"ok": False, "error": "Not an image"}
    cv2_img = cv2.imread(path)
    if cv2_img is None:
        return {"ok": False, "error": "Could not read image"}
    face = get_one_face(cv2_img)
    if face is None:
        return {"ok": False, "error": "Face could not be detected"}
    x_min, y_min, x_max, y_max = face["bbox"]
    for item in G.source_target_map:
        if item["id"] == row:
            item["target"] = {
                "cv2": cv2_img[int(y_min):int(y_max), int(x_min):int(x_max)],
                "face": face,
            }
            return {"ok": True, "map": _serialize_map()}
    return {"ok": False, "error": "row not found"}


@rpc("mapping_add")
async def _mapping_add() -> Dict[str, Any]:
    add_blank_map()
    return {"ok": True, "map": _serialize_map()}


@rpc("mapping_clear")
async def _mapping_clear() -> Dict[str, Any]:
    for item in G.source_target_map:
        item.pop("source", None)
        item.pop("target", None)
    return {"ok": True, "map": _serialize_map()}


@rpc("mapping_reset")
async def _mapping_reset() -> Dict[str, Any]:
    G.source_target_map = []
    return {"ok": True, "map": []}


@rpc("mapping_get")
async def _mapping_get() -> Dict[str, Any]:
    return {"ok": True, "map": _serialize_map()}


@rpc("mapping_valid")
async def _mapping_valid() -> bool:
    return has_valid_map()


@rpc("mapping_simplify")
async def _mapping_simplify() -> Dict[str, Any]:
    if not has_valid_map():
        return {"ok": False, "error": "At least 1 source with target is required"}
    simplify_maps()
    return {"ok": True}


# ─── HTTP routes ─────────────────────────────────────────────────────────


async def health(request: web.Request) -> web.Response:  # noqa: ARG001
    return web.json_response({"ok": True, "name": META.name, "version": META.version})


_UPLOAD_DIR = UPLOADS_DIR
os.makedirs(_UPLOAD_DIR, exist_ok=True)


async def upload(request: web.Request) -> web.Response:
    """Accept a multipart upload from the browser and return a real path
    that the engine can read. Used when the UI runs in plain browser
    mode (no Tauri native dialog)."""
    reader = await request.multipart()
    saved: Optional[str] = None
    async for field in reader:
        if field.name != "file":
            continue
        filename = field.filename or "upload.bin"
        # Strip any directory components from the client-provided name
        filename = os.path.basename(filename).replace("\x00", "")
        if not filename:
            filename = "upload.bin"
        # Make it unique-ish
        ts = int(time.time() * 1000)
        target = os.path.join(_UPLOAD_DIR, f"{ts}_{filename}")
        with open(target, "wb") as f:
            while True:
                chunk = await field.read_chunk(64 * 1024)
                if not chunk:
                    break
                f.write(chunk)
        saved = target
        break
    if not saved:
        return web.json_response({"ok": False, "error": "no file"}, status=400)
    return web.json_response({"ok": True, "path": saved})


async def preview_jpg(request: web.Request) -> web.Response:  # noqa: ARG001
    with _preview_lock:
        data = _preview_jpeg
    if not data:
        return web.Response(status=404, text="no preview")
    return web.Response(body=data, content_type="image/jpeg",
                        headers={"Cache-Control": "no-store"})


async def thumb(request: web.Request) -> web.Response:
    path = request.query.get("path")
    if not path or not os.path.isfile(path):
        return web.Response(status=404, text="not found")
    img = cv2.imread(path)
    if img is None:
        return web.Response(status=415, text="cannot decode")
    size = int(request.query.get("size", 240))
    img = _fit(img, size, size)
    data = _encode_jpeg(img, quality=85)
    return web.Response(body=data, content_type="image/jpeg",
                        headers={"Cache-Control": "no-store"})


async def video_thumb(request: web.Request) -> web.Response:
    path = request.query.get("path")
    if not path or not os.path.isfile(path):
        return web.Response(status=404, text="not found")
    frame_number = int(request.query.get("frame", 0))
    frame = get_video_frame(path, frame_number)
    if frame is None:
        return web.Response(status=415, text="cannot decode")
    size = int(request.query.get("size", 240))
    frame = _fit(frame, size, size)
    data = _encode_jpeg(frame, quality=85)
    return web.Response(body=data, content_type="image/jpeg",
                        headers={"Cache-Control": "no-store"})


async def media_file(request: web.Request) -> web.StreamResponse:
    path = request.query.get("path")
    if not path or not os.path.isfile(path):
        return web.Response(status=404, text="not found")
    return web.FileResponse(path, headers={"Cache-Control": "no-store"})


async def preview_mjpeg(request: web.Request) -> web.StreamResponse:
    boundary = "frame"
    response = web.StreamResponse(
        status=200,
        reason="OK",
        headers={
            "Content-Type": f"multipart/x-mixed-replace; boundary={boundary}",
            "Cache-Control": "no-store",
            "Pragma": "no-cache",
        },
    )
    await response.prepare(request)

    last_sent: bytes = b""
    while True:
        if SRV.live is None:
            await asyncio.sleep(0.05)
            if request.transport is None or request.transport.is_closing():
                break
            continue
        sess = SRV.live
        loop = asyncio.get_running_loop()
        jpeg = await loop.run_in_executor(SRV.executor, sess.wait_for_frame, 0.5)
        if not jpeg or jpeg == last_sent:
            await asyncio.sleep(0.005)
            continue
        last_sent = jpeg
        try:
            await response.write(
                b"--" + boundary.encode() + b"\r\n"
                b"Content-Type: image/jpeg\r\n"
                b"Content-Length: " + str(len(jpeg)).encode() + b"\r\n\r\n"
                + jpeg + b"\r\n"
            )
        except (ConnectionResetError, asyncio.CancelledError):
            break
    return response


async def ws_handler(request: web.Request) -> web.WebSocketResponse:
    ws = web.WebSocketResponse(max_msg_size=16 * 1024 * 1024)
    await ws.prepare(request)
    SRV.ws_clients.append(ws)
    try:
        # send hello with current state
        await ws.send_json({"event": "hello", "state": _state_dict()})
        async for msg in ws:
            if msg.type == WSMsgType.TEXT:
                try:
                    req = json.loads(msg.data)
                except json.JSONDecodeError:
                    continue
                await _handle_rpc(ws, req)
            elif msg.type == WSMsgType.ERROR:
                break
    finally:
        if ws in SRV.ws_clients:
            SRV.ws_clients.remove(ws)
    return ws


async def _handle_rpc(ws: web.WebSocketResponse, req: Dict[str, Any]) -> None:
    rid = req.get("id")
    method = req.get("method", "")
    params = req.get("params") or {}
    handler = RPC.get(method)
    if handler is None:
        await ws.send_json({"id": rid, "error": f"unknown method: {method}"})
        return
    try:
        if isinstance(params, dict):
            result = await handler(**params)
        elif isinstance(params, list):
            result = await handler(*params)
        else:
            result = await handler(params)
        await ws.send_json({"id": rid, "result": result})
    except TypeError as exc:
        await ws.send_json({"id": rid, "error": f"bad params: {exc}"})
    except Exception as exc:
        traceback.print_exc()
        await ws.send_json({"id": rid, "error": str(exc)})


# ─── bootstrap ───────────────────────────────────────────────────────────


@web.middleware
async def cors_middleware(request: web.Request, handler):
    if request.method == "OPTIONS":
        resp = web.Response(status=204)
    else:
        resp = await handler(request)
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return resp


def build_app() -> web.Application:
    app = web.Application(middlewares=[cors_middleware])
    app.router.add_get("/health", health)
    app.router.add_post("/upload", upload)
    app.router.add_get("/preview.jpg", preview_jpg)
    app.router.add_get("/preview.mjpeg", preview_mjpeg)
    app.router.add_get("/thumb", thumb)
    app.router.add_get("/video_thumb", video_thumb)
    app.router.add_get("/media", media_file)
    app.router.add_get("/rpc", ws_handler)
    return app


def _pre_check_engine() -> None:
    """Report required model status without downloading silently."""
    try:
        result = model_manager.status(verify=False)
        missing = result.get("missing_required") or []
        if missing:
            print(f"[backend] required models missing: {missing}", flush=True)
    except Exception as exc:
        print(f"[backend] model pre_check failed: {exc}")


async def _main_async(host: str, port: int) -> None:
    ensure_runtime_dirs()
    load_switch_states()
    if not G.frame_processors:
        G.frame_processors = _frame_processors_from_fp_ui()
    if G.video_encoder is None:
        G.video_encoder = "libx264"
    if G.video_quality is None:
        G.video_quality = 18
    if not G.execution_providers:
        forced = os.environ.get("DEEPFACECAM_PROVIDER")
        if forced:
            G.execution_providers = engine.decode_execution_providers(
                [p.strip() for p in forced.split(",") if p.strip()]
            )
        else:
            G.execution_providers = engine.decode_execution_providers(
                [engine.suggest_default_execution_provider()]
            )
    if G.execution_threads is None:
        G.execution_threads = engine.suggest_execution_threads()
    print(f"[backend_server] execution_providers={G.execution_providers}",
          flush=True)

    SRV.install_status_sink()
    SRV.loop = asyncio.get_running_loop()

    runner = web.AppRunner(build_app())
    await runner.setup()
    site = web.TCPSite(runner, host=host, port=port)
    await site.start()

    addrs = ", ".join(str(s.name) for s in runner.sites)
    print(f"[backend_server] ready on {addrs}", flush=True)
    print(f"[backend_server] PORT={port}", flush=True)

    # Background: report model status. The UI prompts before downloading.
    asyncio.get_running_loop().run_in_executor(SRV.executor, _pre_check_engine)

    stop = asyncio.Event()
    try:
        await stop.wait()
    finally:
        await runner.cleanup()


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=8765)
    args = p.parse_args()
    try:
        asyncio.run(_main_async(args.host, args.port))
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
