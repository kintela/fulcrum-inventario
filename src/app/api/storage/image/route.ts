import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

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
  const rawPath = searchParams.get("path");
  const sanitized = rawPath ? sanitizePath(rawPath) : null;

  if (!sanitized) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/storage/v1/object/fotos/${encodeURI(sanitized)}`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Object not found" },
        { status: response.status },
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const contentType =
      response.headers.get("content-type") ?? "application/octet-stream";
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
