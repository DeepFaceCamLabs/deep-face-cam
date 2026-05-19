#!/usr/bin/env python3
"""Download and verify model files from models/manifest.json.

This is intentionally stdlib-only so it can run in CI or installer hooks
before the full ML Python environment exists.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Any, Dict


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "ids",
        nargs="*",
        help="Specific model ids to download. Defaults to required models.",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Download every model in the manifest.",
    )
    parser.add_argument(
        "--required-only",
        action="store_true",
        help="Download only models marked required.",
    )
    parser.add_argument(
        "--backend-dir",
        default=str(Path(__file__).resolve().parents[1] / "backend"),
        help="Backend directory containing the modules package.",
    )
    parser.add_argument(
        "--manifest",
        default=str(Path(__file__).resolve().parents[1] / "models" / "manifest.json"),
        help="Path to model manifest JSON.",
    )
    parser.add_argument(
        "--models-dir",
        default=None,
        help="Destination model cache directory.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    backend_dir = Path(args.backend_dir).resolve()
    if not (backend_dir / "modules" / "model_manager.py").exists():
        print(f"Backend modules not found: {backend_dir}", file=sys.stderr)
        return 2

    os.environ["DEEPFACECAM_MODEL_MANIFEST"] = str(Path(args.manifest).resolve())
    if args.models_dir:
        os.environ["DEEPFACECAM_MODELS_DIR"] = str(Path(args.models_dir).resolve())

    sys.path.insert(0, str(backend_dir))
    from modules import model_manager

    last_pct: Dict[str, int] = {}

    def progress(payload: Dict[str, Any]) -> None:
        event = payload.get("event")
        model_id = payload.get("id", "unknown")
        if event == "model_download_progress":
            total = int(payload.get("total") or 0)
            current = int(payload.get("bytes") or 0)
            if total <= 0:
                return
            pct = int((current / total) * 100)
            if pct // 5 == last_pct.get(model_id):
                return
            last_pct[model_id] = pct // 5
            print(f"{model_id}: {pct}%")
        elif event:
            print(f"{model_id}: {event}")

    required_only = args.required_only or (not args.all and not args.ids)
    ids = args.ids or None
    result = model_manager.ensure_models(
        model_ids=ids,
        required_only=required_only,
        callback=progress,
    )
    for item in result["results"]:
        if item.get("ok"):
            action = "skipped" if item.get("skipped") else "ready"
            print(f"{item.get('id')}: {action} -> {item.get('path')}")
        else:
            print(f"{item.get('id')}: ERROR {item.get('error')}", file=sys.stderr)
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
