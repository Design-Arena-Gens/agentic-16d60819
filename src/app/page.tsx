import { listUploads, UploadRecord } from "@/lib/db";
import {
  clearFailure,
  createScheduledUpload,
  publishNow,
  removeUpload,
} from "./actions";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function envWarnings() {
  const warnings: string[] = [];
  if (!process.env.IG_USER_ID) {
    warnings.push("IG_USER_ID is not configured");
  }
  if (!process.env.IG_ACCESS_TOKEN) {
    warnings.push("IG_ACCESS_TOKEN is not configured");
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    warnings.push("BLOB_READ_WRITE_TOKEN is not configured");
  }
  if (!process.env.POSTGRES_URL) {
    warnings.push("POSTGRES_URL is not configured");
  }
  return warnings;
}

function statusClasses(status: UploadRecord["status"]) {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "publishing":
      return "bg-blue-100 text-blue-800";
    case "published":
      return "bg-emerald-100 text-emerald-800";
    case "failed":
    default:
      return "bg-rose-100 text-rose-800";
  }
}

export default async function Home() {
  const uploads = await listUploads();
  const warnings = envWarnings();

  const nextDefault = (() => {
    const now = new Date();
    const next = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    next.setMinutes(0, 0, 0);
    return new Date(next);
  })();

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-10">
          <h1 className="text-3xl font-semibold">
            Instagram Video Agent Scheduler
          </h1>
          <p className="max-w-3xl text-slate-600">
            Queue daily video drops, monitor publishing status, and trigger the
            agent when needed. Videos are stored privately via Vercel Blob and
            published through the Instagram Graph API.
          </p>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-6 py-10 lg:grid-cols-[1fr,340px]">
        <section className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-medium">Queued Videos</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {uploads.length === 0 ? (
                <p className="px-6 py-12 text-center text-slate-500">
                  No videos queued yet. Use the form to schedule the first drop.
                </p>
              ) : (
                uploads.map((upload) => {
                  const deleteAction = removeUpload.bind(null, upload.id);
                  const publishAction = publishNow.bind(null, upload.id);
                  const retryAction = clearFailure.bind(null, upload.id);

                  return (
                    <article
                      key={upload.id}
                      className="flex flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium uppercase tracking-wide text-slate-500">
                            Scheduled
                          </span>
                          <span className="rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            #{upload.id.slice(0, 6)}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${statusClasses(
                              upload.status
                            )}`}
                          >
                            {upload.status}
                          </span>
                        </div>
                        <p className="text-lg font-medium text-slate-900">
                          {formatDate(upload.scheduled_for)}
                        </p>
                        {upload.caption ? (
                          <p className="max-w-xl text-sm text-slate-600">
                            {upload.caption}
                          </p>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                          <a
                            href={upload.blob_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-sky-600 hover:underline"
                          >
                            Preview video
                          </a>
                          {upload.published_at ? (
                            <span>
                              Published {formatDate(upload.published_at)}
                            </span>
                          ) : null}
                          {upload.instagram_media_id ? (
                            <span>Media ID: {upload.instagram_media_id}</span>
                          ) : null}
                        </div>
                        {upload.error_message ? (
                          <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">
                            {upload.error_message}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        {upload.status === "pending" ? (
                          <form action={publishAction}>
                            <button
                              type="submit"
                              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                            >
                              Publish now
                            </button>
                          </form>
                        ) : null}

                        {upload.status === "failed" ? (
                          <form action={retryAction}>
                            <button
                              type="submit"
                              className="rounded-full bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-500"
                            >
                              Reset to pending
                            </button>
                          </form>
                        ) : null}

                        {upload.status !== "publishing" ? (
                          <form action={deleteAction}>
                            <button
                              type="submit"
                              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-rose-400 hover:text-rose-500"
                            >
                              Remove
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          {warnings.length > 0 ? (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <p className="font-medium">Configuration required</p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-medium">Schedule a new video</h2>
              <p className="mt-1 text-sm text-slate-500">
                Upload tomorrow&apos;s reel and the agent will handle the rest.
              </p>
            </div>
            <form
              action={createScheduledUpload}
              className="space-y-6 px-5 py-6"
              encType="multipart/form-data"
            >
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Video file
                </label>
                <input
                  type="file"
                  name="video"
                  accept="video/*"
                  required
                  className="block w-full cursor-pointer rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-8 text-center text-sm text-slate-500 hover:border-slate-400"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="caption"
                  className="text-sm font-medium text-slate-700"
                >
                  Caption
                </label>
                <textarea
                  id="caption"
                  name="caption"
                  rows={4}
                  placeholder="Daily drop with Hugh. 🎬"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="scheduled_for"
                  className="text-sm font-medium text-slate-700"
                >
                  Scheduled publish time
                </label>
                <input
                  id="scheduled_for"
                  type="datetime-local"
                  name="scheduled_for"
                  defaultValue={nextDefault.toISOString().slice(0, 16)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
                <p className="text-xs text-slate-500">
                  The cron agent will publish any pending videos whose scheduled
                  time has passed.
                </p>
              </div>

              <button
                type="submit"
                className="w-full rounded-full bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Queue video
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
            <h2 className="text-lg font-medium">Automation checklist</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>• Configure a Vercel Cron to hit /api/cron/publish daily.</li>
              <li>• Provide IG_USER_ID and IG_ACCESS_TOKEN env vars.</li>
              <li>• Add BLOB_READ_WRITE_TOKEN for secure video storage.</li>
              <li>• Set CRON_SECRET to secure the cron hook.</li>
            </ul>
          </div>
        </aside>
      </main>
    </div>
  );
}
