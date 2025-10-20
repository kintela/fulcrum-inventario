import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { deletePantalla } from "@/lib/supabase";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: "Identificador no proporcionado." },
      { status: 400 },
    );
  }

  const parsedId = Number.parseInt(id, 10);
  if (!Number.isFinite(parsedId)) {
    return NextResponse.json(
      { error: "Identificador de pantalla no valido." },
      { status: 400 },
    );
  }

  try {
    await deletePantalla(parsedId);
    revalidatePath("/");
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo eliminar la pantalla.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
