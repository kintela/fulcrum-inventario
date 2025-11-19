"use client";

import Link from "next/link";
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

function normalizeText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value).trim().toLowerCase();
}

function tieneConexionActiva(puerto: SwitchPortRecord): boolean {
  if (puerto.equipo_id || puerto.equipo) return true;
  if (puerto.switch_conectado_id || puerto.switch_conectado) return true;
  return false;
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
  const [searchTerm, setSearchTerm] = useState("");
  const [showOnlyFreePorts, setShowOnlyFreePorts] = useState(false);

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

  const handleSearchTerm = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleFreePortsToggle = (event: ChangeEvent<HTMLInputElement>) => {
    setShowOnlyFreePorts(event.target.checked);
  };

  const selectedSwitches = useMemo(() => {
    if (selectedSwitchIds.size === 0) return [];
    return switches.filter((item) => selectedSwitchIds.has(String(item.id)));
  }, [selectedSwitchIds, switches]);

  function switchMatchesQuery(item: SwitchRecord, query: string): boolean {
    if (!query) return true;
    const values = [
      formatSwitchName(item),
      item.modelo,
      item.ip,
      item.ubicacion?.nombre ?? "",
    ];
    return values.some((value) => normalizeText(value).includes(query));
  }

  function portMatchesQuery(
    puerto: SwitchPortRecord,
    switchRecord: SwitchRecord,
    query: string,
  ): boolean {
    const values = [
      resolveEquipoNombre(puerto),
      resolveTomaRed(puerto),
      resolveObservaciones(puerto),
      puerto.nombre,
      puerto.vlan !== null && puerto.vlan !== undefined ? `vlan ${puerto.vlan}` : "",
      puerto.numero !== null && puerto.numero !== undefined ? `puerto ${puerto.numero}` : "",
      puerto.velocidad_mbps !== null && puerto.velocidad_mbps !== undefined
        ? `${puerto.velocidad_mbps} mbps`
        : "",
      switchRecord.modelo,
      switchRecord.ubicacion?.nombre,
    ];
    return values.some((value) => normalizeText(value).includes(query));
  }

  type SwitchDisplayEntry = {
    switchRecord: SwitchRecord;
    ports: SwitchPortRecord[];
    hasRegisteredPorts: boolean;
  };

  const switchesToRender = useMemo<SwitchDisplayEntry[]>(() => {
    const trimmedQuery = searchTerm.trim().toLowerCase();
    const useAllSwitchesBySearch =
      !showOnlyFreePorts && selectedSwitchIds.size === 0 && trimmedQuery.length > 0;
    const query = showOnlyFreePorts ? "" : trimmedQuery;
    const source = showOnlyFreePorts || useAllSwitchesBySearch ? switches : selectedSwitches;
    const isSearchActive = query.length > 0;

    return source
      .map<SwitchDisplayEntry | null>((item) => {
        const orderedPorts = sortPorts(item.puertos);

        if (showOnlyFreePorts) {
          const freePorts = orderedPorts.filter((puerto) => !tieneConexionActiva(puerto));
          if (freePorts.length === 0) return null;
          return {
            switchRecord: item,
            ports: freePorts,
            hasRegisteredPorts: orderedPorts.length > 0,
          };
        }

        if (orderedPorts.length === 0) {
          if (isSearchActive && !switchMatchesQuery(item, query)) {
            return null;
          }
          return {
            switchRecord: item,
            ports: [],
            hasRegisteredPorts: false,
          };
        }

        let filteredPorts = orderedPorts;
        if (isSearchActive) {
          const matchesSwitch = switchMatchesQuery(item, query);
          filteredPorts = matchesSwitch
            ? orderedPorts
            : orderedPorts.filter((puerto) => portMatchesQuery(puerto, item, query));
        }

        if (isSearchActive && filteredPorts.length === 0) {
          return null;
        }

        return {
          switchRecord: item,
          ports: filteredPorts,
          hasRegisteredPorts: true,
        };
      })
      .filter(
        (
          entry,
        ): entry is {
          switchRecord: SwitchRecord;
          ports: SwitchPortRecord[];
          hasRegisteredPorts: boolean;
        } => entry !== null,
      );
  }, [searchTerm, selectedSwitchIds, selectedSwitches, showOnlyFreePorts, switches]);

  const trimmedSearch = searchTerm.trim();
  const showSelectionPrompt =
    !showOnlyFreePorts && selectedSwitchIds.size === 0 && trimmedSearch.length === 0;
  const noResults =
    !showOnlyFreePorts &&
    switchesToRender.length === 0 &&
    (selectedSwitchIds.size > 0 || trimmedSearch.length > 0);
  const noFreePorts = showOnlyFreePorts && switchesToRender.length === 0;

  return (
    <section className="space-y-6 text-sm text-foreground">
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Selecciona los switches a consultar
            </h2>
            <p className="mt-1 text-sm text-foreground/70">
              Marca los switches que quieras revisar y más abajo verás una tabla con el detalle de
              conexiones de cada uno.
            </p>
          </div>
          <div className="flex flex-col items-center gap-1 text-xs text-foreground/70">
            <Link
              href="/reportes/switches/grafico"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Ver esquema de conexiones"
              title="Ver esquema de conexiones"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground/70 transition hover:bg-muted/50 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <circle cx="6" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.6" />
                <circle cx="18" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.6" />
                <circle cx="12" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.6" />
                <path
                  d="M6 8.5v3M18 8.5v3M12 15v-3"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <path
                  d="M6 6l6 9 6-9"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
            <span>Gráfico</span>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
          <div className="w-full sm:flex-1">
            <label className="text-xs font-medium uppercase text-foreground/60" htmlFor="switches-search">
              Filtrar por término
            </label>
            <input
              id="switches-search"
              type="text"
              value={searchTerm}
              onChange={handleSearchTerm}
              disabled={showOnlyFreePorts}
              placeholder="Buscar por switch, equipo, puerto..."
              className={`mt-1 w-full rounded-lg border border-border bg-background px-4 py-2 text-sm shadow-sm outline-none transition focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-200 ${
                showOnlyFreePorts ? "cursor-not-allowed opacity-60" : ""
              }`}
            />
            {showOnlyFreePorts ? (
              <p className="mt-1 text-xs text-foreground/60">
                El filtro de texto se desactiva al mostrar solo los puertos libres.
              </p>
            ) : null}
          </div>
          <label className="inline-flex items-center gap-3 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:border-foreground/40">
            <input
              type="checkbox"
              className="h-4 w-4 cursor-pointer rounded border-border text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              checked={showOnlyFreePorts}
              onChange={handleFreePortsToggle}
            />
            Puertos libres
          </label>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {switches.map((item) => {
            const switchId = String(item.id);
            const checkboxId = `switch-filter-${switchId}`;
            const nameId = `${checkboxId}-name`;
            const locationId = `${checkboxId}-location`;
            const label = formatSwitchName(item);
            const isChecked = selectedSwitchIds.has(switchId);
            return (
              <div
                key={item.id}
                className={`flex items-center gap-3 rounded-lg border px-4 py-2 transition ${
                  isChecked
                    ? "border-blue-500 bg-blue-50 text-blue-900"
                    : "border-border bg-card text-foreground hover:border-foreground/40"
                }`}
              >
                <input
                  id={checkboxId}
                  type="checkbox"
                  value={switchId}
                  checked={isChecked}
                  onChange={handleToggle}
                  aria-describedby={`${nameId} ${locationId}`}
                  className="h-4 w-4 cursor-pointer rounded border-border text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                />
                <div className="min-w-0">
                  <p id={nameId} className="truncate text-sm font-medium">
                    {label}
                  </p>
                  <p id={locationId} className="truncate text-xs text-foreground/60">
                    {item.ubicacion?.nombre?.trim() || "Sin ubicación"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showOnlyFreePorts ? (
        noFreePorts ? (
          <p className="text-sm text-foreground/70">
            No se encontraron puertos libres registrados en los switches actuales.
          </p>
        ) : (
          switchesToRender.map(({ switchRecord: item, ports }) => {
            const label = formatSwitchName(item);
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
                <div className="overflow-x-auto">
                  <div className="flex gap-4 px-5 py-3 text-xs text-foreground/70">
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full bg-emerald-400/70" />
                      Con equipo conectado
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full bg-amber-400/70" />
                      Puerto disponible
                    </span>
                  </div>
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
                      {ports.map((puerto) => {
                        const conectado = tieneConexionActiva(puerto);
                        const rowHighlight = conectado
                          ? "bg-emerald-50/50"
                          : "bg-amber-50/70";
                        const badgeClasses = conectado
                          ? "bg-emerald-100 text-emerald-900"
                          : "bg-amber-100 text-amber-900";
                        return (
                          <tr
                            key={puerto.id ?? `${item.id}-${puerto.numero}`}
                            className={`border-t border-border/70 text-foreground transition ${rowHighlight}`}
                          >
                            <td className="px-5 py-3">
                              <div className="mb-1 inline-flex items-center gap-2 text-xs font-semibold">
                                <span
                                  className={`rounded-full px-2 py-0.5 ${badgeClasses}`}
                                >
                                  {conectado ? "Con equipo" : "Disponible"}
                                </span>
                                {typeof puerto.numero === "number" ? (
                                  <span className="text-foreground/60">
                                    Puerto {puerto.numero}
                                  </span>
                                ) : null}
                              </div>
                              <div className="font-medium">{resolveEquipoNombre(puerto)}</div>
                            </td>
                            <td className="px-5 py-3">{formatPortSpeed(puerto.velocidad_mbps)}</td>
                            <td className="px-5 py-3">{resolveTomaRed(puerto)}</td>
                            <td className="px-5 py-3">{resolveObservaciones(puerto)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </article>
            );
          })
        )
      ) : showSelectionPrompt ? (
        <p className="text-sm text-foreground/70">
          Selecciona uno o varios switches para ver qué equipos están conectados en cada puerto.
        </p>
      ) : noResults ? (
        <p className="text-sm text-foreground/70">
          Sin coincidencias para &quot;{searchTerm.trim()}&quot; en los switches seleccionados.
        </p>
      ) : (
        switchesToRender.map(({ switchRecord: item, ports, hasRegisteredPorts }) => {
          const label = formatSwitchName(item);
          const hasPorts = ports.length > 0;
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
                  <div className="flex gap-4 px-5 py-3 text-xs text-foreground/70">
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full bg-emerald-400/70" />
                      Con equipo conectado
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full bg-amber-400/70" />
                      Puerto disponible
                    </span>
                  </div>
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
                      {ports.map((puerto) => {
                        const conectado = tieneConexionActiva(puerto);
                        const rowHighlight = conectado
                          ? "bg-emerald-50/50"
                          : "bg-amber-50/70";
                        const badgeClasses = conectado
                          ? "bg-emerald-100 text-emerald-900"
                          : "bg-amber-100 text-amber-900";
                        return (
                          <tr
                            key={puerto.id ?? `${item.id}-${puerto.numero}`}
                            className={`border-t border-border/70 text-foreground transition ${rowHighlight}`}
                          >
                            <td className="px-5 py-3">
                              <div className="mb-1 inline-flex items-center gap-2 text-xs font-semibold">
                                <span
                                  className={`rounded-full px-2 py-0.5 ${badgeClasses}`}
                                >
                                  {conectado ? "Con equipo" : "Disponible"}
                                </span>
                                {typeof puerto.numero === "number" ? (
                                  <span className="text-foreground/60">
                                    Puerto {puerto.numero}
                                  </span>
                                ) : null}
                              </div>
                              <div className="font-medium">{resolveEquipoNombre(puerto)}</div>
                            </td>
                            <td className="px-5 py-3">{formatPortSpeed(puerto.velocidad_mbps)}</td>
                            <td className="px-5 py-3">{resolveTomaRed(puerto)}</td>
                            <td className="px-5 py-3">{resolveObservaciones(puerto)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="px-5 py-4 text-sm text-foreground/70">
                  {hasRegisteredPorts
                    ? "No se encontraron puertos que coincidan con el término buscado."
                    : "Este switch no tiene puertos registrados."}
                </p>
              )}
            </article>
          );
        })
      )}
    </section>
  );
}
