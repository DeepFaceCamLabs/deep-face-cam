# Buy Me a Coffee Setup

Use Buy Me a Coffee as a supporter download channel for convenience installers.
The application source remains open under AGPL-3.0.

## Positioning

Do not describe the paid download as exclusive ownership of the software.
Describe it as:

- a ready-to-run convenience installer
- support for packaging, signing, notarization, testing, and maintenance
- a way to fund continued open-source development

Users who receive the installer still receive the AGPL license rights and should
be able to find the matching source code.

## Suggested Shop Products

### Deep Face Cam for macOS

Short description:

```text
Signed macOS convenience build for Deep Face Cam, with bundled Python backend
and ffmpeg tools. Model files download after an explicit in-app prompt.
```

Included files:

- `DeepFaceCam_<version>_aarch64.dmg`
- `SHA256SUMS.txt`
- link to source tag
- release notes

Buyer note:

```text
Thank you for supporting Deep Face Cam. This installer is a convenience build
of the open-source project. Source code, license, model notes, and release
checksums are linked in the release notes.
```

### Deep Face Cam for Windows

Short description:

```text
Windows x64 convenience installers for Deep Face Cam, with bundled backend
runtime and ffmpeg tools. Choose CPU, DirectML, or NVIDIA CUDA. Model files
download after an explicit in-app prompt.
```

Included files:

- Windows CPU installer
- Windows DirectML installer
- Windows NVIDIA CUDA installer
- `SHA256SUMS.txt`
- link to source tag
- release notes

### Supporter Bundle

Short description:

```text
Support ongoing development and get all current convenience installers in one
download package.
```

## Release Notes Template

```text
Deep Face Cam vX.Y.Z

Source:
https://github.com/DeepFaceCamLabs/deep-face-cam/releases/tag/vX.Y.Z

Downloads:
- macOS Apple Silicon: DeepFaceCam_X.Y.Z_aarch64.dmg
- macOS Intel: DeepFaceCam_X.Y.Z_x64.dmg
- Windows CPU x64: planned / included
- Windows DirectML x64: planned / included
- Windows NVIDIA CUDA x64: planned / included

Checksums:
PASTE_SHA256SUMS

Model notes:
Required models are not bundled into the source repository. The app will prompt
before downloading models into the user app data directory and verify SHA-256
hashes before use.

Responsible use:
Use only with consent and in compliance with applicable law. Do not use for
impersonation, fraud, harassment, or non-consensual intimate imagery.
```

## Operational Checklist

- [ ] Confirm the source tag is public.
- [ ] Upload installer files.
- [ ] Upload or paste checksums.
- [ ] Link the source tag.
- [ ] Link responsible-use and privacy pages.
- [ ] Test checkout with a small purchase or preview flow.
- [ ] Verify the buyer receives the correct file and notes.
- [ ] Update the website download buttons.

## Avoid

- Do not put private direct download links in the public website repository.
- Do not promise model redistribution unless model licenses allow it.
- Do not imply users lose open-source rights because they bought an installer.
- Do not upload signing credentials or notarization logs.
