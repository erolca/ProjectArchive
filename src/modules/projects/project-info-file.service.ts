import { rename, stat, unlink, writeFile } from "node:fs/promises";
import { assertInsideStorageRoot } from "../../lib/storage";
import { getProjectFolderPath, getProjectRootPath } from "../storage/storage.service";

export const PROJECT_INFO_FILE_NAME = "_PROJECT_INFO.txt";

interface ProjectInfoFileProject {
  projectCode: string;
  customerProjectCode?: string | null;
  serialNumber: string;
  machineName: string;
  machineType?: string | null;
  status: string;
  updatedAt: Date | string;
  plcBrand?: string | null;
  hmiBrand?: string | null;
  robotBrand?: string | null;
  customer: {
    customerName: string;
  };
}

export interface ProjectInfoSyncResult {
  projectCode: string;
  synced: boolean;
  skipped: boolean;
  reason?: string;
}

export async function syncProjectInfoFile(project: ProjectInfoFileProject): Promise<ProjectInfoSyncResult> {
  const projectRoot = getProjectRootPath(project.projectCode);
  const projectInfoPath = getProjectFolderPath(project.projectCode, [PROJECT_INFO_FILE_NAME]);

  assertInsideStorageRoot(projectRoot.absolutePath, projectInfoPath.absolutePath);

  const rootKind = await getProjectRootKind(projectRoot.absolutePath);

  if (rootKind !== "directory") {
    return {
      projectCode: project.projectCode,
      synced: false,
      skipped: true,
      reason: "Project folder does not exist.",
    };
  }

  const tempPath = getProjectFolderPath(project.projectCode, [
    `${PROJECT_INFO_FILE_NAME}.${process.pid}.${Date.now()}.tmp`,
  ]);
  assertInsideStorageRoot(projectRoot.absolutePath, tempPath.absolutePath);

  try {
    await writeFile(tempPath.absolutePath, buildProjectInfoFileContent(project), {
      encoding: "utf8",
    });
    await rename(tempPath.absolutePath, projectInfoPath.absolutePath);
  } catch (error) {
    await unlink(tempPath.absolutePath).catch(() => undefined);
    throw error;
  }

  return {
    projectCode: project.projectCode,
    synced: true,
    skipped: false,
  };
}

export function isProjectInfoSystemFile(relativeStoragePath: string): boolean {
  const normalized = relativeStoragePath.replace(/\\/g, "/");
  const parts = normalized.split("/");

  return parts.length === 3 && parts[0] === "projects" && parts[2] === PROJECT_INFO_FILE_NAME;
}

export function logProjectInfoSyncFailure(projectCode: string, context: string): void {
  console.error(`Project info file sync failed during ${context} for project ${projectCode}.`);
}

export function logProjectInfoSyncSkipped(projectCode: string, context: string, reason?: string): void {
  console.warn(
    `Project info file sync skipped during ${context} for project ${projectCode}: ${reason || "Project info file was not updated."}`,
  );
}

function buildProjectInfoFileContent(project: ProjectInfoFileProject): string {
  const lines = [
    "ProjectArchive Project Information",
    "",
    `Project Code: ${displayValue(project.projectCode)}`,
    `Customer: ${displayValue(project.customer.customerName)}`,
    `Customer Project Code: ${displayValue(project.customerProjectCode)}`,
    `Machine Name: ${displayValue(project.machineName)}`,
    `Machine Type: ${displayValue(project.machineType)}`,
    `Serial Number: ${displayValue(project.serialNumber)}`,
    "",
    `PLC: ${displayValue(project.plcBrand)}`,
    `HMI: ${displayValue(project.hmiBrand)}`,
    `Robot: ${displayValue(project.robotBrand)}`,
    "",
    `Status: ${displayValue(project.status)}`,
    `Last Updated: ${formatProjectInfoDate(project.updatedAt)}`,
    "",
  ];

  return lines.join("\n");
}

async function getProjectRootKind(projectRootPath: string): Promise<"directory" | "other" | "missing"> {
  try {
    const projectRootStat = await stat(projectRootPath);

    return projectRootStat.isDirectory() ? "directory" : "other";
  } catch (error) {
    if (isNodeError(error, "ENOENT")) {
      return "missing";
    }

    return "other";
  }
}

function displayValue(value?: string | null): string {
  return value?.trim() || "-";
}

function formatProjectInfoDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "*";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function isNodeError(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
