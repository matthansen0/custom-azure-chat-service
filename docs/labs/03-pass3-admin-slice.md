# Lab 03: Pass 3 Admin Slice

## Goal

Validate the platform-owned features layered around the core chat slice: room administration, membership changes, message lifecycle controls, quick templates, directory filtering, linked context, assignment updates, and audit visibility.

## Steps

1. Open the repo in the dev container.
2. Run `npm install` if dependencies are not already present.
3. Run `bash scripts/validate.sh --local`.

## Expected Outcome

- Backend tests validate room creation, preferences, notification state, context linking, assignment membership, templates, message edit/delete/delivery/priority, and audit records.
- Playwright confirms the admin UI can create a room, add participants, link context, create a template, send/edit/delete a message, hide and recover a room, and inspect audit events.

## Validator parity

The matching validator entry point is:

```bash
bash scripts/validate.sh --local
```