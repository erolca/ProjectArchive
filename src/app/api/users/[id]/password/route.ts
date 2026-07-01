import {
  getRouteParams,
  handleApiError,
  parseIntegerParam,
  readJsonBody,
  requireApiUser,
  successResponse,
  type RouteContext,
} from "../../../../../lib/api-response";
import { resetUserPassword } from "../../../../../modules/users/user.service";

export async function POST(request: Request, context: RouteContext<{ id: string }>): Promise<Response> {
  try {
    const currentUser = await requireApiUser(request);
    const { id } = await getRouteParams(context);
    const body = await readJsonBody(request);
    const user = await resetUserPassword(currentUser, parseIntegerParam(id, "id"), body as never);

    return successResponse(user);
  } catch (error) {
    return handleApiError(error);
  }
}
