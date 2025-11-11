import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import SwitchEditForm, {
  type SwitchEditFormState,
  type SwitchFormValues,
} from "@/components/SwitchEditForm";
import {
  createSwitch,
  fetchFabricantesCatalogo,
  fetchUbicacionesCatalogo,
  type SwitchInsertPayload,
} from "@/lib/supabase";

const INITIAL_STATE: SwitchEditFormState = {
  status: "idle",
  message: null,
};

type SearchParams = {
  from?: string;
};

export default async function NuevoSwitchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { from } = await searchParams;
  const backHref = from ? `/?${from}` : "/";

  const [fabricantes, ubicaciones] = await Promise.all([
    fetchFabricantesCatalogo(),
    fetchUbicacionesCatalogo(),
  ]);

  const valoresIniciales: SwitchFormValues = {
    nombre: null,
    modelo: null,
    fabricante_id: null,
    ubicacion_id: null,
    ip: null,
    ancho_banda_gbps: null,
    puertos_totales: null,
    precio: null,
    fecha_compra: null,
    en_garantia: null,
    observaciones: null,
  };

  async function crearSwitchAction(
    _prevState: SwitchEditFormState,
    formData: FormData,
  ): Promise<SwitchEditFormState> {
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
      if (typeof value !== "string") return { ok: true, value: null };
      const trimmed = value.trim();
      if (!trimmed) return { ok: true, value: null };
      const sanitized = trimmed.replace(",", ".");
      const parsed = Number(sanitized);
      if (Number.isNaN(parsed)) {
        return {
          ok: false,
          message: `Introduce un Numero valido en "${etiqueta}".`,
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
          message: `Introduce un Numero entero valido en "${etiqueta}".`,
        };
      }
      return { ok: true, value: integerValue };
    };

    const fabricanteId = parseIntegerField(
      "fabricante_id",
      "Fabricante",
    );
    if (!fabricanteId.ok) {
      return { status: "error", message: fabricanteId.message };
    }

    const ubicacionId = parseIntegerField("ubicacion_id", "Ubicacion");
    if (!ubicacionId.ok) {
      return { status: "error", message: ubicacionId.message };
    }

    const anchoBanda = parseNumberField(
      "ancho_banda_gbps",
      "Ancho de banda",
    );
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

    const enGarantiaRaw = formData.get("en_garantia");
    const enGarantia =
      enGarantiaRaw === "true" ? true : enGarantiaRaw === "false" ? false : false;

    const payload: SwitchInsertPayload = {
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
      const nuevoId = await createSwitch(payload);
      revalidatePath("/");
      const suffix = from ? `?from=${encodeURIComponent(from)}` : "";
      redirect(`/switches/${nuevoId}/puertos${suffix}`);
    } catch (error) {
      const digest =
        typeof error === "object" && error !== null && "digest" in error
          ? (error as { digest?: unknown }).digest
          : undefined;
      if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
        throw error;
      }
      return {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo crear el switch.",
      };
    }

    return {
      status: "success",
      message: null,
    };
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10">
      <SwitchEditForm
        mode="create"
        submitLabel="Crear switch"
        title="Nuevo switch"
        description="Introduce los detalles del switch y guarda para continuar con la configuracion de puertos."
        values={valoresIniciales}
        fabricantes={fabricantes}
        ubicaciones={ubicaciones}
        action={crearSwitchAction}
        initialState={INITIAL_STATE}
        backHref={backHref}
      />
    </main>
  );
}
