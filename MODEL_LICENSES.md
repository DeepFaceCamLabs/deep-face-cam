# Model Licenses and Sources

This repository does not commit model weights. Model files are downloaded or
placed in the local runtime model cache and are governed by their own upstream
licenses and terms.

Before publishing model files through Cloudflare R2 or any other mirror,
verify that each upstream license permits redistribution and preserve the
required attribution and notices.

## Runtime Model Set

| Model | Purpose | Local filename | Upstream source |
| --- | --- | --- | --- |
| InSwapper 128 | Face identity swap | `inswapper_128.onnx` | https://huggingface.co/hacksider/deep-live-cam |
| InSwapper 128 FP16 | Optional CUDA-oriented swap model | `inswapper_128_fp16.onnx` | https://huggingface.co/hacksider/deep-live-cam |
| GFPGAN ONNX | Optional face enhancement | `gfpgan-1024.onnx` | https://huggingface.co/hacksider/deep-live-cam |
| GPEN BFR 256 | Optional face enhancement | `GPEN-BFR-256.onnx` | https://huggingface.co/hacksider/deep-live-cam |
| GPEN BFR 512 | Optional face enhancement | `GPEN-BFR-512.onnx` | https://huggingface.co/hacksider/deep-live-cam |
| InsightFace Buffalo-L | Face detection, landmarks, recognition | `buffalo_l.zip` / `buffalo_l/` | InsightFace model download cache |

## Distribution Guidance

- Do not commit model binaries into git.
- Prefer a dedicated model hosting location for large files.
- The current app manifest downloads from the project model mirror at
  `https://pub-8c0ddfa5c0454d40822bc9944fe6f303.r2.dev/deep-face-cam/models/v1/`.
- Keep a machine-readable manifest with file names, sizes, SHA-256 hashes, and
  upstream URLs.
- Verify SHA-256 after download before loading a model.
- Keep generated cache files, including `*_coreml.onnx`, out of source control.
- If a model license is unclear, link users to the original source instead of
  mirroring the file yourself.

## Local Verification

The currently downloaded local model metadata is recorded in
[models/manifest.json](./models/manifest.json). Treat it as implementation
metadata, not a legal determination that redistribution is allowed.
