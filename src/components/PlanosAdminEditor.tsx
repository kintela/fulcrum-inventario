"use client";

import { useActionState, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import type { EquipoRecord, PlanoRecord } from "@/lib/supabase";

export type PlanosAdminEditorState = {
  status: "idle" | "success" | "error";
  message: string | null;
  equipoId: string | null;
  mode: "save" | "clear" | null;
  xPct: number | null;
  yPct: number | null;
};

type PlanosAdminEditorProps = {
  planos: PlanoRecord[];
  planoSeleccionadoId: number | null;
  planoImageUrl: string | null;
  equipos: EquipoRecord[];
  action: (
    prevState: PlanosAdminEditorState,
    formData: FormData,
  ) => Promise<PlanosAdminEditorState>;
  initialState: PlanosAdminEditorState;
};

type Position = {
  xPct: number | null;
  yPct: number | null;
};

function toPositionRecord(equipos: EquipoRecord[]): Record<string, Position> {
  return Object.fromEntries(
    equipos.map((equipo) => [
      equipo.id,
      {
        xPct:
          typeof equipo.x_pct === "number" && Number.isFinite(equipo.x_pct)
            ? equipo.x_pct
            : null,
        yPct:
          typeof equipo.y_pct === "number" && Number.isFinite(equipo.y_pct)
            ? equipo.y_pct
            : null,
      },
    ]),
  );
}

function getInitialSelectedEquipoId(equipos: EquipoRecord[]): string | null {
  const sinCoordenadas = equipos.find((equipo) => {
    const hasX = typeof equipo.x_pct === "number" && Number.isFinite(equipo.x_pct);
    const hasY = typeof equipo.y_pct === "number" && Number.isFinite(equipo.y_pct);
    return !hasX || !hasY;
  });

  return sinCoordenadas?.id ?? equipos[0]?.id ?? null;
}

function formatCoordinate(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Sin asignar";
  }

  return `${value.toFixed(2)}%`;
}

function ActionButtons({
  canSave,
  canClear,
}: {
  canSave: boolean;
  canClear: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="submit"
        name="mode"
        value="save"
        disabled={!canSave || pending}
        className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Guardando..." : "Guardar posición"}
      </button>
      <button
        type="submit"
        name="mode"
        value="clear"
        disabled={!canClear || pending}
        className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-foreground/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Borrar posición
      </button>
    </div>
  );
}

