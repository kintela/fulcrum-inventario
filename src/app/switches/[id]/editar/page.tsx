import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import SwitchEditForm, {
  type SwitchEditFormState,
  type SwitchFormValues,
} from "@/components/SwitchEditForm";
import {
  fetchFabricantesCatalogo,
  fetchSwitchById,
  fetchUbicacionesCatalogo,
  updateSwitch,
  type SwitchUpdatePayload,
} from "@/lib/supabase";

type Params = {
  id: string;
};

const INITIAL_STATE: SwitchEditFormState = {
  status: "idle",
  message: null,
};

function toNumberOrNull(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export default async function EditarSwitchPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const resolvedSearch = await searchParams;
  const fromParamRaw = resolvedSearch?.from;
  const fromParam = Array.isArray(fromParamRaw)
    ? fromParamRaw[0]
    : fromParamRaw ?? null;
  const backHref = fromParam ? `/?${fromParam}` : "/";

  const switchInfo = await fetchSwitchById(id);
  if (!switchInfo) {
    notFound();
  }

  const [fabricantes, ubicaciones] = await Promise.all([
    fetchFabricantesCatalogo(),
    fetchUbicacionesCatalogo(),
  ]);

  const valoresIniciales: SwitchFormValues = {
    nombre: switchInfo.nombre ?? null,
    modelo: switchInfo.modelo ?? null,
    fabricante_id:
      typeof switchInfo.fabricante_id === "number"
        ? switchInfo.fabricante_id
        : null,
    ubicacion_id:
      typeof switchInfo.ubicacion_id === "number"
        ? switchInfo.ubicacion_id
        : null,
    ip: switchInfo.ip ?? null,
    ancho_banda_gbps: toNumberOrNull(switchInfo.ancho_banda_gbps),
    puertos_totales: toNumberOrNull(switchInfo.puertos_totales),
    precio: toNumberOrNull(switchInfo.precio),
    fecha_compra: switchInfo.fecha_compra ?? null,
    en_garantia: Boolean(switchInfo.en_garantia),
    observaciones:
      typeof switchInfo.observaciones === "string"
        ? switchInfo.observaciones
        : null,
  };

  async function actualizarSwitchAction(
    _prevState: SwitchEditFormState,
    formData: FormData,
  ): Promise<SwitchEditFormState> {
    "use server";

    const idNumber = Number.parseInt(id, 10);
    const switchIdentifier = Number.isNaN(idNumber) ? id : idNumber;

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
      if (typeof value !== "string") return { ok: true, value: null };
      const trimmed = value.trim();
      if (!trimmed) return { ok: true, value: null };
      const sanitized = trimmed.replace(",", ".");
      const parsed = Number(sanitized);
      if (Number.isNaN(parsed)) {
        return {
          ok: false,
          message: `Introduce un numero valido en "${etiqueta}".`,
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
      if (result.value === null) return result;
      const integerValue = Number.isFinite(result.value)
        ? Math.trunc(result.value)
        : Number.NaN;
      if (Number.isNaN(integerValue)) {
        return {
          ok: false,
          message: `Introduce un numero entero valido en "${etiqueta}".`,
        };
      }
      return { ok: true, value: integerValue };
    };

    const fabricanteId = parseIntegerField("fabricante_id", "Fabricante");
    if (!fabricanteId.ok) {
      return { status: "error", message: fabricanteId.message };
    }

    const ubicacionId = parseIntegerField("ubicacion_id", "Ubicacion");
    if (!ubicacionId.ok) {
      return { status: "error", message: ubicacionId.message };
    }

    const anchoBanda = parseNumberField("ancho_banda_gbps", "Ancho de banda");
    if (!anchoBanda.ok) {
      return { status: "error", message: anchoBanda.message };
    }

    const puertosTotales = parseIntegerField(
      "puertos_totales",
      "Puertos totales",
    );
    if (!puertosTotales.ok) {
      return { status: "error", message: puertosTotales.message };
    }

    const precio = parseNumberField("precio", "Precio");
    if (!precio.ok) {
      return { status: "error", message: precio.message };
    }

    const enGarantia = formData.get("en_garantia") === "true";

    const payload: SwitchUpdatePayload = {
      nombre: getStringOrNull("nombre"),
      modelo: getStringOrNull("modelo"),
      fabricante_id: fabricanteId.value,
      ubicacion_id: ubicacionId.value,
      ip: getStringOrNull("ip"),
      ancho_banda_gbps: anchoBanda.value,
      puertos_totales: puertosTotales.value,
      precio: precio.value,
      fecha_compra: getStringOrNull("fecha_compra"),
      en_garantia: enGarantia,
      observaciones: getStringOrNull("observaciones"),
    };

    try {
      await updateSwitch(switchIdentifier, payload);
      revalidatePath("/");
      revalidatePath(`/switches/${id}/editar`);
      revalidatePath(`/switches/${id}/puertos`);
      return {
        status: "success",
        message: "Switch actualizado correctamente.",
      };
    } catch (error) {
      return {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo actualizar el switch.",
      };
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10">
      <SwitchEditForm
        mode="edit"
        submitLabel="Guardar cambios"
        title="Editar switch"
        description="Actualiza la informacion general del switch."
        values={valoresIniciales}
        fabricantes={fabricantes}
        ubicaciones={ubicaciones}
        action={actualizarSwitchAction}
        initialState={INITIAL_STATE}
        backHref={backHref}
      />
    </main>
  );
}

