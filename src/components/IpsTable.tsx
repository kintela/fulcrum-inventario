"use client";

import { useMemo, useRef, useState } from "react";

type PuertoResumen = {
  switchNombre: string;
  puertoLabel: string;
};

export type IpRegistro = {
  ip: string;
  equipoNombre: string;
  tipo: string;
  usuario: string;
  ubicacion: string;
  tomaRed: string;
  puertos: PuertoResumen[];
};

type ColumnaOrden =
  | "ip"
  | "equipoNombre"
  | "tipo"
  | "usuario"
  | "ubicacion"
  | "tomaRed"
  | "switchNombre"
  | "puertoLabel";

type IpsTableProps = {
  entries: IpRegistro[];
};

const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });

function compareIpStrings(a: string, b: string): number {
  const segA = a.split(".").map((segment) => Number.parseInt(segment, 10) || 0);
  const segB = b.split(".").map((segment) => Number.parseInt(segment, 10) || 0);
  for (let i = 0; i < 4; i += 1) {
    const diff = (segA[i] ?? 0) - (segB[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function getPrimarySwitch(entry: IpRegistro) {
  return entry.puertos[0]?.switchNombre ?? "Sin switch asociado";
}

function getPrimaryPuerto(entry: IpRegistro) {
  return entry.puertos[0]?.puertoLabel ?? "—";
}

function entryMatchesQuery(entry: IpRegistro, query: string) {
  if (!query) return true;
  const normalized = query.toLowerCase();
  const values: string[] = [
    entry.ip,
    entry.equipoNombre,
    entry.tipo,
    entry.usuario,
    entry.ubicacion,
    entry.tomaRed,
    ...entry.puertos.flatMap((puerto) => [puerto.switchNombre, puerto.puertoLabel]),
  ];

  return values.some((value) => value?.toLowerCase().includes(normalized));
}

export default function IpsTable({ entries }: IpsTableProps) {
  const [sortBy, setSortBy] = useState<ColumnaOrden>("ip");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [searchTerm, setSearchTerm] = useState("");
  const tableRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const trimmed = searchTerm.trim();
    if (!trimmed) return entries;
    return entries.filter((entry) => entryMatchesQuery(entry, trimmed));
  }, [entries, searchTerm]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let aValue: string;
      let bValue: string;

      switch (sortBy) {
        case "ip": {
          const diff = compareIpStrings(a.ip, b.ip);
          return sortDirection === "asc" ? diff : -diff;
        }
        case "equipoNombre":
          aValue = a.equipoNombre;
          bValue = b.equipoNombre;
          break;
        case "usuario":
          aValue = a.usuario;
          bValue = b.usuario;
          break;
        case "tipo":
          aValue = a.tipo;
          bValue = b.tipo;
          break;
        case "ubicacion":
          aValue = a.ubicacion;
          bValue = b.ubicacion;
          break;
        case "tomaRed":
          aValue = a.tomaRed;
          bValue = b.tomaRed;
          break;
        case "switchNombre":
          aValue = getPrimarySwitch(a);
          bValue = getPrimarySwitch(b);
          break;
        case "puertoLabel":
          aValue = getPrimaryPuerto(a);
          bValue = getPrimaryPuerto(b);
          break;
        default:
          aValue = "";
          bValue = "";
      }

      const comparison = collator.compare(aValue ?? "", bValue ?? "");
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filtered, sortBy, sortDirection]);

  const handleSort = (column: ColumnaOrden) => {
    setSortBy((prev) => {
      if (prev === column) {
        setSortDirection((dir) => (dir === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDirection("asc");
      return column;
    });
  };

  const renderSortIndicator = (column: ColumnaOrden) => {
    if (sortBy !== column) return null;
    return sortDirection === "asc" ? "↑" : "↓";
  };

  const handlePrint = () => {
    if (typeof window === "undefined") return;
    if (!tableRef.current) return;
    const tableHtml = tableRef.current.innerHTML;
    const printWindow = window.open("", "", "width=1200,height=800");
    if (!printWindow) return;

    const styles = `
      body { font-family: Arial, sans-serif; padding: 24px; color: #000; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 12px; }
      th { background: #f3f4f6; text-transform: uppercase; font-size: 11px; }
      tr:nth-child(even) { background: #fafafa; }
      code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
    `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Listado de IPs</title>
          <meta charset="utf-8" />
          <style>${styles}</style>
        </head>
        <body>
          <h1>Listado de IPs</h1>
          ${tableHtml}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const hasRows = sorted.length > 0;

  return (
    <div className="text-sm text-card-foreground">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:max-w-md">
          <label className="sr-only" htmlFor="ips-search">
            Buscar en listado de IPs
          </label>
          <input
            id="ips-search"
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar por IP, equipo, usuario, switch..."
            className="w-full rounded-lg border border-border bg-card px-4 py-2 text-sm text-foreground shadow-sm outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
          />
        </div>
        <button
          type="button"
          onClick={handlePrint}
          disabled={!hasRows}
          title="Imprimir listado (generar PDF)"
          aria-label="Imprimir listado de IPs"
          className="inline-flex cursor-pointer items-center gap-2 self-start rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
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
          Imprimir
        </button>
      </div>
      <div ref={tableRef} className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full border-collapse text-left">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-foreground/60">
          <tr>
            {[
              { key: "ip", label: "IP" },
              { key: "equipoNombre", label: "Equipo" },
              { key: "tipo", label: "Tipo" },
              { key: "usuario", label: "Usuario" },
              { key: "ubicacion", label: "Ubicación" },
              { key: "tomaRed", label: "Toma de red" },
              { key: "switchNombre", label: "Switch" },
              { key: "puertoLabel", label: "Puerto" },
            ].map((col) => (
              <th key={col.key} className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => handleSort(col.key as ColumnaOrden)}
                  className="inline-flex items-center gap-1 font-semibold text-foreground/70 transition hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40"
                >
                  {col.label}
                  <span aria-hidden="true">{renderSortIndicator(col.key as ColumnaOrden)}</span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((registro) => (
            <tr
              key={`${registro.ip}-${registro.equipoNombre}`}
              className="border-t border-border/80 transition hover:bg-muted/30"
            >
              <td className="px-4 py-3 font-mono text-foreground">{registro.ip}</td>
              <td className="px-4 py-3">{registro.equipoNombre}</td>
              <td className="px-4 py-3">{registro.tipo || "Sin tipo"}</td>
              <td className="px-4 py-3">{registro.usuario}</td>
              <td className="px-4 py-3">{registro.ubicacion}</td>
              <td className="px-4 py-3">{registro.tomaRed}</td>
              <td className="px-4 py-3">
                {registro.puertos.map((puerto, index) => (
                  <div key={`${registro.ip}-switch-${index}`}>{puerto.switchNombre}</div>
                ))}
              </td>
              <td className="px-4 py-3">
                {registro.puertos.map((puerto, index) => (
                  <div key={`${registro.ip}-port-${index}`}>{puerto.puertoLabel}</div>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
