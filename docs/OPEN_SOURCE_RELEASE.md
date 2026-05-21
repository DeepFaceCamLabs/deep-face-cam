# Open Source Release Checklist

Use this checklist before the first public GitHub release and before each
installer release.

## Repository

- [ ] Confirm the repository owner and public repo name.
- [ ] Confirm `package.json` description, license, and version.
- [ ] Confirm `src-tauri/tauri.conf.json` identifier, product name, and version.
- [ ] Update `CHANGELOG.md`.
- [ ] Run `npm run open-source:check`.
- [ ] Run `npm run build`.
- [ ] Run backend smoke test.
- [ ] Confirm no model binaries, generated outputs, or signing secrets are
      tracked.
- [ ] Confirm `README.md`, `NOTICE.md`, `MODEL_LICENSES.md`, `SECURITY.md`,
      and `CONTRIBUTING.md` are current.

## Models

- [ ] Required models are listed in `models/manifest.json`.
- [ ] SHA-256 hashes are verified.
- [ ] Redistribution rights are reviewed before mirroring any model.
- [ ] First-run model download prompt is tested with an empty model directory.

## macOS Build

- [ ] Build `.app` and `.dmg`.
- [ ] Verify bundled Python sidecar starts on a clean machine.
- [ ] Verify bundled `ffmpeg` and `ffprobe` are used.
- [ ] Verify image swap.
- [ ] Verify video swap.
- [ ] Sign with Developer ID.
- [ ] Notarize and staple.
- [ ] Run `npm run release:checksums`.

## Windows Build

- [ ] Build Windows CPU sidecar and installer.
- [ ] Build Windows DirectML sidecar and installer.
- [ ] Build Windows NVIDIA CUDA sidecar and installer.
- [ ] Bundle Python runtime and ffmpeg/ffprobe.
- [ ] Code sign installer and binaries.
- [ ] Verify image swap on a clean Windows machine.
- [ ] Verify video swap on a clean Windows machine.
- [ ] Verify CUDA variant on physical RTX 40/50 test machines.
- [ ] Run `npm run release:checksums`.

## Website and Supporter Download

- [ ] Update website version and changelog.
- [ ] Upload installer assets to the paid download channel.
- [ ] Paste checksums and source tag into the Buy Me a Coffee product notes.
- [ ] Verify Buy Me a Coffee checkout and download flow.
- [ ] Publish source tag.
- [ ] Publish website.
