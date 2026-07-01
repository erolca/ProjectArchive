import { handleApiError, queryParamsToObject, requireApiUser, successResponse } from "../../../../lib/api-response";
import { searchProjects } from "../../../../modules/projects/project.service";

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await requireApiUser(request);
    const result = await searchProjects(user, queryParamsToObject(request.url));

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
