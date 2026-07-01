# CI/CD Plan

## Fast Path

Runs on every pull request and push:
- install with npm ci
- typecheck
- parameterised unit tests
- security smoke checks
- production build

## Security Path

Runs on pull requests, pushes, and schedule:
- npm audit
- CodeQL for JavaScript/TypeScript
- dependency review on pull requests
- Dependabot for npm and GitHub Actions updates

## Deploy Path

Runs only on push to main:
- build
- upload dist artifact
- deploy to GitHub Pages

## Rules

- least-privilege permissions
- no secrets needed
- no third-party actions unless necessary
- official GitHub actions preferred
- short timeouts
- concurrency cancellation
- cache npm dependencies through setup-node
- deployment only after tests pass
