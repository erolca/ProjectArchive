import type { EngineeringDetectionInput, EngineeringScannerResult } from "../engineering-detection.types";
import { compactMetrics, countByExtension, evidenceFromEntries, findEntry, getScannerEntries } from "./scanner-utils";

export function scanKuka(input: EngineeringDetectionInput): EngineeringScannerResult | null {
  const entries = getScannerEntries(input);
  const srcCount = countByExtension(entries, [".src"]);
  const datCount = countByExtension(entries, [".dat"]);
  const krcHint = findEntry(entries, /krc2|krc4|krc5|(^|\/)krc(\/|$)/i);
  const toolBaseHints = entries.filter((entry) => /tool|base|frames?/i.test(entry.path)).length;

  if (!srcCount && !datCount && !krcHint && !/kuka/i.test(`${input.manufacturer || ""} ${input.softwareName || ""} ${input.platform || ""}`)) {
    return null;
  }

  return {
    scannerName: "KUKA Robot Scanner",
    detectedSystem: "KUKA Robot",
    manufacturer: "KUKA",
    platform: krcHint?.name || "KUKA",
    confidence: srcCount ? 90 : 72,
    summary: srcCount ? `Detected ${srcCount} KUKA robot program files.` : "Detected KUKA robot archive hints.",
    metrics: compactMetrics([
      ["SRC files", srcCount],
      ["DAT files", datCount],
      ["Robot program count", srcCount],
      ["KRC hint", krcHint?.name],
      ["Tool/base hints", toolBaseHints],
    ]),
    evidence: [
      ...evidenceFromEntries(entries, /\.src$/i, "Program file"),
      ...evidenceFromEntries(entries, /\.dat$/i, "Data file"),
      ...evidenceFromEntries(entries, /krc2|krc4|krc5|(^|\/)krc(\/|$)/i, "KRC hint", 3),
    ],
    warnings: [],
  };
}
