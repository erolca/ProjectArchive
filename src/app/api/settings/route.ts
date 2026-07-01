import { handleApiError, readJsonBody, requireApiUser, successResponse } from "../../../lib/api-response";
import { getSystemSettings, updateSystemSettings } from "../../../modules/settings/settings.service";

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await requireApiUser(request);
    const settings = await getSystemSettings(user);

    return successResponse(settings);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    const user = await requireApiUser(request);
    const body = await readJsonBody(request);
    const settings = await updateSystemSettings(user, body as never);

    return successResponse(settings);
  } catch (error) {
    return handleApiError(error);
  }
}
