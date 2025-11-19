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
  metadata?: {
    tipo?: string | null;
    switchStats?: {
      used: number;
      total: number;
    };
  };
};

type GraphLink = {
  id: string;
  source: string;
  target: string;
  label: string | null;
  portNumber?: number | null;
  tomaRed?: string | null;
  isEquipoLink?: boolean;
  slotIndex?: number;
  rowSide?: "top" | "bottom" | null;
};

type NodeWithPosition = GraphNode & { x: number; y: number };
type LinkWithPosition = GraphLink & {
  sourcePos: NodeWithPosition;
  targetPos: NodeWithPosition;
};

type PendingEndpoint = {
  node: GraphNode;
  baseX: number;
  priority: number;
};

type SwitchesConnectionsGraphProps = {
  switches: SwitchRecord[];
};

const NODE_WIDTH = 170;
const NODE_HEIGHT = 64;
const EQUIPO_NODE_HEIGHT = 44;
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

const TIPO_EQUIPO_COLORES: Record<string, string> = {
  sobremesa: "fill-blue-100 stroke-blue-300",
  portatil: "fill-green-100 stroke-green-300",
  servidor: "fill-amber-100 stroke-amber-300",
  almacenamiento: "fill-orange-100 stroke-orange-300",
  impresora: "fill-rose-100 stroke-rose-300",
  wifi: "fill-cyan-100 stroke-cyan-300",
  virtual: "fill-purple-100 stroke-purple-300",
  firewall: "fill-red-100 stroke-red-300",
  ups: "fill-stone-200 stroke-stone-400",
  tablet: "fill-pink-100 stroke-pink-300",
  monitor: "fill-indigo-100 stroke-indigo-300",
};

