import Link from "next/link";
import { revalidatePath } from "next/cache";

import PlanosAdminEditor, {
  type PlanosAdminEditorState,
} from "@/components/PlanosAdminEditor";
import {
  buildPlanoStorageProxyUrl,
  fetchEquiposByPlanoId,
  fetchPlanos,
  updateEquipo,
} from "@/lib/supabase";

const INITIAL_STATE: PlanosAdminEditorState = {
  status: "idle",
  message: null,
  equipoId: null,
  mode: null,
  xPct: null,
  yPct: null,
};

function parseNumberField(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export default async function AdminPlanosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const planos = await fetchPlanos();
  const resolvedSearch = await searchParams;
  const planoRaw = resolvedSearch?.plano;
  const planoValue = Array.isArray(planoRaw) ? planoRaw[0] : planoRaw;
  const planoIdParsed =
    typeof planoValue === "string" ? Number.parseInt(planoValue, 10) : Number.NaN;

  const planoSeleccionado =
    planos.find((plano) => plano.id === planoIdParsed) ?? planos[0] ?? null;

  const equipos =
    planoSeleccionado && Number.isFinite(planoSeleccionado.id)
      ? await fetchEquiposByPlanoId(planoSeleccionado.id)
      : [];

  const planoImageUrl =
    planoSeleccionado?.ruta_storage && planoSeleccionado.ruta_storage.trim().length > 0
      ? buildPlanoStorageProxyUrl(planoSeleccionado.ruta_storage.trim())
      : null;

  async function guardarPosicionAction(
    _prevState: PlanosAdminEditorState,
    formData: FormData,
  ): Promise<PlanosAdminEditorState> {
    "use server";

    const equipoIdRaw = formData.get("equipo_id");
    const planoIdRaw = formData.get("plano_id");
    const modeRaw = formData.get("mode");

    if (typeof equipoIdRaw !== "string" || equipoIdRaw.trim().length === 0) {
      return {
        status: "error",
        message: "Selecciona un equipo antes de guardar.",
        equipoId: null,
        mode: null,
        xPct: null,
        yPct: null,
      };
    }

    const equipoId = equipoIdRaw.trim();
    const planoId = parseNumberField(planoIdRaw);
    const mode =
      modeRaw === "clear" || modeRaw === "save" ? modeRaw : null;

    if (planoId === null) {
      return {
        status: "error",
        message: "Selecciona un plano válido.",
        equipoId,
        mode,
        xPct: null,
        yPct: null,
      };
    }

    if (!mode) {
      return {
        status: "error",
        message: "Acción no válida.",
        equipoId,
        mode: null,
        xPct: null,
        yPct: null,
      };
    }

    if (mode === "clear") {
      try {
        await updateEquipo(equipoId, {
          plano_id: planoId,
          x_pct: null,
          y_pct: null,
        });
        revalidatePath("/admin/planos");
        return {
          status: "success",
          message: "Posición eliminada correctamente.",
          equipoId,
          mode,
          xPct: null,
          yPct: null,
        };
      } catch (error) {
        return {
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "No se pudo borrar la posición.",
          equipoId,
          mode,
          xPct: null,
          yPct: null,
        };
      }
    }

    const xPct = parseNumberField(formData.get("x_pct"));
    const yPct = parseNumberField(formData.get("y_pct"));

    if (xPct === null || yPct === null) {
      return {
        status: "error",
        message: "Haz clic sobre el plano para asignar la posición.",
        equipoId,
        mode,
        xPct: null,
        yPct: null,
      };
    }

    if (xPct < 0 || xPct > 100 || yPct < 0 || yPct > 100) {
      return {
        status: "error",
        message: "Las coordenadas deben estar entre 0 y 100.",
        equipoId,
        mode,
        xPct,
        yPct,
      };
    }

    try {
      await updateEquipo(equipoId, {
        plano_id: planoId,
        x_pct: xPct,
        y_pct: yPct,
      });
      revalidatePath("/admin/planos");
      return {
        status: "success",
        message: "Posición guardada correctamente.",
        equipoId,
        mode,
        xPct,
        yPct,
      };
    } catch (error) {
      return {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo guardar la posición.",
        equipoId,
        mode,
        xPct,
        yPct,
      };
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">Editor visual de planos</h2>
            <p className="text-sm text-foreground/70">
              Selecciona un plano y ubica cada equipo con el ratón sobre el SVG.
            </p>
          </div>
          <Link
            href="/admin"
            className="text-sm text-blue-600 underline underline-offset-4 transition hover:text-blue-700"
          >
            Volver a administración
          </Link>
        </div>

        {planos.length === 0 ? (
          <p className="mt-4 text-sm text-foreground/60">
            No hay planos registrados todavía.
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {planos.map((plano) => {
              const isActive = planoSeleccionado?.id === plano.id;

              return (
                <Link
                  key={plano.id}
                  href={`/admin/planos?plano=${plano.id}`}
                  className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    isActive
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-foreground/80 hover:bg-foreground/10"
                  }`}
                >
                  {plano.nombre?.trim() || `Plano ${plano.id}`}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {planoSeleccionado ? (
        <PlanosAdminEditor
          planos={planos}
          planoSeleccionadoId={planoSeleccionado.id}
          planoImageUrl={planoImageUrl}
          equipos={equipos}
          action={guardarPosicionAction}
          initialState={INITIAL_STATE}
        />
      ) : null}
    </section>
  );
}
