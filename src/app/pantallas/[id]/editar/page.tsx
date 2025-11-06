import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import PantallaEditForm, {
  type PantallaEditFormState,
} from "@/components/PantallaEditForm";
import {
  fetchEquiposCatalogo,
  fetchFabricantesCatalogo,
  fetchPantallaById,
  updatePantalla,
  uploadPantallaImage,
  ensureImageFileIsValid,
  type PantallaUpdatePayload,
} from "@/lib/supabase";

type Params = {
  id: string;
};

const INITIAL_STATE: PantallaEditFormState = {
  status: "idle",
  message: null,
};

export default async function EditarPantallaPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const pantallaId = Number.parseInt(id, 10);

  if (!Number.isFinite(pantallaId)) {
    notFound();
  }

  const pantalla = await fetchPantallaById(pantallaId);
  if (!pantalla) {
    notFound();
  }

  const resolvedSearch = await searchParams;
  const fromParamRaw = resolvedSearch?.from;
  const fromParam = Array.isArray(fromParamRaw)
    ? fromParamRaw[0]
    : fromParamRaw ?? null;
  const backHref = fromParam ? `/?${fromParam}` : "/";

  const [fabricantes, equipos] = await Promise.all([
    fetchFabricantesCatalogo(),
    fetchEquiposCatalogo(),
  ]);

  async function actualizarPantallaAction(
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

    const equipoIdValue = getStringOrNull("equipo_id");
    const modelo = getStringOrNull("modelo");
    const fechaCompra = getStringOrNull("fecha_compra");

    const enGarantiaRaw = formData.get("en_garantia");
    let enGarantia: boolean | null = null;
    if (typeof enGarantiaRaw === "string") {
      const normalizado = enGarantiaRaw.trim().toLowerCase();
      if (normalizado === "true") {
        enGarantia = true;
      } else if (normalizado === "false") {
        enGarantia = false;
      } else {
        enGarantia = null;
      }
    }

    const payload: PantallaUpdatePayload = {
      modelo,
      fabricante_id: fabricanteId.value,
      precio: precio.value,
      fecha_compra: fechaCompra,
      en_garantia: enGarantia,
      pulgadas: pulgadas.value,
      equipo_id: equipoIdValue,
      observaciones: getStringOrNull("observaciones"),
    };

    const fotoEntrada = formData.get("foto");
    const nuevaFoto =
      fotoEntrada instanceof File && fotoEntrada.size > 0 ? fotoEntrada : null;

    if (nuevaFoto) {
      try {
        ensureImageFileIsValid(nuevaFoto);
      } catch (error) {
        return {
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "La imagen seleccionada no es válida.",
        };
      }
    }

    try {
      await updatePantalla(pantallaId, payload);
    } catch (error) {
      return {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo actualizar la pantalla.",
      };
    }

    if (nuevaFoto) {
      try {
        await uploadPantallaImage(pantallaId, nuevaFoto);
      } catch (error) {
        revalidatePath("/");
        revalidatePath(`/pantallas/${pantallaId}/editar`);
        return {
          status: "error",
          message:
            error instanceof Error
              ? `Los datos se guardaron pero la foto no pudo subirse: ${error.message}`
              : "Los datos se guardaron pero la foto no pudo subirse.",
        };
      }
    }

    revalidatePath("/");
    revalidatePath(`/pantallas/${pantallaId}/editar`);
    return {
      status: "success",
      message: "Pantalla actualizada correctamente.",
    };
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10">
      <PantallaEditForm
        pantalla={pantalla}
        fabricantes={fabricantes}
        equipos={equipos}
        action={actualizarPantallaAction}
        initialState={INITIAL_STATE}
        backHref={backHref}
      />
    </main>
  );
}
