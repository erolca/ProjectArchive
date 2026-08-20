import { handleApiError, readJsonBody, successResponse } from "../../../../lib/api-response";
import { logoutFromAuthorizationHeader } from "../../../../modules/auth/auth.service";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJsonBody<{ reason?: "MANUAL" | "INACTIVITY" }>(request);

    await logoutFromAuthorizationHeader(request.headers.get("authorization"), body.reason || "MANUAL");

    return successResponse({ loggedOut: true });
  } catch (error) {
    return handleApiError(error);
  }
}
