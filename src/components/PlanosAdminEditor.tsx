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

type ImageDimensions = {
  width: number;
  height: number;
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

function getEquipoDisplayName(equipo: EquipoRecord): string {
  return equipo.nombre?.trim() || equipo.modelo?.trim() || `Equipo ${equipo.id}`;
}

function getUsuarioDisplayName(equipo: EquipoRecord): string {
  const nombreCompleto = equipo.usuario?.nombre_completo?.trim();
  if (nombreCompleto) return nombreCompleto;

  const partes = [equipo.usuario?.nombre, equipo.usuario?.apellidos]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0);

  return partes.length > 0 ? partes.join(" ") : "Sin usuario";
}

function getConexionPrincipal(equipo: EquipoRecord): {
  switchName: string;
  portLabel: string;
} {
  const primerPuerto = Array.isArray(equipo.puertos_conectados)
    ? equipo.puertos_conectados
        .filter(
          (puerto) =>
            Boolean(puerto) &&
            typeof puerto.switch_id === "number" &&
            Number.isFinite(puerto.switch_id),
        )
        .slice()
        .sort((a, b) => {
          const switchA = typeof a.switch_id === "number" ? a.switch_id : Number.MAX_SAFE_INTEGER;
          const switchB = typeof b.switch_id === "number" ? b.switch_id : Number.MAX_SAFE_INTEGER;
          if (switchA !== switchB) return switchA - switchB;

          const numeroA = typeof a.numero === "number" ? a.numero : Number.MAX_SAFE_INTEGER;
          const numeroB = typeof b.numero === "number" ? b.numero : Number.MAX_SAFE_INTEGER;
          return numeroA - numeroB;
        })[0] ?? null
    : null;

  if (!primerPuerto) {
    return {
      switchName: "Sin switch",
      portLabel: "Sin puerto",
    };
  }

  const switchName =
    primerPuerto.switch?.nombre?.trim() ||
    (typeof primerPuerto.switch_id === "number" ? `Switch ${primerPuerto.switch_id}` : "Sin switch");

  const portLabel =
    typeof primerPuerto.numero === "number" && Number.isFinite(primerPuerto.numero)
      ? String(primerPuerto.numero)
      : primerPuerto.nombre?.trim() || "Sin puerto";

  return { switchName, portLabel };
}

function clampZoom(value: number): number {
  return Math.min(4, Math.max(0.5, value));
}

function normalizeRotationTurns(value: number): 0 | 1 | 2 | 3 {
  const normalized = ((value % 4) + 4) % 4;
  return normalized as 0 | 1 | 2 | 3;
}

function fitImageToViewport(
  naturalSize: ImageDimensions,
  viewportWidth: number | null,
): ImageDimensions {
  const usableWidth =
    typeof viewportWidth === "number" && viewportWidth > 0
      ? Math.max(320, viewportWidth - 24)
      : naturalSize.width;
  const scale = naturalSize.width > usableWidth ? usableWidth / naturalSize.width : 1;

  return {
    width: Math.round(naturalSize.width * scale),
    height: Math.round(naturalSize.height * scale),
  };
}

