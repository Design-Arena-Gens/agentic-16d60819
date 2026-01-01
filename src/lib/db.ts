import { sql } from "@vercel/postgres";
import { v4 as uuid } from "uuid";

export type UploadStatus = "pending" | "publishing" | "published" | "failed";

const isDbConfigured = Boolean(process.env.POSTGRES_URL);

export interface UploadRecord {
  id: string;
  blob_url: string;
  blob_path: string;
  caption: string | null;
  status: UploadStatus;
  scheduled_for: Date;
  published_at: Date | null;
  created_at: Date;
  instagram_container_id: string | null;
  instagram_media_id: string | null;
  error_message: string | null;
}

let ensureTablePromise: Promise<void> | null = null;

async function ensureTable() {
  if (!isDbConfigured) {
    throw new Error("POSTGRES_URL environment variable is not configured");
  }

  if (!ensureTablePromise) {
    ensureTablePromise = sql`
      CREATE TABLE IF NOT EXISTS agentic_uploads (
        id UUID PRIMARY KEY,
        blob_url TEXT NOT NULL,
        blob_path TEXT NOT NULL,
        caption TEXT,
        status TEXT NOT NULL,
        scheduled_for TIMESTAMPTZ NOT NULL,
        published_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        instagram_container_id TEXT,
        instagram_media_id TEXT,
        error_message TEXT
      );
    `.then(() => undefined);
  }
  await ensureTablePromise;
}

export async function createUpload(params: {
  blobUrl: string;
  blobPath: string;
  caption?: string;
  scheduledFor: Date;
}) {
  if (!isDbConfigured) {
    throw new Error("Database is not configured");
  }

  await ensureTable();

  const id = uuid();
  const caption = params.caption?.trim() || null;

  await sql`
    INSERT INTO agentic_uploads (id, blob_url, blob_path, caption, status, scheduled_for)
    VALUES (${id}, ${params.blobUrl}, ${params.blobPath}, ${caption}, ${"pending"}, ${params.scheduledFor.toISOString()});
  `;

  return id;
}

export async function listUploads(): Promise<UploadRecord[]> {
  if (!isDbConfigured) {
    return [];
  }

  await ensureTable();
  const { rows } = await sql<UploadRecord>`SELECT * FROM agentic_uploads ORDER BY scheduled_for ASC;`;
  return rows.map((row) => ({
    ...row,
    scheduled_for: new Date(row.scheduled_for),
    created_at: new Date(row.created_at),
    published_at: row.published_at ? new Date(row.published_at) : null,
  }));
}

export async function getNextDueUpload() {
  if (!isDbConfigured) {
    return null;
  }

  await ensureTable();
  const { rows } = await sql<UploadRecord>`
    SELECT * FROM agentic_uploads
    WHERE status = ${"pending"} AND scheduled_for <= NOW()
    ORDER BY scheduled_for ASC
    LIMIT 1;
  `;
  if (rows.length === 0) {
    return null;
  }
  const [row] = rows;
  return {
    ...row,
    scheduled_for: new Date(row.scheduled_for),
    created_at: new Date(row.created_at),
    published_at: row.published_at ? new Date(row.published_at) : null,
  } as UploadRecord;
}

export async function updateUploadStatus(
  id: string,
  changes: Partial<
    Pick<
      UploadRecord,
      | "status"
      | "instagram_container_id"
      | "instagram_media_id"
      | "published_at"
      | "error_message"
    >
  >
) {
  if (!isDbConfigured) {
    throw new Error("Database is not configured");
  }

  await ensureTable();

  const fields: string[] = [];
  const values: unknown[] = [];

  if (changes.status) {
    fields.push(`status = $${fields.length + 1}`);
    values.push(changes.status);
  }

  if (changes.instagram_container_id !== undefined) {
    fields.push(`instagram_container_id = $${fields.length + 1}`);
    values.push(changes.instagram_container_id);
  }

  if (changes.instagram_media_id !== undefined) {
    fields.push(`instagram_media_id = $${fields.length + 1}`);
    values.push(changes.instagram_media_id);
  }

  if (changes.published_at !== undefined) {
    fields.push(`published_at = $${fields.length + 1}`);
    values.push(changes.published_at ? changes.published_at.toISOString() : null);
  }

  if (changes.error_message !== undefined) {
    fields.push(`error_message = $${fields.length + 1}`);
    values.push(changes.error_message);
  }

  if (fields.length === 0) {
    return;
  }

  values.push(id);
  const assignments = fields.join(", ");
  await sql.query(
    `UPDATE agentic_uploads SET ${assignments} WHERE id = $${fields.length + 1}`,
    values
  );
}

export async function deleteUpload(id: string) {
  if (!isDbConfigured) {
    throw new Error("Database is not configured");
  }

  await ensureTable();
  await sql`DELETE FROM agentic_uploads WHERE id = ${id};`;
}
