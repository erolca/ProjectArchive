import { execFile } from "node:child_process";
import { open, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { ArchiveTreeItem } from "../files/file-preview.types";
import type { FileIntelligenceField, FileIntelligenceKind, FileIntelligenceResult } from "./file-intelligence.types";

const execFileAsync = promisify(execFile);
const HEADER_READ_BYTES = 512 * 1024;
const PDF_READ_LIMIT_BYTES = 32 * 1024 * 1024;
const TEXT_ANALYSIS_LIMIT_BYTES = 4 * 1024 * 1024;

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".bmp", ".gif", ".webp"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".webm"]);
const TEXT_EXTENSIONS = new Set([".txt", ".log", ".csv", ".json", ".xml"]);
const ARCHIVE_EXTENSIONS = new Set([".zip", ".rar", ".7z"]);

export async function analyzeFileIntelligence(
  filePath: string,
  fileName: string,
  archiveTree?: ArchiveTreeItem[],
): Promise<FileIntelligenceResult> {
  const kind = getIntelligenceKind(fileName);

  try {
    if (kind === "pdf") return analyzePdf(filePath);
    if (kind === "image") return analyzeImage(filePath, fileName);
    if (kind === "video") return analyzeVideo(filePath, fileName);
    if (kind === "archive") return analyzeArchive(filePath, fileName, archiveTree);
    if (kind === "text") return analyzeText(filePath);

    return {
      kind,
      status: "UNSUPPORTED",
      sections: [],
      warnings: ["File intelligence is not available for this file type."],
    };
  } catch (error) {
    return {
      kind,
      status: "FAILED",
      sections: [],
      warnings: [error instanceof Error ? error.message : "File intelligence extraction failed."],
    };
  }
}

function getIntelligenceKind(fileName: string): FileIntelligenceKind {
  const extension = path.extname(fileName).toLowerCase();

  if (extension === ".pdf") return "pdf";
  if (IMAGE_EXTENSIONS.has(extension)) return "image";
  if (VIDEO_EXTENSIONS.has(extension)) return "video";
  if (ARCHIVE_EXTENSIONS.has(extension)) return "archive";
  if (TEXT_EXTENSIONS.has(extension)) return "text";

  return "unsupported";
}

async function analyzePdf(filePath: string): Promise<FileIntelligenceResult> {
  const fileStat = await stat(filePath);
  const readSize = Math.min(Number(fileStat.size), PDF_READ_LIMIT_BYTES);
  const handle = await open(filePath, "r");

  try {
    const buffer = Buffer.alloc(readSize);
    const { bytesRead } = await handle.read(buffer, 0, readSize, 0);
    const content = buffer.subarray(0, bytesRead).toString("latin1");
    const infoFields: FileIntelligenceField[] = compactFields([
      ["PDF Version", extractPdfVersion(content)],
      ["Page Count", String(countPdfPages(content))],
      ["Title", extractPdfInfo(content, "Title")],
      ["Author", extractPdfInfo(content, "Author")],
      ["Subject", extractPdfInfo(content, "Subject")],
      ["Creator", extractPdfInfo(content, "Creator")],
      ["Producer", extractPdfInfo(content, "Producer")],
      ["Creation Date", normalizePdfDate(extractPdfInfo(content, "CreationDate"))],
      ["Modification Date", normalizePdfDate(extractPdfInfo(content, "ModDate"))],
    ]);

    return {
      kind: "pdf",
      status: fileStat.size > BigInt(PDF_READ_LIMIT_BYTES) ? "PARTIAL" : "EXTRACTED",
      sections: [{ title: "PDF Metadata", fields: infoFields }],
      warnings:
        fileStat.size > BigInt(PDF_READ_LIMIT_BYTES)
          ? ["Large PDF analyzed from the first 32 MB. Page count may be approximate."]
          : [],
    };
  } finally {
    await handle.close();
  }
}

async function analyzeImage(filePath: string, fileName: string): Promise<FileIntelligenceResult> {
  const header = await readHeader(filePath);
  const extension = path.extname(fileName).toLowerCase();
  const metadata = readImageMetadata(header, extension);
  const exif = readJpegExifSummary(header);

  return {
    kind: "image",
    status: metadata ? "EXTRACTED" : "PARTIAL",
    sections: [
      {
        title: "Image Metadata",
        fields: compactFields([
          ["Width", metadata?.width ? `${metadata.width}px` : undefined],
          ["Height", metadata?.height ? `${metadata.height}px` : undefined],
          ["Resolution", metadata?.resolution],
          ["Color Model", metadata?.colorModel],
        ]),
      },
      ...(exif.length ? [{ title: "EXIF", fields: exif }] : []),
    ],
    warnings: metadata ? [] : ["Image header could not be fully interpreted."],
  };
}

