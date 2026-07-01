import { handleApiError, readJsonBody, requireApiUser, successResponse } from "../../../../lib/api-response";
import { changeOwnPassword } from "../../../../modules/profile/profile.service";

export async function POST(request: Request): Promise<Response> {
  try {
    const user = await requireApiUser(request);
    const body = await readJsonBody(request);
    const result = await changeOwnPassword(user, body);

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
