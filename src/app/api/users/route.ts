import {
  handleApiError,
  queryParamsToObject,
  readJsonBody,
  requireApiUser,
  successResponse,
} from "../../../lib/api-response";
import { createUser, listUsers } from "../../../modules/users/user.service";

export async function GET(request: Request): Promise<Response> {
  try {
    const currentUser = await requireApiUser(request);
    const query = normalizeUserQuery(queryParamsToObject(request.url));
    const result = await listUsers(currentUser, query);

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const currentUser = await requireApiUser(request);
    const body = await readJsonBody(request);
    const user = await createUser(currentUser, body as never);

    return successResponse(user, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

function normalizeUserQuery(query: Record<string, string | number>) {
  return {
    ...query,
    isActive: query.isActive === "true" ? true : query.isActive === "false" ? false : undefined,
  };
}
