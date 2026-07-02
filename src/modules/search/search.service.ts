import { ActivityAction, FileCategory, Prisma, ProjectStatus, RoleName } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type { AuthenticatedUser } from "../auth/auth.types";
import { hasPermission } from "../auth/permissions";
import type { EnterpriseSearchQuery, EnterpriseSearchResult, SearchMetadata, SearchResultItem } from "./search.types";
import { enterpriseSearchQuerySchema } from "./search.validators";

export async function searchEnterprise(
  currentUser: AuthenticatedUser,
  input: unknown,
): Promise<EnterpriseSearchResult> {
  const query = enterpriseSearchQuerySchema.parse(input);
  const limit = query.limit || 8;
  const isAdmin = currentUser.role === RoleName.ADMIN;

  const [projectData, fileData, activityData, userData] = await Promise.all([
    hasPermission(currentUser.role, "projects:read") ? searchProjects(query, limit) : emptyResult(),
    hasPermission(currentUser.role, "files:read") ? searchFiles(query, limit) : emptyResult(),
    isAdmin ? searchActivities(query, limit) : emptyResult(),
    isAdmin ? searchUsers(query, limit) : emptyResult(),
  ]);

  return {
    query,
    groups: {
      projects: projectData.items,
      files: fileData.items,
      activities: activityData.items,
      users: userData.items,
    },
    totals: {
      projects: projectData.total,
      files: fileData.total,
      activities: activityData.total,
      users: userData.total,
    },
  };
}

async function searchProjects(
  query: EnterpriseSearchQuery,
  limit: number,
): Promise<{ items: SearchResultItem[]; total: number }> {
  const where = buildProjectWhere(query);

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      include: {
        customer: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: limit,
    }),
    prisma.project.count({ where }),
  ]);

  return {
    total,
    items: projects.map((project) => ({
      id: String(project.id),
      title: project.projectCode,
      subtitle: `${project.customer.customerName} / ${project.machineName}`,
      href: `/projects/${project.id}`,
      date: project.updatedAt.toISOString(),
      metadata: compactMetadata([
        ["Serial", project.serialNumber],
        ["Status", project.status],
        ["Machine", project.machineType],
        ["PLC", project.plcBrand],
        ["HMI", project.hmiBrand],
        ["Robot", project.robotBrand],
      ]),
    })),
  };
}

async function searchFiles(
  query: EnterpriseSearchQuery,
  limit: number,
): Promise<{ items: SearchResultItem[]; total: number }> {
  const where = buildFileWhere(query);

  const [files, total] = await Promise.all([
    prisma.projectFile.findMany({
      where,
      include: {
        project: {
          include: {
            customer: true,
          },
        },
        uploadedBy: true,
        versions: {
          orderBy: {
            uploadedAt: "desc",
          },
          take: 1,
        },
      },
      orderBy: {
        uploadedAt: "desc",
      },
      take: limit,
    }),
    prisma.projectFile.count({ where }),
  ]);

  return {
    total,
    items: files.map((file) => {
      const latestVersion = file.versions[0];

      return {
        id: String(file.id),
        title: file.originalFileName,
        subtitle: `${file.project.projectCode} / ${file.project.customer.customerName}`,
        href: `/projects/${file.projectId}?file=${file.id}`,
        date: file.uploadedAt.toISOString(),
        metadata: compactMetadata([
          ["Category", file.category],
          ["Manufacturer", file.manufacturer],
          ["Platform", file.softwareName || file.platform],
          ["Software Version", file.softwareVersion],
          ["Archive Version", file.currentVersionNo],
          ["File Size", formatBytes(file.fileSize)],
          ["Uploaded By", file.uploadedBy?.fullName || file.uploadedBy?.username],
          ["Change Note", latestVersion?.changeNote],
        ]),
      };
    }),
  };
}

