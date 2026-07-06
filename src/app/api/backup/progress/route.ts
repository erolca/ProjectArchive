import { handleApiError, requireApiUser, successResponse } from "../../../../lib/api-response";
import { getBackupProgress } from "../../../../modules/backup/backup.service";

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await requireApiUser(request);
    const progress = getBackupProgress(user);

    return successResponse(progress);
  } catch (error) {
    return handleApiError(error);
  }
}
