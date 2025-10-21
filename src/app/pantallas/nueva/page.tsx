import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import PantallaEditForm, {
  type PantallaEditFormState,
} from "@/components/PantallaEditForm";
import {
  createPantalla,
  fetchEquiposCatalogo,
  fetchFabricantesCatalogo,
  type PantallaInsertPayload,
  type PantallaRecord,
} from "@/lib/supabase";

const INITIAL_STATE: PantallaEditFormState = {
  status: "idle",
  message: null,
};

export default async function NuevaPantallaPage() {
  const [fabricantes, equipos] = await Promise.all([
    fetchFabricantesCatalogo(),
    fetchEquiposCatalogo(),
  ]);

  const pantallaInicial: PantallaRecord = {
    id: 0,
    equipo_id: null,
    pulgadas: null,
    modelo: null,
    fabricante_id: null,
    fabricanteNombre: null,
    precio: null,
    fecha_compra: null,
    en_garantia: null,
    equipo: null,
  };

  async function crearPantallaAction(
    _prevState: PantallaEditFormState,
    formData: FormData,
  ): Promise<PantallaEditFormState> {
    "use server";

    const getStringOrNull = (field: string) => {
      const value = formData.get(field);
      if (typeof value !== "string") return null;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    };

    const parseNumberField = (
      field: string,
      etiqueta: string,
    ): { ok: true; value: number | null } | { ok: false; message: string } => {
      const value = formData.get(field);
      if (typeof value !== "string") {
        return { ok: true, value: null };
      }
      const trimmed = value.trim();
      if (!trimmed) {
        return { ok: true, value: null };
      }
      const sanitized = trimmed.replace(",", ".");
      const parsed = Number(sanitized);
      if (Number.isNaN(parsed)) {
        return {
          ok: false,
          message: `Introduce un valor numerico valido en "${etiqueta}".`,
        };
      }
      return { ok: true, value: parsed };
    };

    const parseIntegerField = (
      field: string,
      etiqueta: string,
    ): { ok: true; value: number | null } | { ok: false; message: string } => {
      const result = parseNumberField(field, etiqueta);
      if (!result.ok) return result;
      if (result.value === null) {
        return result;
      }
      const integerValue = Number.isFinite(result.value)
        ? Math.trunc(result.value)
        : Number.NaN;
      if (Number.isNaN(integerValue)) {
        return {
          ok: false,
          message: `Introduce un identificador valido en "${etiqueta}".`,
        };
      }
      return { ok: true, value: integerValue };
    };

    const fabricanteId = parseIntegerField("fabricante_id", "Fabricante");
    if (!fabricanteId.ok) {
      return { status: "error", message: fabricanteId.message };
    }

    const pulgadas = parseNumberField("pulgadas", "Pulgadas");
    if (!pulgadas.ok) {
      return { status: "error", message: pulgadas.message };
    }

    const precio = parseNumberField("precio", "Precio");
    if (!precio.ok) {
      return { status: "error", message: precio.message };
    }

    const equipoId = getStringOrNull("equipo_id");

    const enGarantiaRaw = formData.get("en_garantia");
    let enGarantia: boolean | null = null;
    if (typeof enGarantiaRaw === "string") {
      const normalizado = enGarantiaRaw.trim().toLowerCase();
      if (normalizado === "true") enGarantia = true;
      else if (normalizado === "false") enGarantia = false;
      else enGarantia = null;
    }

    const payload: PantallaInsertPayload = {
      modelo: getStringOrNull("modelo"),
      fabricante_id: fabricanteId.value,
      precio: precio.value,
      fecha_compra: getStringOrNull("fecha_compra"),
      en_garantia: enGarantia,
      pulgadas: pulgadas.value,
      equipo_id: equipoId,
    };

    try {
      const nuevaId = await createPantalla(payload);
      revalidatePath("/");
      redirect(`/pantallas/${nuevaId}/editar`);
    } catch (error) {
      if (
        error instanceof Error &&
        "digest" in error &&
        (error as { digest?: string }).digest === "NEXT_REDIRECT"
      ) {
        throw error;
      }
      return {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo crear la pantalla.",
      };
    }

    return {
      status: "success",
      message: null,
    };
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10">
      <PantallaEditForm
        mode="create"
        submitLabel="Crear pantalla"
        title="Nueva pantalla"
        description="Rellena los datos y guarda la nueva pantalla."
        pantalla={pantallaInicial}
        fabricantes={fabricantes}
        equipos={equipos}
        action={crearPantallaAction}
        initialState={INITIAL_STATE}
      />
    </main>
  );
}
