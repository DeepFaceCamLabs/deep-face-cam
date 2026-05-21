# Distribution Plan

The project has two separate distribution surfaces:

- Source code: public GitHub repository under AGPL-3.0.
- Convenience installers: supporter downloads through Buy Me a Coffee or a
  separate download service.

AGPL software may be distributed for a fee, but recipients must have access to
the corresponding source code and license terms. The paid item should be
positioned as a convenience build and project support, not as exclusive access
to the software itself.

## Source Repository

Publish the source repository with:

- `LICENSE`, `NOTICE.md`, `MODEL_LICENSES.md`
- `README.md`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `.github/` issue and pull request templates
- `models/manifest.json`
- build and packaging documentation

Do not commit:

- `node_modules/`
- `dist/`
- `build/`
- `src-tauri/target/`
- `src-tauri/generated/`
- `backend/models/*.onnx`
- `backend/models/*.zip`
- `backend/models/insightface/models/`
- `backend/outputs/`
- local `.env` files or signing credentials

## Supporter Installers

For each public release, prepare:

- macOS Apple Silicon `.dmg`
- macOS Intel `.dmg`
- Windows x64 installer
- SHA-256 checksums
- changelog
- source tag URL
- model download notes
- signing/notarization status

Generate checksums after building installers:

```bash
npm run release:checksums
```

For an internal macOS test build, run the manual GitHub Actions workflow named
`Package macOS`. It uploads unsigned Apple Silicon and Intel DMGs plus
`SHA256SUMS.txt` files as workflow artifacts. Treat those artifacts as test
builds until Developer ID signing and notarization are enabled.

The public website should link the source repository separately from the
supporter download page.

See [BUY_ME_A_COFFEE.md](./BUY_ME_A_COFFEE.md) for shop copy and release-note
templates.

## Signing

macOS production builds should be Developer ID signed and notarized. Windows
production builds should be code signed to reduce SmartScreen friction.

Never commit certificates, private keys, provisioning profiles, app-specific
passwords, or notarization credentials.
