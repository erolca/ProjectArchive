import {
  getRouteParams,
  handleApiError,
  parseIntegerParam,
  readJsonBody,
  requireApiUser,
  successResponse,
  type RouteContext,
} from "../../../../../lib/api-response";
import { createFileVersion } from "../../../../../modules/files/file-version.service";

export async function POST(request: Request, context: RouteContext<{ id: string }>): Promise<Response> {
  try {
    const user = await requireApiUser(request);
    const { id } = await getRouteParams(context);
    const body = await readJsonBody<Record<string, unknown>>(request);
    const result = await createFileVersion(user, {
      ...body,
      fileId: parseIntegerParam(id, "id"),
    } as never);

    return successResponse(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
