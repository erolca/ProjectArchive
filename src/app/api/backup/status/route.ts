import { handleApiError, requireApiUser, successResponse } from "../../../../lib/api-response";
import { getBackupStatus } from "../../../../modules/backup/backup.service";

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await requireApiUser(request);
    const shouldValidate = new URL(request.url).searchParams.get("validate") === "true";
    const status = await getBackupStatus(user, { validate: shouldValidate });

    return successResponse(status);
  } catch (error) {
    return handleApiError(error);
  }
}
