"use client";

import { getStoredAuthToken } from "./client-auth";
import { sanitizeUserMessage } from "./user-messages";

type ApiSuccess<T> = {
  success: true;
  data: T;
};

type ApiFailure = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getStoredAuthToken();
  const headers = new Headers(init.headers);
  const isFormData = init.body instanceof FormData;

  if (!headers.has("accept")) {
    headers.set("accept", "application/json");
  }

  if (!headers.has("content-type") && init.body && !isFormData) {
    headers.set("content-type", "application/json");
  }

  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  const response = await fetch(path, {
    ...init,
    headers,
  });
  const contentType = response.headers.get("content-type") || "";
  const responseText = await response.text();

  if (!contentType.includes("application/json")) {
    throw new Error(sanitizeUserMessage(buildNonJsonError(response, responseText)));
  }

  let payload: ApiResponse<T>;

  try {
    payload = JSON.parse(responseText) as ApiResponse<T>;
  } catch {
    throw new Error(`API returned invalid JSON (${response.status}).`);
  }

  if (!payload.success) {
    throw new Error(sanitizeUserMessage(payload.error.message));
  }

  return payload.data;
}

function buildNonJsonError(response: Response, responseText: string): string {
  const trimmed = responseText.trim();
  const titleMatch = trimmed.match(/<title>(.*?)<\/title>/i);
  const title = titleMatch?.[1]?.trim();

  if (title) {
    return `API returned HTML (${response.status}): ${title}`;
  }

  return `API returned non-JSON response (${response.status}).`;
}

export function getApi<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

export function postApi<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function putApi<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function deleteApi<T>(path: string): Promise<T> {
  return apiRequest<T>(path, {
    method: "DELETE",
  });
}

export function postFormApi<T>(path: string, body: FormData): Promise<T> {
  return apiRequest<T>(path, {
    method: "POST",
    body,
  });
}

export async function downloadApiFile(path: string): Promise<{ blob: Blob; fileName: string }> {
  const token = getStoredAuthToken();
  const headers = new Headers({
    accept: "application/octet-stream",
  });

  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  const response = await fetch(path, {
    headers,
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const payload = (await response.json()) as ApiFailure;
      throw new Error(sanitizeUserMessage(payload.error.message));
    }

    throw new Error(sanitizeUserMessage(`Download failed (${response.status}).`, "Download could not be completed."));
  }

  return {
    blob: await response.blob(),
    fileName: getFileNameFromDisposition(response.headers.get("content-disposition")) || "download.bin",
  };
}

export async function getApiBlob(path: string): Promise<{ blob: Blob; contentType: string }> {
  const token = getStoredAuthToken();
  const headers = new Headers();

  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  const response = await fetch(path, {
    headers,
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const payload = (await response.json()) as ApiFailure;
      throw new Error(sanitizeUserMessage(payload.error.message));
    }

    throw new Error(sanitizeUserMessage(`Preview failed (${response.status}).`, "Preview could not be loaded."));
  }

  return {
    blob: await response.blob(),
    contentType: response.headers.get("content-type") || "application/octet-stream",
  };
}

function getFileNameFromDisposition(disposition: string | null): string | null {
  if (!disposition) {
    return null;
  }

  const match = disposition.match(/filename="([^"]+)"/i);

  return match?.[1] || null;
}
