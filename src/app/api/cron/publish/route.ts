import { NextResponse } from "next/server";
import { publishDueUploads } from "@/app/actions";

async function verify(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return true;
  }

  const auth = request.headers.get("authorization");
  if (!auth) {
    return false;
  }

  const [scheme, token] = auth.split(" ");
  return scheme === "Bearer" && token === secret;
}

export async function GET(request: Request) {
  const authorized = await verify(request);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await publishDueUploads();
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  return GET(request);
}