async function searchActivities(
  query: EnterpriseSearchQuery,
  limit: number,
): Promise<{ items: SearchResultItem[]; total: number }> {
  const where = buildActivityWhere(query);

  const [activities, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      include: {
        user: true,
        project: {
          include: {
            customer: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    }),
    prisma.activityLog.count({ where }),
  ]);

  return {
    total,
    items: activities.map((activity) => ({
      id: String(activity.id),
      title: activity.action.replaceAll("_", " "),
      subtitle: activity.project
        ? `${activity.project.projectCode} / ${activity.project.customer.customerName}`
        : activity.entityType,
      href: activity.projectId ? `/activity?projectId=${activity.projectId}` : "/activity",
      date: activity.createdAt.toISOString(),
      metadata: compactMetadata([
        ["Entity", activity.entityType],
        ["User", activity.user?.fullName || activity.user?.username],
        ["Details", activity.details],
      ]),
    })),
  };
}

async function searchUsers(
  query: EnterpriseSearchQuery,
  limit: number,
): Promise<{ items: SearchResultItem[]; total: number }> {
  const where = buildUserWhere(query);

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        role: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    total,
    items: users.map((user) => ({
      id: String(user.id),
      title: user.fullName || user.username,
      subtitle: user.email,
      href: "/users",
      date: user.updatedAt.toISOString(),
      metadata: compactMetadata([
        ["Username", user.username],
        ["Role", user.role.name],
        ["Department", user.department],
        ["Status", user.isActive ? "Active" : "Inactive"],
        ["Last Login", user.lastLoginAt?.toISOString()],
      ]),
    })),
  };
}

function buildProjectWhere(query: EnterpriseSearchQuery): Prisma.ProjectWhereInput {
  const and: Prisma.ProjectWhereInput[] = [{ deletedAt: null }];
  const search = query.q;

  if (search) {
    and.push({
      OR: [
        { projectCode: { contains: search } },
        { serialNumber: { contains: search } },
        { machineName: { contains: search } },
        { machineType: { contains: search } },
        { description: { contains: search } },
        { plcBrand: { contains: search } },
        { hmiBrand: { contains: search } },
        { robotBrand: { contains: search } },
        { customer: { customerName: { contains: search } } },
        { customer: { customerCode: { contains: search } } },
      ],
    });
  }

  if (query.customer) {
    and.push({
      customer: {
        customerName: {
          contains: query.customer,
        },
      },
    });
  }

  if (query.projectStatus) {
    and.push({ status: query.projectStatus });
  }

  addDateRange(and, "updatedAt", query);

  return { AND: and };
}

function buildFileWhere(query: EnterpriseSearchQuery): Prisma.ProjectFileWhereInput {
  const and: Prisma.ProjectFileWhereInput[] = [{ deletedAt: null }, { project: { deletedAt: null } }];
  const search = query.q;

  if (search) {
    const matchedCategories = matchEnumValues(FileCategory, search);

    and.push({
      OR: [
        { originalFileName: { contains: search } },
        { storedFileName: { contains: search } },
        { platform: { contains: search } },
        { manufacturer: { contains: search } },
        { softwareName: { contains: search } },
        { softwareVersion: { contains: search } },
        { currentVersionNo: { contains: search } },
        { checksum: { contains: search } },
        { project: { projectCode: { contains: search } } },
        { project: { serialNumber: { contains: search } } },
        { project: { machineName: { contains: search } } },
        { project: { customer: { customerName: { contains: search } } } },
        { versions: { some: { versionNo: { contains: search } } } },
        { versions: { some: { changeNote: { contains: search } } } },
        ...(matchedCategories.length ? [{ category: { in: matchedCategories } }] : []),
      ],
    });
  }

  if (query.category) {
    and.push({ category: query.category });
  }

  if (query.manufacturer) {
    and.push({ manufacturer: { contains: query.manufacturer } });
  }

  if (query.platform) {
    and.push({
      OR: [{ platform: { contains: query.platform } }, { softwareName: { contains: query.platform } }],
    });
  }

  if (query.customer) {
    and.push({ project: { customer: { customerName: { contains: query.customer } } } });
  }

  if (query.projectStatus) {
    and.push({ project: { status: query.projectStatus } });
  }

  if (query.uploadedBy) {
    and.push({
      uploadedBy: {
        OR: [
          { username: { contains: query.uploadedBy } },
          { fullName: { contains: query.uploadedBy } },
          { email: { contains: query.uploadedBy } },
        ],
      },
    });
  }

  addDateRange(and, "uploadedAt", query);

  return { AND: and };
}

