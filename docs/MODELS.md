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
purpose, expected size, SHA-256 hash, and upstream URL. The app should verify
downloaded files before loading them.

## Required Models

- `inswapper_128.onnx`
- `buffalo_l.zip`, extracted into the InsightFace model cache layout

## Optional Models

- `inswapper_128_fp16.onnx`
- `gfpgan-1024.onnx`
- `GPEN-BFR-256.onnx`
- `GPEN-BFR-512.onnx`

## Redistribution

Do not mirror model files until the upstream license and redistribution terms
are reviewed. When terms are unclear, link to the upstream source and let the app
download from that source with user confirmation and checksum verification.
