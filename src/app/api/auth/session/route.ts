import { handleApiError, successResponse } from "../../../../lib/api-response";
import { getSessionStatusFromAuthorizationHeader } from "../../../../modules/auth/auth.service";

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await getSessionStatusFromAuthorizationHeader(request.headers.get("authorization"));

    return successResponse(session);
  } catch (error) {
    return handleApiError(error);
  }
}
