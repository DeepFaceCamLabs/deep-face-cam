# Deep Face Cam

Deep Face Cam is a cross-platform desktop face-swap application built with
React, TypeScript, TailwindCSS, Tauri 2, and a bundled Python backend derived
from Deep-Live-Cam.

Official website: <https://deepface.cam/>

The desktop shell owns the native window and file dialogs. The React UI talks to
the local Python sidecar over WebSocket JSON-RPC and HTTP preview routes.

## License

This repository is licensed under the GNU Affero General Public License v3.0.
See [LICENSE](./LICENSE).

The Python backend includes code derived from
[hacksider/Deep-Live-Cam](https://github.com/hacksider/Deep-Live-Cam), which is
licensed under AGPL-3.0. See [NOTICE.md](./NOTICE.md) for attribution and
modification notes.

Model weights are not source code for this repository and are governed by their
own upstream licenses and terms. See [MODEL_LICENSES.md](./MODEL_LICENSES.md)
and [models/manifest.json](./models/manifest.json).

## Responsible Use

This software can alter faces in images, video, and live camera feeds. Use it
only with consent and in compliance with applicable law. Do not use it for
impersonation, fraud, harassment, non-consensual intimate imagery, or any other
harmful or deceptive activity.

See [docs/RESPONSIBLE_USE.md](./docs/RESPONSIBLE_USE.md) and
[docs/PRIVACY.md](./docs/PRIVACY.md).

## Downloads

The source code is open under AGPL-3.0. Convenience installers may be published
through a supporter download channel such as Buy Me a Coffee. Paid installer
downloads are a way to support packaging, signing, and maintenance; users still
receive the same license rights and can build from source.

Public release assets should include checksums, a changelog, and a link to the
matching source tag. See [docs/DISTRIBUTION.md](./docs/DISTRIBUTION.md).

Source repository: <https://github.com/DeepFaceCamLabs/deep-face-cam>

## Architecture

```text
┌─────────────────────────────────────┐
│ Tauri 2 shell (Rust)                │
│ ┌─────────────────────────────────┐ │
│ │ React + TypeScript UI           │ │
│ └──────────────┬──────────────────┘ │
└────────────────┼────────────────────┘
                 │ WebSocket /rpc + HTTP previews
                 ▼
┌─────────────────────────────────────┐
│ ./backend Python sidecar            │
│ modules/backend_server.py           │
│ modules/core.py                     │
│ modules/processors / face_analyser  │
└─────────────────────────────────────┘
```

Important paths:

- `src/` - React UI.
- `src-tauri/` - Tauri shell and Python sidecar launcher.
- `backend/` - Python face-swap engine and JSON-RPC server.
- `backend/modules/backend_server.py` - aiohttp WebSocket/HTTP wrapper around
  the backend engine.
- `backend/modules/backend_ui_shim.py` - headless replacement for the original
  UI module used by the backend.
- `models/manifest.json` - publishable metadata for model downloads.
- `backend/models/` - local runtime model cache. Large model files are ignored
  by git.

## Runtime Models

Large model files are intentionally not committed to git. During local
development they may live under `backend/models/`. Packaged apps should download
models into the per-user app data directory after an explicit user prompt, then
verify them with the SHA-256 values in [models/manifest.json](./models/manifest.json).

Current model groups:

- Face swapping: `inswapper_128.onnx`, optional `inswapper_128_fp16.onnx`.
- Face analysis: InsightFace `buffalo_l`.
- Optional enhancement: `gfpgan-1024.onnx`, `GPEN-BFR-256.onnx`,
  `GPEN-BFR-512.onnx`.

Generated CoreML cache files such as `*_coreml.onnx` are platform-specific
runtime artifacts and should not be distributed as source assets.

See [docs/MODELS.md](./docs/MODELS.md) and
[MODEL_LICENSES.md](./MODEL_LICENSES.md).

## Prerequisites

1. Python 3.10 or newer with the backend dependencies installed.

   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. Node.js 20 or newer.
3. Rust, for Tauri desktop builds. Install from <https://rustup.rs/>.

## Quick Start

Install frontend dependencies:

```bash
npm install
```

Run the web development stack:

```bash
npm run dev:all
# UI:      http://localhost:1420
# Engine:  ws://127.0.0.1:8765/rpc
```

Run the native Tauri development app:

```bash
npm run tauri:dev
```

Build desktop bundles:

```bash
npm run tauri:build
```

Build outputs are written under `src-tauri/target/release/bundle/`.

Build the macOS sidecar, `.app`, and `.dmg`:

```bash
npm run tauri:build:macos
```

Build a Windows installer variant on Windows:

```powershell
$env:DEEPFACECAM_WINDOWS_VARIANT = "cpu"      # cpu, directml, or cuda
npm run tauri:build:windows
```

## Backend Only

Start the Python sidecar directly:

```bash
cd backend
python -m modules.backend_server --port 8765
```

The UI defaults to `ws://127.0.0.1:8765`. To override the connection in local
development, create `.env.local`:

```env
VITE_BACKEND_HOST=127.0.0.1
VITE_BACKEND_PORT=8765
```

## Smoke Test

The smoke test stubs heavy ML imports and verifies the RPC/HTTP plumbing:

```bash
python scripts/smoke_test.py ./backend
```

Expected result:

```text
[smoke] /health OK
[smoke] get_state OK
[smoke] set_state OK
[smoke] swap_paths denied as expected
[smoke] mapping_get OK
[smoke] ALL CHECKS PASSED
```

## Packaging Notes

Production builds should assume the end user has no Python, Node, Rust, ffmpeg,
ffprobe, or model files installed. The packaging path builds a PyInstaller
Python sidecar and bundles `ffmpeg`/`ffprobe` into the app resources. macOS is
split into Apple Silicon and Intel DMGs; Windows is split into CPU, DirectML,
and NVIDIA CUDA x64 installers.

For production model handling, prefer downloading models into the app data
directory:

- macOS: `~/Library/Application Support/net.deeplivecam.deepfacecam/models`
- Windows: `%APPDATA%/net.deeplivecam.deepfacecam/models`
- Linux: `$XDG_DATA_HOME/net.deeplivecam.deepfacecam/models`

Avoid writing long-lived model files into the signed application bundle.

Before publishing source, run:

```bash
npm run open-source:check
```

After building release installers, generate checksums:

```bash
npm run release:checksums
```

See [docs/OPEN_SOURCE_RELEASE.md](./docs/OPEN_SOURCE_RELEASE.md) for the full
release checklist.
