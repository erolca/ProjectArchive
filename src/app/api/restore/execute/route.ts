import { handleApiError, readJsonBody, requireApiUser, successResponse } from "../../../../lib/api-response";
import { executeRestore } from "../../../../modules/restore/restore.service";

export async function POST(request: Request): Promise<Response> {
  try {
    const user = await requireApiUser(request);
    const body = await readJsonBody(request);
    const report = await executeRestore(user, body as never);

    return successResponse(report);
  } catch (error) {
    return handleApiError(error);
  }
}
