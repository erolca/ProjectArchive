import { ActivityAction, type Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { requirePermission } from "../auth/permissions";
import type { AuthenticatedUser } from "../auth/auth.types";

export interface LogActivityInput {
  userId?: number | null;
  projectId?: number | null;
  action: ActivityAction;
  entityType: string;
  entityId?: number | null;
  details?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function logActivity(input: LogActivityInput): Promise<void> {
  await prisma.activityLog.create({
    data: {
      userId: input.userId ?? null,
      projectId: input.projectId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      details: input.details ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}

export interface ActivityListInput {
  page?: number;
  pageSize?: number;
  userId?: number;
  projectId?: number;
  action?: ActivityAction;
  dateFrom?: string;
  dateTo?: string;
}

export async function listActivity(user: AuthenticatedUser, input: ActivityListInput) {
  requirePermission(user, "activity:read");

  const page = input.page && input.page > 0 ? input.page : 1;
  const pageSize = input.pageSize && input.pageSize > 0 ? Math.min(input.pageSize, 100) : 50;
  const skip = (page - 1) * pageSize;
  const where = buildActivityWhere(input);

  const [data, total] = await prisma.$transaction([
    prisma.activityLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        project: {
          select: {
            id: true,
            projectCode: true,
            machineName: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: pageSize,
    }),
    prisma.activityLog.count({
      where,
    }),
  ]);

  return {
    data,
    page,
    pageSize,
    total,
  };
}

function buildActivityWhere(input: ActivityListInput): Prisma.ActivityLogWhereInput {
  const where: Prisma.ActivityLogWhereInput = {};

  if (input.userId) {
    where.userId = input.userId;
  }

  if (input.projectId) {
    where.projectId = input.projectId;
  }

  if (input.action) {
    if (!isActivityAction(input.action)) {
      throw new Error("Invalid activity action filter.");
    }

    where.action = input.action;
  }

  if (input.dateFrom || input.dateTo) {
    where.createdAt = {};

    if (input.dateFrom) {
      where.createdAt.gte = parseDateFilter(input.dateFrom, "dateFrom");
    }

    if (input.dateTo) {
      where.createdAt.lte = parseDateFilter(input.dateTo, "dateTo");
    }
  }

  return where;
}

function isActivityAction(value: string): value is ActivityAction {
  return Object.values(ActivityAction).includes(value as ActivityAction);
}

function parseDateFilter(value: string, fieldName: string): Date {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} must be a valid date.`);
  }

  return date;
}
