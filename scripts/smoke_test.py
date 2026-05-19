#!/usr/bin/env python3
"""Quick end-to-end smoke test of the JSON-RPC + HTTP server.

Stubs out the heavy ML modules (insightface / onnxruntime / tensorflow /
tqdm / etc.) so that the WebSocket and HTTP plumbing can be exercised
on a machine that doesn't have the full requirements.txt installed.

Run from anywhere:

    python scripts/smoke_test.py ./backend

It will:
  * start backend_server on port 8766
  * open a websocket, fetch state, toggle some options
  * GET /health
  * print a pass/fail report
"""

from __future__ import annotations

import argparse
import asyncio
import importlib
import json
import os
import sys
import time
import types
from pathlib import Path


def install_stubs() -> None:
    """Inject lightweight modules so backend_server can import."""

    def stub(name: str, **attrs):
        m = types.ModuleType(name)
        for k, v in attrs.items():
            setattr(m, k, v)
        sys.modules[name] = m
        return m

    # --- insightface ----------------------------------------------------
    insightface = stub("insightface")
    insightface.app = stub("insightface.app")

    class FakeFace:
        def __init__(self, bbox=None, kps=None, det_score=0.9):
            self.bbox = bbox if bbox is not None else [0, 0, 1, 1]
            self.kps = kps
            self.det_score = det_score
            self.normed_embedding = [0.0] * 512

        def __getitem__(self, k):
            return getattr(self, k)

    insightface.app.common = stub("insightface.app.common", Face=FakeFace)

    class FakeFaceAnalysis:
        def __init__(self, *a, **kw):
            self.det_model = types.SimpleNamespace(
                model_file=None,
                detect=lambda frame, max_num=0, metric="default": ([], []),
            )

        def prepare(self, *a, **kw):
            pass

    insightface.app.FaceAnalysis = FakeFaceAnalysis

    # --- onnxruntime ----------------------------------------------------
    ort = stub("onnxruntime")
    ort.get_available_providers = lambda: ["CPUExecutionProvider"]
    ort.SessionOptions = lambda: types.SimpleNamespace(
        graph_optimization_level=None
    )
    ort.GraphOptimizationLevel = types.SimpleNamespace(ORT_ENABLE_ALL=1)
    ort.InferenceSession = lambda *a, **kw: types.SimpleNamespace(
        run=lambda *a, **kw: []
    )

    # --- tqdm -----------------------------------------------------------
    stub("tqdm", tqdm=lambda x, **kw: x)

    # --- tensorflow (optional) ------------------------------------------
    # Already optional in core.py via try/except, but stub anyway.
    sys.modules.setdefault("tensorflow", types.ModuleType("tensorflow"))

    # --- opennsfw2 (predicter uses it) ---------------------------------
    nsfw = stub("opennsfw2")
    nsfw.predict_image = lambda path: 0.0
    nsfw.predict_video_frames = lambda path: ([], [])

    # --- pygrabber.dshow_graph (Windows only) --------------------------
    pg = stub("pygrabber")
    pg.dshow_graph = stub("pygrabber.dshow_graph",
                          FilterGraph=lambda: types.SimpleNamespace(
                              get_input_devices=lambda: []
                          ))


