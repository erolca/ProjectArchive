import {
  getRouteParams,
  handleApiError,
  parseIntegerParam,
  requireApiUser,
  successResponse,
  type RouteContext,
} from "../../../../../lib/api-response";
import { listProjectFiles } from "../../../../../modules/files/file.service";

export async function GET(request: Request, context: RouteContext<{ id: string }>): Promise<Response> {
  try {
    const user = await requireApiUser(request);
    const { id } = await getRouteParams(context);
    const files = await listProjectFiles(user, parseIntegerParam(id, "id"));

    return successResponse(files);
  } catch (error) {
    return handleApiError(error);
  }
}
