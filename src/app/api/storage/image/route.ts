import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ALLOWED_BUCKETS = new Set(["fotos", "planos"]);

function sanitizePath(path: string): string | null {
  if (!path) return null;
  const trimmed = path.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.includes("..")) return null;
  const normalized = trimmed.replace(/^[\\/]+/, "");
  if (normalized.length === 0) return null;
  return normalized;
}

export async function GET(request: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.json(
      { error: "Supabase configuration missing" },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(request.url);
  const rawBucket = searchParams.get("bucket") ?? "fotos";
  const bucket = ALLOWED_BUCKETS.has(rawBucket) ? rawBucket : null;
  const rawPath = searchParams.get("path");
  const sanitized = rawPath ? sanitizePath(rawPath) : null;

  if (!bucket || !sanitized) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const authKey =
      SUPABASE_SERVICE_ROLE_KEY.trim().length > 0
        ? SUPABASE_SERVICE_ROLE_KEY.trim()
        : SUPABASE_ANON_KEY;

    const response = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${bucket}/${encodeURI(sanitized)}`,
      {
        headers: {
          apikey: authKey,
          Authorization: `Bearer ${authKey}`,
        },
      },
    );

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      console.error(
        "[storage/image] object fetch failed",
        bucket,
        sanitized,
        response.status,
        details,
      );
      return NextResponse.json(
        { error: "Object not found" },
        { status: response.status },
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const responseContentType = response.headers.get("content-type");
    const contentType =
      sanitized.toLowerCase().endsWith(".svg")
        ? "image/svg+xml"
        : responseContentType ?? "application/octet-stream";
    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Cache-Control", "public, max-age=3600");
    const contentLength = response.headers.get("content-length");
    if (contentLength) headers.set("Content-Length", contentLength);

    return new NextResponse(arrayBuffer, { status: 200, headers });
  } catch (error) {
    console.error("Error proxying storage image", error);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 },
    );
  }
}
