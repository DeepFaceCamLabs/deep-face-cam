# Contributing

Thanks for helping improve Deep Face Cam. This project is a desktop app with a
React/Tauri interface and a bundled Python face-swap backend.

## Ground Rules

- Follow the responsible-use policy in [docs/RESPONSIBLE_USE.md](./docs/RESPONSIBLE_USE.md).
- Do not submit features intended for impersonation, fraud, harassment, or
non-consensual intimate imagery.
- Do not commit model weights, generated CoreML caches, build outputs, local
settings, or user media.
- Keep backend changes compatible with the AGPL-3.0 license inherited from
Deep-Live-Cam.

## Development Setup

Install frontend dependencies:

```bash
npm install
```

Run the app in development:

```bash
npm run dev:all
```

Run the frontend build check:

```bash
npm run build
```

Run the lightweight backend smoke test:

```bash
python3 -m pip install aiohttp opencv-python-headless numpy
python3 scripts/smoke_test.py ./backend
```

## Pull Requests

Before opening a pull request:

1. Run `npm run build`.
2. Run `npm run open-source:check`.
3. If you touched backend RPC behavior, run `python3 scripts/smoke_test.py ./backend`.
4. If you touched packaging, update [docs/packaging.md](./docs/packaging.md).
5. If you changed model handling, update [models/manifest.json](./models/manifest.json)
   and [MODEL_LICENSES.md](./MODEL_LICENSES.md).

## Packaging Changes

Packaging changes must assume the end user has no Python, Node, Rust, ffmpeg,
ffprobe, or model files installed. Installers should bundle the runtime tools
that are required to start the app, then prompt before downloading model files
into the per-user app data directory.
