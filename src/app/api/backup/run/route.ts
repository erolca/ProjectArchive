import { handleApiError, requireApiUser, successResponse } from "../../../../lib/api-response";
import { runProjectStorageBackup } from "../../../../modules/backup/backup.service";

export async function POST(request: Request): Promise<Response> {
  try {
    const user = await requireApiUser(request);
    const result = await runProjectStorageBackup(user);

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
