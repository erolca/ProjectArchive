import { handleApiError, requireApiUser, successResponse } from "../../../lib/api-response";
import { getDashboardSummary } from "../../../modules/dashboard/dashboard.service";

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await requireApiUser(request);
    const summary = await getDashboardSummary(user);

    return successResponse(summary);
  } catch (error) {
    return handleApiError(error);
  }
}
