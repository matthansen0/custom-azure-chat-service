# Lab 02: Pass 2 Working Slice

## Goal

Validate the first complete working slice of the chat prototype: room list, room open, message send, realtime delivery, typing indicators, read receipts, reactions, pinning, and room search.

## Steps

1. Open the repo in the dev container.
2. Run `npm install` if dependencies are not already present.
3. Run `bash scripts/validate.sh --local`.

## Expected Outcome

- Backend unit and integration tests pass.
- Workspace typecheck passes.
- Playwright confirms the shell loads and that two users can exchange a live message, observe typing, see read receipt updates, react, pin a room, and search for the new message.

## Validator parity

The matching validator entry point is:

```bash
bash scripts/validate.sh --local
```