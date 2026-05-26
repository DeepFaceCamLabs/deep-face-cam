# GitHub Setup

This project is intended to publish source code separately from the public
website and supporter installer downloads.

## Account and Organization

Recommended setup:

1. Create a new GitHub account that is not your personal identity.
2. Enable two-factor authentication.
3. Create a GitHub organization owned by that account.
4. Publish repositories under the organization.
5. Add your personal account as an organization member only if you are
   comfortable with that association being visible.

This keeps the project brand separate from your personal GitHub profile.

## Repositories

Create two repositories:

- `DeepFaceCamLabs/deep-face-cam`: application source code.
- `DeepFaceCamLabs/deep-face-cam-site`: website and download landing page.

The source repository should be public. The website repository is private for
now, because installer download and Buy Me a Coffee flow details may be staged
there before publication.

## Source Repository Settings

Enable:

- Issues
- Discussions, optional
- Security advisories
- Dependabot alerts
- GitHub Actions

Recommended branch protection for `main`:

- Require pull request before merging.
- Require status checks to pass.
- Require conversation resolution.
- Block force pushes.

Replace placeholders before publishing:

- `.github/FUNDING.yml`: set the Buy Me a Coffee handle.
- `README.md`: add the real website URL when known.

## Website Repository Settings

For GitHub Pages:

1. Open repository settings.
2. Go to Pages.
3. Choose GitHub Actions as the source.
4. Add a custom domain when ready.

The website should link to:

- Source repository
- Buy Me a Coffee supporter download page
- Checksums and changelog for each release
- Responsible-use and privacy policy pages

Do not put private installer URLs or expiring signed URLs into the public
website source.

## Secrets

Never commit signing credentials. Put secrets only in GitHub Actions secrets or
your release machine keychain.

Likely future secrets:

- Apple Developer ID certificate material
- Apple notarization credentials
- Windows code-signing certificate material
- Buy Me a Coffee webhook secret, if you later automate downloads
- CDN storage credentials, if installer files are served outside Buy Me a Coffee

## Local GitHub CLI Profile

Use the dedicated GitHub CLI config directory for this project:

```bash
export GH_CONFIG_DIR=/Users/zeroone/.config/gh-deepfacecam
```

This profile is logged in as `ITTutorial` and has admin access to the
`DeepFaceCamLabs` repositories. The token is managed by GitHub CLI and the local
keyring; do not copy tokens into this repository.

Common checks:

```bash
GH_CONFIG_DIR=/Users/zeroone/.config/gh-deepfacecam gh auth status -h github.com
GH_CONFIG_DIR=/Users/zeroone/.config/gh-deepfacecam gh repo view DeepFaceCamLabs/deep-face-cam --json viewerPermission
```

Use this profile when pushing release changes or triggering packaging workflows:

```bash
GH_CONFIG_DIR=/Users/zeroone/.config/gh-deepfacecam gh workflow run package-macos.yml --repo DeepFaceCamLabs/deep-face-cam --ref main -f retention-days=14
GH_CONFIG_DIR=/Users/zeroone/.config/gh-deepfacecam gh workflow run package-windows.yml --repo DeepFaceCamLabs/deep-face-cam --ref main -f retention-days=14
```

## Release Flow

1. Update version in `package.json` and `src-tauri/tauri.conf.json`.
2. Run `npm run open-source:check`.
3. Build macOS and Windows installers.
4. Test on clean machines.
5. Sign and notarize.
6. Generate SHA-256 checksums.
7. Upload installers to the supporter download channel.
8. Tag the source release.
9. Update the website.
