# QA Checklist

Manual release checklist for ProjectArchive stabilization.

## Environment

- Confirm `.env` points to the intended MySQL database.
- Run `npx prisma validate`.
- Run `npm run typecheck`.
- Start the app and confirm `/login` renders.

## Authentication and Permissions

- Visit `/` without a token and confirm redirect to `/login`.
- Log in with a valid user and confirm redirect to `/`.
- Open `/login` while authenticated and confirm redirect to `/`.
- Log out and confirm the token is cleared.
- Confirm non-ADMIN users cannot access user management actions.
- Confirm inactive or invalid-token sessions are rejected.

## Core Pages

- Dashboard loads metrics, last uploaded files, and recent activity.
- Projects page supports search, filters, sorting, pagination, and empty state.
- Project create page validates required fields and redirects to detail on success.
- Project detail loads project, customer, machine information, and section selector.
- Activity page filters by action, user, project, and date.
- Search page returns grouped results and handles no-result searches.
- Users page lists, filters, creates, edits, resets password, and soft-deletes users as ADMIN.
- Settings page loads, saves, cancels changes, and shows unsaved changes correctly.

## File Workflows

- Upload a valid PLC/HMI/Robot archive and confirm metadata, version, checksum, and activity log.
- Upload a duplicate file and confirm duplicate handling still works.
- Upload an invalid executable extension and confirm it is rejected.
- Confirm long filenames wrap in tables and preview metadata.
- Download a file and confirm the browser receives the original filename.
- Preview PDF, image, video, text, ZIP, RAR/7Z, and unsupported files.
- Confirm RAR/7Z preview limitation messages are user-friendly and download remains available.
- Confirm file intelligence displays available metadata without blocking preview.

## Backup and Restore

- Validate backup location.
- Run backup and confirm status, history, size, duration, and activity log.
- Run backup verification and review warnings/failures.
- Copy backup path and confirm the browser does not try to open local folders directly.
- Analyze restore in dry-run mode.
- Confirm restore conflict preview and report render long paths cleanly.

## Regression Checks

- Existing API routes return JSON on errors.
- Upload, download, preview, search, backup, restore, authentication, permissions, activity logging, and engineering metadata still behave as expected.
- No internal paths, stack traces, parser/tooling errors, or implementation details are displayed to end users.
