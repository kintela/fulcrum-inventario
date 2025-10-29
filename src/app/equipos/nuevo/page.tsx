import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import EquipoEditForm, {
  type EquipoEditFormState,
} from "@/components/EquipoEditForm";
import {
  TIPO_ACTUACION_ENUM_VALUES,
  type ActuacionTipo,
  type ActuacionUpsert,
  type EquipoInsertPayload,
  type EquipoRecord,
  createEquipo,
  fetchFabricantesCatalogo,
  fetchUbicacionesCatalogo,
  fetchUsuariosCatalogo,
  upsertActuaciones,
} from "@/lib/supabase";

const INITIAL_STATE: EquipoEditFormState = {
  status: "idle",
  message: null,
};

type SearchParams = {
  tipo?: string;
  from?: string;
};

export default async function NuevoEquipoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { tipo, from } = await searchParams;
  const backHref = from ? `/?${from}` : "/";

  const [fabricantes, ubicaciones, usuarios] = await Promise.all([
    fetchFabricantesCatalogo(),
    fetchUbicacionesCatalogo(),
    fetchUsuariosCatalogo(),
  ]);

  const equipoInicial = {
    id: "nuevo",
    nombre: null,
    modelo: null,
    tipo: tipo ?? null,
    fecha_compra: null,
    en_garantia: false,
    precio_compra: null,
    fabricante_id: null,
    ubicacion_id: null,
    usuario_id: null,
    sistema_operativo: null,
    so_precio: null,
    so_serial: null,
    numero_serie: null,
    part_number: null,
    ip: null,
    tarjeta_red: null,
    toma_red: null,
    admite_update: null,
    al_garbigune: null,
    fabricante: null,
    ubicacion: null,
    usuario: null,
    procesador: null,
    ram: null,
    ssd: null,
    hdd: null,
    tarjeta_grafica: null,
    observaciones: null,
    url: null,
    fecha_bios: null,
    pantallas: [],
    actuaciones: [],
  } satisfies EquipoRecord;

  async function crearEquipoAction(
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
    const enGarantia = enGarantiaRaw === "true";

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

    const actuacionesCountRaw = formData.get("actuaciones_count");
    const actuacionesCount =
      typeof actuacionesCountRaw === "string"
        ? Number.parseInt(actuacionesCountRaw, 10)
        : 0;

    if (Number.isNaN(actuacionesCount) || actuacionesCount < 0) {
      return {
        status: "error",
        message: "El numero de actuaciones indicado es invalido.",
      };
    }

    const actuacionesPayload: ActuacionUpsert[] = [];

    for (let i = 0; i < actuacionesCount; i += 1) {
      const indiceHumano = i + 1;

      const tipoActuacion = getStringOrNull(`actuaciones_${i}_tipo`);
      const descripcionActuacion = getStringOrNull(
        `actuaciones_${i}_descripcion`,
      );
      const fechaActuacion = getStringOrNull(`actuaciones_${i}_fecha`);
      const hechaPorActuacion = getStringOrNull(
        `actuaciones_${i}_hecha_por`,
      );

      const costeActuacion = parseNumberField(
        `actuaciones_${i}_coste`,
        `Coste actuacion ${indiceHumano}`,
      );
      if (!costeActuacion.ok) {
        return { status: "error", message: costeActuacion.message };
      }

      const hayContenido =
        Boolean(tipoActuacion) ||
        Boolean(descripcionActuacion) ||
        costeActuacion.value !== null ||
        Boolean(fechaActuacion) ||
        Boolean(hechaPorActuacion);

      if (!hayContenido) {
        continue;
      }

      if (!tipoActuacion) {
        return {
          status: "error",
          message: `La actuacion ${indiceHumano} debe incluir un tipo.`,
        };
      }

      if (!TIPO_ACTUACION_ENUM_VALUES.includes(tipoActuacion as ActuacionTipo)) {
        return {
          status: "error",
          message: `Selecciona un tipo valido para la actuacion ${indiceHumano}.`,
        };
      }

      const tipoValidado = tipoActuacion as ActuacionTipo;

      const actuacion: ActuacionUpsert = {
        tipo: tipoValidado,
        descripcion: descripcionActuacion,
        coste: costeActuacion.value,
        fecha: fechaActuacion ?? undefined,
        hecha_por: hechaPorActuacion,
      };

      actuacionesPayload.push(actuacion);
    }

    const payload: EquipoInsertPayload = {
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
      ip: getStringOrNull("ip"),
      tarjeta_red: getStringOrNull("tarjeta_red"),
      toma_red: getStringOrNull("toma_red"),
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
      const nuevoId = await createEquipo(payload);
      if (actuacionesPayload.length > 0) {
        await upsertActuaciones(nuevoId, actuacionesPayload);
      }
      revalidatePath("/");
      const suffix = from ? `?from=${encodeURIComponent(from)}` : "";
      redirect(`/equipos/${nuevoId}/editar${suffix}`);
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
            : "No se pudo crear el equipo.",
      };
    }

    return {
      status: "success",
      message: null,
    };
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <EquipoEditForm
        mode="create"
        submitLabel="Crear equipo"
        title="Nuevo equipo"
        description="Rellena los datos y guarda el nuevo equipo."
        equipo={equipoInicial}
        fabricantes={fabricantes}
        ubicaciones={ubicaciones}
        usuarios={usuarios}
        action={crearEquipoAction}
        initialState={INITIAL_STATE}
        backHref={backHref}
      />
    </main>
  );
}
