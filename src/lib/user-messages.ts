const TECHNICAL_MESSAGE_PATTERNS = [
  /ffprobe/i,
  /ffmpeg/i,
  /unrar/i,
  /\b7z\b/i,
  /parser/i,
  /tooling/i,
  /internal error/i,
  /exception/i,
  /stack trace/i,
  /filesystem/i,
  /implementation detail/i,
  /invalid json/i,
  /non-json/i,
  /returned html/i,
  /database_url/i,
  /jwt_secret/i,
  /storage_root/i,
  /prisma/i,
  /mysql/i,
];

const PATH_PATTERN = /([A-Za-z]:\\|\\\\[^\\]+\\|\/(?:var|home|usr|opt|srv|tmp|mnt|storage|app)\b)/;

export function sanitizeUserMessage(
  message: string | null | undefined,
  fallback = "The request could not be completed. Please try again or contact an administrator.",
): string {
  const trimmed = message?.trim();

  if (!trimmed) {
    return fallback;
  }

  if (TECHNICAL_MESSAGE_PATTERNS.some((pattern) => pattern.test(trimmed)) || PATH_PATTERN.test(trimmed)) {
    return fallback;
  }

  return trimmed;
}

export function getUserErrorMessage(error: unknown, fallback: string): string {
  return sanitizeUserMessage(error instanceof Error ? error.message : null, fallback);
}
