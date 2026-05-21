# Packaging Notes

DeepFaceCam separates three things that should not be bundled together:

- UI shell: React + Tauri.
- Backend source: packaged as a small read-only resource at `generated/backend`.
- Runtime data: models, outputs, uploads, cache, and preferences in the OS app data directory.

This follows the desktop rule that the installed app bundle or `Program Files`
directory must be treated as read-only.

## Backend Resource

Run:

```bash
npm run prepare:backend
```

The script copies `backend/` into `src-tauri/generated/backend` and excludes:

- `.venv`
- model binaries
- outputs
- caches
- tests
- Python bytecode

It copies `models/manifest.json` into the generated backend so a packaged app
can still download and verify models.

## Model Downloads

Models are stored outside the app bundle:

- macOS: Tauri app data directory, usually under `~/Library/Application Support/<bundle-id>/models`
- Windows: Tauri app data directory under the user's app data location

For development or CI, run:

```bash
npm run models:download
```

To download into a specific cache:

```bash
python3 scripts/download_models.py --required-only --models-dir /path/to/models
python3 scripts/download_models.py --all --models-dir /path/to/models
```

The packaged backend does not download models silently. On startup the UI calls
`model_status`; if required models are missing, it shows a blocking first-run
prompt with the target folder, estimated download size, and an explicit
"Download Required Models" action. Downloads then run through `download_models`
with progress events.

## macOS Sidecar

Prepare a clean packaging Python environment:

```bash
npm run packaging:python:macos
```

Build the standalone macOS backend first:

```bash
npm run sidecar:macos
```

This creates a PyInstaller onedir backend at:

```text
src-tauri/generated/macos/backend-sidecar/deepfacecam-backend
```

The sidecar includes the Python runtime and backend dependencies, but not model
binaries. The Tauri shell checks for this bundled sidecar first and falls back
to a source-tree Python backend only for development.

Then build the macOS app:

```bash
npm run tauri:build -- --bundles app
```

For a release DMG:

```bash
npm run tauri:build:macos
```

This uses a local `hdiutil` DMG step after the Tauri `.app` build. It avoids
Finder AppleScript decoration because that step can time out in automation.

Current macOS notes:

- The GitHub workflow builds two separate DMGs:
  - Apple Silicon on the `macos-15` arm64 runner.
  - Intel on the `macos-15-intel` x64 runner.
- Local sidecar builds use the current Mac architecture.
- Python, backend dependencies, `ffmpeg`, and `ffprobe` are bundled in the sidecar.
- Models stay in the app data directory and are downloaded only after the first-run prompt.
- Developer ID signing and notarization still need to be wired before public distribution.

macOS acceleration notes:

- Apple Silicon builds use ONNX Runtime's CoreML provider, not PyTorch MPS.
- CoreML is configured to let the system use CPU, GPU, and Neural Engine where
  supported.
- Intel builds use the CPU provider by default unless a compatible accelerated
  provider is added later.
- The backend chooses the best available provider at startup in this order:
  CUDA, ROCm, CoreML, DirectML, CPU.

## GitHub macOS Packaging

Run the manual `Package macOS` workflow from GitHub Actions. It creates clean
Python 3.11 packaging environments on Apple Silicon and Intel runners, builds
the PyInstaller backend sidecar for each architecture, bundles the Tauri `.app`,
creates unsigned DMGs, writes `SHA256SUMS.txt`, and uploads both artifacts.

The artifacts are for internal testing until Developer ID signing and
notarization are configured. They are not uploaded to a public GitHub Release.

## Windows Sidecar

Windows builds are split by runtime variant:

```bash
npm run packaging:python:windows:cpu
npm run packaging:python:windows:directml
npm run packaging:python:windows:cuda
```

Build the active sidecar variant with:

```bash
DEEPFACECAM_WINDOWS_VARIANT=cpu npm run sidecar:windows
DEEPFACECAM_WINDOWS_VARIANT=directml npm run sidecar:windows
DEEPFACECAM_WINDOWS_VARIANT=cuda npm run sidecar:windows
```

Each variant writes the bundled backend to:

```text
src-tauri/generated/windows/backend-sidecar/deepfacecam-backend
```

Then build the Windows installers:

```bash
DEEPFACECAM_WINDOWS_VARIANT=cpu npm run tauri:build:windows
```

The sidecar includes Python, backend dependencies, `ffmpeg.exe`, and
`ffprobe.exe`, but not model binaries.

## GitHub Windows Packaging

Run the manual `Package Windows` workflow from GitHub Actions. It builds three
unsigned x64 installer artifacts:

- CPU: maximum compatibility.
- DirectML: broad Windows GPU support.
- NVIDIA CUDA: NVIDIA-specific runtime package.

GitHub-hosted Windows runners can verify packaging only. CUDA performance and
RTX 40/50 compatibility need self-hosted Windows GPU machines.

## Current Bundle Status

`npm run tauri:build -- --bundles app` builds a macOS `.app` with the clean
backend resource, the macOS backend sidecar, and no model binaries.

The GitHub macOS workflow now builds Apple Silicon and Intel DMGs. The GitHub
Windows workflow prepares CPU, DirectML, and NVIDIA CUDA installer variants.

## Installer-Time Download

Windows installers can run custom download logic more naturally than macOS DMG.
For macOS, a first-run model setup screen is usually the more reliable path.
For both OSes, keep the same destination: the Tauri app data `models` directory.
