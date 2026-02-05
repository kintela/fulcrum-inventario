import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import PatchPanelPortsForm, {
  type PatchPanelPortsFormState,
} from "@/components/PatchPanelPortsForm";
import {
  deletePatchPanelPorts,
  fetchPatchpanelById,
  fetchSwitchesCatalogo,
  fetchSwitchPortsCatalogo,
  upsertPatchPanelPorts,
  type PatchPanelPortUpsert,
} from "@/lib/supabase";

const INITIAL_STATE: PatchPanelPortsFormState = {
  status: "idle",
  message: null,
};

type Params = {
  id: string;
};

export default async function PatchPanelPortsPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const patchpanelInfo = await fetchPatchpanelById(id);
  if (!patchpanelInfo) {
    notFound();
  }

  const puertosTotales = Number.isFinite(Number(patchpanelInfo.puertos_totales))
    ? Number(patchpanelInfo.puertos_totales)
    : 0;

  if (puertosTotales <= 0) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
        <div className="space-y-3 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm">
          <h1 className="text-2xl font-semibold text-foreground">
            {patchpanelInfo.nombre ?? `Patch panel #${patchpanelInfo.id}`}
          </h1>
          <p className="text-sm text-foreground/70">
            Este patch panel no tiene definido el número total de puertos. Configúralo antes de
            gestionar los puertos individuales.
          </p>
        </div>
      </main>
    );
  }

  const [switchesCatalogo, switchPortsCatalogo] = await Promise.all([
    fetchSwitchesCatalogo(),
    fetchSwitchPortsCatalogo(),
  ]);

  const opcionesSwitches = switchesCatalogo
    .map((sw) => {
      const nombre =
        sw.nombre?.trim().length && sw.nombre
          ? sw.nombre.trim()
          : `Switch #${sw.id}`;
      return {
        value: String(sw.id),
        label: nombre,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" }));

  const opcionesPuertosPorSwitch: Record<
    string,
    Array<{ value: string; label: string; numero?: number }>
  > = {};
  const puertoSwitchToSwitch = new Map<number, number>();
  const puertosCatalogoPorId = new Map<number, (typeof switchPortsCatalogo)[number]>();

  switchPortsCatalogo.forEach((puerto) => {
    puertoSwitchToSwitch.set(puerto.id, puerto.switch_id);
    puertosCatalogoPorId.set(puerto.id, puerto);

    const switchKey = String(puerto.switch_id);
    const baseLabel = `Puerto ${puerto.numero}`;
    const etiqueta = puerto.nombre?.trim() || "";
    const label = etiqueta ? `${baseLabel} - ${etiqueta}` : baseLabel;

    if (!opcionesPuertosPorSwitch[switchKey]) {
      opcionesPuertosPorSwitch[switchKey] = [];
    }

    opcionesPuertosPorSwitch[switchKey].push({
      value: String(puerto.id),
      label,
      numero: puerto.numero,
    });
  });

  Object.values(opcionesPuertosPorSwitch).forEach((lista) => {
    lista.sort((a, b) => {
      const numA = typeof a.numero === "number" ? a.numero : Number.POSITIVE_INFINITY;
      const numB = typeof b.numero === "number" ? b.numero : Number.POSITIVE_INFINITY;
      if (numA !== numB) return numA - numB;
      return a.label.localeCompare(b.label, "es", { sensitivity: "base" });
    });
  });

  async function guardarPuertosAction(
    _prevState: PatchPanelPortsFormState,
    formData: FormData,
  ): Promise<PatchPanelPortsFormState> {
    "use server";

    const patchpanelIdRaw = formData.get("patchpanel_id");
    if (typeof patchpanelIdRaw !== "string" || patchpanelIdRaw.trim().length === 0) {
      return { status: "error", message: "Identificador del patch panel no válido." };
    }

    const puertosTotalesRaw = formData.get("puertos_totales");
    const puertosTotalesForm = typeof puertosTotalesRaw === "string"
      ? Number.parseInt(puertosTotalesRaw, 10)
      : Number.NaN;

    if (!Number.isFinite(puertosTotalesForm) || puertosTotalesForm <= 0) {
      return {
        status: "error",
        message: "El número total de puertos indicado no es válido.",
      };
    }

    const patchpanelIdNumber = Number.parseInt(patchpanelIdRaw, 10);
    if (!Number.isFinite(patchpanelIdNumber)) {
      return {
        status: "error",
        message: "El identificador del patch panel es inválido.",
      };
    }

    const puertosAUpsert: PatchPanelPortUpsert[] = [];
    const idsParaEliminar: number[] = [];

    for (let numero = 1; numero <= puertosTotalesForm; numero += 1) {
      const base = `puerto_${numero}`;
      const idRaw = formData.get(`${base}_id`);
      const switchRaw = formData.get(`${base}_switch_id`);
      const puertoSwitchRaw = formData.get(`${base}_puerto_switch_id`);
      const etiquetaRaw = formData.get(`${base}_etiqueta`);
      const observacionesRaw = formData.get(`${base}_observaciones`);

      const idValor =
        typeof idRaw === "string" && idRaw.trim().length > 0
          ? Number.parseInt(idRaw, 10)
          : null;

      const switchId =
        typeof switchRaw === "string" && switchRaw.trim().length > 0
          ? Number.parseInt(switchRaw.trim(), 10)
          : null;

      const puertoSwitchId =
        typeof puertoSwitchRaw === "string" && puertoSwitchRaw.trim().length > 0
          ? Number.parseInt(puertoSwitchRaw.trim(), 10)
          : null;

      if (switchId !== null && !Number.isFinite(switchId)) {
        return {
          status: "error",
          message: `El switch seleccionado para el puerto ${numero} no es válido.`,
        };
      }

      if (puertoSwitchId !== null && !Number.isFinite(puertoSwitchId)) {
        return {
          status: "error",
          message: `El puerto del switch seleccionado para el puerto ${numero} no es válido.`,
        };
      }

      if (switchId !== null && puertoSwitchId === null) {
        return {
          status: "error",
          message: `Selecciona un puerto del switch para el puerto ${numero}.`,
        };
      }

      if (switchId === null && puertoSwitchId !== null) {
        return {
          status: "error",
          message: `Selecciona un switch para el puerto ${numero}.`,
        };
      }

      if (switchId !== null && puertoSwitchId !== null) {
        const expectedSwitchId = puertoSwitchToSwitch.get(puertoSwitchId);
        if (!expectedSwitchId) {
          return {
            status: "error",
            message: `El puerto seleccionado para el puerto ${numero} no existe.`,
          };
        }
        if (expectedSwitchId !== switchId) {
          return {
            status: "error",
            message: `El puerto seleccionado para el puerto ${numero} no pertenece al switch elegido.`,
          };
        }
      }

      const observaciones =
        typeof observacionesRaw === "string" && observacionesRaw.trim().length > 0
          ? observacionesRaw.trim()
          : null;
      const etiqueta =
        typeof etiquetaRaw === "string" && etiquetaRaw.trim().length > 0
          ? etiquetaRaw.trim()
          : null;

      const hayContenido =
        puertoSwitchId !== null ||
        (observaciones && observaciones.length > 0) ||
        (etiqueta && etiqueta.length > 0);

      if (!hayContenido) {
        if (idValor !== null) {
          idsParaEliminar.push(idValor);
        }
        continue;
      }

      const puerto: PatchPanelPortUpsert = {
        patchpanel_id: patchpanelIdNumber,
        numero,
        puerto_switch_id: puertoSwitchId ?? null,
        observaciones,
      };

      if (idValor !== null) {
        puerto.id = idValor;
      }

      if (etiqueta) {
        puerto.etiqueta = etiqueta;
      }

      puertosAUpsert.push(puerto);
    }

    try {
      if (idsParaEliminar.length > 0) {
        await deletePatchPanelPorts(idsParaEliminar);
      }
      if (puertosAUpsert.length > 0) {
        await upsertPatchPanelPorts(puertosAUpsert);
      }
      revalidatePath("/patchpanels");
      revalidatePath(`/patchpanels/${patchpanelIdRaw}/puertos`);
      return {
        status: "success",
        message: "Puertos guardados correctamente.",
      };
    } catch (error) {
      return {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudieron guardar los puertos.",
      };
    }
  }

  const puertosOrdenados =
    Array.isArray(patchpanelInfo.puertos) && patchpanelInfo.puertos.length > 0
      ? patchpanelInfo.puertos.slice().sort((a, b) => a.numero - b.numero)
      : [];

  const puertosEnriquecidos = puertosOrdenados.map((puerto) => {
    const puertoSwitch =
      puerto.puerto_switch_id && puertosCatalogoPorId.has(puerto.puerto_switch_id)
        ? puertosCatalogoPorId.get(puerto.puerto_switch_id) ?? null
        : null;
    return {
      ...puerto,
      puerto_switch: puertoSwitch,
    };
  });

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
      <PatchPanelPortsForm
        patchpanelId={String(patchpanelInfo.id)}
        patchpanelNombre={patchpanelInfo.nombre}
        puertosTotales={puertosTotales}
        puertos={puertosEnriquecidos}
        opcionesSwitches={opcionesSwitches}
        opcionesPuertosPorSwitch={opcionesPuertosPorSwitch}
        action={guardarPuertosAction}
        initialState={INITIAL_STATE}
        backHref="/patchpanels"
      />
    </main>
  );
}
