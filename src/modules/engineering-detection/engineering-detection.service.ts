import path from "node:path";
import type { ArchiveTreeItem } from "../files/file-preview.types";
import type {
  EngineeringDetectionCategory,
  EngineeringDetectionInput,
  EngineeringDetectionResult,
} from "./engineering-detection.types";
import { runEngineeringScanners } from "./scanners";

interface DetectionRule {
  detectedType: string;
  category: Exclude<EngineeringDetectionCategory, "UNKNOWN">;
  manufacturer: string;
  platform: string;
  confidence: number;
  patterns: RegExp[];
}

const DETECTION_RULES: DetectionRule[] = [
  rule("Beckhoff TwinCAT 3", "PLC", "Beckhoff", "TwinCAT 3", 94, [
    /\.tsproj$/i,
    /\.plcproj$/i,
    /\.tmc$/i,
    /twincat[\s_-]*3/i,
    /twincat project/i,
    /(^|\/)_boot(\/|$)/i,
  ]),
  rule("Beckhoff TwinCAT 2", "PLC", "Beckhoff", "TwinCAT 2", 90, [
    /\.pro$/i,
    /\.tsm$/i,
    /\.tpy$/i,
    /twincat[\s_-]*2/i,
  ]),
  rule("Siemens TIA Portal", "PLC", "Siemens", "TIA Portal", 94, [
    /\.ap\d+$/i,
    /\.zap\d+$/i,
    /\.zal\d+$/i,
    /tia[\s_-]*portal/i,
  ]),
  rule("Siemens STEP7", "PLC", "Siemens", "STEP7", 92, [/\.s7p$/i, /step[\s_-]*7/i]),
  rule("Codesys", "PLC", "Codesys", "Codesys", 84, [/\.project$/i, /\.library$/i, /\.device$/i, /codesys/i]),
  rule("Rockwell Studio5000", "PLC", "Rockwell", "Studio5000", 88, [/\.acd$/i, /\.l5x$/i, /\.l5k$/i, /studio[\s_-]*5000/i]),
  rule("Yaskawa Robot", "ROBOT", "Yaskawa", "Yaskawa", 92, [/\.jbi$/i, /yaskawa/i, /motoman/i]),
  rule("KUKA Robot", "ROBOT", "KUKA", "KUKA", 88, [/\.src$/i, /\.dat$/i, /(^|\/)krc(\/|$)/i, /(^|\/)r1(\/|$)/i, /kuka/i]),
  rule("ABB Robot", "ROBOT", "ABB", "ABB", 88, [/\.mod$/i, /\.sys$/i, /rapid/i, /abb/i]),
  rule("FANUC Robot", "ROBOT", "FANUC", "FANUC", 86, [/\.ls$/i, /\.tp$/i, /fanuc/i]),
  rule("Universal Robots", "ROBOT", "Universal Robots", "PolyScope", 86, [/\.urp$/i, /\.script$/i, /polyscope/i, /universal[\s_-]*robots/i]),
  rule("Siemens WinCC Unified", "HMI", "Siemens", "WinCC Unified", 90, [/wincc[\s_-]*unified/i]),
  rule("Siemens WinCC", "HMI", "Siemens", "WinCC", 84, [/\.fwx$/i, /\.psb$/i, /wincc/i]),
  rule("Weintek EasyBuilder", "HMI", "Weintek", "EasyBuilder", 90, [/\.emtp$/i, /\.mtp$/i, /\.xob$/i, /\.exob$/i, /easybuilder/i, /weintek/i]),
  rule("Pro-face GP-Pro", "HMI", "Pro-face", "GP-Pro", 88, [/\.prx$/i, /\.prw$/i, /gp[\s_-]*pro/i, /pro[\s_-]*face/i]),
  rule("Ignition", "HMI", "Ignition", "Ignition", 84, [/\.proj$/i, /ignition/i]),
  rule("Cognex Vision", "VISION", "Cognex", "In-Sight / VisionPro", 86, [/\.job$/i, /\.vpp$/i, /cognex/i, /in[\s_-]*sight/i, /visionpro/i]),
  rule("Keyence Vision", "VISION", "Keyence", "CV-X / XG-X", 84, [/keyence/i, /cv[\s_-]*x/i, /xg[\s_-]*x/i]),
  rule("Omron Vision", "VISION", "Omron", "FH", 82, [/omron/i, /(^|\/)fh(\/|$)/i]),
  rule("Sick Vision", "VISION", "Sick", "Inspector", 82, [/sick/i, /inspector/i]),
  rule("EPLAN", "ELECTRICAL", "EPLAN", "EPLAN P8", 90, [/\.zw1$/i, /\.edz$/i, /eplan/i]),
  rule("AutoCAD Electrical", "ELECTRICAL", "AutoCAD", "AutoCAD Electrical", 78, [
    /autocad[\s_-]*electrical/i,
    /acade/i,
    /electrical.*\.(dwg|dxf)$/i,
    /\.(dwg|dxf)$/i,
  ]),
  rule("SEE Electrical", "ELECTRICAL", "SEE Electrical", "SEE Electrical", 84, [/see[\s_-]*electrical/i]),
];

