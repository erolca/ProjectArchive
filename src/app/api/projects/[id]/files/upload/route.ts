import {
  getRouteParams,
  handleApiError,
  parseIntegerParam,
  requireApiUser,
  successResponse,
  type RouteContext,
} from "../../../../../../lib/api-response";
import { finalizeFileUpload } from "../../../../../../modules/files/file.service";
import { prepareUploadSchema } from "../../../../../../modules/files/file.validators";
import { stageTempUpload } from "../../../../../../modules/storage/storage.service";
import { sanitizeFileName } from "../../../../../../lib/file-utils";

export async function POST(request: Request, context: RouteContext<{ id: string }>): Promise<Response> {
  try {
    const user = await requireApiUser(request);
    const { id } = await getRouteParams(context);
    const projectId = parseIntegerParam(id, "id");
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      throw new Error("File is required.");
    }

    const uploadInput = prepareUploadSchema.parse({
      projectId,
      category: String(form.get("category") || ""),
      platform: optionalFormString(form.get("platform")),
      originalFileName: file.name,
      fileSize: file.size,
      versionNo: optionalFormString(form.get("versionNo")),
      changeNote: optionalFormString(form.get("changeNote")),
      confirmWarnings: form.get("confirmWarnings") === "true",
    });
    const originalFileName = sanitizeFileName(uploadInput.originalFileName);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const stagedPath = await stageTempUpload(originalFileName, bytes);
    const result = await finalizeFileUpload(user, {
      projectId: uploadInput.projectId,
      category: uploadInput.category,
      platform: uploadInput.platform,
      originalFileName,
      fileSize: uploadInput.fileSize,
      versionNo: uploadInput.versionNo,
      changeNote: uploadInput.changeNote,
      confirmWarnings: uploadInput.confirmWarnings,
      tempRelativePath: stagedPath.relativePath,
    } as never);

    return successResponse(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

function optionalFormString(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed || undefined;
}
