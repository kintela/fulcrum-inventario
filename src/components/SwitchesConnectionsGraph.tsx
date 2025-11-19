"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type WheelEvent,
} from "react";

import type { SwitchRecord, SwitchPortRecord } from "@/lib/supabase";

type GraphNodeType = "switch" | "equipo" | "switchLink";

type GraphNode = {
  id: string;
  label: string;
  subtitle: string | null;
  type: GraphNodeType;
};

type GraphLink = {
  id: string;
  source: string;
  target: string;
  label: string | null;
};

type NodeWithPosition = GraphNode & { x: number; y: number };
type LinkWithPosition = GraphLink & {
  sourcePos: { x: number; y: number };
  targetPos: { x: number; y: number };
};

type SwitchesConnectionsGraphProps = {
  switches: SwitchRecord[];
};

const NODE_WIDTH = 170;
const NODE_HEIGHT = 64;
const DEFAULT_DIAGRAM_WIDTH = 1100;
const DIAGRAM_HEIGHT = 900;
const SWITCH_HORIZONTAL_SPACING = 220;
const SWITCH_MARGIN_X = 180;

function formatSwitchLabel(item: SwitchRecord): string {
  if (item.nombre && item.nombre.trim()) return item.nombre.trim();
  if (item.modelo && item.modelo.trim()) return item.modelo.trim();
  return `Switch ${item.id}`;
}

function ensureEquipoLabel(puerto: SwitchPortRecord): string {
  const nombre = puerto.equipo?.nombre?.trim();
  if (nombre && nombre.length > 0) return nombre;
  if (puerto.nombre && puerto.nombre.trim().length > 0) return puerto.nombre.trim();
  return "Puerto disponible";
}

function ensureSwitchLinkLabel(nombre: string | null | undefined): string {
  if (nombre && nombre.trim().length > 0) return nombre.trim();
  return "Switch sin nombre";
}

