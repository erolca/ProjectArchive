import type { EngineeringDetectionInput, EngineeringScannerResult } from "../engineering-detection.types";
import { compactMetrics, countByExtension, evidenceFromEntries, findByExtension, getScannerEntries, hasEntry } from "./scanner-utils";

export function scanBeckhoff(input: EngineeringDetectionInput): EngineeringScannerResult | null {
  const entries = getScannerEntries(input);
  const tsproj = countByExtension(entries, [".tsproj"]);
  const tsm = countByExtension(entries, [".tsm"]);
  const pro = countByExtension(entries, [".pro"]);
  const tmc = countByExtension(entries, [".tmc"]);
  const pouCount = countByExtension(entries, [".tcpou", ".pou", ".exp"]);
  const gvlCount = countByExtension(entries, [".tcgvl", ".gvl"]);
  const dutCount = countByExtension(entries, [".tcdut", ".dut"]);
  const libraryReferences = countByExtension(entries, [".library", ".lib", ".compiled-library"]);
  const bootProjectDetected = hasEntry(entries, /(^|\/)_boot(\/|$)|bootproject|plc_boot/i);
  const mainProject = findByExtension(entries, [".tsproj", ".tsm", ".pro"]);

  if (!tsproj && !tsm && !pro && !tmc && !bootProjectDetected && !/beckhoff|twincat/i.test(`${input.manufacturer || ""} ${input.softwareName || ""} ${input.platform || ""}`)) {
    return null;
  }

  const generation = tsproj || tmc ? "TwinCAT 3" : "TwinCAT 2";

  return {
    scannerName: "Beckhoff TwinCAT Scanner",
    detectedSystem: `Beckhoff ${generation}`,
    manufacturer: "Beckhoff",
    platform: generation,
    confidence: tsproj || tsm || pro ? 94 : 78,
    summary: `Detected ${generation} project indicators${mainProject ? ` with main project ${mainProject.name}` : ""}.`,
    metrics: compactMetrics([
      ["TwinCAT Generation", generation],
      [".tsproj files", tsproj],
      [".tsm files", tsm],
      [".pro files", pro],
      [".tmc files", tmc],
      ["POU files", pouCount],
      ["GVL files", gvlCount],
      ["DUT files", dutCount],
      ["Library references", libraryReferences],
      ["Boot project", bootProjectDetected ? "Detected" : "Not detected"],
      ["Main project file", mainProject?.path],
    ]),
    evidence: [
      ...evidenceFromEntries(entries, /\.(tsproj|tsm|pro|tmc)$/i, "Project file"),
      ...evidenceFromEntries(entries, /(^|\/)_boot(\/|$)|bootproject|plc_boot/i, "Boot project hint", 3),
    ],
    warnings: [],
  };
}
