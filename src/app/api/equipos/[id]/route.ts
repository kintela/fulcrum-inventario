import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { deleteEquipo } from "@/lib/supabase";

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

  try {
    await deleteEquipo(id);
    revalidatePath("/");
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo eliminar el equipo.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
