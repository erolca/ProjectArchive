import { handleApiError, readJsonBody, requireApiUser, successResponse } from "../../../lib/api-response";
import { getOwnProfile, updateOwnProfile } from "../../../modules/profile/profile.service";

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await requireApiUser(request);
    const profile = await getOwnProfile(user);

    return successResponse(profile);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    const user = await requireApiUser(request);
    const body = await readJsonBody(request);
    const profile = await updateOwnProfile(user, body);

    return successResponse(profile);
  } catch (error) {
    return handleApiError(error);
  }
}
