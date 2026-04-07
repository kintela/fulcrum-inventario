"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import type { EquipoRecord } from "@/lib/supabase";

type PlanosViewerProps = {
  planoId: number;
  planoNombre: string;
  planoImageUrl: string | null;
  equipos: EquipoRecord[];
};

type ImageDimensions = {
  width: number;
  height: number;
};

type TooltipRow = {
  label: string;
  value: string;
};

type VisibleEquipoData = {
  id: string;
  equipoLabel: string;
  usuarioLabel: string;
  tomaLabel: string;
  ubicacionLabel: string;
  switchName: string;
  portLabel: string;
  tooltipRows: TooltipRow[];
  visualPosition: { xPct: number; yPct: number };
};

const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });

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

function normalizeComparableText(value: string | null | undefined): string {
  if (!value) return "";

  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
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
  planoId,
  planoNombre,
  planoImageUrl,
  equipos,
}: PlanosViewerProps) {
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [zoom, setZoom] = useState(1);
  const [rotationTurns, setRotationTurns] = useState<0 | 1 | 2 | 3>(0);
  const [imageNaturalSize, setImageNaturalSize] = useState<ImageDimensions | null>(null);
  const [imageBaseSize, setImageBaseSize] = useState<ImageDimensions | null>(null);
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const isPrintingRef = useRef(false);
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
    setSearchTerm("");
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
  const shouldRestrictMarkersToCurrentPlano = new Set(["principal", "principal2"]).has(
    normalizeComparableText(planoNombre),
  );
  const equiposConPosicionVisibles = useMemo(() => {
    const equiposDelPlano = shouldRestrictMarkersToCurrentPlano
      ? equiposConPosicion.filter((equipo) => Number(equipo.plano_id) === Number(planoId))
      : equiposConPosicion;

    const query = normalizeComparableText(deferredSearchTerm);
    if (!query) {
      return equiposDelPlano;
    }

    return equiposDelPlano.filter((equipo) => {
      const values = [
        getEquipoDisplayName(equipo),
        getUsuarioDisplayName(equipo),
        equipo.modelo,
        equipo.toma_red,
        equipo.ubicacion?.nombre,
      ]
        .map((value) => normalizeComparableText(value))
        .filter((value) => value.length > 0);

      return values.some((value) => value.includes(query));
    });
  }, [
    deferredSearchTerm,
    equiposConPosicion,
    planoId,
    shouldRestrictMarkersToCurrentPlano,
  ]);

  const equiposVisiblesData = useMemo<VisibleEquipoData[]>(() => {
    return equiposConPosicionVisibles
      .map((equipo) => {
        const usuarioLabel = getUsuarioDisplayName(equipo);
        const tomaLabel = equipo.toma_red?.trim() || "Sin toma";
        const equipoLabel = getEquipoDisplayName(equipo);
        const ubicacionLabel = equipo.ubicacion?.nombre?.trim() || "Sin ubicación";
        const conexion = getConexionPrincipal(equipo);
        const tooltipRows: TooltipRow[] = [
          { label: "Equipo", value: equipoLabel },
          { label: "Usuario", value: usuarioLabel },
          { label: "Toma", value: tomaLabel },
          { label: "Switch", value: conexion.switchName },
          { label: "Puerto", value: conexion.portLabel },
        ];

        return {
          id: equipo.id,
          equipoLabel,
          usuarioLabel,
          tomaLabel,
          ubicacionLabel,
          switchName: conexion.switchName,
          portLabel: conexion.portLabel,
          tooltipRows,
          visualPosition: mapPositionToVisual(
            {
              xPct: equipo.x_pct!,
              yPct: equipo.y_pct!,
            },
            rotationTurns,
          ),
        };
      })
      .sort((a, b) => {
        const byUsuario = collator.compare(a.usuarioLabel, b.usuarioLabel);
        if (byUsuario !== 0) return byUsuario;
        return collator.compare(a.equipoLabel, b.equipoLabel);
      });
  }, [equiposConPosicionVisibles, rotationTurns]);

  const equiposSinPosicion = equipos.length - equiposConPosicion.length;
  const imageWidth = imageBaseSize?.width ?? 0;
  const imageHeight = imageBaseSize?.height ?? 0;
  const isQuarterTurn = rotationTurns % 2 !== 0;
  const stageWidth = isQuarterTurn ? imageHeight : imageWidth;
  const stageHeight = isQuarterTurn ? imageWidth : imageHeight;
  const rotationDegrees = rotationTurns * 90;
  const printableBaseSize = useMemo(() => {
    if (imageNaturalSize) {
      return fitImageToViewport(imageNaturalSize, 1040);
    }

    return imageBaseSize;
  }, [imageBaseSize, imageNaturalSize]);
  const printImageWidth = printableBaseSize?.width ?? 0;
  const printImageHeight = printableBaseSize?.height ?? 0;
  const printStageWidth =
    rotationTurns % 2 !== 0 ? printImageHeight : printImageWidth;
  const printStageHeight =
    rotationTurns % 2 !== 0 ? printImageWidth : printImageHeight;
  const canPrint = Boolean(planoImageUrl && printableBaseSize);

  const handlePrintPdf = useCallback(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    if (!canPrint || isPrintingRef.current) return;

    isPrintingRef.current = true;

    const styleEl = document.createElement("style");
    styleEl.setAttribute("data-print-style", "planos-viewer");
    styleEl.media = "print";
    styleEl.textContent = `
      @page {
        size: A4 portrait;
        margin: 10mm;
      }

      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      @media print {
        body {
          margin: 0;
          padding: 0;
          background: #fff;
        }

        body * {
          visibility: hidden !important;
        }

        #planos-print-area,
        #planos-print-area * {
          visibility: visible !important;
        }

        #planos-print-area {
          display: block !important;
          position: absolute;
          inset: 0;
          width: 100%;
          background: #fff;
        }

        .planos-print-page {
          color: #111827;
          font-family: Arial, sans-serif;
        }

        .planos-print-title {
          margin: 0 0 2mm;
          font-size: 18px;
          font-weight: 700;
        }

        .planos-print-subtitle {
          margin: 0 0 6mm;
          font-size: 11px;
          color: #4b5563;
        }

        .planos-print-map-shell {
          margin: 0 0 8mm;
          page-break-inside: avoid;
        }

        .planos-print-map {
          position: relative;
          margin: 0 auto;
          border: 1px solid #d1d5db;
          background: #fff;
          overflow: visible;
        }

        .planos-print-label {
          position: absolute;
          bottom: 7px;
          left: 50%;
          display: block;
          max-width: 72px;
          transform: translateX(-50%);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          border: 1px solid #cbd5e1;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.96);
          padding: 1px 4px;
          font-size: 8px;
          line-height: 1;
          text-align: center;
          color: #0f172a;
        }

        .planos-print-dot {
          position: absolute;
          left: 50%;
          top: 50%;
          display: block;
          width: 8px;
          height: 8px;
          transform: translate(-50%, -50%);
          border: 1px solid #fff;
          border-radius: 999px;
          background: #0ea5e9;
          box-shadow: 0 0 0 1px rgba(14, 165, 233, 0.15);
        }

        .planos-print-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10px;
        }

        .planos-print-table th,
        .planos-print-table td {
          border: 1px solid #d1d5db;
          padding: 6px;
          text-align: left;
          vertical-align: top;
        }

        .planos-print-table th {
          background: #f3f4f6;
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .planos-print-table tr {
          page-break-inside: avoid;
        }
      }
    `;
    document.head.appendChild(styleEl);

    const cleanup = () => {
      if (styleEl.parentNode) {
        styleEl.parentNode.removeChild(styleEl);
      }
      window.removeEventListener("afterprint", cleanup);
      isPrintingRef.current = false;
    };

    window.addEventListener("afterprint", cleanup);
    window.print();

    window.setTimeout(() => {
      if (isPrintingRef.current) {
        cleanup();
      }
    }, 10000);
  }, [canPrint]);

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

          <div className="flex flex-wrap items-start justify-end gap-3">
            <button
              type="button"
              onClick={handlePrintPdf}
              disabled={!canPrint}
              title="Generar PDF imprimible del plano"
              aria-label="Generar PDF imprimible del plano"
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-foreground/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 9V4H7v5m10 0h1a3 3 0 0 1 3 3v4h-4m0 0v4H7v-4m10 0H7m0 0H3v-4a3 3 0 0 1 3-3h1m0 0h10"
                />
                <path strokeLinecap="round" d="M17 13H7v6h10z" />
              </svg>
              <span>PDF</span>
            </button>

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
                <div className="mt-1 text-sm font-semibold text-foreground">
                  {equiposSinPosicion}
                </div>
              </div>
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
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <label className="flex w-full max-w-sm flex-col gap-2 text-xs text-foreground/70">
                Buscar equipos visibles
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Usuario, equipo, toma o ubicación..."
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
                />
                <span className="text-[11px] text-foreground/60">
                  Mostrando {equiposConPosicionVisibles.length} de {equiposConPosicion.length} equipos
                  ubicados
                </span>
              </label>
              <div className="flex flex-wrap items-center gap-2 text-xs text-foreground/60">
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
                      {/* eslint-disable-next-line @next/next/no-img-element -- Plano interactivo con zoom/rotacion y medicion directa del recurso cargado. */}
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
                      {equiposVisiblesData.map((equipo) => {
                        return (
                          <div
                            key={`viewer-marker-${equipo.id}`}
                            className="pointer-events-none absolute z-10"
                            style={{
                              left: `${equipo.visualPosition.xPct}%`,
                              top: `${equipo.visualPosition.yPct}%`,
                            }}
                          >
                            <span className="absolute bottom-[7px] left-1/2 block max-w-[72px] -translate-x-1/2 truncate rounded border border-slate-200 bg-white/95 px-1 py-px text-center text-[8px] leading-none text-slate-900">
                              {equipo.usuarioLabel}
                            </span>
                            <button
                              type="button"
                              aria-label={equipo.tooltipRows
                                .map((row) => `${row.label}: ${row.value}`)
                                .join(", ")}
                              className="group pointer-events-auto absolute left-1/2 top-1/2 block h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-help rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500/50"
                            >
                              <span
                                aria-hidden="true"
                                className="absolute left-1/2 top-1/2 block h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-sky-500 shadow shadow-sky-500/40"
                              />
                              <span className="sr-only">{equipo.equipoLabel}</span>
                              <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-max min-w-[160px] max-w-[220px] -translate-x-1/2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-left text-[10px] leading-tight text-slate-900 shadow-lg group-hover:block group-focus-visible:block">
                                {equipo.tooltipRows.map((row) => (
                                  <span
                                    key={`${equipo.id}-${row.label}`}
                                    className="block whitespace-nowrap"
                                  >
                                    <span className="font-semibold">{row.label}:</span>{" "}
                                    {row.value}
                                  </span>
                                ))}
                              </span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- Plano interactivo con zoom/rotacion y medicion directa del recurso cargado. */}
                  <img
                    ref={imageRef}
                    src={planoImageUrl}
                    alt={`Plano ${planoNombre}`}
                    className="block h-auto max-w-full"
                    draggable={false}
                    onLoad={handleImageLoad}
                    onError={() => setImageLoadFailed(true)}
                  />
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div id="planos-print-area" aria-hidden="true" style={{ display: "none" }}>
        <div className="planos-print-page">
          <h1 className="planos-print-title">Plano {planoNombre}</h1>
          <p className="planos-print-subtitle">
            Equipos ubicados mostrados: {equiposVisiblesData.length} de {equiposConPosicion.length}.
          </p>

          {planoImageUrl && printableBaseSize ? (
            <div className="planos-print-map-shell">
              <div
                className="planos-print-map"
                style={{
                  width: `${printStageWidth}px`,
                  height: `${printStageHeight}px`,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: `${printImageWidth}px`,
                    height: `${printImageHeight}px`,
                    transform: `translate(-50%, -50%) rotate(${rotationDegrees}deg)`,
                    transformOrigin: "center center",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- La impresión necesita el recurso original con overlay HTML estático. */}
                  <img
                    src={planoImageUrl}
                    alt={`Plano ${planoNombre} para impresión`}
                    style={{ display: "block", width: "100%", height: "100%" }}
                  />
                </div>

                <div style={{ position: "absolute", inset: 0 }}>
                  {equiposVisiblesData.map((equipo) => (
                    <div
                      key={`print-marker-${equipo.id}`}
                      style={{
                        position: "absolute",
                        left: `${equipo.visualPosition.xPct}%`,
                        top: `${equipo.visualPosition.yPct}%`,
                      }}
                    >
                      <span className="planos-print-label">{equipo.usuarioLabel}</span>
                      <span className="planos-print-dot" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <table className="planos-print-table">
            <thead>
              <tr>
                <th>Equipo</th>
                <th>Usuario</th>
                <th>Toma</th>
                <th>Switch</th>
                <th>Puerto</th>
                <th>Ubicación</th>
              </tr>
            </thead>
            <tbody>
              {equiposVisiblesData.length > 0 ? (
                equiposVisiblesData.map((equipo) => (
                  <tr key={`print-row-${equipo.id}`}>
                    <td>{equipo.equipoLabel}</td>
                    <td>{equipo.usuarioLabel}</td>
                    <td>{equipo.tomaLabel}</td>
                    <td>{equipo.switchName}</td>
                    <td>{equipo.portLabel}</td>
                    <td>{equipo.ubicacionLabel}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>No hay equipos ubicados para imprimir en este plano.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