async def main_async(repo_root: Path, port: int) -> int:
    install_stubs()

    sys.path.insert(0, str(repo_root))
    os.chdir(repo_root)

    # Stub modules.predicter so NSFW imports don't blow up
    pred = types.ModuleType("modules.predicter")
    pred.predict_image = lambda *a, **kw: False
    pred.predict_video = lambda *a, **kw: False
    pred.predict_frame = lambda *a, **kw: False
    sys.modules["modules.predicter"] = pred

    # Stub modules.processors.frame.core
    fpc = types.ModuleType("modules.processors.frame.core")
    fpc.get_frame_processors_modules = lambda names=None: []
    fpc.process_video_in_memory = lambda *a, **kw: False
    sys.modules["modules.processors.frame.core"] = fpc

    # Stub modules.processors.frame._onnx_enhancer (used by face_analyser)
    enh = types.ModuleType("modules.processors.frame._onnx_enhancer")
    enh.build_provider_config = lambda: ["CPUExecutionProvider"]
    sys.modules["modules.processors.frame._onnx_enhancer"] = enh

    # Stub modules.onnx_optimize
    oo = types.ModuleType("modules.onnx_optimize")
    oo.IS_APPLE_SILICON = False
    oo.optimize_for_coreml = lambda path, **kw: path
    sys.modules["modules.onnx_optimize"] = oo

    # Stub modules.gpu_processing
    gpu = types.ModuleType("modules.gpu_processing")
    import cv2
    gpu.gpu_resize = lambda img, dsize: cv2.resize(img, dsize)
    gpu.gpu_cvt_color = lambda img, code: cv2.cvtColor(img, code)
    gpu.gpu_flip = lambda img, code: cv2.flip(img, code)
    sys.modules["modules.gpu_processing"] = gpu

    # Now import the backend server
    bs = importlib.import_module("modules.backend_server")

    runner_task = asyncio.create_task(bs._main_async("127.0.0.1", port))

    # Wait for server to start
    await asyncio.sleep(1.0)

    # WebSocket roundtrip + HTTP /health, all via aiohttp so we don't
    # block the shared event loop.
    import asyncio as aio
    try:
        from aiohttp import ClientSession
    except ImportError:
        print("[smoke] aiohttp client missing")
        return 1

    async with ClientSession() as cs:
        async with cs.get(f"http://127.0.0.1:{port}/health") as h:
            health_body = await h.json()
            assert health_body.get("ok") is True, f"bad health: {health_body}"
            print("[smoke] /health OK:", health_body)
        async with cs.ws_connect(f"ws://127.0.0.1:{port}/rpc") as ws:
            msg = await ws.receive_json()
            assert msg.get("event") == "hello", f"expected hello: {msg}"
            print("[smoke] hello state keys:",
                  sorted(list(msg["state"].keys()))[:8], "...")

            await ws.send_json({"id": 1, "method": "get_state"})
            r = await ws.receive_json()
            assert "result" in r and r["result"]["name"], r
            print("[smoke] get_state OK")

            await ws.send_json({
                "id": 2, "method": "set_state",
                "params": {"patch": {"many_faces": True, "opacity": 0.42}},
            })
            r = await ws.receive_json()
            s = r["result"]
            assert s["many_faces"] is True
            assert abs(s["opacity"] - 0.42) < 1e-6
            print("[smoke] set_state OK: many_faces=True opacity=0.42")

            await ws.send_json({
                "id": 3, "method": "swap_paths"
            })
            r = await ws.receive_json()
            assert r["result"]["ok"] is False  # no source/target yet
            print("[smoke] swap_paths denied as expected")

            await ws.send_json({"id": 4, "method": "list_cameras"})
            r = await ws.receive_json()
            print("[smoke] cameras:", r["result"])

            await ws.send_json({"id": 5, "method": "mapping_get"})
            r = await ws.receive_json()
            assert r["result"]["ok"] is True
            print("[smoke] mapping_get OK")

    print("[smoke] ALL CHECKS PASSED")
    runner_task.cancel()
    try:
        await runner_task
    except aio.CancelledError:
        pass
    return 0


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("repo_root", nargs="?",
                   default=str(Path(__file__).resolve().parent.parent / "backend"))
    p.add_argument("--port", type=int, default=8766)
    args = p.parse_args()
    root = Path(args.repo_root).expanduser().resolve()
    if not (root / "modules" / "backend_server.py").exists():
        print(f"backend_server.py not found under {root}", file=sys.stderr)
        return 2
    t0 = time.time()
    rc = asyncio.run(main_async(root, args.port))
    print(f"[smoke] elapsed: {time.time() - t0:.1f}s")
    return rc


if __name__ == "__main__":
    sys.exit(main())
