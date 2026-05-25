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
purpose, expected size, SHA-256 hash, R2 mirror download URL, and upstream
source page. The app verifies downloaded files before loading them.

The project model mirror is published separately from source releases on
Cloudflare R2:

- `https://pub-8c0ddfa5c0454d40822bc9944fe6f303.r2.dev/deep-face-cam/models/v1/`

The downloader also supports overriding the model mirror with
`DEEPFACECAM_MODEL_BASE_URL`.

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
R2 or another object storage provider, keep the upstream source link and checksum in
[models/manifest.json](../models/manifest.json), and keep the download flow
visible to the user.
