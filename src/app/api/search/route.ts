import { handleApiError, queryParamsToObject, requireApiUser, successResponse } from "../../../lib/api-response";
import { searchEnterprise } from "../../../modules/search/search.service";

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await requireApiUser(request);
    const result = await searchEnterprise(user, queryParamsToObject(request.url));

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