export default function PlanosAdminEditor({
  planos,
  planoSeleccionadoId,
  planoImageUrl,
  equipos,
  action,
  initialState,
}: PlanosAdminEditorProps) {
  const [state, formAction] = useActionState(action, initialState);
  const [selectedEquipoId, setSelectedEquipoId] = useState<string | null>(() =>
    getInitialSelectedEquipoId(equipos),
  );
  const [positionsById, setPositionsById] = useState<Record<string, Position>>(() =>
    toPositionRecord(equipos),
  );
  const [draftPosition, setDraftPosition] = useState<Position | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [feedback, setFeedback] = useState<PlanosAdminEditorState | null>(null);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setPositionsById(toPositionRecord(equipos));
    setSelectedEquipoId(getInitialSelectedEquipoId(equipos));
    setDraftPosition(null);
    setSearchTerm("");
    setFeedback(null);
  }, [equipos, planoSeleccionadoId]);

  useEffect(() => {
    setImageLoadFailed(false);
  }, [planoImageUrl]);

  useEffect(() => {
    if (state.status === "idle") return;

    setFeedback(state);

    if (state.status === "success" && state.equipoId) {
      setPositionsById((prev) => ({
        ...prev,
        [state.equipoId!]: {
          xPct: state.mode === "clear" ? null : state.xPct ?? null,
          yPct: state.mode === "clear" ? null : state.yPct ?? null,
        },
      }));
      setDraftPosition(null);
    }
  }, [state]);

  useEffect(() => {
    setDraftPosition(null);
  }, [selectedEquipoId]);

  const equiposFiltrados = useMemo(() => {
    const query = deferredSearchTerm.trim().toLowerCase();
    if (!query) return equipos;

    return equipos.filter((equipo) => {
      const values = [
        equipo.nombre,
        equipo.modelo,
        equipo.toma_red,
        equipo.ubicacion?.nombre,
      ]
        .map((value) => (typeof value === "string" ? value.toLowerCase().trim() : ""))
        .filter((value) => value.length > 0);

      return values.some((value) => value.includes(query));
    });
  }, [deferredSearchTerm, equipos]);

  const selectedEquipo =
    equipos.find((equipo) => equipo.id === selectedEquipoId) ?? null;
  const savedPosition = selectedEquipoId ? positionsById[selectedEquipoId] ?? null : null;
  const positionToDisplay = draftPosition ?? savedPosition;
  const canClear =
    selectedEquipoId !== null &&
    ((savedPosition?.xPct ?? null) !== null || (savedPosition?.yPct ?? null) !== null);

  const equiposConPosicion = equipos.filter((equipo) => {
    const position = positionsById[equipo.id];
    return (
      typeof position?.xPct === "number" &&
      Number.isFinite(position.xPct) &&
      typeof position?.yPct === "number" &&
      Number.isFinite(position.yPct)
    );
  }).length;

  const handleMapClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedEquipoId || !imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    const xPct = Number(Math.min(100, Math.max(0, x)).toFixed(3));
    const yPct = Number(Math.min(100, Math.max(0, y)).toFixed(3));

    setDraftPosition({ xPct, yPct });
    setFeedback(null);
  };

  return (
    <section className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
          <header className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Posicionado visual</h2>
            <p className="text-sm text-foreground/70">
              Selecciona un equipo, haz clic sobre el plano y guarda su posición.
            </p>
            <p className="text-xs text-foreground/60">
              Asignados: {equiposConPosicion} de {equipos.length}
            </p>
          </header>

          <label className="flex flex-col gap-2 text-sm text-foreground/70">
            Buscar equipo
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Nombre, modelo o toma..."
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
            />
          </label>

          <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
            {equiposFiltrados.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-3 text-sm text-foreground/60">
                No hay equipos que coincidan con la búsqueda.
              </p>
            ) : (
              equiposFiltrados.map((equipo) => {
                const isSelected = equipo.id === selectedEquipoId;
                const position = positionsById[equipo.id];
                const hasPosition =
                  typeof position?.xPct === "number" &&
                  Number.isFinite(position.xPct) &&
                  typeof position?.yPct === "number" &&
                  Number.isFinite(position.yPct);
                const titulo =
                  equipo.nombre?.trim() ||
                  equipo.modelo?.trim() ||
                  `Equipo ${equipo.id}`;

                return (
                  <button
                    key={equipo.id}
                    type="button"
                    onClick={() => setSelectedEquipoId(equipo.id)}
                    className={`flex w-full flex-col gap-1 rounded-lg border px-3 py-3 text-left transition ${
                      isSelected
                        ? "border-foreground bg-foreground/5"
                        : "border-border bg-background hover:bg-foreground/5"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-foreground">{titulo}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          hasPosition
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {hasPosition ? "Ubicado" : "Pendiente"}
                      </span>
                    </div>
                    <span className="text-xs text-foreground/70">
                      Toma: {equipo.toma_red?.trim() || "Sin toma"}
                    </span>
                    <span className="text-xs text-foreground/60">
                      X {formatCoordinate(position?.xPct)} · Y {formatCoordinate(position?.yPct)}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-foreground">
                  {planos.find((plano) => plano.id === planoSeleccionadoId)?.nombre ?? "Plano"}
                </h2>
                <p className="text-sm text-foreground/70">
                  Haz clic sobre el SVG para colocar el equipo seleccionado.
                </p>
              </div>

              <form action={formAction} className="space-y-3">
                <input type="hidden" name="equipo_id" value={selectedEquipoId ?? ""} />
                <input type="hidden" name="plano_id" value={planoSeleccionadoId ?? ""} />
                <input
                  type="hidden"
                  name="x_pct"
                  value={draftPosition?.xPct != null ? String(draftPosition.xPct) : ""}
                />
                <input
                  type="hidden"
                  name="y_pct"
                  value={draftPosition?.yPct != null ? String(draftPosition.yPct) : ""}
                />
                <ActionButtons
                  canSave={selectedEquipoId !== null && draftPosition !== null}
                  canClear={canClear}
                />
              </form>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-border bg-background px-3 py-2">
                <div className="text-xs font-medium uppercase tracking-wide text-foreground/60">
                  Equipo seleccionado
                </div>
                <div className="mt-1 text-sm font-semibold text-foreground">
                  {selectedEquipo?.nombre?.trim() ||
                    selectedEquipo?.modelo?.trim() ||
                    (selectedEquipo ? `Equipo ${selectedEquipo.id}` : "Ninguno")}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-background px-3 py-2">
                <div className="text-xs font-medium uppercase tracking-wide text-foreground/60">
                  Toma de red
                </div>
                <div className="mt-1 text-sm font-semibold text-foreground">
                  {selectedEquipo?.toma_red?.trim() || "Sin toma"}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-background px-3 py-2">
                <div className="text-xs font-medium uppercase tracking-wide text-foreground/60">
                  Coordenada X
                </div>
                <div className="mt-1 text-sm font-semibold text-foreground">
                  {formatCoordinate(positionToDisplay?.xPct)}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-background px-3 py-2">
                <div className="text-xs font-medium uppercase tracking-wide text-foreground/60">
                  Coordenada Y
                </div>
                <div className="mt-1 text-sm font-semibold text-foreground">
                  {formatCoordinate(positionToDisplay?.yPct)}
                </div>
              </div>
            </div>

            {feedback?.message ? (
              <p
                className={`mt-4 rounded-md px-3 py-2 text-sm ${
                  feedback.status === "error"
                    ? "border border-red-200 bg-red-50 text-red-700"
                    : "border border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
              >
                {feedback.message}
              </p>
            ) : null}
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            {!planoImageUrl ? (
              <p className="text-sm text-foreground/60">
                Este plano no tiene ruta de storage configurada.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3 text-xs text-foreground/60">
                  <span className="font-medium text-foreground/70">Ruta del plano:</span>
                  <code className="rounded bg-foreground/5 px-2 py-1">{planoImageUrl}</code>
                  <a
                    href={planoImageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 underline underline-offset-4 hover:text-blue-700"
                  >
                    Abrir plano en otra pestaña
                  </a>
                </div>

                {imageLoadFailed ? (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    No se ha podido cargar el SVG. Si el bucket `planos` es privado, reinicia el
                    servidor de Next para que lea `SUPABASE_SERVICE_ROLE_KEY` y abre la URL del
                    plano en otra pestaña para ver el error real.
                  </div>
                ) : null}

                <div
                  className="relative inline-block max-w-full cursor-crosshair overflow-auto rounded-lg border border-border bg-white"
                  onClick={handleMapClick}
                >
                  <img
                    ref={imageRef}
                    src={planoImageUrl}
                    alt="Plano de oficina"
                    className="block h-auto max-w-full"
                    draggable={false}
                    onLoad={() => setImageLoadFailed(false)}
                    onError={() => setImageLoadFailed(true)}
                  />

                  {equipos.map((equipo) => {
                    const position =
                      equipo.id === selectedEquipoId && draftPosition
                        ? draftPosition
                        : positionsById[equipo.id];

                    if (
                      typeof position?.xPct !== "number" ||
                      !Number.isFinite(position.xPct) ||
                      typeof position?.yPct !== "number" ||
                      !Number.isFinite(position.yPct)
                    ) {
                      return null;
                    }

                    const isSelected = equipo.id === selectedEquipoId;
                    const label = equipo.toma_red?.trim() || equipo.nombre?.trim() || equipo.id;

                    return (
                      <button
                        key={`marker-${equipo.id}`}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedEquipoId(equipo.id);
                        }}
                        title={label}
                        className={`absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow ${
                          isSelected
                            ? "border-white bg-red-500 shadow-red-500/50"
                            : "border-white bg-sky-500 shadow-sky-500/40"
                        }`}
                        style={{
                          left: `${position.xPct}%`,
                          top: `${position.yPct}%`,
                        }}
                      >
                        <span className="sr-only">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