function mapPositionToVisual(
  position: { xPct: number; yPct: number },
  rotationTurns: 0 | 1 | 2 | 3,
): { xPct: number; yPct: number } {
  switch (rotationTurns) {
    case 1:
      return { xPct: 100 - position.yPct, yPct: position.xPct };
    case 2:
      return { xPct: 100 - position.xPct, yPct: 100 - position.yPct };
    case 3:
      return { xPct: position.yPct, yPct: 100 - position.xPct };
    default:
      return position;
  }
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
  const [isPanning, setIsPanning] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotationTurns, setRotationTurns] = useState<0 | 1 | 2 | 3>(0);
  const [imageNaturalSize, setImageNaturalSize] = useState<ImageDimensions | null>(null);
  const [imageBaseSize, setImageBaseSize] = useState<ImageDimensions | null>(null);
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const panStateRef = useRef({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });
  const suppressNextClickRef = useRef(false);

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
    setZoom(1);
  }, [planoImageUrl]);

  useEffect(() => {
    setRotationTurns(0);
    setImageNaturalSize(null);
    setImageBaseSize(null);
  }, [planoImageUrl]);

  useEffect(() => {
    if (!imageNaturalSize) return;

    const syncImageBaseSize = () => {
      const viewportWidth = viewportRef.current?.clientWidth ?? null;
      setImageBaseSize(fitImageToViewport(imageNaturalSize, viewportWidth));
    };

    syncImageBaseSize();
    window.addEventListener("resize", syncImageBaseSize);

    return () => {
      window.removeEventListener("resize", syncImageBaseSize);
    };
  }, [imageNaturalSize]);

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

  const imageWidth = imageBaseSize?.width ?? 0;
  const imageHeight = imageBaseSize?.height ?? 0;
  const isQuarterTurn = rotationTurns % 2 !== 0;
  const stageWidth = isQuarterTurn ? imageHeight : imageWidth;
  const stageHeight = isQuarterTurn ? imageWidth : imageHeight;
  const rotationDegrees = rotationTurns * 90;

  const handleMapClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }

    if (!selectedEquipoId || !stageRef.current) return;

    const rect = stageRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const xVisual = ((event.clientX - rect.left) / rect.width) * 100;
    const yVisual = ((event.clientY - rect.top) / rect.height) * 100;
    let x = xVisual;
    let y = yVisual;

    switch (rotationTurns) {
      case 1:
        x = yVisual;
        y = 100 - xVisual;
        break;
      case 2:
        x = 100 - xVisual;
        y = 100 - yVisual;
        break;
      case 3:
        x = 100 - yVisual;
        y = xVisual;
        break;
      default:
        break;
    }

    const xPct = Number(Math.min(100, Math.max(0, x)).toFixed(3));
    const yPct = Number(Math.min(100, Math.max(0, y)).toFixed(3));

    setDraftPosition({ xPct, yPct });
    setFeedback(null);
  };

  const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    setImageLoadFailed(false);

    const naturalWidth = event.currentTarget.naturalWidth || event.currentTarget.clientWidth;
    const naturalHeight = event.currentTarget.naturalHeight || event.currentTarget.clientHeight;

    if (naturalWidth > 0 && naturalHeight > 0) {
      setImageNaturalSize({ width: naturalWidth, height: naturalHeight });
    }
  };

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheelZoom = (event: WheelEvent) => {
      event.preventDefault();

      const rect = viewport.getBoundingClientRect();
      const pointerX = event.clientX - rect.left + viewport.scrollLeft;
      const pointerY = event.clientY - rect.top + viewport.scrollTop;
      const zoomFactor = event.deltaY < 0 ? 1.1 : 1 / 1.1;

      setZoom((currentZoom) => {
        const nextZoom = clampZoom(Number((currentZoom * zoomFactor).toFixed(3)));
        if (nextZoom === currentZoom) {
          return currentZoom;
        }

        const scaleRatio = nextZoom / currentZoom;

        requestAnimationFrame(() => {
          const currentViewport = viewportRef.current;
          if (!currentViewport) return;

          currentViewport.scrollLeft = Math.max(
            0,
            pointerX * scaleRatio - (event.clientX - rect.left),
          );
          currentViewport.scrollTop = Math.max(
            0,
            pointerY * scaleRatio - (event.clientY - rect.top),
          );
        });

        return nextZoom;
      });
    };

    viewport.addEventListener("wheel", handleWheelZoom, { passive: false });

    return () => {
      viewport.removeEventListener("wheel", handleWheelZoom);
    };
  }, []);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const viewport = viewportRef.current;
      const panState = panStateRef.current;
      if (!viewport || !panState.active) return;

      const deltaX = event.clientX - panState.startX;
      const deltaY = event.clientY - panState.startY;
      if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
        panState.moved = true;
      }

      viewport.scrollLeft = panState.scrollLeft - deltaX;
      viewport.scrollTop = panState.scrollTop - deltaY;
    };

    const stopPanning = () => {
      if (!panStateRef.current.active) return;

      if (panStateRef.current.moved) {
        suppressNextClickRef.current = true;
      }

      panStateRef.current.active = false;
      setIsPanning(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopPanning);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopPanning);
    };
  }, []);

  const handleViewportMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !viewportRef.current) return;

    panStateRef.current = {
      active: true,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: viewportRef.current.scrollLeft,
      scrollTop: viewportRef.current.scrollTop,
    };
    setIsPanning(true);
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
                const titulo = getEquipoDisplayName(equipo);

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
                  {selectedEquipo ? getEquipoDisplayName(selectedEquipo) : "Ninguno"}
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
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-foreground/60">
                  <div className="flex flex-wrap items-center gap-3">
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
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-foreground/5 px-2 py-1 font-medium text-foreground/70">
                      Giro {rotationDegrees}°
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setRotationTurns((currentTurns) =>
                          normalizeRotationTurns(currentTurns - 1),
                        )
                      }
                      className="rounded border border-border bg-background px-2 py-1 text-sm text-foreground transition hover:bg-foreground/10"
                    >
                      Izquierda
                    </button>
                    <button
                      type="button"
                      onClick={() => setRotationTurns(0)}
                      className="rounded border border-border bg-background px-2 py-1 text-sm text-foreground transition hover:bg-foreground/10"
                    >
                      0°
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setRotationTurns((currentTurns) =>
                          normalizeRotationTurns(currentTurns + 1),
                        )
                      }
                      className="rounded border border-border bg-background px-2 py-1 text-sm text-foreground transition hover:bg-foreground/10"
                    >
                      Derecha
                    </button>
                    <span className="rounded bg-foreground/5 px-2 py-1 font-medium text-foreground/70">
                      Zoom {Math.round(zoom * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setZoom((currentZoom) => clampZoom(currentZoom / 1.1))}
                      className="rounded border border-border bg-background px-2 py-1 text-sm text-foreground transition hover:bg-foreground/10"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoom(1)}
                      className="rounded border border-border bg-background px-2 py-1 text-sm text-foreground transition hover:bg-foreground/10"
                    >
                      100%
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoom((currentZoom) => clampZoom(currentZoom * 1.1))}
                      className="rounded border border-border bg-background px-2 py-1 text-sm text-foreground transition hover:bg-foreground/10"
                    >
                      +
                    </button>
                  </div>
                </div>

                {imageLoadFailed ? (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    No se ha podido cargar el SVG. Si el bucket `planos` es privado, reinicia el
                    servidor de Next para que lea `SUPABASE_SERVICE_ROLE_KEY` y abre la URL del
                    plano en otra pestaña para ver el error real.
                  </div>
                ) : null}

                <div
                  ref={viewportRef}
                  onMouseDown={handleViewportMouseDown}
                  className={`max-h-[70vh] overflow-auto rounded-lg border border-border bg-white ${
                    isPanning ? "cursor-grabbing select-none" : "cursor-grab"
                  }`}
                >
                  {imageBaseSize ? (
                    <div
                      className="origin-top-left"
                      style={{
                        width: `${stageWidth}px`,
                        height: `${stageHeight}px`,
                        transform: `scale(${zoom})`,
                      }}
                    >
                      <div
                        ref={stageRef}
                        className={`relative ${isPanning ? "cursor-grabbing" : "cursor-crosshair"}`}
                        onClick={handleMapClick}
                        style={{
                          width: `${stageWidth}px`,
                          height: `${stageHeight}px`,
                        }}
                      >
                        <div
                          className="absolute left-1/2 top-1/2"
                          style={{
                            width: `${imageWidth}px`,
                            height: `${imageHeight}px`,
                            transform: `translate(-50%, -50%) rotate(${rotationDegrees}deg)`,
                            transformOrigin: "center center",
                          }}
                        >
                          <img
                            ref={imageRef}
                            src={planoImageUrl}
                            alt="Plano de oficina"
                            className="block h-full w-full"
                            draggable={false}
                            onLoad={handleImageLoad}
                            onError={() => setImageLoadFailed(true)}
                          />
                        </div>

                        <div className="pointer-events-none absolute inset-0 z-10">
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
                            const equipoLabel = getEquipoDisplayName(equipo);
                            const usuarioLabel = getUsuarioDisplayName(equipo);
                            const tomaLabel = equipo.toma_red?.trim() || "Sin toma";
                            const conexion = getConexionPrincipal(equipo);
                            const tooltipLabel = [
                              `Equipo: ${equipoLabel}`,
                              `Usuario: ${usuarioLabel}`,
                              `Toma: ${tomaLabel}`,
                              `Switch: ${conexion.switchName}`,
                              `Puerto: ${conexion.portLabel}`,
                            ].join("\n");
                            const visualPosition = mapPositionToVisual(
                              {
                                xPct: position.xPct,
                                yPct: position.yPct,
                              },
                              rotationTurns,
                            );

                            return (
                              <div
                                key={`marker-${equipo.id}`}
                                className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
                                style={{
                                  left: `${visualPosition.xPct}%`,
                                  top: `${visualPosition.yPct}%`,
                                }}
                              >
                                <span
                                  className={`mb-0.5 block max-w-[72px] truncate rounded border px-1 py-px text-center text-[8px] leading-none ${
                                    isSelected
                                      ? "border-red-200 bg-red-50/95 text-red-950"
                                      : "border-slate-200 bg-white/95 text-slate-900"
                                  }`}
                                >
                                  {usuarioLabel}
                                </span>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    if (suppressNextClickRef.current) {
                                      suppressNextClickRef.current = false;
                                      return;
                                    }
                                    event.stopPropagation();
                                    setSelectedEquipoId(equipo.id);
                                  }}
                                  title={tooltipLabel}
                                  className={`pointer-events-auto block h-2.5 w-2.5 rounded-full border shadow ${
                                    isSelected
                                      ? "border-white bg-red-500 shadow-red-500/50"
                                      : "border-white bg-sky-500 shadow-sky-500/40"
                                  }`}
                                >
                                  <span className="sr-only">{equipoLabel}</span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <img
                      ref={imageRef}
                      src={planoImageUrl}
                      alt="Plano de oficina"
                      className="block h-auto max-w-full"
                      draggable={false}
                      onLoad={handleImageLoad}
                      onError={() => setImageLoadFailed(true)}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
