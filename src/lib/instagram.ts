const API_VERSION = process.env.IG_API_VERSION ?? "v19.0";
const IG_USER_ID = process.env.IG_USER_ID;
const IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN;

export interface PublishResult {
  containerId: string;
  mediaId: string;
}

function assertConfig() {
  if (!IG_USER_ID) {
    throw new Error("Missing IG_USER_ID environment variable");
  }

  if (!IG_ACCESS_TOKEN) {
    throw new Error("Missing IG_ACCESS_TOKEN environment variable");
  }
}

async function createMediaContainer(params: {
  videoUrl: string;
  caption?: string | null;
}) {
  const searchParams = new URLSearchParams({
    access_token: IG_ACCESS_TOKEN!,
    video_url: params.videoUrl,
    share_to_feed: "true",
    media_type: "REELS",
  });

  if (params.caption) {
    searchParams.append("caption", params.caption);
  }

  const response = await fetch(
    `https://graph.facebook.com/${API_VERSION}/${IG_USER_ID}/media`,
    {
      method: "POST",
      body: searchParams,
    }
  );

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(
      payload?.error?.message ??
        `Failed to create media container (status ${response.status})`
    );
  }

  if (!payload.id) {
    throw new Error("Instagram API did not return a container id");
  }

  return payload.id as string;
}

async function pollContainerStatus(containerId: string) {
  const params = new URLSearchParams({
    access_token: IG_ACCESS_TOKEN!,
    fields: "status_code,status",
  });

  const maxAttempts = 20;
  const delayMs = 5000;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${containerId}?${params.toString()}`
    );
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(
        payload?.error?.message ??
          `Failed to poll container status (status ${response.status})`
      );
    }

    const statusCode = payload.status_code as string | undefined;
    if (statusCode === "FINISHED") {
      return;
    }
    if (statusCode === "ERROR") {
      throw new Error(
        payload?.status?.description ??
          "Instagram reported an error processing the video"
      );
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error("Timed out while waiting for Instagram to process the video");
}

async function publishContainer(containerId: string) {
  const searchParams = new URLSearchParams({
    access_token: IG_ACCESS_TOKEN!,
    creation_id: containerId,
  });

  const response = await fetch(
    `https://graph.facebook.com/${API_VERSION}/${IG_USER_ID}/media_publish`,
    {
      method: "POST",
      body: searchParams,
    }
  );

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(
      payload?.error?.message ??
        `Failed to publish media (status ${response.status})`
    );
  }

  if (!payload.id) {
    throw new Error("Instagram API did not return a media id");
  }

  return payload.id as string;
}

export async function publishInstagramVideo(params: {
  videoUrl: string;
  caption?: string | null;
}) {
  assertConfig();

  const containerId = await createMediaContainer(params);
  await pollContainerStatus(containerId);
  const mediaId = await publishContainer(containerId);

  return {
    containerId,
    mediaId,
  } satisfies PublishResult;
}
