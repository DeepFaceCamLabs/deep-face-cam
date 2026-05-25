# Deep Face Cam Models v1

This release mirrors the runtime model files referenced by
`models/manifest.json`.

Public mirror:

- `https://pub-8c0ddfa5c0454d40822bc9944fe6f303.r2.dev/deep-face-cam/models/v1/`

## Assets

- `inswapper_128.onnx`
- `inswapper_128_fp16.onnx`
- `gfpgan-1024.onnx`
- `GPEN-BFR-256.onnx`
- `GPEN-BFR-512.onnx`
- `buffalo_l.zip`

Generated cache files such as `*_coreml.onnx` are not published here.

## Verification

The app verifies file size and SHA-256 from `models/manifest.json` after
download and before using the model.

## Sources

The model sources and redistribution notes are documented in
`MODEL_LICENSES.md` and `docs/MODELS.md`.
