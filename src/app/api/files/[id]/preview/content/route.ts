import { Readable } from "node:stream";
import {
  getRouteParams,
  handleApiError,
  parseIntegerParam,
  requireApiUser,
  type RouteContext,
} from "../../../../../../lib/api-response";
import { resolveFilePreviewContent } from "../../../../../../modules/files/file-preview.service";

export async function GET(request: Request, context: RouteContext<{ id: string }>): Promise<Response> {
  try {
    const user = await requireApiUser(request);
    const { id } = await getRouteParams(context);
    const result = await resolveFilePreviewContent(user, parseIntegerParam(id, "id"));
    const stream = Readable.toWeb(result.stream) as ReadableStream<Uint8Array>;

    return new Response(stream, {
      headers: {
        "content-type": result.contentType,
        "content-disposition": `inline; filename="${escapeHeaderValue(result.fileName)}"`,
        "content-length": String(result.size),
        "cache-control": "private, max-age=60",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

function escapeHeaderValue(value: string): string {
  return value.replace(/["\\\r\n]/g, "_");
}