async function analyzeVideo(filePath: string, fileName: string): Promise<FileIntelligenceResult> {
  const extension = path.extname(fileName).toLowerCase();
  const fallbackFields = compactFields([["Container", extension.replace(".", "").toUpperCase()]]);

  try {
    const { stdout } = await execFileAsync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=format_name,duration:stream=codec_name,width,height,avg_frame_rate",
        "-of",
        "json",
        filePath,
      ],
      {
        windowsHide: true,
        timeout: 10000,
        maxBuffer: 1024 * 1024,
      },
    );
    const payload = JSON.parse(stdout) as {
      format?: { format_name?: string; duration?: string };
      streams?: Array<{ codec_name?: string; width?: number; height?: number; avg_frame_rate?: string }>;
    };
    const videoStream = payload.streams?.find((stream) => stream.width || stream.height) || payload.streams?.[0];

    return {
      kind: "video",
      status: "EXTRACTED",
      sections: [
        {
          title: "Video Metadata",
          fields: compactFields([
            ["Duration", formatDuration(payload.format?.duration)],
            ["Width", videoStream?.width ? `${videoStream.width}px` : undefined],
            ["Height", videoStream?.height ? `${videoStream.height}px` : undefined],
            ["Codec", videoStream?.codec_name],
            ["Container", payload.format?.format_name || extension.replace(".", "").toUpperCase()],
            ["FPS", formatFps(videoStream?.avg_frame_rate)],
          ]),
        },
      ],
      warnings: [],
    };
  } catch {
    return {
      kind: "video",
      status: "PARTIAL",
      sections: [{ title: "Video Metadata", fields: fallbackFields }],
      warnings: ["Detailed video metadata requires ffprobe on the server."],
    };
  }
}

async function analyzeArchive(
  filePath: string,
  fileName: string,
  archiveTree?: ArchiveTreeItem[],
): Promise<FileIntelligenceResult> {
  const fileStat = await stat(filePath);
  const tree = archiveTree || [];
  const files = flattenArchiveFiles(tree);
  const folders = flattenArchiveFolders(tree);
  const topLevelFolders = tree.filter((item) => item.type === "folder").map((item) => item.name);
  const largestFile = files.reduce<ArchiveTreeItem | null>(
    (largest, item) => (!largest || Number(item.size || 0) > Number(largest.size || 0) ? item : largest),
    null,
  );
  const totalUncompressedSize = files.reduce((sum, item) => sum + Number(item.size || 0), 0);
  const extension = path.extname(fileName).toLowerCase();
  const isLimitedFallback = tree.length === 1 && tree[0]?.name === fileName && files.length === 1;

  return {
    kind: "archive",
    status: isLimitedFallback ? "PARTIAL" : "EXTRACTED",
    sections: [
      {
        title: "Archive Metadata",
        fields: compactFields([
          ["Container", extension.replace(".", "").toUpperCase()],
          ["File Count", String(isLimitedFallback ? 0 : files.length)],
          ["Folder Count", String(isLimitedFallback ? 0 : folders.length)],
          ["Total Uncompressed Size", isLimitedFallback ? undefined : formatBytes(totalUncompressedSize)],
          ["Largest File", largestFile && !isLimitedFallback ? `${largestFile.path} (${formatBytes(Number(largestFile.size || 0))})` : undefined],
          ["Top-level Folders", topLevelFolders.length ? topLevelFolders.join(", ") : undefined],
          ["Archive File Size", formatBytes(Number(fileStat.size))],
        ]),
      },
    ],
    warnings: isLimitedFallback ? ["Archive listing tooling is unavailable or could not read this archive format."] : [],
  };
}

