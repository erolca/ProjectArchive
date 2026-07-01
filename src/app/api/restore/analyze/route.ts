import { handleApiError, readJsonBody, requireApiUser, successResponse } from "../../../../lib/api-response";
import { analyzeRestore } from "../../../../modules/restore/restore.service";

export async function POST(request: Request): Promise<Response> {
  try {
    const user = await requireApiUser(request);
    const body = await readJsonBody(request);
    const preview = await analyzeRestore(user, body as never);

    return successResponse(preview);
  } catch (error) {
    return handleApiError(error);
  }
}