function buildActivityWhere(query: EnterpriseSearchQuery): Prisma.ActivityLogWhereInput {
  const and: Prisma.ActivityLogWhereInput[] = [];
  const search = query.q;

  if (search) {
    const matchedActions = matchEnumValues(ActivityAction, search);

    and.push({
      OR: [
        { entityType: { contains: search } },
        { details: { contains: search } },
        { project: { projectCode: { contains: search } } },
        { project: { serialNumber: { contains: search } } },
        { project: { machineName: { contains: search } } },
        { project: { customer: { customerName: { contains: search } } } },
        { user: { username: { contains: search } } },
        { user: { fullName: { contains: search } } },
        { user: { email: { contains: search } } },
        ...(matchedActions.length ? [{ action: { in: matchedActions } }] : []),
      ],
    });
  }

  if (query.customer) {
    and.push({ project: { customer: { customerName: { contains: query.customer } } } });
  }

  if (query.projectStatus) {
    and.push({ project: { status: query.projectStatus } });
  }

  if (query.uploadedBy) {
    and.push({
      user: {
        OR: [
          { username: { contains: query.uploadedBy } },
          { fullName: { contains: query.uploadedBy } },
          { email: { contains: query.uploadedBy } },
        ],
      },
    });
  }

  addDateRange(and, "createdAt", query);

  return and.length ? { AND: and } : {};
}

function buildUserWhere(query: EnterpriseSearchQuery): Prisma.UserWhereInput {
  const and: Prisma.UserWhereInput[] = [{ deletedAt: null }];
  const search = query.q;

  if (search) {
    const matchedRoles = matchEnumValues(RoleName, search);

    and.push({
      OR: [
        { username: { contains: search } },
        { fullName: { contains: search } },
        { email: { contains: search } },
        { department: { contains: search } },
        ...(matchedRoles.length ? [{ role: { name: { in: matchedRoles } } }] : []),
      ],
    });
  }

  return { AND: and };
}

function addDateRange<TWhere extends Record<string, unknown>>(
  and: TWhere[],
  field: string,
  query: EnterpriseSearchQuery,
): void {
  const range: Prisma.DateTimeFilter = {};

  if (query.dateFrom) {
    range.gte = new Date(query.dateFrom);
  }

  if (query.dateTo) {
    const endDate = new Date(query.dateTo);
    endDate.setHours(23, 59, 59, 999);
    range.lte = endDate;
  }

  if (range.gte || range.lte) {
    and.push({ [field]: range } as TWhere);
  }
}

function compactMetadata(items: Array<[string, string | number | bigint | Date | null | undefined]>): SearchMetadata[] {
  return items
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([label, value]) => ({
      label,
      value: value instanceof Date ? value.toISOString() : String(value),
    }));
}

function formatBytes(value: bigint): string {
  const bytes = Number(value);

  if (!Number.isFinite(bytes)) {
    return String(value);
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function matchEnumValues<TValue extends string>(source: Record<string, TValue>, search: string): TValue[] {
  const normalizedSearch = normalizeSearch(search);

  return Object.values(source).filter((value) => normalizeSearch(value).includes(normalizedSearch));
}

function normalizeSearch(value: string): string {
  return value.replaceAll("_", " ").toLowerCase();
}

function emptyResult(): { items: SearchResultItem[]; total: number } {
  return {
    items: [],
    total: 0,
  };
}
