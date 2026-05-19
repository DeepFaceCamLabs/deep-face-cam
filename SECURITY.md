# Security and Responsible Disclosure

Deep Face Cam runs local Python, native desktop, video, and model-loading code.
Treat model files and project dependencies as executable supply-chain inputs.

## Reporting Issues

If you discover a security issue, do not publish exploit details first. Open a
private security advisory in the GitHub repository, or contact the project
maintainer through the security contact listed on the repository profile.

## Model Safety

- Download model files only from trusted sources.
- Verify SHA-256 hashes from `models/manifest.json` before loading models.
- Do not load user-supplied model files without review.
- Avoid pickle-based model formats in production when an ONNX equivalent is
  available.

## Responsible Use

This project can be used to alter faces in media and live video. Do not use it
for impersonation, fraud, harassment, non-consensual intimate imagery, or other
harmful activity.
