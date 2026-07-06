# AGENTS.md

## Project

Industrial Automation Project Archive System

A web-based project archive and management system for industrial automation projects.

The system manages:

* PLC projects
* HMI projects
* Robot programs
* Electrical drawings
* Mechanical drawings
* Documentation
* Commissioning records
* Service history
* Version history
* Customer and machine information

---

## Current Project Status

Completed features:

* Prisma/MySQL schema with projects, customers, files, versions, users, roles, activity logs, tags, service/commissioning records, and system settings.
* Local disk/NAS-ready storage foundation with safe paths, project folders, filename sanitizing, SHA256 checksums, and path traversal protection.
* Authentication foundation with password hashing, JWT sessions, current-user resolution, role permissions, and default seed support.
* Project backend and UI for create, list, search, filter, sort, detail, and short-link lookup.
* Project status can be updated from the Project Detail General section by users with project edit permission.
* Project General Information can be edited after creation with a single Save Changes action and per-field audit logging that records old value, new value, user, and timestamp.
* Project Detail General view includes a compact Project Intelligence summary with key systems, archive health scoring, completeness checklist, suggestions, latest backup, and last update using existing project metadata, uploaded file metadata, archive versions, and backup status.
* Project Detail includes an Engineering Timeline section that groups project-specific ActivityLog events by date using the existing activity API and permissions.
* File backend and UI for real browser upload, metadata persistence, version history, duplicate checksum detection, and streamed downloads.
* Machine digital archive section selector for PLC, HMI, Robot, Electrical, Mechanical, Pneumatic, Vision, Camera, Photos, Videos, FAT, SAT, Spare Parts, Service, Commissioning, Backups, and Documents.
* Dashboard with project, customer, backup, machine archive, recent upload, and activity metrics.
* Activity timeline with filters.
* User management for ADMIN users: list, search, pagination, sorting, create, edit, activate/deactivate, reset password, and soft delete.
* Editable system settings persisted in the database.
* Project storage backup system for ADMIN users using the configured File Backup Location, with validation, incremental copy, persisted last-run status, and audit logging.
* Backup history and verification: every backup run is stored, Settings shows run history, and ADMIN users can verify backup integrity against `STORAGE_ROOT/projects`.
* Backup folder UX copies the configured backup path for Windows Explorer because browsers cannot directly open server-local folders.
* Disaster recovery restore wizard: ADMIN users can analyze backup history entries, preview restore scope/conflicts, dry-run, and restore the full archive, one project, selected categories, or selected files.
* Engineering metadata system for uploads: category-driven manufacturer and platform/software dropdowns persist manufacturer, software name, and software version while preserving the legacy internal platform code.
* File preview engine: users with download permission can preview supported PDFs, images, videos, text files, and archive file trees without changing download behavior.
* Archive preview UX shows user-friendly informational notices when RAR/7Z folder listing is unavailable, while confirming upload integrity and download availability.
* File intelligence metadata extraction: preview-time extraction for PDFs, images, videos, archives, and text files without AI, content mutation, or database caching.
* Engineering detection layer: preview-time rule-based identification of PLC, robot, HMI, vision, and electrical engineering systems from filenames, archive entries, and existing metadata.
* Vendor engineering scanners: lightweight read-only scanners for Beckhoff TwinCAT, Siemens TIA/STEP7, Yaskawa, KUKA, ABB, and PDF/document hints.
* Enterprise metadata search: global topbar search, `/search` page, grouped results for projects, files, activities, and ADMIN-only users with metadata filters.
* User-facing message presentation sanitizes developer-oriented details before displaying errors or preview limitations.
* QA stabilization pass for page empty states, long text wrapping, explicit upload busy state, and manual release checklist.

Current architecture:

