import Link from "next/link";

import PlanosViewer from "@/components/PlanosViewer";
import {
  buildPlanoStorageProxyUrl,
  fetchEquiposByPlanoId,
  fetchPlanos,
} from "@/lib/supabase";

export default async function PlanosPage({
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

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <div className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-foreground">Visualizador de planos</h1>
            <p className="text-sm text-foreground/70">
              Consulta la ubicación de los equipos sobre cada plano sin entrar al editor.
            </p>
          </div>
          <Link
            href="/"
            className="text-sm text-blue-600 underline underline-offset-4 transition hover:text-blue-700"
          >
            Volver al dashboard
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
                  href={`/planos?plano=${plano.id}`}
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
        <PlanosViewer
          planoNombre={planoSeleccionado.nombre?.trim() || `Plano ${planoSeleccionado.id}`}
          planoImageUrl={planoImageUrl}
          equipos={equipos}
        />
      ) : null}
    </main>
  );
}
