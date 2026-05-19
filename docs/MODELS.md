# Model Handling

Model binaries are not source code for this repository and should not be
committed to git.

## Runtime Location

Downloaded models belong in the per-user app data directory, not inside the
signed app bundle:

- macOS: `~/Library/Application Support/net.deeplivecam.deepfacecam/models`
- Windows: `%APPDATA%/net.deeplivecam.deepfacecam/models`

## Manifest

[models/manifest.json](../models/manifest.json) records the model id, filename,
purpose, expected size, SHA-256 hash, GitHub release download URL, and upstream
source page. The app verifies downloaded files before loading them.

The project model mirror is published separately from source releases:

- `https://github.com/DeepFaceCamLabs/deep-face-cam/releases/tag/models-v1`

## Required Models

- `inswapper_128.onnx`
- `buffalo_l.zip`, extracted into the InsightFace model cache layout

## Optional Models

- `inswapper_128_fp16.onnx`
- `gfpgan-1024.onnx`
- `GPEN-BFR-256.onnx`
- `GPEN-BFR-512.onnx`

## Redistribution

Do not commit model binaries into git. If model binaries are mirrored through
GitHub Releases, keep the upstream source link and checksum in
[models/manifest.json](../models/manifest.json), and keep the download flow
visible to the user.
