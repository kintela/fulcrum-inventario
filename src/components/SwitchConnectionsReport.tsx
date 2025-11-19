"use client";

import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";

import type { SwitchRecord, SwitchPortRecord } from "@/lib/supabase";

type SwitchConnectionsReportProps = {
  switches: SwitchRecord[];
};

const mbpsFormatter = new Intl.NumberFormat("es-ES");
const gbpsFormatter = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 1,
});

function formatSwitchName(item: SwitchRecord): string {
  if (item.nombre && item.nombre.trim().length > 0) {
    return item.nombre.trim();
  }
  if (item.modelo && item.modelo.trim().length > 0) {
    return item.modelo.trim();
  }
  return `Switch ${item.id}`;
}

function formatPortSpeed(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    return "Sin dato";
  }
  if (value >= 1000) {
    const gbps = value / 1000;
    return `${gbpsFormatter.format(gbps)} Gbps`;
  }
  return `${mbpsFormatter.format(value)} Mbps`;
}

function resolveEquipoNombre(puerto: SwitchPortRecord): string {
  const equipoNombre = puerto.equipo?.nombre?.trim();
  if (equipoNombre) return equipoNombre;
  const switchNombre = puerto.switch_conectado?.nombre?.trim();
  if (switchNombre) return `Switch: ${switchNombre}`;
  if (puerto.nombre && puerto.nombre.trim().length > 0) {
    return puerto.nombre.trim();
  }
  return "Puerto disponible";
}

function resolveTomaRed(puerto: SwitchPortRecord): string {
  const toma = puerto.equipo?.toma_red?.trim();
  if (toma && toma.length > 0) return toma;
  return "Sin dato";
}

function resolveObservaciones(puerto: SwitchPortRecord): string {
  const texto = puerto.observaciones?.trim();
  if (texto && texto.length > 0) return texto;
  return "Sin observaciones";
}

function sortPorts(ports: SwitchPortRecord[] | null | undefined) {
  if (!ports) return [];
  return [...ports].sort((a, b) => {
    const numA = typeof a.numero === "number" ? a.numero : Number.MAX_SAFE_INTEGER;
    const numB = typeof b.numero === "number" ? b.numero : Number.MAX_SAFE_INTEGER;
    if (numA !== numB) return numA - numB;
    return resolveEquipoNombre(a).localeCompare(resolveEquipoNombre(b), "es");
  });
}

export default function SwitchConnectionsReport({
  switches,
}: SwitchConnectionsReportProps) {
  const [selectedSwitchIds, setSelectedSwitchIds] = useState<Set<string>>(
    () => new Set(),
  );

  const handleToggle = (event: ChangeEvent<HTMLInputElement>) => {
    const { checked, value } = event.target;
    setSelectedSwitchIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(value);
      } else {
        next.delete(value);
      }
      return next;
    });
  };

  const selectedSwitches = useMemo(() => {
    if (selectedSwitchIds.size === 0) return [];
    return switches.filter((item) => selectedSwitchIds.has(String(item.id)));
  }, [selectedSwitchIds, switches]);

  const hasSelectedSwitches = selectedSwitches.length > 0;

  return (
    <section className="space-y-6 text-sm text-foreground">
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold text-foreground">
          Selecciona los switches a consultar
        </h2>
        <p className="mt-1 text-sm text-foreground/70">
          Marca los switches que quieras revisar y más abajo verás una tabla con el detalle de
          conexiones de cada uno.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {switches.map((item) => {
            const switchId = String(item.id);
            const labelId = `switch-filter-${switchId}`;
            const label = formatSwitchName(item);
            const isChecked = selectedSwitchIds.has(switchId);
            return (
              <label
                key={item.id}
                htmlFor={labelId}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-2 transition ${
                  isChecked
                    ? "border-blue-500 bg-blue-50 text-blue-900"
                    : "border-border bg-card text-foreground hover:border-foreground/40"
                }`}
              >
                <input
                  id={labelId}
                  type="checkbox"
                  value={switchId}
                  checked={isChecked}
                  onChange={handleToggle}
                  className="h-4 w-4 rounded border-border text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{label}</p>
                  <p className="truncate text-xs text-foreground/60">
                    {item.ubicacion?.nombre?.trim() || "Sin ubicación"}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {!hasSelectedSwitches ? (
        <p className="text-sm text-foreground/70">
          Selecciona uno o varios switches para ver qué equipos están conectados en cada puerto.
        </p>
      ) : (
        selectedSwitches.map((item) => {
          const label = formatSwitchName(item);
          const puertosOrdenados = sortPorts(item.puertos);
          const hasPorts = puertosOrdenados.length > 0;
          return (
            <article
              key={item.id}
              className="rounded-xl border border-border bg-card shadow-sm"
            >
              <header className="border-b border-border px-5 py-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">{label}</h3>
                    <p className="text-sm text-foreground/70">
                      {item.modelo?.trim() || "Modelo desconocido"} ·{" "}
                      {item.puertos_totales ?? 0} puertos ·{" "}
                      {item.ubicacion?.nombre?.trim() || "Sin ubicación"}
                    </p>
                  </div>
                  {item.ip ? (
                    <p className="text-xs font-mono text-foreground/60">
                      IP: {item.ip}
                    </p>
                  ) : null}
                </div>
              </header>

              {hasPorts ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-left text-sm">
                    <thead className="bg-muted/40 text-xs uppercase tracking-wide text-foreground/60">
                      <tr>
                        <th className="px-5 py-3 font-semibold">Equipo conectado</th>
                        <th className="px-5 py-3 font-semibold">Velocidad del puerto</th>
                        <th className="px-5 py-3 font-semibold">Toma de red</th>
                        <th className="px-5 py-3 font-semibold">Observaciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {puertosOrdenados.map((puerto) => (
                        <tr
                          key={puerto.id ?? `${item.id}-${puerto.numero}`}
                          className="border-t border-border/70 text-foreground"
                        >
                          <td className="px-5 py-3">
                            <div className="font-medium">{resolveEquipoNombre(puerto)}</div>
                            {typeof puerto.numero === "number" ? (
                              <p className="text-xs text-foreground/60">
                                Puerto {puerto.numero}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-5 py-3">{formatPortSpeed(puerto.velocidad_mbps)}</td>
                          <td className="px-5 py-3">{resolveTomaRed(puerto)}</td>
                          <td className="px-5 py-3">{resolveObservaciones(puerto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="px-5 py-4 text-sm text-foreground/70">
                  Este switch no tiene puertos registrados.
                </p>
              )}
            </article>
          );
        })
      )}
    </section>
  );
}
