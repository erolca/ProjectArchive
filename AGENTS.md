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
* File backend and UI for real browser upload, metadata persistence, version history, duplicate checksum detection, and streamed downloads.
* Machine digital archive tabs for PLC, HMI, Robot, Electrical, Mechanical, Pneumatic, Vision, Camera, Photos, Videos, FAT, SAT, Spare Parts, Service, Commissioning, Backups, and Documents.
* Dashboard with project, customer, backup, machine archive, recent upload, and activity metrics.
* Activity timeline with filters.
* User management for ADMIN users: list, search, pagination, sorting, create, edit, activate/deactivate, reset password, and soft delete.
* Editable system settings persisted in the database.

Current architecture:

* Next.js App Router provides frontend pages and API routes.
* Business logic lives in service modules under `src/modules`.
* Shared helpers live under `src/lib`.
* Prisma stores metadata; actual files stay on disk under `STORAGE_ROOT`.
* API routes use consistent JSON success/error responses.

Database changes:

* Added file categories for machine archive coverage, including Pneumatic, Vision, Camera, Photo, Video, FAT, SAT, and Spare Parts.
* Added user profile fields: full name and department.
* Added system settings singleton table.
* Added audit actions for user lifecycle and archive uploads.

API endpoints:

* Auth: `POST /api/auth/login`, `GET /api/auth/me`
* Dashboard: `GET /api/dashboard`
* Projects: `GET/POST /api/projects`, `GET/PUT /api/projects/[id]`, `GET /api/projects/search`, `GET /api/projects/code/[projectCode]`
* Files: `GET /api/projects/[id]/files`, `POST /api/projects/[id]/files/upload`, `POST /api/projects/[id]/files/prepare`, `POST /api/projects/[id]/files/finalize`, `POST /api/files/[id]/versions`, `GET /api/files/[id]/download`
* Activity: `GET /api/activity`
* Users: `GET/POST /api/users`, `PUT/DELETE /api/users/[id]`, `POST /api/users/[id]/password`
* Settings: `GET/PUT /api/settings`

Remaining roadmap:

* Apply and verify migrations in clean environments.
* Add automated tests for auth, permissions, project CRUD, upload/download, settings, and user management.
* Add backup execution jobs for database and file storage.
* Add admin screens for roles/permissions if permissions become configurable.
* Add advanced search across project metadata, file metadata, checksums, and activity logs.
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
