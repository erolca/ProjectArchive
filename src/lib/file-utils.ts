import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { basename, extname } from "node:path";
import type {
  CategoryPlatformResolution,
  FileCategory,
  FileClassificationInput,
  PlatformCode,
  StoredFileNameInput,
} from "../modules/storage/storage.types";

const SAFE_PROJECT_CODE_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
const VERSION_PATTERN = /^V\d+\.\d+$/;
const UNSAFE_FILENAME_CHARS = /[^A-Za-z0-9._-]/g;
const MULTIPLE_UNDERSCORES = /_+/g;

const CATEGORY_BASE_FOLDERS: Record<FileCategory, string> = {
  PLC: "PLC",
  HMI: "HMI",
  ROBOT: "ROBOT",
  ELECTRICAL: "ELECTRICAL",
  MECHANICAL: "MECHANICAL",
  PNEUMATIC: "PNEUMATIC",
  VISION: "VISION",
  CAMERA: "CAMERA",
  PHOTO: "PHOTOS",
  VIDEO: "VIDEOS",
  FAT: "FAT",
  SAT: "SAT",
  SPARE_PARTS: "SPARE_PARTS",
  DOCUMENT: "DOCUMENTS",
  PHOTO_VIDEO: "PHOTO_VIDEO",
  BACKUP: "BACKUPS",
  COMMISSIONING: "COMMISSIONING",
  SERVICE: "SERVICE",
};

const PLATFORM_FOLDERS: Partial<Record<PlatformCode, string[]>> = {
  BECKHOFF_TWINCAT2: ["PLC", "BECKHOFF_TWINCAT2"],
  BECKHOFF_TWINCAT3: ["PLC", "BECKHOFF_TWINCAT3"],
  SIEMENS_TIA: ["PLC", "SIEMENS_TIA"],
  OMRON_SYSMAC: ["PLC", "OMRON_SYSMAC"],
  WEINTEK: ["HMI", "WEINTEK"],
  SIEMENS: ["HMI", "SIEMENS"],
  PROFACE: ["HMI", "PROFACE"],
  KUKA: ["ROBOT", "KUKA"],
  YASKAWA: ["ROBOT", "YASKAWA"],
  ABB: ["ROBOT", "ABB"],
};

const EXTENSION_PLATFORM_HINTS: Record<string, PlatformCode[]> = {
  ".pro": ["BECKHOFF_TWINCAT2"],
  ".tsm": ["BECKHOFF_TWINCAT2"],
  ".tpy": ["BECKHOFF_TWINCAT2"],
  ".lib": ["BECKHOFF_TWINCAT2"],
  ".exp": ["BECKHOFF_TWINCAT2"],
  ".tcpou": ["BECKHOFF_TWINCAT2", "BECKHOFF_TWINCAT3"],
  ".tcdut": ["BECKHOFF_TWINCAT2", "BECKHOFF_TWINCAT3"],
  ".tcgvl": ["BECKHOFF_TWINCAT2", "BECKHOFF_TWINCAT3"],
  ".sln": ["BECKHOFF_TWINCAT3"],
  ".tsproj": ["BECKHOFF_TWINCAT3"],
  ".plcproj": ["BECKHOFF_TWINCAT3"],
  ".tmc": ["BECKHOFF_TWINCAT3"],
  ".s7p": ["SIEMENS_TIA"],
  ".awl": ["SIEMENS_TIA"],
  ".scl": ["SIEMENS_TIA"],
  ".db": ["SIEMENS_TIA"],
  ".smc2": ["OMRON_SYSMAC"],
  ".csm2": ["OMRON_SYSMAC"],
  ".opt": ["OMRON_SYSMAC"],
  ".cxp": ["OMRON_SYSMAC"],
  ".emtp": ["WEINTEK"],
  ".mtp": ["WEINTEK"],
  ".xob": ["WEINTEK"],
  ".exob": ["WEINTEK"],
  ".cmp": ["WEINTEK"],
  ".fwx": ["SIEMENS"],
  ".psb": ["SIEMENS"],
  ".prx": ["PROFACE"],
  ".prw": ["PROFACE"],
  ".ltx": ["PROFACE"],
  ".src": ["KUKA"],
  ".sub": ["KUKA"],
  ".jbi": ["YASKAWA"],
  ".cnd": ["YASKAWA"],
  ".lst": ["YASKAWA"],
  ".prm": ["YASKAWA"],
  ".mod": ["ABB"],
  ".sys": ["ABB"],
  ".cfg": ["ABB"],
  ".prg": ["ABB"],
};

const ARCHIVE_EXTENSIONS = new Set([".zip", ".rar", ".7z", ".tar", ".gz"]);

