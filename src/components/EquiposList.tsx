"use client";

import { useMemo, useState } from "react";
import { formatearFecha, formatearImporte } from "@/lib/format";
import type { EquipoRecord } from "@/lib/supabase";

const tipoLabels: Record<string, string> = {
  sobremesa: "Sobremesa",
  portatil: "Portátil",
  tablet: "Tablet",
};

type EquiposListProps = {
  equipos: EquipoRecord[];
  filtroTipo?: string | null;
  filtroAnio?: number | null;
};

function obtenerNombreUsuario(equipo: EquipoRecord): string | null {
  if (!equipo.usuario) return null;
  if (equipo.usuario.nombre_completo) return equipo.usuario.nombre_completo;

  const partes = [equipo.usuario.nombre, equipo.usuario.apellidos].filter(
    (parte): parte is string => Boolean(parte),
  );

  return partes.length > 0 ? partes.join(" ") : null;
}

function normalizarValor(valor: unknown): string {
  if (valor === null || valor === undefined) {
    return "";
  }

  if (typeof valor === "boolean") {
    return valor ? "true 1 si yes" : "false 0 no";
  }

  if (typeof valor === "number") {
    const texto = valor.toString();
    return `${texto} ${texto.replace(".", ",")}`;
  }

  if (Array.isArray(valor)) {
    return valor.map(normalizarValor).join(" ");
  }

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

  const baseFiltrados = useMemo(() => {
    let dataset = equipos;

    if (filtroTipo) {
      const tipoNormalizado = filtroTipo.toLowerCase();
      dataset = dataset.filter(
        (equipo) => equipo.tipo?.toLowerCase() === tipoNormalizado,
      );
    }

    if (filtroAnio !== null && filtroAnio !== undefined) {
      dataset = dataset.filter((equipo) => {
        if (!equipo.fecha_compra) return false;
        const fecha = new Date(equipo.fecha_compra);
        return !Number.isNaN(fecha.getTime()) && fecha.getFullYear() === filtroAnio;
      });
    }

    return dataset;
  }, [equipos, filtroTipo, filtroAnio]);

  const filtrados = useMemo(() => {
    const normalizada = query.trim().toLowerCase();
    if (!normalizada) return baseFiltrados;

    return baseFiltrados.filter((equipo) => {
      const valores: unknown[] = [...Object.values(equipo)];

      if (equipo.tipo) {
        const etiqueta = tipoLabels[equipo.tipo.toString().toLowerCase()];
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

      return valores.some((valor) => normalizarValor(valor).includes(normalizada));
    });
  }, [baseFiltrados, query]);

  return (
    <section aria-label="Listado de equipos" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex-1">
          <label className="flex flex-col gap-1 text-sm text-foreground/70">
            Buscar en todos los campos
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ej. portatil HP, en garantia, 2023..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground shadow-sm focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </label>
        </div>
        <div className="text-sm text-foreground/60">
          {filtrados.length === baseFiltrados.length
            ? filtrados.length === 1
              ? "1 resultado"
              : `${filtrados.length} resultados`
            : `${filtrados.length} de ${baseFiltrados.length} resultados`}
        </div>
      </div>

      {equipos.length === 0 ? (
        <p className="text-sm text-foreground/60">
          No hay equipos registrados todavía. Añade el primero desde el panel de gestión.
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
            const tipo = equipo.tipo ? tipoLabels[equipo.tipo.toLowerCase()] ?? equipo.tipo : "—";
            const fabricante = equipo.fabricante?.nombre ?? "Sin fabricante";
            const usuario = obtenerNombreUsuario(equipo) ?? "Sin usuario asignado";
            const ubicacion = equipo.ubicacion?.nombre ?? "Sin ubicación";
            const sistemaOperativo = equipo.sistema_operativo ?? "Sin sistema operativo";
            const esWindows10 =
              sistemaOperativo.toLowerCase().includes("windows 10");
            const tieneSoPrecio =
              equipo.so_precio !== null && equipo.so_precio !== undefined && equipo.so_precio !== 0;
            const soPrecioTexto = tieneSoPrecio ? formatearImporte(equipo.so_precio) : null;
            const procesador = equipo.procesador ?? "Sin procesador";
            const tarjetaGrafica = equipo.tarjeta_grafica ?? "Sin tarjeta gráfica";
            const observaciones =
              equipo.observaciones && equipo.observaciones.trim().length > 0
                ? equipo.observaciones.trim()
                : null;
            const soSerial = equipo.so_serial ?? "Sin número de serie SO";
            const numeroSerie = equipo.numero_serie ?? "Sin número de serie";
            const partNumber = equipo.part_number ?? "Sin part number";
            const admiteUpdateTexto =
              equipo.admite_update === null || equipo.admite_update === undefined
                ? "Desconocido"
                : equipo.admite_update
                  ? "Sí"
                  : "No";

            const ram = equipo.ram ?? 0;
            const ssd = equipo.ssd ?? 0;
            const hdd = equipo.hdd ?? 0;
            const ramTexto = ram ? `${ram} GB RAM` : "";
            const ssdTexto = ssd ? `${ssd} GB SSD` : "";
            const hddTexto = hdd ? `${hdd} GB HDD` : "";
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
                  <p
                    className={`text-sm ${esWindows10 ? "text-red-500" : "text-foreground/70"}`}
                  >
                    {tieneSoPrecio ? `${sistemaOperativo} · ${soPrecioTexto}` : sistemaOperativo}
                  </p>
                  <p className="text-[9px] text-foreground/70 leading-tight">SO serial: {soSerial}</p>
                  <p className="text-sm text-foreground/70">Número serie: {numeroSerie}</p>
                  <p className="text-sm text-foreground/70">Part number: {partNumber}</p>
                  <p className="text-sm text-foreground/70">Admite update: {admiteUpdateTexto}</p>
                  <div className="border-t border-border/60 pt-2" />
                </div>

                <dl className="grid gap-2 text-sm text-foreground/80">
                  <div className="flex justify-between gap-3">
                    <dt className="font-medium text-foreground/70">Ubicación</dt>
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
                    <dt className="font-medium text-foreground/70">Garantía</dt>
                    <dd className="text-foreground">{equipo.en_garantia ? "Sí" : "No"}</dd>
                  </div>
                  {observaciones ? (
                    <div className="flex flex-col gap-1 border-t border-border/60 pt-2">
                      <dt className="font-medium text-foreground/70">Observaciones</dt>
                      <dd className="text-foreground whitespace-pre-line">{observaciones}</dd>
                    </div>
                  ) : null}
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}




