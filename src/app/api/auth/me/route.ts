import { getCurrentUserFromAuthorizationHeader } from "../../../../modules/auth/auth.service";
import { errorResponse, handleApiError, successResponse } from "../../../../lib/api-response";

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await getCurrentUserFromAuthorizationHeader(request.headers.get("authorization"));

    if (!user) {
      return errorResponse("AUTHENTICATION_REQUIRED", "Authentication required.", 401);
    }

    return successResponse(user);
  } catch (error) {
    return handleApiError(error);
  }
}
