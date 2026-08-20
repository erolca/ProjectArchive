import {
  getRouteParams,
  handleApiError,
  parseIntegerParam,
  requireApiUser,
  successResponse,
  type RouteContext,
} from "../../../../../lib/api-response";
import { unarchiveProject } from "../../../../../modules/projects/project.service";

export async function POST(request: Request, context: RouteContext<{ id: string }>): Promise<Response> {
  try {
    const user = await requireApiUser(request);
    const { id } = await getRouteParams(context);
    const result = await unarchiveProject(user, parseIntegerParam(id, "id"));

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
