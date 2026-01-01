## Instagram Agent Scheduler

This Next.js app manages a daily Instagram upload pipeline. Drop tomorrow's video, choose a caption, and the agent stores the file in Vercel Blob, tracks it in Postgres, and publishes through the Instagram Graph API when the schedule hits.

### Features

- Video queue with status tracking (`pending`, `publishing`, `published`, `failed`)
- File storage via Vercel Blob for Instagram-compatible public URLs
- Automated publishing flow that:
  1. Creates a media container
  2. Polls processing status
  3. Finalizes publication on Instagram
- REST hook at `/api/cron/publish` for Vercel Cron triggers
- Manual controls to publish immediately, reset failures, or remove queued items

### Configuration

Set the following environment variables locally and in Vercel:

| Variable | Description |
| --- | --- |
| `IG_USER_ID` | Instagram Business Account ID (from the Facebook app) |
| `IG_ACCESS_TOKEN` | Long-lived Instagram Graph API token with `instagram_content_publish` |
| `BLOB_READ_WRITE_TOKEN` | Scoped token for Vercel Blob storage |
| `POSTGRES_URL` | Connection string for Vercel Postgres |
| `CRON_SECRET` | Shared secret to secure the cron endpoint |
| `IG_API_VERSION` _(optional)_ | Graph API version, defaults to `v19.0` |

Create a daily cron job in Vercel pointing to `https://YOUR-DEPLOYMENT.vercel.app/api/cron/publish` with an `Authorization: Bearer $CRON_SECRET` header.

### Local Development

```bash
npm install
npm run dev
```

### Production Build

```bash
npm run build
npm start
```
