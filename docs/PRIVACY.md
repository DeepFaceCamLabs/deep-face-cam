# Privacy

Deep Face Cam is designed as a local desktop app.

## Local Processing

Images, videos, and camera frames are processed by the local backend sidecar on
the user's machine. The app does not need to upload user media to a cloud
service for the core face-swap workflow.

## Network Access

The app may access the network for:

- Downloading required model files after the user confirms the prompt.
- Opening project, documentation, donation, or release links.
- Future update checks, if an update channel is added.

## Runtime Data

Runtime data should be stored in the per-user app data directory:

- macOS: `~/Library/Application Support/net.deeplivecam.deepfacecam/`
- Windows: `%APPDATA%/net.deeplivecam.deepfacecam/`

This includes model files, generated output, temporary files, and local settings.
Installers should not write long-lived user data into the signed application
bundle.

## Telemetry

No telemetry is currently required for the open-source app. If telemetry is
added later, it should be opt-in, documented, and easy to disable.
