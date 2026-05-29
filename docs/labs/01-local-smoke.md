# Lab 01: Local Pass 1 Smoke Test

## Goal

Validate that the Pass 1 architecture skeleton runs locally with backend auth, frontend bootstrap, backend unit tests, and browser smoke coverage.

## Steps

1. Open the repo in the dev container.
2. Run `npm install`.
3. Run `bash scripts/validate.sh --local`.

## Expected Outcome

- Backend unit tests pass.
- Workspace typecheck passes.
- Playwright smoke test opens the app, loads the demo shell, and shows the seeded chat rooms.

## Validator parity

The matching validator entry point is:

```bash
bash scripts/validate.sh --local
```