async function analyzeText(filePath: string): Promise<FileIntelligenceResult> {
  const fileStat = await stat(filePath);
  const readSize = Math.min(Number(fileStat.size), TEXT_ANALYSIS_LIMIT_BYTES);
  const handle = await open(filePath, "r");

  try {
    const buffer = Buffer.alloc(readSize);
    const { bytesRead } = await handle.read(buffer, 0, readSize, 0);
    const sample = buffer.subarray(0, bytesRead);
    const encoding = detectEncoding(sample);
    const text = sample.toString(encoding === "UTF-16 LE" ? "utf16le" : "utf8");

    return {
      kind: "text",
      status: fileStat.size > BigInt(TEXT_ANALYSIS_LIMIT_BYTES) ? "PARTIAL" : "EXTRACTED",
      sections: [
        {
          title: "Text Metadata",
          fields: compactFields([
            ["Line Count", String(countLines(text))],
            ["Character Count", String(text.length)],
            ["Encoding", encoding],
          ]),
        },
      ],
      warnings:
        fileStat.size > BigInt(TEXT_ANALYSIS_LIMIT_BYTES)
          ? ["Large text file analyzed from the first 4 MB. Counts are partial."]
          : [],
    };
  } finally {
    await handle.close();
  }
}

async function readHeader(filePath: string): Promise<Buffer> {
  const handle = await open(filePath, "r");

  try {
    const buffer = Buffer.alloc(HEADER_READ_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, HEADER_READ_BYTES, 0);

    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

function readImageMetadata(buffer: Buffer, extension: string) {
  if (extension === ".png" && buffer.length >= 29 && buffer.subarray(1, 4).toString("ascii") === "PNG") {
    const colorType = buffer.readUInt8(25);
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
      colorModel: pngColorModel(colorType),
      resolution: undefined,
    };
  }

  if ((extension === ".jpg" || extension === ".jpeg") && buffer.readUInt16BE(0) === 0xffd8) {
    return readJpegDimensions(buffer);
  }

  if (extension === ".gif" && buffer.subarray(0, 3).toString("ascii") === "GIF") {
    return {
      width: buffer.readUInt16LE(6),
      height: buffer.readUInt16LE(8),
      colorModel: "Indexed RGB",
      resolution: undefined,
    };
  }

  if (extension === ".bmp" && buffer.subarray(0, 2).toString("ascii") === "BM") {
    const bitsPerPixel = buffer.readUInt16LE(28);
    return {
      width: buffer.readInt32LE(18),
      height: Math.abs(buffer.readInt32LE(22)),
      colorModel: `${bitsPerPixel}-bit bitmap`,
      resolution: undefined,
    };
  }

  if (extension === ".webp" && buffer.subarray(0, 4).toString("ascii") === "RIFF") {
    return readWebpDimensions(buffer);
  }

  return null;
}

function readJpegDimensions(buffer: Buffer) {
  let offset = 2;

  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);

    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
        colorModel: jpegColorModel(buffer.readUInt8(offset + 9)),
        resolution: readJpegResolution(buffer),
      };
    }

    offset += 2 + length;
  }

  return null;
}

function readWebpDimensions(buffer: Buffer) {
  const chunk = buffer.subarray(12, 16).toString("ascii");

  if (chunk === "VP8X" && buffer.length >= 30) {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
      colorModel: "WebP",
      resolution: undefined,
    };
  }

  if (chunk === "VP8 " && buffer.length >= 30) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
      colorModel: "WebP",
      resolution: undefined,
    };
  }

  if (chunk === "VP8L" && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21);
    return {
      width: 1 + (bits & 0x3fff),
      height: 1 + ((bits >> 14) & 0x3fff),
      colorModel: "WebP Lossless",
      resolution: undefined,
    };
  }

  return null;
}

function readJpegResolution(buffer: Buffer): string | undefined {
  let offset = 2;

  while (offset + 14 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);

    if (marker === 0xe0 && buffer.subarray(offset + 4, offset + 9).toString("ascii") === "JFIF\0") {
      const unit = buffer.readUInt8(offset + 11);
      const xDensity = buffer.readUInt16BE(offset + 12);
      const yDensity = buffer.readUInt16BE(offset + 14);
      const unitLabel = unit === 1 ? "dpi" : unit === 2 ? "dpcm" : "aspect";

      return `${xDensity} x ${yDensity} ${unitLabel}`;
    }

    offset += 2 + length;
  }

  return undefined;
}

function readJpegExifSummary(buffer: Buffer): FileIntelligenceField[] {
  const exifStart = buffer.indexOf(Buffer.from("Exif\0\0", "ascii"));

  if (exifStart < 0) {
    return [];
  }

  return [{ label: "EXIF", value: "Present" }];
}

