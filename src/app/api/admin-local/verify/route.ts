import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const adminPassword = process.env.ADMIN_LOCAL_PASSWORD;
  if (!adminPassword) {
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

  if (!password) {
    return NextResponse.json(
      { ok: false, error: "Contraseña requerida" },
      { status: 400 },
    );
  }

  if (password !== adminPassword) {
    return NextResponse.json(
      { ok: false, error: "Contraseña incorrecta" },
      { status: 401 },
    );
  }

  return NextResponse.json({ ok: true });
}