* Next.js App Router provides frontend pages and API routes.
* Business logic lives in service modules under `src/modules`.
* Shared helpers live under `src/lib`.
* Prisma stores metadata; actual files stay on disk under `STORAGE_ROOT`.
* API routes use consistent JSON success/error responses.
* Backup service copies `STORAGE_ROOT/projects` to the configured external/local/NAS destination while preserving directory structure, filenames, and timestamps.
* Backup verification compares source and backup folders using SHA256 first, file size second, and modified date only as a warning when checksum is unavailable.
* Restore service reads selected `BackupRun` destinations, validates all source/destination paths, and restores into `STORAGE_ROOT/projects` unless an explicit alternative restore location is selected.
* File upload metadata uses structured engineering definitions and maps friendly selections such as Beckhoff/TwinCAT 3 to uppercase internal platform codes for compatibility.
* Project Detail uses a grouped section selector instead of horizontal archive tabs, while preserving the same section state and file actions.
* Project status updates reuse the existing project update API and log status-change details in ActivityLog.
* Project General edits reuse `PUT /api/projects/[id]`, send only modified fields, and remain disabled for read-only roles.
* Project Intelligence and Archive Health are computed in the Project Detail UI from already-loaded project and file records, plus the existing backup status endpoint; they do not run preview scanners, background jobs, or add database fields.
* Engineering Timeline reuses `GET /api/activity?projectId=...`; no duplicate activity service or timeline-specific database table is used.
* Preview service reuses file metadata, storage path safety, authentication, and file permissions; binary previews stream inline through authenticated API routes.
* Preview UI translates archive preview limitations into end-user guidance and avoids exposing parser/tooling details.
* File intelligence is an additive module under `src/modules/file-intelligence`; it runs on demand from the existing preview service after authorization and safe path resolution.
* Engineering detection is an additive module under `src/modules/engineering-detection`; it runs on demand in the preview flow and does not persist results.
* Vendor scanners live under `src/modules/engineering-detection/scanners`; they reuse preview archive trees and existing metadata, and they never extract archives permanently.
* Enterprise search service performs permission-aware Prisma metadata searches across projects, customers, machine identifiers, files, engineering metadata, version notes, activities, and users.
* Frontend API client preserves backend contracts while filtering technical implementation details from messages shown in the UI.
* Manual QA coverage is tracked in `QA_CHECKLIST.md` for authentication, permissions, pages, file workflows, backup, restore, and regression checks.

Database changes:

* Added file categories for machine archive coverage, including Pneumatic, Vision, Camera, Photo, Video, FAT, SAT, and Spare Parts.
* Added user profile fields: full name and department.
* Added system settings singleton table.
* Added audit actions for user lifecycle and archive uploads.
* Added last file-backup result fields to system settings and backup audit actions.
* Added backup run history table and backup verification audit actions.
* Added restore audit actions for disaster recovery operations.
* Added engineering metadata fields to project files and file versions.
* No database fields were added for file intelligence; extracted metadata is computed on demand to avoid migration and cache invalidation risk.
* No database fields were added for engineering detection; detected type, confidence, evidence, and warnings are calculated on demand.
* No database fields were added for vendor scanner output; scanner summaries, metrics, evidence, and warnings are calculated during preview.

API endpoints:

* Auth: `POST /api/auth/login`, `GET /api/auth/me`
* Dashboard: `GET /api/dashboard`
* Projects: `GET/POST /api/projects`, `GET/PUT /api/projects/[id]`, `GET /api/projects/search`, `GET /api/projects/code/[projectCode]`
* Files: `GET /api/projects/[id]/files`, `POST /api/projects/[id]/files/upload`, `POST /api/projects/[id]/files/prepare`, `POST /api/projects/[id]/files/finalize`, `POST /api/files/[id]/versions`, `GET /api/files/[id]/download`
* Activity: `GET /api/activity`
* Users: `GET/POST /api/users`, `PUT/DELETE /api/users/[id]`, `POST /api/users/[id]/password`
* Settings: `GET/PUT /api/settings`
* Backup: `GET /api/backup/status`, `GET /api/backup/history`, `POST /api/backup/run`, `POST /api/backup/verify`
* Restore: `POST /api/restore/analyze`, `POST /api/restore/execute`
* Preview: `GET /api/files/[id]/preview`, `GET /api/files/[id]/preview/content`
* Search: `GET /api/search`

Remaining roadmap:

