import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import EquipoEditForm, {
  type EquipoEditFormState,
} from "@/components/EquipoEditForm";
import {
  fetchEquipoById,
  fetchFabricantesCatalogo,
  fetchUbicacionesCatalogo,
  fetchUsuariosCatalogo,
  updateEquipo,
  type EquipoUpdatePayload,
} from "@/lib/supabase";

type Params = {
  id: string;
};

const INITIAL_STATE: EquipoEditFormState = {
  status: "idle",
  message: null,
};

export default async function EditarEquipoPage({
  params,
}: {
  params: Params;
}) {
  const equipo = await fetchEquipoById(params.id);
  if (!equipo) {
    notFound();
  }

  const [fabricantes, ubicaciones, usuarios] = await Promise.all([
    fetchFabricantesCatalogo(),
    fetchUbicacionesCatalogo(),
    fetchUsuariosCatalogo(),
  ]);

  async function actualizarEquipoAction(
    _prevState: EquipoEditFormState,
    formData: FormData,
  ): Promise<EquipoEditFormState> {
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
          message: `Introduce un identificador numerico valido en "${etiqueta}".`,
        };
      }
      return { ok: true, value: integerValue };
    };

    const precioCompra = parseNumberField("precio_compra", "Precio compra");
    if (!precioCompra.ok) {
      return { status: "error", message: precioCompra.message };
    }

    const soPrecio = parseNumberField("so_precio", "Precio SO");
    if (!soPrecio.ok) {
      return { status: "error", message: soPrecio.message };
    }

    const ram = parseNumberField("ram", "RAM");
    if (!ram.ok) {
      return { status: "error", message: ram.message };
    }

    const ssd = parseNumberField("ssd", "SSD");
    if (!ssd.ok) {
      return { status: "error", message: ssd.message };
    }

    const hdd = parseNumberField("hdd", "HDD");
    if (!hdd.ok) {
      return { status: "error", message: hdd.message };
    }

    const fabricanteId = parseIntegerField("fabricante_id", "Fabricante");
    if (!fabricanteId.ok) {
      return { status: "error", message: fabricanteId.message };
    }

    const ubicacionId = parseIntegerField("ubicacion_id", "Ubicacion");
    if (!ubicacionId.ok) {
      return { status: "error", message: ubicacionId.message };
    }

    const usuarioId = parseIntegerField("usuario_id", "Usuario asignado");
    if (!usuarioId.ok) {
      return { status: "error", message: usuarioId.message };
    }

    const enGarantiaRaw = formData.get("en_garantia");
    const enGarantia =
      enGarantiaRaw === "true" ? true : enGarantiaRaw === "false" ? false : false;

    const admiteUpdateRaw = formData.get("admite_update");
    const admiteUpdate =
      admiteUpdateRaw === "true"
        ? true
        : admiteUpdateRaw === "false"
          ? false
          : null;

    const alGarbiguneRaw = formData.get("al_garbigune");
    const alGarbigune =
      alGarbiguneRaw === "true"
        ? true
        : alGarbiguneRaw === "false"
          ? false
          : null;

    const tipoRaw = getStringOrNull("tipo");

    const payload: EquipoUpdatePayload = {
      nombre: getStringOrNull("nombre"),
      modelo: getStringOrNull("modelo"),
      tipo: tipoRaw ?? null,
      fecha_compra: getStringOrNull("fecha_compra"),
      en_garantia: enGarantia,
      precio_compra: precioCompra.value,
      fabricante_id: fabricanteId.value,
      ubicacion_id: ubicacionId.value,
      usuario_id: usuarioId.value,
      sistema_operativo: getStringOrNull("sistema_operativo"),
      so_precio: soPrecio.value,
      so_serial: getStringOrNull("so_serial"),
      numero_serie: getStringOrNull("numero_serie"),
      part_number: getStringOrNull("part_number"),
      admite_update: admiteUpdate,
      al_garbigune: alGarbigune,
      procesador: getStringOrNull("procesador"),
      ram: ram.value,
      ssd: ssd.value,
      hdd: hdd.value,
      tarjeta_grafica: getStringOrNull("tarjeta_grafica"),
      observaciones: getStringOrNull("observaciones"),
      url: getStringOrNull("url"),
      fecha_bios: getStringOrNull("fecha_bios"),
    };

    try {
      await updateEquipo(params.id, payload);
      revalidatePath("/");
      revalidatePath(`/equipos/${params.id}/editar`);
      return {
        status: "success",
        message: "Equipo actualizado correctamente.",
      };
    } catch (error) {
      return {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo actualizar el equipo.",
      };
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <EquipoEditForm
        equipo={equipo}
        fabricantes={fabricantes}
        ubicaciones={ubicaciones}
        usuarios={usuarios}
        action={actualizarEquipoAction}
        initialState={INITIAL_STATE}
      />
    </main>
  );
}
