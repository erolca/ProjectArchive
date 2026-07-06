import type { EngineeringDetectionInput, EngineeringScannerResult } from "../engineering-detection.types";
import { compactMetrics, getScannerEntries, normalize } from "./scanner-utils";

export function scanDocument(input: EngineeringDetectionInput): EngineeringScannerResult | null {
  const entries = getScannerEntries(input);
  const text = normalize([
    input.fileName,
    input.category || "",
    input.manufacturer || "",
    input.softwareName || "",
    ...entries.map((entry) => entry.path),
  ].join(" "));
  const hints = [
    ["FAT document", /\bfat\b|factory acceptance/i],
    ["SAT document", /\bsat\b|site acceptance/i],
    ["Electrical documentation", /electrical|eplan|schematic|drawing|dwg|dxf/i],
    ["Manual / Service document", /manual|service|maintenance|operation/i],
  ] as const;
  const matchedHints = hints.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
  const revision = input.fileName.match(/\b(rev(?:ision)?[\s_-]?[a-z0-9]+|v\d+(?:\.\d+)?)\b/i)?.[1];
  const isDocument = /\.(pdf|docx?|xlsx?|pptx?|csv|txt|log)$/i.test(input.fileName) || matchedHints.length > 0;

  if (!isDocument) {
    return null;
  }

  return {
    scannerName: "PDF / Document Scanner",
    detectedSystem: matchedHints[0] || "Engineering Document",
    manufacturer: input.manufacturer || "Document",
    platform: input.softwareName || "Document",
    confidence: matchedHints.length ? 78 : 55,
    summary: matchedHints.length ? `Detected document hints: ${matchedHints.join(", ")}.` : "Detected a general engineering document.",
    metrics: compactMetrics([
      ["FAT hint", matchedHints.includes("FAT document") ? "Detected" : "Not detected"],
      ["SAT hint", matchedHints.includes("SAT document") ? "Detected" : "Not detected"],
      ["Electrical documentation hint", matchedHints.includes("Electrical documentation") ? "Detected" : "Not detected"],
      ["Manual / Service hint", matchedHints.includes("Manual / Service document") ? "Detected" : "Not detected"],
      ["Revision hint", revision],
      ["File intelligence status", input.intelligence?.status],
    ]),
    evidence: matchedHints.map((hint) => `Filename or metadata indicates ${hint}.`),
    warnings: matchedHints.length ? [] : ["Only general document details were detected."],
  };
}
