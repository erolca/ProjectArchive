import { handleApiError, requireApiUser, successResponse } from "../../../../lib/api-response";
import { runStorageIntegrityScan } from "../../../../modules/system-integrity/integrity.service";

export async function POST(request: Request): Promise<Response> {
  try {
    const user = await requireApiUser(request);
    const result = await runStorageIntegrityScan(user);

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