export function detectEngineeringFile(input: EngineeringDetectionInput): EngineeringDetectionResult {
  const candidates = buildCandidates(input);
  const evidence: string[] = [];
  const scannerResults = runEngineeringScanners(input);

  if (input.category) evidence.push(`Uploaded category: ${input.category}`);
  if (input.manufacturer) evidence.push(`Uploaded manufacturer: ${input.manufacturer}`);
  if (input.softwareName || input.platform) evidence.push(`Uploaded platform/software: ${input.softwareName || input.platform}`);

  const ruleMatches = DETECTION_RULES.flatMap((ruleItem) => {
    const matches = candidates.filter((candidate) => ruleItem.patterns.some((pattern) => pattern.test(candidate.normalized)));

    if (!matches.length) return [];

    return [
      {
        rule: ruleItem,
        evidence: matches.slice(0, 5).map((match) => match.label),
      },
    ];
  });

  const metadataResult = detectFromMetadata(input, evidence);
  const bestRule = ruleMatches.sort((left, right) => right.rule.confidence - left.rule.confidence)[0];

  if (!bestRule && metadataResult) {
    return {
      ...metadataResult,
      scannerResults,
    };
  }

  if (!bestRule) {
    return {
      detectedType: null,
      category: "UNKNOWN",
      manufacturer: null,
      platform: null,
      confidence: 0,
      evidence: [],
      warnings: ["No specific engineering system was detected from this file."],
      scannerResults,
    };
  }

  const conflictingMatches = Array.from(
    new Set(
      ruleMatches
        .filter((match) => match.rule.detectedType !== bestRule.rule.detectedType)
        .map((match) => match.rule.detectedType),
    ),
  );

  const resultEvidence = [...evidence, ...bestRule.evidence.map((item) => `Matched ${item}`)];

  return {
    detectedType: bestRule.rule.detectedType,
    category: bestRule.rule.category,
    manufacturer: bestRule.rule.manufacturer,
    platform: bestRule.rule.platform,
    confidence: Math.max(bestRule.rule.confidence, metadataResult?.confidence || 0),
    evidence: resultEvidence.slice(0, 10),
    warnings: conflictingMatches.length
      ? [`Additional engineering hints were found: ${conflictingMatches.slice(0, 3).join(", ")}.`]
      : [],
    scannerResults,
  };
}

function detectFromMetadata(input: EngineeringDetectionInput, evidence: string[]): EngineeringDetectionResult | null {
  const metadataText = [input.category, input.manufacturer, input.softwareName, input.platform].filter(Boolean).join(" ");

  if (!metadataText) {
    return null;
  }

  const metadataCandidate = {
    label: "uploaded engineering metadata",
    normalized: normalize(metadataText),
  };
  const match = DETECTION_RULES.find((ruleItem) => ruleItem.patterns.some((pattern) => pattern.test(metadataCandidate.normalized)));

  if (!match && input.manufacturer) {
    return {
      detectedType: `${input.manufacturer}${input.softwareName ? ` ${input.softwareName}` : ""}`,
      category: normalizeCategory(input.category),
      manufacturer: input.manufacturer,
      platform: input.softwareName || input.platform || null,
      confidence: 70,
      evidence,
      warnings: [],
      scannerResults: [],
    };
  }

  if (!match) {
    return null;
  }

  return {
    detectedType: match.detectedType,
    category: match.category,
    manufacturer: match.manufacturer,
    platform: input.softwareName || match.platform,
    confidence: 82,
    evidence,
    warnings: [],
    scannerResults: [],
  };
}

function buildCandidates(input: EngineeringDetectionInput): Array<{ label: string; normalized: string }> {
  const archiveEntries = flattenArchiveTree(input.archiveTree || []);
  const names = [
    { label: `file name "${input.fileName}"`, value: input.fileName },
    { label: `file extension "${path.extname(input.fileName)}"`, value: path.extname(input.fileName) },
    ...archiveEntries.map((entry) => ({
      label: `archive entry "${entry.path}"`,
      value: entry.path,
    })),
  ];

  return names
    .filter((candidate) => candidate.value)
    .map((candidate) => ({
      label: candidate.label,
      normalized: normalize(candidate.value),
    }));
}

function flattenArchiveTree(tree: ArchiveTreeItem[]): Array<{ path: string; type: "folder" | "file" }> {
  return tree.flatMap((item) => [
    { path: item.path, type: item.type },
    ...flattenArchiveTree(item.children || []),
  ]);
}

function normalize(value: string): string {
  return value.replaceAll("\\", "/").toLowerCase();
}

function normalizeCategory(category?: string | null): EngineeringDetectionCategory {
  if (category === "PLC" || category === "ROBOT" || category === "HMI" || category === "VISION" || category === "ELECTRICAL") {
    return category;
  }

  return "UNKNOWN";
}

function rule(
  detectedType: string,
  category: Exclude<EngineeringDetectionCategory, "UNKNOWN">,
  manufacturer: string,
  platform: string,
  confidence: number,
  patterns: RegExp[],
): DetectionRule {
  return {
    detectedType,
    category,
    manufacturer,
    platform,
    confidence,
    patterns,
  };
}
