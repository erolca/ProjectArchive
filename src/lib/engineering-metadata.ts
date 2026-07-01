export interface EngineeringPlatformOption {
  category: string;
  manufacturer: string;
  platform: string;
  code: string;
}

export const ENGINEERING_METADATA_OPTIONS: EngineeringPlatformOption[] = [
  { category: "PLC", manufacturer: "Beckhoff", platform: "TwinCAT 2", code: "BECKHOFF_TWINCAT2" },
  { category: "PLC", manufacturer: "Beckhoff", platform: "TwinCAT 3", code: "BECKHOFF_TWINCAT3" },
  { category: "PLC", manufacturer: "Siemens", platform: "STEP7", code: "SIEMENS_STEP7" },
  { category: "PLC", manufacturer: "Siemens", platform: "TIA Portal", code: "SIEMENS_TIA_PORTAL" },
  { category: "PLC", manufacturer: "Rockwell", platform: "Studio5000", code: "ROCKWELL_STUDIO5000" },
  { category: "PLC", manufacturer: "Omron", platform: "Sysmac Studio", code: "OMRON_SYSMAC_STUDIO" },
  { category: "PLC", manufacturer: "Mitsubishi", platform: "GX Works", code: "MITSUBISHI_GX_WORKS" },
  { category: "PLC", manufacturer: "Schneider", platform: "EcoStruxure", code: "SCHNEIDER_ECOSTRUXURE" },
  { category: "PLC", manufacturer: "Codesys", platform: "Codesys", code: "CODESYS_CODESYS" },
  { category: "PLC", manufacturer: "B&R", platform: "Automation Studio", code: "BR_AUTOMATION_STUDIO" },
  { category: "ROBOT", manufacturer: "Yaskawa", platform: "YRC1000", code: "YASKAWA_YRC1000" },
  { category: "ROBOT", manufacturer: "Yaskawa", platform: "DX200", code: "YASKAWA_DX200" },
  { category: "ROBOT", manufacturer: "KUKA", platform: "KRC4", code: "KUKA_KRC4" },
  { category: "ROBOT", manufacturer: "KUKA", platform: "KRC5", code: "KUKA_KRC5" },
  { category: "ROBOT", manufacturer: "ABB", platform: "IRC5", code: "ABB_IRC5" },
  { category: "ROBOT", manufacturer: "ABB", platform: "OmniCore", code: "ABB_OMNICORE" },
  { category: "ROBOT", manufacturer: "FANUC", platform: "R-30iB", code: "FANUC_R30IB" },
  { category: "ROBOT", manufacturer: "Universal Robots", platform: "PolyScope", code: "UNIVERSAL_ROBOTS_POLYSCOPE" },
  { category: "HMI", manufacturer: "Siemens", platform: "WinCC", code: "SIEMENS_WINCC" },
  { category: "HMI", manufacturer: "Siemens", platform: "WinCC Unified", code: "SIEMENS_WINCC_UNIFIED" },
  { category: "HMI", manufacturer: "Weintek", platform: "EasyBuilder Pro", code: "WEINTEK_EASYBUILDER_PRO" },
  { category: "HMI", manufacturer: "Pro-face", platform: "GP-Pro EX", code: "PROFACE_GP_PRO_EX" },
  { category: "HMI", manufacturer: "Beijer", platform: "iX Developer", code: "BEIJER_IX_DEVELOPER" },
  { category: "HMI", manufacturer: "Ignition", platform: "Ignition Perspective", code: "IGNITION_PERSPECTIVE" },
  { category: "HMI", manufacturer: "Codesys", platform: "Codesys Visualization", code: "CODESYS_VISUALIZATION" },
  { category: "VISION", manufacturer: "Cognex", platform: "In-Sight", code: "COGNEX_IN_SIGHT" },
  { category: "VISION", manufacturer: "Cognex", platform: "VisionPro", code: "COGNEX_VISIONPRO" },
  { category: "VISION", manufacturer: "Keyence", platform: "CV-X", code: "KEYENCE_CV_X" },
  { category: "VISION", manufacturer: "Keyence", platform: "XG-X", code: "KEYENCE_XG_X" },
  { category: "VISION", manufacturer: "Omron", platform: "FH", code: "OMRON_FH" },
  { category: "VISION", manufacturer: "Sick", platform: "Inspector", code: "SICK_INSPECTOR" },
  { category: "ELECTRICAL", manufacturer: "EPLAN", platform: "EPLAN P8", code: "EPLAN_P8" },
  { category: "ELECTRICAL", manufacturer: "AutoCAD", platform: "AutoCAD Electrical", code: "AUTOCAD_ELECTRICAL" },
  { category: "ELECTRICAL", manufacturer: "SEE Electrical", platform: "SEE Electrical", code: "SEE_ELECTRICAL" },
  { category: "ELECTRICAL", manufacturer: "SolidWorks", platform: "SolidWorks Electrical", code: "SOLIDWORKS_ELECTRICAL" },
  { category: "MECHANICAL", manufacturer: "SolidWorks", platform: "SolidWorks", code: "SOLIDWORKS_SOLIDWORKS" },
  { category: "MECHANICAL", manufacturer: "Autodesk", platform: "Inventor", code: "AUTODESK_INVENTOR" },
  { category: "MECHANICAL", manufacturer: "Autodesk", platform: "AutoCAD", code: "AUTODESK_AUTOCAD" },
  { category: "MECHANICAL", manufacturer: "Siemens", platform: "Solid Edge", code: "SIEMENS_SOLID_EDGE" },
];

export function resolveEngineeringMetadataCode(category: string, manufacturer?: string | null, platform?: string | null): string | null {
  if (!manufacturer || !platform) {
    return null;
  }

  const option = ENGINEERING_METADATA_OPTIONS.find(
    (item) =>
      item.category === category &&
      item.manufacturer.toLowerCase() === manufacturer.toLowerCase() &&
      item.platform.toLowerCase() === platform.toLowerCase(),
  );

  return option?.code || null;
}
