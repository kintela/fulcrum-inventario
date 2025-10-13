"use client";

import { useMemo, useState } from "react";
import { formatearFecha, formatearImporte } from "@/lib/format";
import type { EquipoRecord } from "@/lib/supabase";

const tipoLabels: Record<string, string> = {
  sobremesa: "Sobremesa",
  portatil: "Portatil",
  tablet: "Tablet",
  servidor: "Servidor",
};

type EquiposListProps = {
  equipos: EquipoRecord[];
  filtroTipo?: string | null;
  filtroAnio?: number | null;
};

type FiltroAdmiteUpdate = "todos" | "si" | "no" | "desconocido";
type FiltroGarbigune = "todos" | "si" | "no" | "desconocido";

function obtenerNombreUsuario(equipo: EquipoRecord): string | null {
  if (!equipo.usuario) return null;
  if (equipo.usuario.nombre_completo) return equipo.usuario.nombre_completo;
  const partes = [equipo.usuario.nombre, equipo.usuario.apellidos].filter(
    (parte): parte is string => Boolean(parte),
  );
  return partes.length > 0 ? partes.join(" ") : null;
}

function normalizarValor(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "boolean") return valor ? "true 1 si yes" : "false 0 no";
  if (typeof valor === "number") {
    const texto = valor.toString();
    return `${texto} ${texto.replace(".", ",")}`;
  }
  if (Array.isArray(valor)) return valor.map(normalizarValor).join(" ");
  if (typeof valor === "object") {
    return Object.values(valor as Record<string, unknown>)
      .map(normalizarValor)
      .join(" ");
  }
  const texto = valor.toString().toLowerCase();
  const sinAcentos = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return `${texto} ${sinAcentos}`.trim();
}