const PLATFORM_CATEGORY: Partial<Record<PlatformCode, FileCategory>> = {
  BECKHOFF_TWINCAT2: "PLC",
  BECKHOFF_TWINCAT3: "PLC",
  SIEMENS_TIA: "PLC",
  OMRON_SYSMAC: "PLC",
  WEINTEK: "HMI",
  SIEMENS: "HMI",
  PROFACE: "HMI",
  KUKA: "ROBOT",
  YASKAWA: "ROBOT",
  ABB: "ROBOT",
};

export function validateProjectCode(projectCode: string): string {
  const normalized = projectCode.trim().toUpperCase();

  if (!SAFE_PROJECT_CODE_PATTERN.test(normalized)) {
    throw new Error("Invalid project code. Use uppercase letters, numbers, and dash separators only.");
  }

  return normalized;
}

export function validateVersion(version: string): string {
  const normalized = version.trim().toUpperCase();

  if (!VERSION_PATTERN.test(normalized)) {
    throw new Error("Invalid version. Use VMAJOR.MINOR format, for example V1.0.");
  }

  return normalized;
}

export function normalizeToken(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ğĞ]/g, "G")
    .replace(/[üÜ]/g, "U")
    .replace(/[şŞ]/g, "S")
    .replace(/[ıİ]/g, "I")
    .replace(/[öÖ]/g, "O")
    .replace(/[çÇ]/g, "C")
    .replace(UNSAFE_FILENAME_CHARS, "_")
    .replace(MULTIPLE_UNDERSCORES, "_")
    .replace(/^_+|_+$/g, "");
}

export function sanitizeFileName(fileName: string): string {
  const baseName = basename(fileName.trim()).replace(/\s+/g, "_");
  const sanitized = normalizeToken(baseName);

  if (!sanitized || sanitized === "." || sanitized === "..") {
    throw new Error("Invalid filename.");
  }

  return sanitized;
}

export function buildStoredFileName(input: StoredFileNameInput): string {
  const projectCode = validateProjectCode(input.projectCode);
  const version = validateVersion(input.version);
  const category = input.category;
  const platform = normalizeToken(input.platform || "GENERAL").toUpperCase() || "GENERAL";
  const date = formatStorageDate(input.date || new Date());
  const originalFileName = sanitizeFileName(input.originalFileName);

  return `${projectCode}_${category}_${platform}_${version}_${date}_${originalFileName}`;
}

export async function calculateSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);

    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

export function resolveCategoryPlatform(input: FileClassificationInput): CategoryPlatformResolution {
  const category = input.category;
  const extension = extname(input.originalFileName).toLowerCase();
  const platform = normalizePlatform(input.platform);
  const hints = EXTENSION_PLATFORM_HINTS[extension] || [];
  const warnings: string[] = [];

  if (ARCHIVE_EXTENSIONS.has(extension) && category === "BACKUP") {
    warnings.push("Archive category is ambiguous; confirm whether it contains PLC, HMI, Robot, or mixed files.");
  }

  for (const hintedPlatform of hints) {
    const expectedCategory = PLATFORM_CATEGORY[hintedPlatform];
    if (expectedCategory && expectedCategory !== category) {
      warnings.push(
        `${extension} usually belongs to ${expectedCategory}/${hintedPlatform}; confirm before storing under ${category}.`,
      );
    }
  }

  if (extension === ".dwg" && category === "PLC") {
    warnings.push(".dwg is usually an electrical or mechanical drawing; confirm before storing under PLC.");
  }

  if (platform && platform !== "GENERAL") {
    const expectedCategory = PLATFORM_CATEGORY[platform];
    if (expectedCategory && expectedCategory !== category) {
      warnings.push(`${platform} is normally stored under ${expectedCategory}; confirm category ${category}.`);
    }
  }

  return {
    category,
    platform,
    folderSegments: resolveFolderSegments(category, platform),
    warnings,
  };
}

export function resolveFolderSegments(category: FileCategory, platform?: PlatformCode | "GENERAL"): string[] {
  if (platform && platform !== "GENERAL") {
    const platformFolders = PLATFORM_FOLDERS[platform];
    if (platformFolders && platformFolders[0] === CATEGORY_BASE_FOLDERS[category]) {
      return platformFolders;
    }
  }

  return [CATEGORY_BASE_FOLDERS[category]];
}

export function formatStorageDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizePlatform(platform?: PlatformCode | string | null): PlatformCode | "GENERAL" {
  if (!platform) {
    return "GENERAL";
  }

  const normalized = normalizeToken(platform).toUpperCase();

  if (isPlatformCode(normalized)) {
    return normalized;
  }

  return "GENERAL";
}

function isPlatformCode(value: string): value is PlatformCode {
  return [
    "BECKHOFF_TWINCAT2",
    "BECKHOFF_TWINCAT3",
    "SIEMENS_TIA",
    "OMRON_SYSMAC",
    "WEINTEK",
    "SIEMENS",
    "PROFACE",
    "KUKA",
    "YASKAWA",
    "ABB",
    "GENERAL",
  ].includes(value);
}