function getEquipoColorClasses(tipo: string | null | undefined): string {
  if (!tipo) return "fill-emerald-100 stroke-emerald-300";
  const normalized = tipo.trim().toLowerCase();
  if (!normalized) return "fill-emerald-100 stroke-emerald-300";
  return TIPO_EQUIPO_COLORES[normalized] ?? "fill-emerald-100 stroke-emerald-300";
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

  const handleWheel = useCallback((event: WheelEvent<Element>) => {
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
    const switchPortBuckets = new Map<
      string,
      { top: SwitchPortRecord[]; bottom: SwitchPortRecord[] }
    >();
    const portRowLookup = new Map<number, "top" | "bottom">();
    const equipoSwitchCounts = new Map<string, Map<string, number>>();
    const equipoRowStats = new Map<
      string,
      Map<
        string,
        {
          topCount: number;
          bottomCount: number;
          topMin: number;
          bottomMin: number;
        }
      >
    >();
    const links: GraphLink[] = [];

    const includedSwitchIds = new Set(
      filteredSwitches.map((switchRecord) => String(switchRecord.id)),
    );

    for (const switchRecord of filteredSwitches) {
      const switchNodeId = `switch-${switchRecord.id}`;
      const puertosSwitch = switchRecord.puertos ?? [];
      const usedPorts = puertosSwitch.filter(
        (puerto) =>
          (puerto.equipo_id && puerto.equipo) ||
          (puerto.switch_conectado_id && puerto.switch_conectado),
      ).length;
      const totalSwitchPorts =
        typeof switchRecord.puertos_totales === "number" &&
        switchRecord.puertos_totales > 0
          ? switchRecord.puertos_totales
          : puertosSwitch.length;
      if (!nodes.has(switchNodeId)) {
        nodes.set(switchNodeId, {
          id: switchNodeId,
          label: formatSwitchLabel(switchRecord),
          subtitle: switchRecord.ubicacion?.nombre?.trim() ?? null,
          type: "switch",
          metadata: {
            switchStats: {
              used: usedPorts,
              total: totalSwitchPorts,
            },
          },
        });
      }

      const puertosOrdenados = [...(switchRecord.puertos ?? [])].sort(
        (a, b) => (a.numero ?? 0) - (b.numero ?? 0),
      );
      const totalPorts = puertosOrdenados.length;
      const half = Math.max(1, Math.ceil(totalPorts / 2));
      const topPorts = puertosOrdenados.slice(0, half);
      const bottomPorts = puertosOrdenados.slice(half);
      switchPortBuckets.set(switchNodeId, { top: topPorts, bottom: bottomPorts });
      for (const port of topPorts) {
        if (typeof port.id === "number") {
          portRowLookup.set(port.id, "top");
        }
      }
      for (const port of bottomPorts) {
        if (typeof port.id === "number") {
          portRowLookup.set(port.id, "bottom");
        }
      }

      for (const puerto of puertosOrdenados) {
        if (puerto.equipo_id && puerto.equipo) {
          const equipoNodeId = `equipo-${puerto.equipo_id}`;
          if (!nodes.has(equipoNodeId)) {
            nodes.set(equipoNodeId, {
              id: equipoNodeId,
              label: ensureEquipoLabel(puerto),
              subtitle: null,
              type: "equipo",
              metadata: { tipo: puerto.equipo?.tipo ?? null },
            });
          }
          const equipoCounts =
            equipoSwitchCounts.get(equipoNodeId) ?? new Map<string, number>();
          equipoCounts.set(
            switchNodeId,
            (equipoCounts.get(switchNodeId) ?? 0) + 1,
          );
          equipoSwitchCounts.set(equipoNodeId, equipoCounts);

          const rowSide = typeof puerto.id === "number" ? portRowLookup.get(puerto.id) : undefined;
          const rowStatsMap =
            equipoRowStats.get(equipoNodeId) ?? new Map<
              string,
              {
                topCount: number;
                bottomCount: number;
                topMin: number;
                bottomMin: number;
              }
            >();
          const stats =
            rowStatsMap.get(switchNodeId) ?? {
              topCount: 0,
              bottomCount: 0,
              topMin: Number.POSITIVE_INFINITY,
              bottomMin: Number.POSITIVE_INFINITY,
            };
          const portNumber =
            typeof puerto.numero === "number" ? puerto.numero : Number.POSITIVE_INFINITY;
          if (rowSide === "top") {
            stats.topCount += 1;
            stats.topMin = Math.min(stats.topMin, portNumber);
          } else if (rowSide === "bottom") {
            stats.bottomCount += 1;
            stats.bottomMin = Math.min(stats.bottomMin, portNumber);
          }
          rowStatsMap.set(switchNodeId, stats);
          equipoRowStats.set(equipoNodeId, rowStatsMap);

          links.push({
            id: `link-${switchNodeId}-${equipoNodeId}-${puerto.id}`,
            source: switchNodeId,
            target: equipoNodeId,
            label:
              typeof puerto.numero === "number"
                ? `Puerto ${puerto.numero}`
                : "Puerto sin número",
            portNumber: typeof puerto.numero === "number" ? puerto.numero : null,
            tomaRed: puerto.equipo?.toma_red?.trim() ?? null,
            isEquipoLink: true,
            rowSide: rowSide ?? null,
          });
          continue;
        }

        if (puerto.switch_conectado_id && puerto.switch_conectado) {
          const connectedId = String(puerto.switch_conectado_id);
          const existingSwitchTarget = includedSwitchIds.has(connectedId)
            ? `switch-${connectedId}`
            : null;

          if (existingSwitchTarget) {
          links.push({
            id: `link-${switchNodeId}-${existingSwitchTarget}-${puerto.id}`,
            source: switchNodeId,
            target: existingSwitchTarget,
            label:
              typeof puerto.numero === "number"
                ? `Puerto ${puerto.numero}`
                : "Puerto sin número",
            portNumber: typeof puerto.numero === "number" ? puerto.numero : null,
            isEquipoLink: false,
          });
          continue;
        }

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
            portNumber: typeof puerto.numero === "number" ? puerto.numero : null,
            isEquipoLink: false,
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
    const locationOrder = new Map<string, number>([
      ["cpd_principal", 0],
      ["informática", 1],
    ]);
    switchNodes.sort((a, b) => {
      const locA =
        locationOrder.get(a.subtitle?.toLowerCase() ?? "") ?? 2;
      const locB =
        locationOrder.get(b.subtitle?.toLowerCase() ?? "") ?? 2;
      if (locA !== locB) return locA - locB;
      return a.label.localeCompare(b.label, "es");
    });
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

  const switchAssignments = new Map<
    string,
    { top: PendingEndpoint[]; bottom: PendingEndpoint[] }
  >();
  const globalAssignments = {
    top: [] as PendingEndpoint[],
    bottom: [] as PendingEndpoint[],
  };
  const switchStacks = new Map<string, { top: number; bottom: number }>();
  const globalStacks = { top: 0, bottom: 0 };

  for (const node of endpointNodes) {
    const relatedLinks = links.filter(
      (link) => link.target === node.id || link.source === node.id,
    );

    const anchorSwitches = relatedLinks
      .map((link) => {
        const sourceSwitch = switchPositionsMap.get(link.source);
        if (sourceSwitch?.type === "switch")
          return { id: sourceSwitch.id, x: sourceSwitch.x };
        const targetSwitch = switchPositionsMap.get(link.target);
        if (targetSwitch?.type === "switch")
          return { id: targetSwitch.id, x: targetSwitch.x };
        return null;
      })
      .filter(
        (value): value is { id: string; x: number } => value !== null,
      );

    let anchorInfo: { id: string; x: number } | null = null;
    if (node.type === "equipo") {
      const equipoCounts = equipoSwitchCounts.get(node.id);
      if (equipoCounts) {
        const best = [...equipoCounts.entries()].sort((a, b) => {
          const countDiff = b[1] - a[1];
          if (countDiff !== 0) return countDiff;
          const switchAX = switchPositionsMap.get(a[0])?.x ?? 0;
          const switchBX = switchPositionsMap.get(b[0])?.x ?? 0;
          return switchAX - switchBX;
        })[0];
        if (best) {
          anchorInfo = {
            id: best[0],
            x: switchPositionsMap.get(best[0])?.x ?? SWITCH_MARGIN_X,
          };
        }
      }
    }

    if (!anchorInfo && anchorSwitches.length > 0) {
      const counts = new Map<string, { count: number; x: number }>();
      for (const anchor of anchorSwitches) {
        const entry = counts.get(anchor.id) ?? { count: 0, x: anchor.x };
        entry.count += 1;
        entry.x = anchor.x;
        counts.set(anchor.id, entry);
      }
      const best = [...counts.entries()].sort((a, b) => {
        if (b[1].count !== a[1].count) return b[1].count - a[1].count;
        return a[1].x - b[1].x;
      })[0];
      if (best) {
        anchorInfo = { id: best[0], x: best[1].x };
      }
    }

    const baseX = anchorInfo
      ? anchorInfo.x
      : SWITCH_MARGIN_X;

    const stacksKey = anchorInfo?.id ?? "__global__";
    const stacks =
      stacksKey === "__global__"
        ? globalStacks
        : switchStacks.get(stacksKey) ?? { top: 0, bottom: 0 };
    if (stacksKey !== "__global__" && !switchStacks.has(stacksKey)) {
      switchStacks.set(stacksKey, stacks);
    }

    const bucketInfo =
      anchorInfo && switchPortBuckets.get(anchorInfo.id);

    let assignTop: boolean;

    if (node.type === "equipo" && anchorInfo) {
      const stats = equipoRowStats.get(node.id)?.get(anchorInfo.id);
      if (stats) {
        if (stats.topCount > stats.bottomCount) {
          assignTop = true;
        } else if (stats.bottomCount > stats.topCount) {
          assignTop = false;
        } else {
          const topMin = stats.topMin;
          const bottomMin = stats.bottomMin;
          if (Number.isFinite(topMin) && Number.isFinite(bottomMin)) {
            assignTop = topMin <= bottomMin;
          } else if (Number.isFinite(topMin)) {
            assignTop = true;
          } else if (Number.isFinite(bottomMin)) {
            assignTop = false;
          } else if (bucketInfo) {
            assignTop = bucketInfo.top.length >= bucketInfo.bottom.length;
          } else {
            assignTop = stacks.top <= stacks.bottom;
          }
        }
      } else if (bucketInfo) {
        assignTop = bucketInfo.top.length >= bucketInfo.bottom.length;
      } else {
        assignTop = stacks.top <= stacks.bottom;
      }
    } else {
      assignTop = stacks.top <= stacks.bottom;
    }

    if (assignTop) stacks.top += 1;
    else stacks.bottom += 1;

    const clampedX = Math.min(
      Math.max(baseX, SWITCH_MARGIN_X / 2),
      diagramWidth - SWITCH_MARGIN_X / 2,
    );

    let priority = Number.POSITIVE_INFINITY;
    if (node.type === "equipo" && anchorInfo) {
      const stats = equipoRowStats.get(node.id)?.get(anchorInfo.id);
      const candidate = assignTop ? stats?.topMin : stats?.bottomMin;
      if (typeof candidate === "number" && Number.isFinite(candidate)) {
        priority = candidate;
      }
    }

    const entry = {
      node,
      baseX: clampedX,
      priority,
    };

    if (stacksKey === "__global__") {
      (assignTop ? globalAssignments.top : globalAssignments.bottom).push(entry);
    } else {
      const container =
        switchAssignments.get(stacksKey) ?? { top: [], bottom: [] };
      (assignTop ? container.top : container.bottom).push(entry);
      switchAssignments.set(stacksKey, container);
    }
  }

    const positionedEndpoints: NodeWithPosition[] = [];

    const verticalSpacing = EQUIPO_NODE_HEIGHT + 12;

    const placeRow = (
      items: PendingEndpoint[],
      isTop: boolean,
    ) => {
      if (items.length === 0) return;
      const sorted = [...items].sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.node.label.localeCompare(b.node.label, "es");
      });
      if (isTop) {
        const startY = topRowBaseY - (sorted.length - 1) * verticalSpacing;
        sorted.forEach((item, index) => {
          positionedEndpoints.push({
            ...item.node,
            x: item.baseX,
            y: startY + index * verticalSpacing,
          });
        });
      } else {
        const startY = bottomRowBaseY;
        sorted.forEach((item, index) => {
          positionedEndpoints.push({
            ...item.node,
            x: item.baseX,
            y: startY + index * verticalSpacing,
          });
        });
      }
    };

    for (const assignment of switchAssignments.values()) {
      placeRow(assignment.top, true);
      placeRow(assignment.bottom, false);
    }

    placeRow(globalAssignments.top, true);
    placeRow(globalAssignments.bottom, false);

    const positionsMap = new Map<string, NodeWithPosition>();
    for (const node of positionedSwitches) {
      positionsMap.set(node.id, node);
    }
    for (const node of positionedEndpoints) {
      positionsMap.set(node.id, node);
    }

    const positionedLinks: LinkWithPosition[] = links.flatMap((link) => {
      const sourcePos = positionsMap.get(link.source);
      const targetPos = positionsMap.get(link.target);
      if (!sourcePos || !targetPos) return [];
      return [
        {
          ...link,
          sourcePos,
          targetPos,
        },
      ];
    });

    const linksByTarget = new Map<string, LinkWithPosition[]>();
    for (const link of positionedLinks) {
      if (link.targetPos.type !== "equipo") continue;
      const arr = linksByTarget.get(link.target) ?? [];
      arr.push(link);
      linksByTarget.set(link.target, arr);
    }
    for (const arr of linksByTarget.values()) {
      arr.sort((a, b) => {
        const aVal = a.portNumber ?? Number.POSITIVE_INFINITY;
        const bVal = b.portNumber ?? Number.POSITIVE_INFINITY;
        if (aVal !== bVal) return aVal - bVal;
        return a.id.localeCompare(b.id);
      });
      arr.forEach((link, index) => {
        link.slotIndex = index;
      });
    }

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
              const targetHeight =
                targetPos.type === "switch" ? NODE_HEIGHT : EQUIPO_NODE_HEIGHT;
              const isEquipmentTarget = targetPos.type === "equipo";
              const slotIndex = isEquipmentTarget ? link.slotIndex ?? 0 : 0;
              const labelX = isEquipmentTarget
                ? targetPos.x - NODE_WIDTH / 2 - 6
                : (startX + endX) / 2;
              const labelY = isEquipmentTarget
                ? targetPos.y - targetHeight / 2 + 14 * (slotIndex + 1)
                : (sourcePos.y + targetPos.y) / 2 - 10;
              const textAnchor = isEquipmentTarget ? "end" : "middle";
              return (
                <g key={link.id} className="text-[10px]">
                  <path
                    d={path}
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth={1.5}
                    markerEnd="url(#arrowhead)"
                  />
                  {(link.portNumber != null || link.label) && (
                    <>
                      <text
                        x={labelX}
                        y={labelY}
                        textAnchor={textAnchor}
                        className="fill-foreground/70 text-[10px]"
                      >
                        {link.portNumber != null
                          ? `P${link.portNumber}`
                          : link.label}
                      </text>
                      {isEquipmentTarget && link.tomaRed ? (
                        <text
                          x={labelX}
                          y={labelY + 10}
                          textAnchor={textAnchor}
                          className="fill-foreground/60 text-[9px]"
                        >
                          {link.tomaRed}
                        </text>
                      ) : null}
                    </>
                  )}
                </g>
              );
            })}
            {positionedNodes.map((node) => {
              const colors: Record<Exclude<GraphNodeType, "equipo">, string> = {
                switch: "fill-slate-200 stroke-slate-400",
                switchLink: "fill-violet-100 stroke-violet-300",
              };
              const classNames =
                node.type === "equipo"
                  ? getEquipoColorClasses(node.metadata?.tipo ?? null)
                  : colors[node.type as Exclude<GraphNodeType, "equipo">];
            const nodeHeight =
              node.type === "switch" ? NODE_HEIGHT : EQUIPO_NODE_HEIGHT;
            return (
              <g key={node.id}>
                <rect
                  x={node.x - NODE_WIDTH / 2}
                  y={node.y - nodeHeight / 2}
                  width={NODE_WIDTH}
                  height={nodeHeight}
                  rx={14}
                  className={`${classNames} stroke-[1.5]`}
                />
                <text
                  x={node.x}
                  y={node.type === "switch" ? node.y - 4 : node.y + 3}
                  textAnchor="middle"
                  className="text-sm font-semibold text-foreground"
                >
                  {node.label}
                </text>
                {node.subtitle && node.type === "switch" ? (
                  <>
                    <text
                      x={node.x}
                      y={node.y + 14}
                      textAnchor="middle"
                      className="text-xs text-foreground/70"
                    >
                      {node.subtitle}
                    </text>
                    {node.metadata?.switchStats ? (
                      <text
                        x={node.x}
                        y={node.y + 28}
                        textAnchor="middle"
                        className="text-xs text-foreground/70"
                      >
                        {node.metadata.switchStats.used} de{" "}
                        {node.metadata.switchStats.total} puertos
                      </text>
                    ) : null}
                  </>
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
