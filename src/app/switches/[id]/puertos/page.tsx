import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import SwitchPortsForm, {
  type SwitchPortsFormState,
} from "@/components/SwitchPortsForm";
import {
  deleteSwitchPorts,
  fetchEquiposCatalogo,
  fetchSwitchById,
  fetchSwitchesCatalogo,
  upsertSwitchPorts,
  type SwitchPortUpsert,
} from "@/lib/supabase";

const INITIAL_STATE: SwitchPortsFormState = {
  status: "idle",
  message: null,
};

type Params = {
  id: string;
};

export default async function SwitchPortsPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const switchInfo = await fetchSwitchById(id);
  if (!switchInfo) {
    notFound();
  }

  const puertosTotales = Number.isFinite(Number(switchInfo.puertos_totales))
    ? Number(switchInfo.puertos_totales)
    : 0;

  if (puertosTotales <= 0) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
        <div className="space-y-3 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm">
          <h1 className="text-2xl font-semibold text-foreground">
            {switchInfo.nombre ?? `Switch #${switchInfo.id}`}
          </h1>
          <p className="text-sm text-foreground/70">
            Este switch no tiene definido el número total de puertos. Configúralo antes de gestionar
            los puertos individuales.
          </p>
        </div>
      </main>
    );
  }

  const [equiposCatalogo, switchesCatalogo] = await Promise.all([
    fetchEquiposCatalogo(),
    fetchSwitchesCatalogo(),
  ]);

  const opcionesEquipos = [
    ...equiposCatalogo.map((equipo) => {
      const nombre =
        equipo.nombre?.trim().length && equipo.nombre
          ? equipo.nombre.trim()
          : `Equipo #${equipo.id}`;
      const modelo =
        equipo.modelo?.trim().length && equipo.modelo
          ? ` (${equipo.modelo.trim()})`
          : "";
      return {
        value: `equipo:${equipo.id}`,
        label: `${nombre}${modelo}`,
      };
    }),
    ...switchesCatalogo.map((sw) => {
      const nombre =
        sw.nombre?.trim().length && sw.nombre
          ? sw.nombre.trim()
          : `Switch #${sw.id}`;
      return {
        value: `switch:${sw.id}`,
        label: `${nombre} (Switch)`,
      };
    }),
  ].sort((a, b) =>
    a.label.localeCompare(b.label, "es", { sensitivity: "base" }),
  );

  async function guardarPuertosAction(
    _prevState: SwitchPortsFormState,
    formData: FormData,
  ): Promise<SwitchPortsFormState> {
    "use server";

    const switchIdRaw = formData.get("switch_id");
    if (typeof switchIdRaw !== "string" || switchIdRaw.trim().length === 0) {
      return { status: "error", message: "Identificador del switch no válido." };
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

    const switchIdNumber = Number.parseInt(switchIdRaw, 10);
    if (!Number.isFinite(switchIdNumber)) {
      return {
        status: "error",
        message: "El identificador del switch es inválido.",
      };
    }

    const puertosAUpsert: SwitchPortUpsert[] = [];
    const idsParaEliminar: number[] = [];

    for (let numero = 1; numero <= puertosTotalesForm; numero += 1) {
      const base = `puerto_${numero}`;
      const idRaw = formData.get(`${base}_id`);
      const nombreRaw = formData.get(`${base}_nombre`);
      const equipoSeleccionRaw = formData.get(`${base}_equipo_id`);
      const vlanRaw = formData.get(`${base}_vlan`);
      const velocidadRaw = formData.get(`${base}_velocidad`);
      const poeRaw = formData.get(`${base}_poe`);
      const observacionesRaw = formData.get(`${base}_observaciones`);

      const idValor =
        typeof idRaw === "string" && idRaw.trim().length > 0
          ? Number.parseInt(idRaw, 10)
          : null;
      const nombre =
        typeof nombreRaw === "string" && nombreRaw.trim().length > 0
          ? nombreRaw.trim()
          : null;
      let equipoId: string | null = null;
      let switchConectadoId: number | null = null;
      if (
        typeof equipoSeleccionRaw === "string" &&
        equipoSeleccionRaw.trim().length > 0
      ) {
        const trimmed = equipoSeleccionRaw.trim();
        if (trimmed.startsWith("equipo:")) {
          equipoId = trimmed.split("equipo:")[1] ?? null;
        } else if (trimmed.startsWith("switch:")) {
          const rawId = trimmed.split("switch:")[1] ?? "";
          const parsed = Number.parseInt(rawId, 10);
          if (Number.isFinite(parsed)) {
            switchConectadoId = parsed;
          } else {
            return {
              status: "error",
              message: `El switch seleccionado para el puerto ${numero} no es válido.`,
            };
          }
        } else {
          equipoId = trimmed;
        }
      }
      const vlan =
        typeof vlanRaw === "string" && vlanRaw.trim().length > 0
          ? Number.parseInt(vlanRaw.trim(), 10)
          : null;
      if (vlan !== null && (!Number.isFinite(vlan) || vlan < 0)) {
        return {
          status: "error",
          message: `La VLAN indicada para el puerto ${numero} no es válida.`,
        };
      }
      const velocidad =
        typeof velocidadRaw === "string" && velocidadRaw.trim().length > 0
          ? Number.parseInt(velocidadRaw.trim(), 10)
          : null;
      if (velocidad !== null && (!Number.isFinite(velocidad) || velocidad < 0)) {
        return {
          status: "error",
          message: `La velocidad indicada para el puerto ${numero} no es válida.`,
        };
      }

      const poe =
        typeof poeRaw === "string"
          ? poeRaw === "on" || poeRaw === "true" || poeRaw === "1"
          : false;

      const observaciones =
        typeof observacionesRaw === "string" && observacionesRaw.trim().length > 0
          ? observacionesRaw.trim()
          : null;

      const hayContenido =
        nombre ||
        equipoId ||
        switchConectadoId !== null ||
        vlan !== null ||
        velocidad !== null ||
        poe ||
        (observaciones && observaciones.length > 0);

      if (!hayContenido) {
        if (idValor !== null) {
          idsParaEliminar.push(idValor);
        }
        continue;
      }

      const puerto: SwitchPortUpsert = {
        switch_id: switchIdNumber,
        numero,
        nombre,
        equipo_id: equipoId ?? null,
        switch_conectado_id: switchConectadoId ?? null,
        vlan,
        velocidad_mbps: velocidad,
        poe,
        observaciones,
      };

      if (idValor !== null) {
        puerto.id = idValor;
      }

      puertosAUpsert.push(puerto);
    }

    try {
      if (idsParaEliminar.length > 0) {
        await deleteSwitchPorts(idsParaEliminar);
      }
      if (puertosAUpsert.length > 0) {
        await upsertSwitchPorts(puertosAUpsert);
      }
      revalidatePath("/");
      revalidatePath(`/switches/${switchIdRaw}/puertos`);
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
    Array.isArray(switchInfo.puertos) && switchInfo.puertos.length > 0
      ? switchInfo.puertos.slice().sort((a, b) => a.numero - b.numero)
      : [];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
      <SwitchPortsForm
        switchId={String(switchInfo.id)}
        switchNombre={switchInfo.nombre}
        puertosTotales={puertosTotales}
        puertos={puertosOrdenados}
        opcionesEquipos={opcionesEquipos}
        action={guardarPuertosAction}
        initialState={INITIAL_STATE}
        backHref={`/switches/${switchInfo.id}/editar`}
      />
    </main>
  );
}
