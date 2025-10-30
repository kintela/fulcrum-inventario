export const runtime = "nodejs";

import crypto from "node:crypto";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const adminPasswordRaw = process.env.ADMIN_LOCAL_PASSWORD;
  console.log("ADMIN_LOCAL_PASSWORD (process env):", adminPasswordRaw);
  if (!adminPasswordRaw) {
    console.warn(
      "ADMIN_LOCAL_PASSWORD no está configurada en el servidor; denegando acceso.",
    );
    return NextResponse.json(
      { ok: false, error: "Servicio no disponible" },
      { status: 500 },
    );
  }

  let password: string | null = null;
  try {
    const payload = (await request.json()) as { password?: unknown } | null;
    if (payload && typeof payload.password === "string") {
      password = payload.password;
    }
  } catch {
    // ignore parse errors
  }

  const provided = password.trim();
  if (!provided) {
    return NextResponse.json(
      { ok: false, error: "Contraseña requerida" },
      { status: 400 },
    );
  }

  const expected = adminPasswordRaw.trim();
  if (!expected) {
    console.warn(
      "ADMIN_LOCAL_PASSWORD está definida pero vacía; denegando acceso.",
    );
    return NextResponse.json(
      { ok: false, error: "Servicio no disponible" },
      { status: 500 },
    );
  }

  const providedBuffer = Buffer.from(provided, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return NextResponse.json(
      { ok: false, error: "Contraseña incorrecta" },
      { status: 401 },
    );
  }

  return NextResponse.json({ ok: true });
}
