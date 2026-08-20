import { handleApiError, readJsonBody, successResponse } from "../../../../lib/api-response";
import { refreshSessionFromAuthorizationHeader } from "../../../../modules/auth/auth.service";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJsonBody<{ logActivity?: boolean }>(request);
    const result = await refreshSessionFromAuthorizationHeader(request.headers.get("authorization"), {
      logActivity: body.logActivity === true,
    });

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
