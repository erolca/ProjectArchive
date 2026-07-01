import { handleApiError, queryParamsToObject, requireApiUser, successResponse } from "../../../lib/api-response";
import { listActivity } from "../../../modules/activity/activity.service";

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await requireApiUser(request);
    const query = queryParamsToObject(request.url);
    const result = await listActivity(user, {
      page: typeof query.page === "number" ? query.page : undefined,
      pageSize: typeof query.pageSize === "number" ? query.pageSize : undefined,
      userId: typeof query.userId === "number" ? query.userId : undefined,
      projectId: typeof query.projectId === "number" ? query.projectId : undefined,
      action: typeof query.action === "string" ? (query.action as never) : undefined,
      dateFrom: typeof query.dateFrom === "string" ? query.dateFrom : undefined,
      dateTo: typeof query.dateTo === "string" ? query.dateTo : undefined,
    });

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
