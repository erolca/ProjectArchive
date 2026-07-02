import {
  getRouteParams,
  handleApiError,
  parseIntegerParam,
  requireApiUser,
  successResponse,
  type RouteContext,
} from "../../../../../lib/api-response";
import { getFilePreview } from "../../../../../modules/files/file-preview.service";

export async function GET(request: Request, context: RouteContext<{ id: string }>): Promise<Response> {
  try {
    const user = await requireApiUser(request);
    const { id } = await getRouteParams(context);
    const preview = await getFilePreview(user, parseIntegerParam(id, "id"));

    return successResponse(preview);
  } catch (error) {
    return handleApiError(error);
  }
}
