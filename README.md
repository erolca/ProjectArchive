# ProjectArchive
# Industrial Digital Machine Archive

> **Enterprise Digital Archive Platform for Industrial Automation Projects**

ProjectArchive is a modern web-based platform designed to manage the complete lifecycle of industrial automation projects.

Instead of storing PLC programs, robot backups, electrical drawings, FAT documents, manuals, photos and engineering files across multiple folders, USB drives and personal computers, ProjectArchive centralizes everything into a secure, searchable and version-controlled system.

---

# Features

## Authentication & Security

- JWT Authentication
- Secure Login
- User Profile
- Role-Based Authorization
- User Management
- Department Management
- Password Reset
- Activity Logging
- Audit Trail

---

# Project Management

Manage complete machine projects.

Supported information:

- Project Code
- Customer
- Machine Name
- Machine Type
- PLC Brand
- Robot Brand
- HMI Brand
- Status
- Description

Additional features:

- Search
- Filtering
- Sorting
- Pagination

---

# Machine Digital Archive

Every project contains dedicated engineering archive sections.

Supported categories

- PLC
- HMI
- Robot
- Vision
- Camera
- Electrical
- Mechanical
- Pneumatic
- Documents
- Photos
- Videos
- FAT
- SAT
- Spare Parts
- Service
- Commissioning
- Backups

---

# File Management

Every uploaded file supports

- Upload
- Download
- Version History
- Latest Version Badge
- SHA256 Checksum
- File Size
- Upload Date
- Uploaded By

Supported archive formats

- PDF
- DOCX
- XLSX
- PPTX
- DWG
- DXF
- CSV
- ZIP
- RAR
- 7Z

Executable files are blocked for security.

---

# Dashboard

Real-time statistics

- Total Projects
- Active Projects
- Customers
- Users
- PLC Files
- Robot Files
- HMI Files
- Electrical Files
- Mechanical Files
- Vision Files
- FAT Documents
- SAT Documents
- Service Files
- Spare Parts Files
- Recent Activity

---

# Backup & Disaster Recovery

Enterprise backup system for engineering archives.

Features

- Incremental Backup
- Backup History
- Backup Verification
- SHA256 Verification
- Timestamp-aware Validation
- External HDD Support
- NAS Support
- Local Storage Support
- Activity Logging
- Administrator Only Execution

Backup Statistics

- Copied Files
- Skipped Files
- Failed Files
- Total Files
- Total Size
- Backup Duration

Verification

- SHA256 Comparison
- Size Comparison
- Timestamp Warning
- Missing File Detection
- Corrupted File Detection

---

# Activity Log

Every important action is recorded.

Examples

- User Login
- User Logout
- User Created
- User Updated
- Password Reset
- Project Created
- Project Updated
- File Uploaded
- File Downloaded
- Backup Started
- Backup Completed
- Backup Failed
- Backup Verification Started
- Backup Verification Completed
- Backup Verification Failed

---

# System Settings

Configurable settings

- Company Name
- Departments
- Storage Provider
- Storage Root
- File Backup Location
- Maximum Upload Size

---

# Technology Stack

## Frontend

- Next.js 15
- React
- TypeScript

## Backend

- Next.js API Routes
- Prisma ORM

## Database

- MariaDB

## Authentication

- JWT

## Storage

- Local Storage Provider

---

# Folder Structure

```
storage/

└── projects/

    └── PRJ-XXXX

        ├── PLC

        ├── HMI

        ├── Robot

        ├── Vision

        ├── Camera

        ├── Electrical

        ├── Mechanical

        ├── Pneumatic

        ├── Documents

        ├── Photos

        ├── Videos

        ├── FAT

        ├── SAT

        ├── Service

        ├── Commissioning

        ├── SpareParts

        └── Backups
```

---

# Installation

Clone repository

```bash
git clone https://github.com/erolca/ProjectArchive.git
```

Install packages

```bash
npm install
```

Configure

```text
.env
```

Run database migration

```bash
npx prisma migrate dev
```

Seed default administrator

```bash
npm run seed
```

Start development server

```bash
npm run dev
```

Open

```
http://localhost:3000
```

---

# Default Administrator

Configured inside

```
.env
```

Example

```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=********
```

---

# Security

ProjectArchive includes multiple security layers.

- JWT Authentication
- Role Based Authorization
- Audit Logging
- Activity Tracking
- SHA256 File Verification
- Safe Upload Validation
- Executable File Blocking
- Path Traversal Protection
- Backup Destination Validation

---

# Current Version

**v1.1.0**

Completed

- Authentication
- User Management
- Project Management
- Machine Digital Archive
- File Versioning
- Dashboard
- Settings
- Backup System
- Backup History
- Backup Verification
- Activity Logging

---

# Roadmap

## v1.2

Disaster Recovery

- Restore Wizard
- Restore Preview
- Restore Selected Project
- Restore Selected Files
- Restore Report

---

## v1.3

Scheduled Backup

- Daily Backup
- Weekly Backup
- Monthly Backup
- Backup Retention
- Automatic Cleanup

---

## v1.4

Document Intelligence

- PDF Preview
- Image Gallery
- Video Preview
- ZIP Explorer
- DWG Metadata
- Rich File Preview

---

## v1.5

Enterprise Search

- Global Search
- OCR Support
- Search Inside Documents
- Search Inside Archives

---

## v2.0

AI Engineering Assistant

- AI Project Search
- Engineering Knowledge Base
- PLC Program Analysis
- Robot Backup Analysis
- Document Assistant
- Natural Language Search

---

# Why ProjectArchive?

Industrial automation projects generate thousands of engineering files during a machine's lifecycle.

ProjectArchive centralizes every engineering asset into a single secure platform, eliminating scattered folders, inconsistent backups and undocumented revisions.

It provides a single source of truth for industrial automation projects.

---

# License

Private Project

Copyright © 2026

Industrial Digital Machine Archive

All Rights Reserved.
