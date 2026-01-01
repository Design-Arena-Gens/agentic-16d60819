'use server';

import { revalidatePath } from "next/cache";
import { put, del } from "@vercel/blob";
import { z } from "zod";
import {
  createUpload,
  deleteUpload,
  getNextDueUpload,
  listUploads,
  updateUploadStatus,
} from "@/lib/db";
import { publishInstagramVideo } from "@/lib/instagram";
import { v4 as uuid } from "uuid";

const scheduleSchema = z.object({
  caption: z
    .string()
    .max(2200, "Caption must be shorter than the Instagram limit")
    .optional(),
  scheduledFor: z.coerce.date().refine(
    (value) => value.getTime() > Date.now() - 60_000,
    "Schedule must be in the future"
  ),
});

export async function createScheduledUpload(formData: FormData) {
  const video = formData.get("video");
  if (!(video instanceof File)) {
    throw new Error("Missing video file");
  }
  if (!video.type.startsWith("video/")) {
    throw new Error("File must be a video");
  }

  const parsed = scheduleSchema.safeParse({
    caption: formData.get("caption"),
    scheduledFor: formData.get("scheduled_for") ?? new Date(Date.now() + 86_400_000),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid form input");
  }

  const { caption, scheduledFor } = parsed.data;

  const arrayBuffer = await video.arrayBuffer();
  const blobName = `instagram/${uuid()}-${video.name}`;
  const blob = await put(blobName, arrayBuffer, {
    access: "public",
    contentType: video.type,
  });

  await createUpload({
    blobUrl: blob.url,
    blobPath: blob.pathname,
    caption: caption ?? undefined,
    scheduledFor,
  });

  revalidatePath("/");
}

export async function removeUpload(id: string) {
  const uploads = await listUploads();
  const upload = uploads.find((item) => item.id === id);
  if (!upload) {
    throw new Error("Upload not found");
  }

  if (upload.status === "publishing") {
    throw new Error("Cannot delete an upload while publishing");
  }

  await deleteUpload(id);
  await del(upload.blob_path);
  revalidatePath("/");
}

export async function publishDueUploads() {
  const due = await getNextDueUpload();
  if (!due) {
    return;
  }

  await updateUploadStatus(due.id, {
    status: "publishing",
    error_message: null,
  });

  try {
    const result = await publishInstagramVideo({
      videoUrl: due.blob_url,
      caption: due.caption ?? undefined,
    });

    await updateUploadStatus(due.id, {
      status: "published",
      instagram_container_id: result.containerId,
      instagram_media_id: result.mediaId,
      published_at: new Date(),
      error_message: null,
    });
  } catch (error) {
    await updateUploadStatus(due.id, {
      status: "failed",
      error_message:
        error instanceof Error ? error.message : "Unknown error publishing",
    });
  }

  revalidatePath("/");
}

export async function publishNow(id: string) {
  const uploads = await listUploads();
  const upload = uploads.find((item) => item.id === id);
  if (!upload) {
    throw new Error("Upload not found");
  }
  if (upload.status === "publishing") {
    throw new Error("Already publishing this upload");
  }

  await updateUploadStatus(upload.id, {
    status: "publishing",
    error_message: null,
  });

  try {
    const result = await publishInstagramVideo({
      videoUrl: upload.blob_url,
      caption: upload.caption ?? undefined,
    });

    await updateUploadStatus(upload.id, {
      status: "published",
      instagram_container_id: result.containerId,
      instagram_media_id: result.mediaId,
      published_at: new Date(),
      error_message: null,
    });
  } catch (error) {
    await updateUploadStatus(upload.id, {
      status: "failed",
      error_message:
        error instanceof Error ? error.message : "Unknown error publishing",
    });
  }

  revalidatePath("/");
}

export async function clearFailure(id: string) {
  await updateUploadStatus(id, { status: "pending", error_message: null });
  revalidatePath("/");
}
