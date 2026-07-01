import {
  getRouteParams,
  handleApiError,
  requireApiUser,
  successResponse,
  type RouteContext,
} from "../../../../../lib/api-response";
import { resolveProjectShortLink } from "../../../../../modules/projects/project.service";

export async function GET(request: Request, context: RouteContext<{ projectCode: string }>): Promise<Response> {
  try {
    const user = await requireApiUser(request);
    const { projectCode } = await getRouteParams(context);
    const project = await resolveProjectShortLink(user, projectCode);

    return successResponse(project);
  } catch (error) {
    return handleApiError(error);
  }
}
