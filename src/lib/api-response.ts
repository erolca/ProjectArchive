import { ZodError } from "zod";
import { getCurrentUserFromAuthorizationHeader } from "../modules/auth/auth.service";
import type { AuthenticatedUser } from "../modules/auth/auth.types";

export interface RouteContext<TParams extends Record<string, string> = Record<string, string>> {
  params: Promise<TParams>;
}

export function successResponse(data: unknown, init?: ResponseInit): Response {
  return jsonResponse(
    {
      success: true,
      data,
    },
    {
      status: init?.status || 200,
      headers: init?.headers,
    },
  );
}

export function errorResponse(code: string, message: string, status = 400): Response {
  return jsonResponse(
    {
      success: false,
      error: {
        code,
        message,
      },
    },
    {
      status,
    },
  );
}

export function handleApiError(error: unknown): Response {
  if (error instanceof ZodError) {
    return errorResponse("VALIDATION_ERROR", error.issues[0]?.message || "Invalid request.", 400);
  }

  if (error instanceof SyntaxError) {
    return errorResponse("INVALID_JSON", "Request body must be valid JSON.", 400);
  }

  if (error instanceof Error) {
    const message = error.message;

    if (message === "Authentication required.") {
      return errorResponse("AUTHENTICATION_REQUIRED", message, 401);
    }

    if (message === "Permission denied." || message === "User account is inactive.") {
      return errorResponse("PERMISSION_DENIED", message, 403);
    }

    if (message.endsWith("not found.") || message === "File not found." || message === "Project not found.") {
      return errorResponse("NOT_FOUND", message, 404);
    }

    if (message.includes("already exists")) {
      return errorResponse("CONFLICT", message, 409);
    }

    return errorResponse("BAD_REQUEST", message, 400);
  }

  return errorResponse("INTERNAL_ERROR", "Unexpected server error.", 500);
}

export async function readJsonBody<T = unknown>(request: Request): Promise<T> {
  return (await request.json()) as T;
}

export async function requireApiUser(request: Request): Promise<AuthenticatedUser> {
  const user = await getCurrentUserFromAuthorizationHeader(request.headers.get("authorization"));

  if (!user) {
    throw new Error("Authentication required.");
  }

  return user;
}

export async function getRouteParams<TParams extends Record<string, string>>(
  context: RouteContext<TParams>,
): Promise<TParams> {
  return context.params;
}

export function parseIntegerParam(value: string, name: string): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
}

export function queryParamsToObject(url: string): Record<string, string | number> {
  const params = new URL(url).searchParams;
  const output: Record<string, string | number> = {};

  for (const [key, value] of params.entries()) {
    if (key === "page" || key === "pageSize" || key === "userId" || key === "projectId") {
      output[key] = Number(value);
    } else {
      output[key] = value;
    }
  }

  return output;
}

function jsonResponse(body: unknown, init: ResponseInit): Response {
  return new Response(JSON.stringify(body, jsonReplacer), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  });
}

function jsonReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }

  return value;
}