* Apply and verify migrations in clean environments.
* Add automated tests for auth, permissions, project CRUD, upload/download, settings, and user management.
* Add scheduled backup execution jobs and recurring restore drills using backup history, verification results, and restore dry-run reports.
* Add admin screens for roles/permissions if permissions become configurable.
* Add full-text document content search, OCR, and indexed PDF/archive content parsing as a future search phase.
* Add production deployment docs, monitoring, and backup restore procedures.

---

## Technology Stack

Frontend

* Next.js 15
* TypeScript
* TailwindCSS
* shadcn/ui

Backend

* Next.js App Router
* TypeScript

Database

* MySQL 8
* Prisma ORM

Storage

* Local Disk
* NAS

Future Support

* MinIO
* S3
* OneDrive Synchronization

---

## Core Principles

Business rules are more important than implementation details.

Data integrity is more important than convenience.

Version history must never be lost.

All important actions must be traceable.

Do not delete historical data without explicit approval.

Prefer soft delete over hard delete.

---

## Read Order

Before planning or coding, read the following files in order:

1. .agents/architect.md
2. .agents/business-rules.md
3. .agents/database.md
4. .agents/automation.md
5. .agents/file-storage.md
6. .agents/backend.md
7. .agents/frontend.md
8. .agents/security.md
9. .agents/devops.md
10. .agents/qa.md

Business rules override technical preferences.

Security requirements override convenience.

---

## Available Agents

Solution Architect Agent

Responsible for:

* architecture
* module design
* scalability
* implementation order

Business Rules Agent

Responsible for:

* project lifecycle
* revision rules
* service history
* commissioning history
* data ownership

Database Agent

Responsible for:

* MySQL schema
* Prisma models
* indexes
* migrations

Industrial Automation Agent

Responsible for:

* PLC platforms
* HMI platforms
* Robot platforms
* file categorization
* automation-specific rules

File Storage Agent

Responsible for:

* storage structure
* file naming
* version storage
* NAS support
* backup strategy

Backend Agent

Responsible for:

* API routes
* services
* validation
* business logic

Frontend Agent

Responsible for:

* UI
* UX
* dashboard
* forms
* tables

Security Agent

Responsible for:

* authentication
* authorization
* audit logging
* upload security
* OWASP review

DevOps Agent

Responsible for:

* Docker
* deployment
* backup strategy
* monitoring

QA Agent

Responsible for:

* testing
* validation
* acceptance criteria

---

## Working Rules

Always analyze before coding.

Always produce a plan before implementation.

Do not modify unrelated files.

Do not introduce new technologies without justification.

Use TypeScript strict mode.

Use Prisma migrations.

Use Zod validation.

Keep business logic outside UI components.

Use service-based architecture.

---

## Development Order

1. Architecture
2. Business Rules
3. Database
4. Storage
5. Authentication
6. Project Management
7. File Management
8. Activity Logs
9. Search
10. Dashboard
11. Administration
12. Testing
13. Deployment

---

## Security Requirements

Every file operation must verify permissions.

Every upload must be validated.

Every download must be logged.

Every delete operation must be logged.

Prevent:

* path traversal
* unauthorized access
* unsafe uploads
* privilege escalation

Never expose internal filesystem paths to unauthorized users.

---

## File Storage Rules

Actual files must be stored on disk.

Database stores metadata only.

Supported categories:

* PLC
* HMI
* ROBOT
* ELECTRICAL
* MECHANICAL
* PNEUMATIC
* VISION
* CAMERA
* PHOTO
* VIDEO
* FAT
* SAT
* SPARE_PARTS
* DOCUMENT
* PHOTO_VIDEO
* BACKUP
* COMMISSIONING
* SERVICE

Version history must remain accessible.

---

## Done Definition

A task is considered complete only if:

* architecture is respected
* business rules are respected
* TypeScript has no errors
* lint passes
* Prisma schema is valid
* migration is valid
* permissions are checked
* activity logs are created
* tests pass
* documentation is updated

---

## First Action

When starting work:

1. Read AGENTS.md
2. Read all files under .agents
3. Summarize architecture
4. Summarize business rules
5. Create implementation plan
6. Wait for approval before major coding work
