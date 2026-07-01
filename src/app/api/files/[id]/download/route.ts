import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import {
  getRouteParams,
  handleApiError,
  parseIntegerParam,
  requireApiUser,
  type RouteContext,
} from "../../../../../lib/api-response";
import { resolveFileDownload } from "../../../../../modules/files/file.service";

export async function GET(request: Request, context: RouteContext<{ id: string }>): Promise<Response> {
  try {
    const user = await requireApiUser(request);
    const { id } = await getRouteParams(context);
    const result = await resolveFileDownload(user, parseIntegerParam(id, "id"));
    const fileStat = await stat(result.absolutePath);
    const stream = Readable.toWeb(createReadStream(result.absolutePath)) as ReadableStream<Uint8Array>;

    return new Response(stream, {
      headers: {
        "content-type": "application/octet-stream",
        "content-disposition": `attachment; filename="${escapeHeaderValue(result.originalFileName)}"`,
        "content-length": String(fileStat.size),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

function escapeHeaderValue(value: string): string {
  return value.replace(/["\\\r\n]/g, "_");
}
