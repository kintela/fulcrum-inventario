"use client";

import { useMemo } from "react";

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
const SVG_WIDTH = 1100;
const SWITCH_COLUMN_X = 220;
const ENDPOINT_COLUMN_X = SVG_WIDTH - 220;

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
  const { positionedNodes, positionedLinks, height } = useMemo(() => {
    const nodes = new Map<string, GraphNode>();
    const links: GraphLink[] = [];

    for (const switchRecord of switches) {
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

    const maxNodes = Math.max(switchNodes.length, endpointNodes.length, 1);
    const svgHeight = Math.max(500, maxNodes * 110);

    const positionNodes = (
      list: GraphNode[],
      columnX: number,
    ): NodeWithPosition[] => {
      const spacing = svgHeight / (list.length + 1);
      return list.map((node, index) => ({
        ...node,
        x: columnX,
        y: spacing * (index + 1),
      }));
    };

    const positionedSwitches = positionNodes(switchNodes, SWITCH_COLUMN_X);
    const positionedEndpoints = positionNodes(endpointNodes, ENDPOINT_COLUMN_X);

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
      height: svgHeight,
    };
  }, [switches]);

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
      <div className="w-full overflow-x-auto rounded-xl border border-border bg-card p-4 shadow-sm">
        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${height}`}
          className="h-[560px] w-full min-w-[800px]"
          role="img"
          aria-label="Esquema de conexiones entre switches y equipos"
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
        </svg>
      </div>
    </div>
  );
}
