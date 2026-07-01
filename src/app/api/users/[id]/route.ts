import {
  getRouteParams,
  handleApiError,
  parseIntegerParam,
  readJsonBody,
  requireApiUser,
  successResponse,
  type RouteContext,
} from "../../../../lib/api-response";
import { deleteUser, updateUser } from "../../../../modules/users/user.service";

export async function PUT(request: Request, context: RouteContext<{ id: string }>): Promise<Response> {
  try {
    const currentUser = await requireApiUser(request);
    const { id } = await getRouteParams(context);
    const body = await readJsonBody(request);
    const user = await updateUser(currentUser, parseIntegerParam(id, "id"), body as never);

    return successResponse(user);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext<{ id: string }>): Promise<Response> {
  try {
    const currentUser = await requireApiUser(request);
    const { id } = await getRouteParams(context);
    const user = await deleteUser(currentUser, parseIntegerParam(id, "id"));

    return successResponse(user);
  } catch (error) {
    return handleApiError(error);
  }
}