export default function EquiposList({
  equipos,
  filtroTipo = null,
  filtroAnio = null,
}: EquiposListProps) {
  const [query, setQuery] = useState("");
  const [mostrarBoxes, setMostrarBoxes] = useState(true);
const [mostrarNoBoxes, setMostrarNoBoxes] = useState(true);
const [mostrarAsignados, setMostrarAsignados] = useState(true);
const [mostrarSinAsignar, setMostrarSinAsignar] = useState(true);
const [sistemaOperativoSeleccionado, setSistemaOperativoSeleccionado] = useState<string>("");
const [ubicacionSeleccionada, setUbicacionSeleccionada] = useState<string>("");
const [tipoSeleccionado, setTipoSeleccionado] = useState<string>("");
const [antiguedadMinima, setAntiguedadMinima] = useState<number | null>(null);
const [filtroAdmiteUpdate, setFiltroAdmiteUpdate] =
  useState<FiltroAdmiteUpdate>("todos");
const [filtroGarbigune, setFiltroGarbigune] =
  useState<FiltroGarbigune>("todos");

const sistemasOperativos = useMemo(() => {
  const valores = new Set<string>();
  equipos.forEach((equipo) => {
    if (equipo.sistema_operativo) valores.add(equipo.sistema_operativo.trim());
  });
  return Array.from(valores).sort((a, b) => a.localeCompare(b, "es"));
}, [equipos]);

const tiposDisponibles = useMemo(() => {
  const valores = new Set<string>();
  equipos.forEach((equipo) => {
    if (equipo.tipo) valores.add(equipo.tipo.trim().toLowerCase());
  });
  return Array.from(valores).sort((a, b) => {
    const etiquetaA = tipoLabels[a] ?? a;
    const etiquetaB = tipoLabels[b] ?? b;
    return etiquetaA.localeCompare(etiquetaB, "es");
  });
}, [equipos]);

const ubicacionesDisponibles = useMemo(() => {
    const valores = new Set<string>();
    equipos.forEach((equipo) => {
      if (equipo.ubicacion?.nombre) valores.add(equipo.ubicacion.nombre.trim());
    });
  return Array.from(valores).sort((a, b) => a.localeCompare(b, "es"));
}, [equipos]);

const opcionesAntiguedad = useMemo(() => Array.from({ length: 20 }, (_, indice) => indice + 1), []);

const baseFiltrados = useMemo(() => {
  let dataset = equipos;

    if (filtroTipo) {
      const tipoNormalizado = filtroTipo.toLowerCase();
      dataset = dataset.filter((equipo) => equipo.tipo?.toLowerCase() === tipoNormalizado);
    }

    if (filtroAnio !== null && filtroAnio !== undefined) {
      dataset = dataset.filter((equipo) => {
        if (!equipo.fecha_compra) return false;
        const fecha = new Date(equipo.fecha_compra);
        return !Number.isNaN(fecha.getTime()) && fecha.getFullYear() === filtroAnio;
      });
    }

    dataset = dataset.filter((equipo) => {
      const ubicacion = equipo.ubicacion?.nombre?.toLowerCase() ?? "";
      const estaEnBoxes = ubicacion.includes("box");
      if (!mostrarBoxes && estaEnBoxes) return false;
      if (!mostrarNoBoxes && !estaEnBoxes) return false;

      const asignado = equipo.usuario_id !== null && equipo.usuario_id !== undefined;
      if (!mostrarAsignados && asignado) return false;
      if (!mostrarSinAsignar && !asignado) return false;

      if (sistemaOperativoSeleccionado) {
        if (
          !equipo.sistema_operativo ||
          equipo.sistema_operativo.trim() !== sistemaOperativoSeleccionado
        ) {
          return false;
        }
      }

      if (ubicacionSeleccionada) {
        if (!equipo.ubicacion?.nombre || equipo.ubicacion.nombre.trim() !== ubicacionSeleccionada)
          return false;
      }

      if (antiguedadMinima !== null) {
        if (!equipo.fecha_compra) return false;
        const fechaCompra = new Date(equipo.fecha_compra);
        if (Number.isNaN(fechaCompra.getTime())) return false;

        const hoy = new Date();
        let antiguedad = hoy.getFullYear() - fechaCompra.getFullYear();
        const mesDiff = hoy.getMonth() - fechaCompra.getMonth();
        if (mesDiff < 0 || (mesDiff === 0 && hoy.getDate() < fechaCompra.getDate())) {
          antiguedad -= 1;
        }

        if (antiguedad < antiguedadMinima) return false;
      }

      if (tipoSeleccionado) {
        if (!equipo.tipo || equipo.tipo.trim().toLowerCase() !== tipoSeleccionado) return false;
      }

      if (filtroAdmiteUpdate !== "todos") {
        if (filtroAdmiteUpdate === "si" && equipo.admite_update !== true) return false;
        if (filtroAdmiteUpdate === "no" && equipo.admite_update !== false) return false;
        if (
          filtroAdmiteUpdate === "desconocido" &&
          equipo.admite_update !== null &&
          equipo.admite_update !== undefined
        ) {
          return false;
        }
      }

      if (filtroGarbigune !== "todos") {
        if (filtroGarbigune === "si" && equipo.al_garbigune !== true) return false;
        if (filtroGarbigune === "no" && equipo.al_garbigune !== false) return false;
        if (
          filtroGarbigune === "desconocido" &&
          equipo.al_garbigune !== null &&
          equipo.al_garbigune !== undefined
        ) {
          return false;
        }
      }

      return true;
    });

    return dataset;
  }, [
    equipos,
    filtroTipo,
    filtroAnio,
    mostrarBoxes,
    mostrarNoBoxes,
    mostrarAsignados,
    mostrarSinAsignar,
    sistemaOperativoSeleccionado,
    ubicacionSeleccionada,
    tipoSeleccionado,
    antiguedadMinima,
    filtroAdmiteUpdate,
    filtroGarbigune,
  ]);

  const filtrados = useMemo(() => {
    const normalizada = query.trim().toLowerCase();
    if (!normalizada) return baseFiltrados;

    return baseFiltrados.filter((equipo) => {
      const valores: unknown[] = [...Object.values(equipo)];
      if (equipo.tipo) {
        const etiqueta = tipoLabels[equipo.tipo.toLowerCase()];
        if (etiqueta) valores.push(etiqueta);
      }
      const usuario = obtenerNombreUsuario(equipo);
      if (usuario) valores.push(usuario);
      if (equipo.fabricante?.nombre) valores.push(equipo.fabricante.nombre);
      if (equipo.ubicacion?.nombre) valores.push(equipo.ubicacion.nombre);
      if (equipo.procesador) valores.push(equipo.procesador);
      if (equipo.tarjeta_grafica) valores.push(equipo.tarjeta_grafica);
      if (equipo.observaciones && equipo.observaciones.trim().length > 0) {
        valores.push(equipo.observaciones);
      }
      if (equipo.so_precio) valores.push(equipo.so_precio);
      if (equipo.so_serial) valores.push(equipo.so_serial);
      if (equipo.numero_serie) valores.push(equipo.numero_serie);
      if (equipo.part_number) valores.push(equipo.part_number);
      if (equipo.admite_update !== null && equipo.admite_update !== undefined) {
        valores.push(equipo.admite_update ? "admite update" : "no admite update");
      }
      if (equipo.al_garbigune !== null && equipo.al_garbigune !== undefined) {
        valores.push(equipo.al_garbigune ? "al garbigune" : "no garbigune");
      }
      if (equipo.pantallas && Array.isArray(equipo.pantallas)) {
        equipo.pantallas.forEach((pantalla) => {
          if (pantalla?.pulgadas) valores.push(pantalla.pulgadas);
          if (pantalla?.modelo) valores.push(pantalla.modelo);
          if (pantalla?.fabricanteNombre) valores.push(pantalla.fabricanteNombre);
        });
      }

      return valores.some((valor) => normalizarValor(valor).includes(normalizada));
    });
  }, [baseFiltrados, query]);

  return (
    <section aria-label="Listado de equipos" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
        <label className="flex flex-col gap-1 text-sm text-foreground/70 sm:w-52 lg:w-60">
          Buscar en todos los campos
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ej. portatil HP, en garantia, 2023..."
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground shadow-sm focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/20"
          />
        </label>

        <fieldset className="flex flex-col gap-2 rounded-lg border border-border bg-card/40 px-3 py-2 text-xs text-foreground/80 sm:w-44">
          <legend className="font-semibold uppercase tracking-wide text-foreground/60">Boxes</legend>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={mostrarBoxes}
              onChange={(event) => setMostrarBoxes(event.target.checked)}
              className="h-4 w-4 rounded border-border text-foreground focus:ring-2 focus:ring-foreground/30"
            />
            <span>En boxes</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={mostrarNoBoxes}
              onChange={(event) => setMostrarNoBoxes(event.target.checked)}
              className="h-4 w-4 rounded border-border text-foreground focus:ring-2 focus:ring-foreground/30"
            />
            <span>Fuera de boxes</span>
          </label>
        </fieldset>

        <fieldset className="flex flex-col gap-2 rounded-lg border border-border bg-card/40 px-3 py-2 text-xs text-foreground/80 sm:w-44">
          <legend className="font-semibold uppercase tracking-wide text-foreground/60">
            Asignacion
          </legend>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={mostrarAsignados}
              onChange={(event) => setMostrarAsignados(event.target.checked)}
              className="h-4 w-4 rounded border-border text-foreground focus:ring-2 focus:ring-foreground/30"
            />
            <span>Asignados</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={mostrarSinAsignar}
              onChange={(event) => setMostrarSinAsignar(event.target.checked)}
              className="h-4 w-4 rounded border-border text-foreground focus:ring-2 focus:ring-foreground/30"
            />
            <span>Sin asignar</span>
          </label>
        </fieldset>

        <label className="flex flex-col gap-1 rounded-lg border border-border bg-card/40 px-3 py-2 text-xs text-foreground/80 sm:w-48">
          <span className="font-semibold uppercase tracking-wide text-foreground/60">
            Sistema operativo
          </span>
          <select
            value={sistemaOperativoSeleccionado}
            onChange={(event) => setSistemaOperativoSeleccionado(event.target.value)}
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/20"
          >
            <option value="">Todos</option>
            {sistemasOperativos.map((so) => (
              <option key={so} value={so}>
                {so}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 rounded-lg border border-border bg-card/40 px-3 py-2 text-xs text-foreground/80 sm:w-48">
          <span className="font-semibold uppercase tracking-wide text-foreground/60">Ubicacion</span>
          <select
            value={ubicacionSeleccionada}
            onChange={(event) => setUbicacionSeleccionada(event.target.value)}
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/20"
          >
            <option value="">Todas</option>
            {ubicacionesDisponibles.map((ubic) => (
              <option key={ubic} value={ubic}>
                {ubic}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 rounded-lg border border-border bg-card/40 px-3 py-2 text-xs text-foreground/80 sm:w-40">
          <span className="font-semibold uppercase tracking-wide text-foreground/60">Tipo</span>
          <select
            value={tipoSeleccionado}
            onChange={(event) => setTipoSeleccionado(event.target.value)}
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/20"
          >
            <option value="">Todos</option>
            {tiposDisponibles.map((tipoClave) => (
              <option key={tipoClave} value={tipoClave}>
                {tipoLabels[tipoClave] ?? tipoClave}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 rounded-lg border border-border bg-card/40 px-3 py-2 text-xs text-foreground/80 sm:w-40">
          <span className="font-semibold uppercase tracking-wide text-foreground/60">
            Antiguedad
          </span>
          <select
            value={antiguedadMinima ?? ""}
            onChange={(event) =>
              setAntiguedadMinima(event.target.value ? Number(event.target.value) : null)
            }
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/20"
          >
            <option value="">Todas</option>
            {opcionesAntiguedad.map((opcion) => (
              <option key={opcion} value={opcion}>
                {`≥ ${opcion}`}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 rounded-lg border border-border bg-card/40 px-3 py-2 text-xs text-foreground/80 sm:w-40">
          <span className="font-semibold uppercase tracking-wide text-foreground/60">
            Admite update
          </span>
          <select
            value={filtroAdmiteUpdate}
            onChange={(event) =>
              setFiltroAdmiteUpdate(event.target.value as FiltroAdmiteUpdate)
            }
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/20"
          >
            <option value="todos">Todos</option>
            <option value="si">Si</option>
            <option value="no">No</option>
            <option value="desconocido">Desconocido</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 rounded-lg border border-border bg-card/40 px-3 py-2 text-xs text-foreground/80 sm:w-40">
          <span className="font-semibold uppercase tracking-wide text-foreground/60">
            Al garbigune
          </span>
          <select
            value={filtroGarbigune}
            onChange={(event) => setFiltroGarbigune(event.target.value as FiltroGarbigune)}
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/20"
          >
            <option value="todos">Todos</option>
            <option value="si">Si</option>
            <option value="no">No</option>
            <option value="desconocido">Desconocido</option>
          </select>
        </label>
      </div>

      <div className="text-sm text-foreground/60">
        {filtrados.length === baseFiltrados.length
          ? filtrados.length === 1
            ? "1 resultado"
            : `${filtrados.length} resultados`
          : `${filtrados.length} de ${baseFiltrados.length} resultados`}
      </div>

      {equipos.length === 0 ? (
        <p className="text-sm text-foreground/60">
          No hay equipos registrados todavia. Anade el primero desde el panel de gestion.
        </p>
      ) : baseFiltrados.length === 0 ? (
        <p className="text-sm text-foreground/60">
          No hay equipos que coincidan con el filtro seleccionado.
        </p>
      ) : filtrados.length === 0 ? (
        <p className="text-sm text-foreground/60">
          No se encontraron equipos que coincidan con{" "}
          <span className="font-medium">&ldquo;{query}&rdquo;</span>.
        </p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
          {filtrados.map((equipo) => {
            const tipo = equipo.tipo ? tipoLabels[equipo.tipo.toLowerCase()] ?? equipo.tipo : "-";
            const fabricante = equipo.fabricante?.nombre ?? "Sin fabricante";
            const usuario = obtenerNombreUsuario(equipo) ?? "Sin usuario asignado";
            const ubicacion = equipo.ubicacion?.nombre ?? "Sin ubicacion";
            const sistemaOperativo = equipo.sistema_operativo ?? "Sin sistema operativo";
            const esWindows10 = sistemaOperativo.toLowerCase().includes("windows 10");
            const tieneSoPrecio =
              equipo.so_precio !== null && equipo.so_precio !== undefined && equipo.so_precio !== 0;
            const soPrecioTexto = tieneSoPrecio ? formatearImporte(equipo.so_precio) : null;
            const procesador = equipo.procesador ?? "Sin procesador";
            const tarjetaGrafica = equipo.tarjeta_grafica ?? "Sin tarjeta grafica";
            const observaciones =
              equipo.observaciones && equipo.observaciones.trim().length > 0
                ? equipo.observaciones.trim()
                : null;
            const soSerial = equipo.so_serial ?? "Sin numero de serie SO";
            const numeroSerie = equipo.numero_serie ?? "Sin numero de serie";
            const partNumber = equipo.part_number ?? "Sin part number";
            const admiteUpdateTexto =
              equipo.admite_update === null || equipo.admite_update === undefined
                ? "Desconocido"
                : equipo.admite_update
                  ? "Si"
                  : "No";
            const alGarbiguneTexto =
              equipo.al_garbigune === null || equipo.al_garbigune === undefined
                ? "Desconocido"
                : equipo.al_garbigune
                  ? "Si"
                  : "No";
            const pantallas = Array.isArray(equipo.pantallas) ? equipo.pantallas : [];

            const ramTexto = equipo.ram ? `${equipo.ram} GB RAM` : "";
            const ssdTexto = equipo.ssd ? `${equipo.ssd} GB SSD` : "";
            const hddTexto = equipo.hdd ? `${equipo.hdd} GB HDD` : "";
            const almacenamiento = [ramTexto, ssdTexto, hddTexto].filter(Boolean).join(" · ");

            return (
              <li
                key={equipo.id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm"
              >
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-foreground">
                    {equipo.nombre ?? "Equipo sin nombre"}
                  </h3>
                  <p className="text-xs font-semibold italic text-foreground/60">{usuario}</p>
                  <p className="text-sm text-foreground/70">
                    {fabricante}
                    {equipo.modelo ? ` ${equipo.modelo}` : ""}
                  </p>
                  <p className="text-sm text-foreground/70">{procesador}</p>
                  {almacenamiento ? (
                    <p className="text-sm text-foreground/70">{almacenamiento}</p>
                  ) : null}
                  <p className="text-sm text-foreground/70">{tarjetaGrafica}</p>
                  <p className={`text-sm ${esWindows10 ? "text-red-500" : "text-foreground/70"}`}>
                    {tieneSoPrecio ? `${sistemaOperativo} · ${soPrecioTexto}` : sistemaOperativo}
                  </p>
                  <p className="text-[9px] leading-tight text-foreground/70">
                    SO serial: {soSerial}
                  </p>
                  <p className="text-sm text-foreground/70">Numero serie: {numeroSerie}</p>
                  <p className="text-sm text-foreground/70">Part number: {partNumber}</p>
                  <p className="text-sm text-foreground/70">Admite update: {admiteUpdateTexto}</p>
                  <div className="border-t border-border/60 pt-2" />
                </div>

                <dl className="grid gap-2 text-sm text-foreground/80">
                  <div className="flex justify-between gap-3">
                    <dt className="font-medium text-foreground/70">Ubicacion</dt>
                    <dd className="text-foreground">{ubicacion}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="font-medium text-foreground/70">Tipo</dt>
                    <dd className="text-foreground">{tipo}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="font-medium text-foreground/70">Fecha compra</dt>
                    <dd className="text-foreground">{formatearFecha(equipo.fecha_compra)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="font-medium text-foreground/70">Precio compra</dt>
                    <dd className="text-foreground">
                      {equipo.url ? (
                        <a
                          href={equipo.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 underline underline-offset-4"
                        >
                          {formatearImporte(equipo.precio_compra)}
                        </a>
                      ) : (
                        formatearImporte(equipo.precio_compra)
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="font-medium text-foreground/70">Garantia</dt>
                    <dd className="text-foreground">{equipo.en_garantia ? "Si" : "No"}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="font-medium text-foreground/70">Al garbigune</dt>
                    <dd className="text-foreground">{alGarbiguneTexto}</dd>
                  </div>
                  {observaciones ? (
                    <div className="flex flex-col gap-1 border-t border-border/60 pt-2">
                      <dt className="font-medium text-foreground/70">Observaciones</dt>
                      <dd className="text-foreground whitespace-pre-line">{observaciones}</dd>
                    </div>
                  ) : null}
                </dl>

                {pantallas.length > 0 ? (
                  <div className="border-t border-border/60 pt-3">
                    <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground/60">
                      Pantallas conectadas
                    </h4>
                    <div className="flex flex-wrap gap-3" aria-label="Pantallas conectadas">
                      {pantallas.map((pantalla, index) => {
                        const etiquetaFabricante = pantalla?.fabricanteNombre ?? "";
                        const etiquetaModelo = pantalla?.modelo ?? "";
                        const descripcion =
                          `${etiquetaFabricante} ${etiquetaModelo}`.trim() || "Pantalla";
                        const pulgadasTexto =
                          pantalla?.pulgadas !== null && pantalla?.pulgadas !== undefined
                            ? `${pantalla.pulgadas}`
                            : "?";

                        return (
                          <div
                            key={pantalla?.id ?? `${equipo.id}-pantalla-${index}`}
                            className="flex w-20 flex-col items-center gap-1 text-center text-foreground/70"
                          >
                            <div className="flex aspect-[16/10] w-full items-center justify-center rounded-md border border-border bg-foreground/[0.04] text-[11px] font-semibold text-foreground">
                              {pulgadasTexto}
                            </div>
                            <span className="line-clamp-2 text-[10px] leading-tight text-foreground/60">
                              {descripcion}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
