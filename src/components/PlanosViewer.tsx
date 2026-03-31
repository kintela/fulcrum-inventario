"use client";

import { useEffect, useRef, useState } from "react";

import type { EquipoRecord } from "@/lib/supabase";

type PlanosViewerProps = {
  planoNombre: string;
  planoImageUrl: string | null;
  equipos: EquipoRecord[];
};

type ImageDimensions = {
  width: number;
  height: number;
};

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

export default function PlanosViewer({
  planoNombre,
  planoImageUrl,
  equipos,
}: PlanosViewerProps) {
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotationTurns, setRotationTurns] = useState<0 | 1 | 2 | 3>(0);
  const [imageNaturalSize, setImageNaturalSize] = useState<ImageDimensions | null>(null);
  const [imageBaseSize, setImageBaseSize] = useState<ImageDimensions | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const panStateRef = useRef({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });

  useEffect(() => {
    setImageLoadFailed(false);
    setZoom(1);
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

  const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    setImageLoadFailed(false);

    const naturalWidth = event.currentTarget.naturalWidth || event.currentTarget.clientWidth;
    const naturalHeight = event.currentTarget.naturalHeight || event.currentTarget.clientHeight;

    if (naturalWidth > 0 && naturalHeight > 0) {
      setImageNaturalSize({ width: naturalWidth, height: naturalHeight });
    }
  };

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

  const equiposConPosicion = equipos.filter((equipo) => {
    return (
      typeof equipo.x_pct === "number" &&
      Number.isFinite(equipo.x_pct) &&
      typeof equipo.y_pct === "number" &&
      Number.isFinite(equipo.y_pct)
    );
  });

  const equiposSinPosicion = equipos.length - equiposConPosicion.length;
  const imageWidth = imageBaseSize?.width ?? 0;
  const imageHeight = imageBaseSize?.height ?? 0;
  const isQuarterTurn = rotationTurns % 2 !== 0;
  const stageWidth = isQuarterTurn ? imageHeight : imageWidth;
  const stageHeight = isQuarterTurn ? imageWidth : imageHeight;
  const rotationDegrees = rotationTurns * 90;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">{planoNombre}</h2>
            <p className="text-sm text-foreground/70">
              Pasa el ratón por cada punto para ver el equipo, el usuario y la conexión.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-background px-3 py-2">
              <div className="text-xs font-medium uppercase tracking-wide text-foreground/60">
                Total equipos
              </div>
              <div className="mt-1 text-sm font-semibold text-foreground">{equipos.length}</div>
            </div>
            <div className="rounded-lg border border-border bg-background px-3 py-2">
              <div className="text-xs font-medium uppercase tracking-wide text-foreground/60">
                Ubicados
              </div>
              <div className="mt-1 text-sm font-semibold text-foreground">
                {equiposConPosicion.length}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background px-3 py-2">
              <div className="text-xs font-medium uppercase tracking-wide text-foreground/60">
                Pendientes
              </div>
              <div className="mt-1 text-sm font-semibold text-foreground">{equiposSinPosicion}</div>
            </div>
          </div>
        </div>
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
                    setRotationTurns((currentTurns) => normalizeRotationTurns(currentTurns - 1))
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
                    setRotationTurns((currentTurns) => normalizeRotationTurns(currentTurns + 1))
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
                No se ha podido cargar el SVG del plano.
              </div>
            ) : null}

            <div
              ref={viewportRef}
              onMouseDown={handleViewportMouseDown}
              className={`max-h-[75vh] overflow-auto rounded-lg border border-border bg-white ${
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
                    className="relative"
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
                        alt={`Plano ${planoNombre}`}
                        className="block h-full w-full"
                        draggable={false}
                        onLoad={handleImageLoad}
                        onError={() => setImageLoadFailed(true)}
                      />
                    </div>

                    <div className="pointer-events-none absolute inset-0 z-10">
                      {equiposConPosicion.map((equipo) => {
                        const usuarioLabel = getUsuarioDisplayName(equipo);
                        const tomaLabel = equipo.toma_red?.trim() || "Sin toma";
                        const equipoLabel = getEquipoDisplayName(equipo);
                        const conexion = getConexionPrincipal(equipo);
                        const visualPosition = mapPositionToVisual(
                          {
                            xPct: equipo.x_pct!,
                            yPct: equipo.y_pct!,
                          },
                          rotationTurns,
                        );

                        return (
                          <div
                            key={`viewer-marker-${equipo.id}`}
                            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
                            style={{
                              left: `${visualPosition.xPct}%`,
                              top: `${visualPosition.yPct}%`,
                            }}
                          >
                            <span className="mb-0.5 block max-w-[72px] truncate rounded border border-slate-200 bg-white/95 px-1 py-px text-center text-[8px] leading-none text-slate-900">
                              {usuarioLabel}
                            </span>
                            <button
                              type="button"
                              title={[
                                `Equipo: ${equipoLabel}`,
                                `Usuario: ${usuarioLabel}`,
                                `Toma: ${tomaLabel}`,
                                `Switch: ${conexion.switchName}`,
                                `Puerto: ${conexion.portLabel}`,
                              ].join("\n")}
                              className="pointer-events-auto block h-2.5 w-2.5 rounded-full border border-white bg-sky-500 shadow shadow-sky-500/40"
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
                  alt={`Plano ${planoNombre}`}
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
  );
}
