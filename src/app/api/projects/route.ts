import {
  handleApiError,
  queryParamsToObject,
  readJsonBody,
  requireApiUser,
  successResponse,
} from "../../../lib/api-response";
import { createProject, searchProjects } from "../../../modules/projects/project.service";

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await requireApiUser(request);
    const result = await searchProjects(user, queryParamsToObject(request.url));

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const user = await requireApiUser(request);
    const body = await readJsonBody(request);
    const project = await createProject(user, body as never);

    return successResponse(project, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
