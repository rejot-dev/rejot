# Release Process

To create a new release and publish packages (NPM, Python, Docker images), follow these steps:

## 1. Bump Versions

Use the version bump script to update all package versions (NPM and Python):

```sh
bun run scripts/version-bump.ts <patch|minor|major>
```

- Replace `<patch|minor|major>` with the type of version bump you want.
- This updates all publishable package.json files and the Python version.

## 2. Commit Changes

```sh
git add .
git commit -m "chore: bump versions for release"
```

## 3. Create a Git Tag

Create a tag in the format `vX.Y.Z` (e.g., `v1.2.3`). This is required to trigger the publish
workflows.

```sh
git tag vX.Y.Z
git push origin main --tags
```

- Replace `X.Y.Z` with the new version number.

## 4. Publishing

Pushing the tag will automatically trigger the following GitHub Actions workflows:

- **NPM packages:** `.github/workflows/npm.yml` (publishes all public packages)
- **Python package:** `.github/workflows/python.yml` (publishes to PyPI)
- **Docker images:** `.github/workflows/build-and-publish.yml` (publishes container images)

No manual publishing steps are required—everything is automated via GitHub Actions.

---

**Note:**

- Ensure you have the necessary permissions and tokens set up in the repository secrets for NPM and
  PyPI publishing.
- For more details, see the individual workflow files in `.github/workflows/`.