export default function SwitchesConnectionsGraph({
  switches,
}: SwitchesConnectionsGraphProps) {
  const filteredSwitches = useMemo(() => {
    return switches.filter((item) => {
      const ubicacion = item.ubicacion?.nombre?.trim().toLowerCase();
      if (ubicacion === "boxes") return false;
      const puertos = item.puertos ?? [];
      const tieneConexion = puertos.some(
        (puerto) =>
          (puerto.equipo_id && puerto.equipo) ||
          (puerto.switch_conectado_id && puerto.switch_conectado),
      );
      return tieneConexion;
    });
  }, [switches]);

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const lastPosition = useRef({ x: 0, y: 0 });

  const resetView = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const handleWheel = useCallback((event: WheelEvent<SVGSVGElement>) => {
    const { deltaY } = event;
    setZoom((prev) => {
      const factor = deltaY < 0 ? 1.1 : 0.9;
      const next = Math.min(Math.max(prev * factor, 0.25), 8);
      return Number(next.toFixed(2));
    });
  }, []);

  const handleMouseDown = useCallback((event: MouseEvent<SVGSVGElement>) => {
    event.preventDefault();
    isPanning.current = true;
    lastPosition.current = { x: event.clientX, y: event.clientY };
  }, []);

  const handleMouseMove = useCallback((event: MouseEvent<SVGSVGElement>) => {
    if (!isPanning.current) return;
    event.preventDefault();
    const dx = event.clientX - lastPosition.current.x;
    const dy = event.clientY - lastPosition.current.y;
    setOffset((prev) => ({
      x: prev.x + dx,
      y: prev.y + dy,
    }));
    lastPosition.current = { x: event.clientX, y: event.clientY };
  }, []);

  const handleMouseUp = useCallback((event: MouseEvent<SVGSVGElement>) => {
    if (event) event.preventDefault();
    isPanning.current = false;
  }, []);

  const { positionedNodes, positionedLinks, height, width } = useMemo(() => {
    const nodes = new Map<string, GraphNode>();
    const links: GraphLink[] = [];

    for (const switchRecord of filteredSwitches) {
      const switchNodeId = `switch-${switchRecord.id}`;
      if (!nodes.has(switchNodeId)) {
        nodes.set(switchNodeId, {
          id: switchNodeId,
          label: formatSwitchLabel(switchRecord),
          subtitle: switchRecord.ubicacion?.nombre?.trim() ?? null,
          type: "switch",
        });
      }

      const puertosOrdenados = [...(switchRecord.puertos ?? [])].sort(
        (a, b) => (a.numero ?? 0) - (b.numero ?? 0),
      );

      for (const puerto of puertosOrdenados) {
        if (puerto.equipo_id && puerto.equipo) {
          const equipoNodeId = `equipo-${puerto.equipo_id}`;
          if (!nodes.has(equipoNodeId)) {
            nodes.set(equipoNodeId, {
              id: equipoNodeId,
              label: ensureEquipoLabel(puerto),
              subtitle: `Equipo`,
              type: "equipo",
            });
          }
          links.push({
            id: `link-${switchNodeId}-${equipoNodeId}-${puerto.id}`,
            source: switchNodeId,
            target: equipoNodeId,
            label:
              typeof puerto.numero === "number"
                ? `Puerto ${puerto.numero}`
                : "Puerto sin número",
          });
          continue;
        }

        if (puerto.switch_conectado_id && puerto.switch_conectado) {
          const linkNodeId = `switchlink-${puerto.switch_conectado_id}`;
          if (!nodes.has(linkNodeId)) {
            nodes.set(linkNodeId, {
              id: linkNodeId,
              label: ensureSwitchLinkLabel(puerto.switch_conectado.nombre),
              subtitle: "Switch conectado",
              type: "switchLink",
            });
          }
          links.push({
            id: `link-${switchNodeId}-${linkNodeId}-${puerto.id}`,
            source: switchNodeId,
            target: linkNodeId,
            label:
              typeof puerto.numero === "number"
                ? `Puerto ${puerto.numero}`
                : "Puerto sin número",
          });
          continue;
        }
      }
    }

    const switchNodes: GraphNode[] = [];
    const endpointNodes: GraphNode[] = [];
    for (const node of nodes.values()) {
      if (node.type === "switch") {
        switchNodes.push(node);
      } else {
        endpointNodes.push(node);
      }
    }
    switchNodes.sort((a, b) => a.label.localeCompare(b.label, "es"));
    endpointNodes.sort((a, b) => a.label.localeCompare(b.label, "es"));

    const diagramWidth = Math.max(
      DEFAULT_DIAGRAM_WIDTH,
      SWITCH_MARGIN_X * 2 + SWITCH_HORIZONTAL_SPACING * Math.max(1, switchNodes.length - 1),
    );
    const centerY = DIAGRAM_HEIGHT / 2;
    const topRowBaseY = centerY - 220;
    const bottomRowBaseY = centerY + 220;

    const positionedSwitches: NodeWithPosition[] = switchNodes.map((node, index) => ({
      ...node,
      x: SWITCH_MARGIN_X + index * SWITCH_HORIZONTAL_SPACING,
      y: centerY,
    }));

    const switchPositionsMap = new Map<string, NodeWithPosition>();
    for (const node of positionedSwitches) {
      switchPositionsMap.set(node.id, node);
    }

    const topBuckets = new Map<number, number>();
    const bottomBuckets = new Map<number, number>();

    const positionedEndpoints: NodeWithPosition[] = endpointNodes.map((node, index) => {
      const relatedLinks = links.filter(
        (link) => link.target === node.id || link.source === node.id,
      );
      const anchorXs = relatedLinks
        .map((link) => {
          const sourceSwitch = switchPositionsMap.get(link.source);
          if (sourceSwitch?.type === "switch") return sourceSwitch.x;
          const targetSwitch = switchPositionsMap.get(link.target);
          if (targetSwitch?.type === "switch") return targetSwitch.x;
          return null;
        })
        .filter((value): value is number => value !== null);

      let baseX =
        anchorXs.length > 0
          ? anchorXs.reduce((acc, value) => acc + value, 0) / anchorXs.length
          : SWITCH_MARGIN_X + (index % Math.max(1, positionedSwitches.length)) * SWITCH_HORIZONTAL_SPACING;
      baseX = Math.min(Math.max(baseX, SWITCH_MARGIN_X / 2), diagramWidth - SWITCH_MARGIN_X / 2);

      const assignTop = index % 2 === 0;
      const bucketKey = Math.round(baseX / 50);
      const bucket = assignTop ? topBuckets : bottomBuckets;
      const count = bucket.get(bucketKey) ?? 0;
      bucket.set(bucketKey, count + 1);
      const verticalOffset = count * 28;
      const y = assignTop ? topRowBaseY - verticalOffset : bottomRowBaseY + verticalOffset;

      return {
        ...node,
        x: baseX,
        y,
      };
    });

    const positionsMap = new Map<string, NodeWithPosition>();
    for (const node of positionedSwitches) {
      positionsMap.set(node.id, node);
    }
    for (const node of positionedEndpoints) {
      positionsMap.set(node.id, node);
    }

    const positionedLinks: LinkWithPosition[] = links
      .map((link) => {
        const sourcePos = positionsMap.get(link.source);
        const targetPos = positionsMap.get(link.target);
        if (!sourcePos || !targetPos) return null;
        return {
          ...link,
          sourcePos,
          targetPos,
        };
      })
      .filter((link): link is LinkWithPosition => Boolean(link));

    return {
      positionedNodes: [...positionedSwitches, ...positionedEndpoints],
      positionedLinks,
      height: DIAGRAM_HEIGHT,
      width: diagramWidth,
    };
  }, [filteredSwitches]);

  if (positionedNodes.length === 0) {
    return (
      <p className="text-sm text-foreground/70">
        No hay conexiones registradas para mostrar en el gráfico.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 text-xs uppercase tracking-wide text-foreground/60">
        <div className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-blue-300" />
          Switch
        </div>
        <div className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-emerald-300" />
          Equipo
        </div>
        <div className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-violet-300" />
          Switch conectado
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-foreground/70">
        <p>Usa la rueda del ratón para acercar o alejar. Arrastra para mover el lienzo.</p>
        <button
          type="button"
          onClick={resetView}
          className="rounded-md border border-border px-3 py-1 text-xs font-semibold text-foreground transition hover:bg-muted/50"
        >
          Restablecer vista
        </button>
        <span className="font-mono text-foreground/60">Zoom: {zoom.toFixed(2)}x</span>
      </div>
      <div
        className="w-full overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm"
        onWheelCapture={handleWheel}
        style={{ touchAction: "none", overscrollBehavior: "contain" }}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full cursor-grab"
          style={{ height: `${Math.min(height, 900)}px` }}
          role="img"
          aria-label="Esquema de conexiones entre switches y equipos"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseUp}
          onMouseUp={handleMouseUp}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="10"
              refY="3.5"
              orient="auto"
              fill="#94a3b8"
            >
              <polygon points="0 0, 10 3.5, 0 7" />
            </marker>
          </defs>
          <g transform={`translate(${offset.x} ${offset.y}) scale(${zoom})`}>
            {positionedLinks.map((link) => {
              const { sourcePos, targetPos } = link;
              const startX =
                sourcePos.x +
                (sourcePos.type === "switch" ? NODE_WIDTH / 2 : -NODE_WIDTH / 2);
              const endX =
                targetPos.x +
                (targetPos.type === "switch" ? NODE_WIDTH / 2 : -NODE_WIDTH / 2);
              const controlOffset = (endX - startX) / 2;
              const path = `M ${startX} ${sourcePos.y} C ${startX + controlOffset} ${
                sourcePos.y
              }, ${endX - controlOffset} ${targetPos.y}, ${endX} ${targetPos.y}`;
              const labelX = (startX + endX) / 2;
              const labelY = (sourcePos.y + targetPos.y) / 2 - 10;
              return (
                <g key={link.id} className="text-[10px]">
                  <path
                    d={path}
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth={1.5}
                    markerEnd="url(#arrowhead)"
                  />
                  {link.label ? (
                    <text
                      x={labelX}
                      y={labelY}
                      textAnchor="middle"
                      className="fill-foreground/70 text-[10px]"
                    >
                      {link.label}
                    </text>
                  ) : null}
                </g>
              );
            })}
            {positionedNodes.map((node) => {
              const colors: Record<GraphNodeType, string> = {
                switch: "fill-blue-100 stroke-blue-300",
                equipo: "fill-emerald-100 stroke-emerald-300",
                switchLink: "fill-violet-100 stroke-violet-300",
              };
              const classNames = colors[node.type];
              return (
                <g key={node.id}>
                  <rect
                    x={node.x - NODE_WIDTH / 2}
                    y={node.y - NODE_HEIGHT / 2}
                    width={NODE_WIDTH}
                    height={NODE_HEIGHT}
                    rx={14}
                    className={`${classNames} stroke-[1.5]`}
                  />
                  <text
                    x={node.x}
                    y={node.y - 4}
                    textAnchor="middle"
                    className="text-sm font-semibold text-foreground"
                  >
                    {node.label}
                  </text>
                  {node.subtitle ? (
                    <text
                      x={node.x}
                      y={node.y + 14}
                      textAnchor="middle"
                      className="text-xs text-foreground/70"
                    >
                      {node.subtitle}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}
