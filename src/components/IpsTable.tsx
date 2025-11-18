"use client";

import { useMemo, useState } from "react";

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

  return (
    <div className="text-sm text-card-foreground">
      <div className="mb-3 flex justify-start">
        <label className="sr-only" htmlFor="ips-search">
          Buscar en listado de IPs
        </label>
        <input
          id="ips-search"
          type="text"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Buscar por IP, equipo, usuario, switch..."
          className="w-full max-w-md rounded-lg border border-border bg-card px-4 py-2 text-sm text-foreground shadow-sm outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
        />
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
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
