import { handleApiError, requireApiUser, successResponse } from "../../../../lib/api-response";
import { listBackupHistory } from "../../../../modules/backup/backup.service";

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await requireApiUser(request);
    const history = await listBackupHistory(user);

    return successResponse(history);
  } catch (error) {
    return handleApiError(error);
  }
}
