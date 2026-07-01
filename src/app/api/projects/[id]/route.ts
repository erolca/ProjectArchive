import {
  getRouteParams,
  handleApiError,
  parseIntegerParam,
  readJsonBody,
  requireApiUser,
  successResponse,
  type RouteContext,
} from "../../../../lib/api-response";
import { getProjectById, updateProject } from "../../../../modules/projects/project.service";

export async function GET(_request: Request, context: RouteContext<{ id: string }>): Promise<Response> {
  try {
    const user = await requireApiUser(_request);
    const { id } = await getRouteParams(context);
    const project = await getProjectById(user, parseIntegerParam(id, "id"));

    return successResponse(project);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request, context: RouteContext<{ id: string }>): Promise<Response> {
  try {
    const user = await requireApiUser(request);
    const { id } = await getRouteParams(context);
    const body = await readJsonBody(request);
    const project = await updateProject(user, parseIntegerParam(id, "id"), body as never);

    return successResponse(project);
  } catch (error) {
    return handleApiError(error);
  }
}
