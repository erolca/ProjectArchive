import {
  getRouteParams,
  handleApiError,
  parseIntegerParam,
  readJsonBody,
  requireApiUser,
  successResponse,
  type RouteContext,
} from "../../../../../../lib/api-response";
import { prepareFileUpload } from "../../../../../../modules/files/file.service";

export async function POST(request: Request, context: RouteContext<{ id: string }>): Promise<Response> {
  try {
    const user = await requireApiUser(request);
    const { id } = await getRouteParams(context);
    const body = await readJsonBody<Record<string, unknown>>(request);
    const result = await prepareFileUpload(user, {
      ...body,
      projectId: parseIntegerParam(id, "id"),
    } as never);

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
