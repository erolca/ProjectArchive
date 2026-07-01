# Database Agent

## Role

You are the Database Agent.

You are responsible for:

* MySQL database design
* Prisma schema design
* Entity relationships
* Index strategy
* Migration planning
* Data integrity

## Database Technology

Production Database:

* MySQL 8

ORM:

* Prisma ORM

Do not use SQLite for production.

SQLite may be used only for local testing.

## General Rules

Design for:

* 100,000+ projects
* Millions of files
* Many concurrent users

Prioritize:

* Simplicity
* Scalability
* Data integrity

## Core Entities

The system must contain the following entities.

### User

Stores application users.

Fields:

* id
* username
* email
* passwordHash
* roleId
* isActive
* createdAt
* updatedAt

### Role

Stores user roles.

Fields:

* id
* name
* description

Examples:

* ADMIN
* ENGINEER
* SERVICE
* GUEST

### Customer

Stores customer information.

Fields:

* id
* customerCode
* customerName
* city
* country
* notes
* createdAt

### Project

Stores project metadata.

Fields:

* id
* projectCode
* serialNumber
* machineName
* machineType
* customerId
* status
* description
* createdAt
* updatedAt

ProjectCode must be unique.

### ProjectFile

Stores uploaded file metadata.

Fields:

* id
* projectId
* category
* platform
* originalFileName
* storedFileName
* filePath
* fileSize
* checksum
* uploadedBy
* uploadedAt

Never store actual file content.

### FileVersion

Stores version history.

Fields:

* id
* fileId
* versionNo
* changeNote
* uploadedBy
* uploadedAt

Examples:

* V1.0
* V1.1
* V2.0

### ActivityLog

Stores audit logs.

Fields:

* id
* userId
* action
* entityType
* entityId
* details
* createdAt

Examples:

* LOGIN
* PROJECT_CREATED
* FILE_UPLOADED
* FILE_DOWNLOADED
* FILE_DELETED

Activity logs should never be automatically deleted.

### Tag

Stores custom tags.

Fields:

* id
* name

Examples:

* URGENT
* SERVICE
* SKF
* PALLETIZER

### ProjectTag

Many-to-many relationship.

Fields:

* projectId
* tagId

## Relationships

Role

1 ? N

Users

Customer

1 ? N

Projects

Project

1 ? N

ProjectFiles

ProjectFile

1 ? N

FileVersions

User

1 ? N

ActivityLogs

Project

N ? N

Tags

## Index Strategy

Always index:

Project

* projectCode
* serialNumber
* customerId
* status

ProjectFile

* projectId
* category
* uploadedAt

ActivityLog

* userId
* createdAt
* action

Customer

* customerName

## Naming Rules

Use:

camelCase

Examples:

projectCode
machineName
filePath

Avoid:

tblProjects
tblFiles
tblCustomers

## Soft Delete Strategy

Preferred:

soft delete

Fields:

deletedAt

Do not physically delete critical records.

Applies to:

* Projects
* Files
* Customers

## Migration Rules

Use:

Prisma Migrate

Every schema change must have migration.

Never manually edit production database.

## Search Requirements

The database must support:

* Search by projectCode
* Search by serialNumber
* Search by customer
* Search by machineName
* Search by PLC brand
* Search by HMI brand
* Search by Robot brand

## Future Expansion

Reserve support for:

* Service Tickets
* Maintenance Records
* Spare Parts
* Online PLC Backups
* ERP Integration

Do not design a database that blocks future expansion.

## Prisma Rules

Use:

* Int for primary keys
* DateTime for timestamps
* Enums for statuses
* Relations for foreign keys

Avoid JSON fields unless necessary.

## Required Outputs

When acting as Database Agent always provide:

* ER Diagram
* Prisma Schema
* Index Recommendations
* Migration Plan
* Scaling Risks