function pngColorModel(colorType: number): string {
  const models: Record<number, string> = {
    0: "Grayscale",
    2: "Truecolor RGB",
    3: "Indexed color",
    4: "Grayscale with alpha",
    6: "Truecolor RGB with alpha",
  };

  return models[colorType] || `PNG color type ${colorType}`;
}

function jpegColorModel(components: number): string {
  if (components === 1) return "Grayscale";
  if (components === 3) return "YCbCr/RGB";
  if (components === 4) return "CMYK";

  return `${components} components`;
}

function extractPdfVersion(content: string): string | undefined {
  return content.match(/^%PDF-([0-9.]+)/)?.[1];
}

function countPdfPages(content: string): number {
  return (content.match(/\/Type\s*\/Page\b/g) || []).length;
}

function extractPdfInfo(content: string, key: string): string | undefined {
  const match = content.match(new RegExp(`/${key}\\s*(\\((?:\\\\.|[^\\\\)])*\\)|<[^>]*>)`));
  const value = match?.[1];

  if (!value) {
    return undefined;
  }

  if (value.startsWith("<")) {
    return decodePdfHexString(value.slice(1, -1));
  }

  return decodePdfLiteralString(value.slice(1, -1));
}

function decodePdfLiteralString(value: string): string {
  return value.replace(/\\([nrtbf()\\])/g, (_match, escaped: string) => {
    const map: Record<string, string> = {
      n: "\n",
      r: "\r",
      t: "\t",
      b: "\b",
      f: "\f",
      "(": "(",
      ")": ")",
      "\\": "\\",
    };

    return map[escaped] || escaped;
  });
}

function decodePdfHexString(value: string): string {
  const clean = value.replace(/\s/g, "");
  const bytes = Buffer.from(clean.length % 2 === 0 ? clean : `${clean}0`, "hex");

  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    const utf16le = Buffer.from(bytes.subarray(2));

    for (let index = 0; index + 1 < utf16le.length; index += 2) {
      const high = utf16le[index];
      utf16le[index] = utf16le[index + 1];
      utf16le[index + 1] = high;
    }

    return utf16le.toString("utf16le");
  }

  return bytes.toString("utf8").replace(/\0/g, "");
}

function normalizePdfDate(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const match = value.match(/^D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?/);

  if (!match) {
    return value;
  }

  const [, year, month = "01", day = "01", hour = "00", minute = "00", second = "00"] = match;

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function flattenArchiveFiles(tree: ArchiveTreeItem[]): ArchiveTreeItem[] {
  return tree.flatMap((item) => {
    if (item.type === "file") return [item];

    return flattenArchiveFiles(item.children || []);
  });
}

function flattenArchiveFolders(tree: ArchiveTreeItem[]): ArchiveTreeItem[] {
  return tree.flatMap((item) => {
    if (item.type === "file") return [];

    return [item, ...flattenArchiveFolders(item.children || [])];
  });
}

function detectEncoding(buffer: Buffer): "UTF-8" | "UTF-16 LE" | "UTF-8 BOM" | "Binary/Unknown" {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return "UTF-8 BOM";
  }

  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return "UTF-16 LE";
  }

  if (buffer.includes(0)) {
    return "Binary/Unknown";
  }

  return buffer.toString("utf8").includes("\uFFFD") ? "Binary/Unknown" : "UTF-8";
}

function countLines(value: string): number {
  if (!value) {
    return 0;
  }

  return value.split(/\r\n|\r|\n/).length;
}

function formatDuration(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const seconds = Number(value);

  if (!Number.isFinite(seconds)) {
    return undefined;
  }

  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const remainingSeconds = rounded % 60;

  return hours ? `${hours}h ${minutes}m ${remainingSeconds}s` : `${minutes}m ${remainingSeconds}s`;
}

function formatFps(value?: string): string | undefined {
  if (!value || value === "0/0") {
    return undefined;
  }

  const [numerator, denominator] = value.split("/").map(Number);

  if (!denominator) {
    return value;
  }

  return (numerator / denominator).toFixed(2);
}

function formatBytes(bytes: number): string {
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

function compactFields(items: Array<[string, string | undefined]>): FileIntelligenceField[] {
  return items
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([label, value]) => ({
      label,
      value: value || "-",
    }));
}
