# Notices and Attribution

Deep Face Cam includes a Python backend derived from
[hacksider/Deep-Live-Cam](https://github.com/hacksider/Deep-Live-Cam).

Deep-Live-Cam is licensed under the GNU Affero General Public License v3.0. A
copy of that license is included at [LICENSE](./LICENSE) and
[backend/LICENSE](./backend/LICENSE).

## Upstream Project

- Project: Deep-Live-Cam
- Repository: https://github.com/hacksider/Deep-Live-Cam
- License: GNU Affero General Public License v3.0
- Upstream authors and contributors: see the upstream repository history and
  notices.

## Local Modifications

This repository reorganizes and extends the upstream codebase for a desktop app
distribution. Material changes include:

- Added a React + TypeScript user interface.
- Added a Tauri 2 desktop shell for macOS and Windows packaging.
- Moved the Python backend into `./backend` so this directory can function as an
  independent repository.
- Added `modules/backend_server.py`, an aiohttp JSON-RPC and HTTP wrapper for
  the backend engine.
- Added `modules/backend_ui_shim.py` so the backend can run headlessly without
  the original Qt UI.
- Added frontend workflows for file mode, live mode, preview, generated output,
  save-as, and native file dialogs.
- Added packaging scripts, smoke tests, and model manifest metadata.

## Model Weights

Model weights are not authored by this project. They are large binary artifacts
with their own upstream licenses, distribution terms, and usage restrictions.
See [MODEL_LICENSES.md](./MODEL_LICENSES.md) and
[models/manifest.json](./models/manifest.json).

Generated cache files such as `*_coreml.onnx` are local optimization artifacts
and should not be treated as upstream source files.
