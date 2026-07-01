import { handleApiError, readJsonBody, successResponse } from "../../../../lib/api-response";
import { login } from "../../../../modules/auth/auth.service";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJsonBody(request);
    const result = await login(body as never);

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
