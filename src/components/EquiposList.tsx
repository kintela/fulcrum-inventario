"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

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

type IaFilters = {
  sistemasOperativosContains?: string[];

  admiteUpdate?: "true" | "false" | "unknown";

  asignado?: boolean;

  alGarbigune?: boolean;

  ubicacionesContains?: string[];

  tiposIn?: string[];
};

type IaResultado = {
  filters: IaFilters;

  summary: string | null;
};

function normalizarListadoStrings(valor: unknown): string[] | undefined {
  if (typeof valor === "string") {
    const limpio = valor.trim().toLowerCase();

    return limpio ? [limpio] : undefined;
  }

  if (!Array.isArray(valor)) return undefined;

  const lista = valor

    .map((item) =>
      typeof item === "string" ? item.trim().toLowerCase() : null,
    )

    .filter((item): item is string => Boolean(item));

  return lista.length > 0 ? Array.from(new Set(lista)) : undefined;
}

function normalizarFiltrosIa(raw: unknown): IaFilters {
  if (!raw || typeof raw !== "object") return {};

  const objeto = raw as Record<string, unknown>;

  const filtros: IaFilters = {};

  const so = normalizarListadoStrings(
    objeto.sistema_operativo_contains ??
      objeto.sistemas_operativos_contains ??
      objeto.sistema_operativo_normalizado_contains ??
      objeto.sistema_operativo,
  );

  if (so) filtros.sistemasOperativosContains = so;

  const ubicaciones = normalizarListadoStrings(
    objeto.ubicacion_contains ??
      objeto.ubicaciones_contains ??
      objeto.ubicacion_normalizada_contains ??
      objeto.ubicacion,
  );

  if (ubicaciones) filtros.ubicacionesContains = ubicaciones;

  const tipos = normalizarListadoStrings(
    objeto.tipo_in ?? objeto.tipos_in ?? objeto.tipo,
  );

  if (tipos) filtros.tiposIn = tipos.map((tipo) => tipo.toLowerCase());

  const admite =
    objeto.admite_update ??
    objeto.admite_update_equals ??
    objeto.admite_update_es ??
    objeto.admiteUpdate;

  if (typeof admite === "string") {
    const valor = admite.trim().toLowerCase();

    if (["true", "false", "unknown", "null"].includes(valor)) {
      filtros.admiteUpdate =
        valor === "null" ? "unknown" : (valor as IaFilters["admiteUpdate"]);
    }
  } else if (typeof admite === "boolean") {
    filtros.admiteUpdate = admite ? "true" : "false";
  }

  const asignado =
    objeto.asignado ??
    objeto.asignados ??
    objeto.asignado_equals ??
    objeto.asignado_es ??
    objeto.tiene_usuario ??
    objeto.usuario_no_es_null;

  if (typeof asignado === "boolean") {
    filtros.asignado = asignado;
  } else if (typeof asignado === "string") {
    const valor = asignado.trim().toLowerCase();

    if (valor === "true" || valor === "false")
      filtros.asignado = valor === "true";
  }

  const garbigune =
    objeto.al_garbigune ?? objeto.al_garbigune_equals ?? objeto.garbigune;

  if (typeof garbigune === "boolean") {
    filtros.alGarbigune = garbigune;
  } else if (typeof garbigune === "string") {
    const valor = garbigune.trim().toLowerCase();

    if (valor === "true" || valor === "false")
      filtros.alGarbigune = valor === "true";
  }

  return filtros;
}

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
  const [searchTerm, setSearchTerm] = useState("");

  const promptRef = useRef<HTMLTextAreaElement | null>(null);

  const [mostrarBoxes, setMostrarBoxes] = useState(true);

  const [mostrarNoBoxes, setMostrarNoBoxes] = useState(true);

  const [mostrarAsignados, setMostrarAsignados] = useState(true);

  const [mostrarSinAsignar, setMostrarSinAsignar] = useState(true);

  const [sistemaOperativoSeleccionado, setSistemaOperativoSeleccionado] =
    useState<string>("");

  const [ubicacionSeleccionada, setUbicacionSeleccionada] =
    useState<string>("");

  const [tipoSeleccionado, setTipoSeleccionado] = useState<string>("");

  const [antiguedadMinima, setAntiguedadMinima] = useState<number | null>(null);

  const [mostrarAdmitenUpdate, setMostrarAdmitenUpdate] = useState(true);

  const [mostrarNoAdmitenUpdate, setMostrarNoAdmitenUpdate] = useState(true);

  const [mostrarGarbiguneSi, setMostrarGarbiguneSi] = useState(true);

  const [mostrarGarbiguneNo, setMostrarGarbiguneNo] = useState(true);

  const [iaResultado, setIaResultado] = useState<IaResultado | null>(null);

  const [iaDestacados, setIaDestacados] = useState<
    Array<{ id: string; motivo: string | null }>
  >([]);

  const iaDestacadosMapa = useMemo(() => {
    const mapa = new Map<string, string | null>();

    iaDestacados.forEach((item) => mapa.set(item.id, item.motivo ?? null));

    return mapa;
  }, [iaDestacados]);

  const [respuestaIa, setRespuestaIa] = useState<string | null>(null);

  const [errorIa, setErrorIa] = useState<string | null>(null);

  const [cargandoIa, setCargandoIa] = useState(false);

  const sistemasOperativos = useMemo(() => {
    const valores = new Set<string>();

    equipos.forEach((equipo) => {
      if (equipo.sistema_operativo)
        valores.add(equipo.sistema_operativo.trim());
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

  const opcionesAntiguedad = useMemo(
    () => Array.from({ length: 20 }, (_, indice) => indice + 1),

    [],
  );

  async function consultarIA() {
    const promptOriginal = promptRef.current?.value ?? "";

    const prompt = promptOriginal.trim();

    if (!prompt) return;

    setCargandoIa(true);

    setErrorIa(null);

    setRespuestaIa(null);

    setIaResultado(null);

    setIaDestacados([]);

    setSearchTerm("");

    try {
      const ahora = new Date();

      const resumenEquipos = equipos.map((equipo) => {
        const fechaCompra = equipo.fecha_compra
          ? new Date(equipo.fecha_compra)
          : null;

        let antiguedadAnos: number | null = null;
        if (fechaCompra && !Number.isNaN(fechaCompra.getTime())) {
          antiguedadAnos = ahora.getFullYear() - fechaCompra.getFullYear();
          const mesDiff = ahora.getMonth() - fechaCompra.getMonth();

          if (
            mesDiff < 0 ||
            (mesDiff === 0 && ahora.getDate() < fechaCompra.getDate())
          ) {
            antiguedadAnos -= 1;
          }
        }

        return {
          id: equipo.id,
          nombre: equipo.nombre,
          tipo: equipo.tipo,
          admite_update: equipo.admite_update,
          admite_update_bool: equipo.admite_update === true,
          al_garbigune: equipo.al_garbigune,
          ubicacion: equipo.ubicacion?.nombre ?? null,
          usuario_id: equipo.usuario_id,
          usuario_resumen: obtenerNombreUsuario(equipo),
          asignado:
            equipo.usuario_id !== null && equipo.usuario_id !== undefined,
          sistema_operativo: equipo.sistema_operativo,
          sistema_operativo_normalizado:
            equipo.sistema_operativo?.toLowerCase() ?? null,
          en_garantia: equipo.en_garantia,
          fecha_compra: equipo.fecha_compra,
          precio_compra: equipo.precio_compra,
          fecha_bios: equipo.fecha_bios,
          procesador: equipo.procesador,
          tarjeta_grafica: equipo.tarjeta_grafica,
          ram: equipo.ram,
          ssd: equipo.ssd,
          hdd: equipo.hdd,
          antiguedad_anos: antiguedadAnos,
          texto_busqueda: normalizarValor({
            nombre: equipo.nombre,
            tipo: equipo.tipo,
            sistema_operativo: equipo.sistema_operativo,
            usuario: obtenerNombreUsuario(equipo),
            ubicacion: equipo.ubicacion?.nombre ?? null,
            admite_update: equipo.admite_update,
            al_garbigune: equipo.al_garbigune,
            procesador: equipo.procesador,
            tarjeta_grafica: equipo.tarjeta_grafica,
            ram: equipo.ram,
            ssd: equipo.ssd,
            hdd: equipo.hdd,
            precio_compra: equipo.precio_compra,
          }),
        };
      });

      const response = await fetch("/api/ai", {
        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({
          prompt,

          contexto: {
            equipos: resumenEquipos,
          },
        }),
      });

      if (!response.ok) {
        const detalle = await response.json().catch(() => ({}));

        throw new Error(
          detalle?.message ?? "No se pudo obtener respuesta de la IA.",
        );
      }

      const data = (await response.json()) as {
        filters?: Record<string, unknown>;

        highlights?: Array<{ id: string; motivo: string | null }>;

        summary?: string | null;
      };

      const filtros = normalizarFiltrosIa(data.filters);

      setIaResultado({
        filters: filtros,

        summary: data.summary ?? null,
      });

      setIaDestacados(Array.isArray(data.highlights) ? data.highlights : []);

      setRespuestaIa(data.summary ?? null);
    } catch (error) {
      const mensaje =
        error instanceof Error
          ? error.message
          : "Ha ocurrido un error consultando la IA.";

      setErrorIa(mensaje);
    } finally {
      setCargandoIa(false);
    }
  }

  function limpiarFiltroIa() {
    setIaResultado(null);
    setIaDestacados([]);
    setRespuestaIa(null);
    setErrorIa(null);

    const current = promptRef.current?.value ?? "";
    setSearchTerm(current.trim());
  }

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

        return (
          !Number.isNaN(fecha.getTime()) && fecha.getFullYear() === filtroAnio
        );
      });
    }

    dataset = dataset.filter((equipo) => {
      const ubicacion = equipo.ubicacion?.nombre?.toLowerCase() ?? "";

      const estaEnBoxes = ubicacion.includes("box");

      if (!mostrarBoxes && estaEnBoxes) return false;

      if (!mostrarNoBoxes && !estaEnBoxes) return false;

      const asignado =
        equipo.usuario_id !== null && equipo.usuario_id !== undefined;

      if (!mostrarAsignados && asignado) return false;

      if (!mostrarSinAsignar && !asignado) return false;

      const filtrosIa = iaResultado?.filters ?? null;

      if (
        !filtrosIa?.sistemasOperativosContains?.length &&
        sistemaOperativoSeleccionado
      ) {
        if (
          !equipo.sistema_operativo ||
          equipo.sistema_operativo.trim() !== sistemaOperativoSeleccionado
        ) {
          return false;
        }
      }

      if (ubicacionSeleccionada) {
        if (
          !equipo.ubicacion?.nombre ||
          equipo.ubicacion.nombre.trim() !== ubicacionSeleccionada
        )
          return false;
      }

      if (antiguedadMinima !== null) {
        if (!equipo.fecha_compra) return false;

        const fechaCompra = new Date(equipo.fecha_compra);

        if (Number.isNaN(fechaCompra.getTime())) return false;

        const hoy = new Date();

        let antiguedad = hoy.getFullYear() - fechaCompra.getFullYear();

        const mesDiff = hoy.getMonth() - fechaCompra.getMonth();

        if (
          mesDiff < 0 ||
          (mesDiff === 0 && hoy.getDate() < fechaCompra.getDate())
        ) {
          antiguedad -= 1;
        }

        if (antiguedad < antiguedadMinima) return false;
      }

      if (tipoSeleccionado) {
        if (
          !equipo.tipo ||
          equipo.tipo.trim().toLowerCase() !== tipoSeleccionado
        )
          return false;
      }

      if (!mostrarAdmitenUpdate && equipo.admite_update === true) return false;

      if (!mostrarNoAdmitenUpdate && equipo.admite_update === false)
        return false;

      if (!mostrarGarbiguneSi && equipo.al_garbigune === true) return false;

      if (!mostrarGarbiguneNo && equipo.al_garbigune === false) return false;

      return true;
    });

    const filtrosIa = iaResultado?.filters ?? null;

    if (filtrosIa) {
      if (filtrosIa.sistemasOperativosContains) {
        dataset = dataset.filter((equipo) => {
          const so = equipo.sistema_operativo?.toLowerCase() ?? "";

          return filtrosIa.sistemasOperativosContains!.some((fragmento) =>
            so.includes(fragmento),
          );
        });
      }

      if (filtrosIa.ubicacionesContains) {
        dataset = dataset.filter((equipo) => {
          const ubicacion = equipo.ubicacion?.nombre?.toLowerCase() ?? "";

          return filtrosIa.ubicacionesContains!.some((fragmento) =>
            ubicacion.includes(fragmento),
          );
        });
      }

      if (filtrosIa.tiposIn) {
        dataset = dataset.filter((equipo) => {
          const tipo = equipo.tipo?.toLowerCase() ?? "";

          return filtrosIa.tiposIn!.includes(tipo);
        });
      }

      if (filtrosIa.admiteUpdate === "true") {
        dataset = dataset.filter((equipo) => equipo.admite_update === true);
      } else if (filtrosIa.admiteUpdate === "false") {
        dataset = dataset.filter(
          (equipo) =>
            equipo.admite_update === false || equipo.admite_update === null,
        );
      } else if (filtrosIa.admiteUpdate === "unknown") {
        dataset = dataset.filter(
          (equipo) =>
            equipo.admite_update === null || equipo.admite_update === undefined,
        );
      }

      if (typeof filtrosIa.asignado === "boolean") {
        dataset = dataset.filter((equipo) => {
          const tieneUsuario =
            equipo.usuario_id !== null && equipo.usuario_id !== undefined;

          return filtrosIa.asignado ? tieneUsuario : !tieneUsuario;
        });
      }

      if (typeof filtrosIa.alGarbigune === "boolean") {
        dataset = dataset.filter(
          (equipo) => equipo.al_garbigune === filtrosIa.alGarbigune,
        );
      }

      if (iaDestacados.length > 0) {
        dataset = dataset.filter((equipo) => iaDestacadosMapa.has(equipo.id));
      }
    }

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

    mostrarAdmitenUpdate,

    mostrarNoAdmitenUpdate,

    mostrarGarbiguneSi,

    mostrarGarbiguneNo,

    iaResultado,

    iaDestacados,

    iaDestacadosMapa,
  ]);

  useEffect(() => {
    if (!iaResultado) return;

    const conteoBase = baseFiltrados.length;

    const conteoDestacados = iaDestacados.length;

    const conteo = conteoDestacados > 0 ? conteoDestacados : conteoBase;

    const resumen = iaResultado.summary?.trim();

    const mensaje =
      resumen && resumen.length > 0
        ? `${resumen} (${conteo} ${conteo === 1 ? "resultado" : "resultados"})`
        : `Filtro IA aplicado (${conteo} ${conteo === 1 ? "resultado" : "resultados"})`;

    setRespuestaIa(mensaje);
  }, [iaResultado, iaDestacados.length, baseFiltrados.length]);

  const filtrados = useMemo(() => {
    const dataset = baseFiltrados;

    if (iaResultado) return dataset;

    const normalizada = searchTerm.trim().toLowerCase();

    if (!normalizada) return dataset;

    return dataset.filter((equipo) => {
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
        valores.push(
          equipo.admite_update ? "admite update" : "no admite update",
        );
      }

      if (equipo.al_garbigune !== null && equipo.al_garbigune !== undefined) {
        valores.push(equipo.al_garbigune ? "al garbigune" : "no garbigune");
      }

      if (equipo.pantallas && Array.isArray(equipo.pantallas)) {
        equipo.pantallas.forEach((pantalla) => {
          if (pantalla?.pulgadas) valores.push(pantalla.pulgadas);

          if (pantalla?.modelo) valores.push(pantalla.modelo);

          if (pantalla?.fabricanteNombre)
            valores.push(pantalla.fabricanteNombre);
        });
      }

      return valores.some((valor) =>
        normalizarValor(valor).includes(normalizada),
      );
    });
  }, [baseFiltrados, searchTerm, iaResultado]);

  return (
    <section aria-label="Listado de equipos" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-sm text-foreground/70">
              Buscar en todos los campos
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
                <textarea
                  ref={promptRef}
                  placeholder="Escribe tu busqueda o prompt"
                  rows={5}
                  className="flex-1 resize-y rounded-lg border border-border bg-background px-3 py-3 text-base text-foreground shadow-sm focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />

                <div className="flex flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const termino = promptRef.current?.value ?? "";
                      const trimmed = termino.trim();

                      setIaResultado(null);
                      setIaDestacados([]);
                      setRespuestaIa(null);
                      setErrorIa(null);

                      if (promptRef.current) {
                        promptRef.current.value = trimmed;
                      }

                      setSearchTerm(trimmed);
                    }}
                    className="flex h-[48px] cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-5 text-sm font-semibold uppercase tracking-wide text-foreground shadow-sm transition hover:bg-card/80"
                    aria-label="Aplicar busqueda manual"
                    title="Aplicar busqueda manual"
                  >
                    Buscar
                  </button>

                  <button
                    type="button"
                    onClick={consultarIA}
                    disabled={cargandoIa}
                    className="flex h-[48px] cursor-pointer items-center gap-2 rounded-full border border-border bg-foreground px-5 text-sm font-semibold uppercase tracking-wide text-background shadow-sm transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="Consultar IA sobre los datos"
                    title="Consultar IA sobre los datos"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="h-5 w-5"
                    >
                      <path
                        d="M12 3.75a8.25 8.25 0 0 0-7.19 12.3l-1.06 3.18 3.18-1.06A8.25 8.25 0 1 0 12 3.75Z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      <path
                        d="M9.75 12c0-1.24 1.01-2.25 2.25-2.25S14.25 10.76 14.25 12 13.24 14.25 12 14.25 9.75 13.24 9.75 12Z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>

                    <span>IA</span>
                  </button>
                </div>
              </div>
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:gap-4">
          <fieldset className="flex flex-col gap-2 rounded-lg border border-border bg-card/40 px-3 py-2 text-xs text-foreground/80 sm:w-44">
            <legend className="font-semibold uppercase tracking-wide text-foreground/60">
              Boxes
            </legend>

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

          <fieldset className="flex flex-col gap-2 rounded-lg border border-border bg-card/40 px-3 py-2 text-xs text-foreground/80 sm:w-44">
            <legend className="font-semibold uppercase tracking-wide text-foreground/60">
              Admite update
            </legend>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={mostrarAdmitenUpdate}
                onChange={(event) =>
                  setMostrarAdmitenUpdate(event.target.checked)
                }
                className="h-4 w-4 rounded border-border text-foreground focus:ring-2 focus:ring-foreground/30"
              />

              <span>Si admite</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={mostrarNoAdmitenUpdate}
                onChange={(event) =>
                  setMostrarNoAdmitenUpdate(event.target.checked)
                }
                className="h-4 w-4 rounded border-border text-foreground focus:ring-2 focus:ring-foreground/30"
              />

              <span>No admite</span>
            </label>
          </fieldset>

          <fieldset className="flex flex-col gap-2 rounded-lg border border-border bg-card/40 px-3 py-2 text-xs text-foreground/80 sm:w-44">
            <legend className="font-semibold uppercase tracking-wide text-foreground/60">
              Al garbigune
            </legend>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={mostrarGarbiguneSi}
                onChange={(event) =>
                  setMostrarGarbiguneSi(event.target.checked)
                }
                className="h-4 w-4 rounded border-border text-foreground focus:ring-2 focus:ring-foreground/30"
              />

              <span>Si</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={mostrarGarbiguneNo}
                onChange={(event) =>
                  setMostrarGarbiguneNo(event.target.checked)
                }
                className="h-4 w-4 rounded border-border text-foreground focus:ring-2 focus:ring-foreground/30"
              />

              <span>No</span>
            </label>
          </fieldset>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
          <label className="flex flex-col gap-1 rounded-lg border border-border bg-card/40 px-3 py-2 text-xs text-foreground/80 sm:w-48">
            <span className="font-semibold uppercase tracking-wide text-foreground/60">
              Sistema operativo
            </span>

            <select
              value={sistemaOperativoSeleccionado}
              onChange={(event) =>
                setSistemaOperativoSeleccionado(event.target.value)
              }
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
            <span className="font-semibold uppercase tracking-wide text-foreground/60">
              Ubicacion
            </span>

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
            <span className="font-semibold uppercase tracking-wide text-foreground/60">
              Tipo
            </span>

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
                setAntiguedadMinima(
                  event.target.value ? Number(event.target.value) : null,
                )
              }
              className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/20"
            >
              <option value="">Todas</option>

              {opcionesAntiguedad.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {`= ${opcion}`}
                </option>
              ))}
            </select>
          </label>
        </div>

        {cargandoIa || errorIa || respuestaIa || iaResultado ? (
          <div className="rounded-lg border border-border bg-card/40 px-3 py-2 text-sm text-foreground/80">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground/60">
                Respuesta IA
              </p>

              {iaResultado ? (
                <button
                  type="button"
                  onClick={limpiarFiltroIa}
                  className="cursor-pointer text-xs font-semibold text-foreground transition hover:text-foreground/70"
                >
                  Limpiar filtro IA
                </button>
              ) : null}
            </div>

            {cargandoIa ? (
              <p className="animate-pulse text-foreground/70">Consultando...</p>
            ) : errorIa ? (
              <p className="text-red-500">{errorIa}</p>
            ) : (
              <>
                {respuestaIa ? (
                  <pre className="whitespace-pre-wrap break-words font-mono text-foreground">
                    {respuestaIa}
                  </pre>
                ) : null}

                {iaResultado?.filters ? (
                  <pre className="mt-2 whitespace-pre-wrap break-words rounded bg-background/60 px-2 py-1 text-[11px] font-mono text-foreground/80">
                    {JSON.stringify(iaResultado.filters, null, 2)}
                  </pre>
                ) : null}

                {iaDestacados.length > 0 ? (
                  <div className="mt-2 flex flex-col gap-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground/60">
                      Equipos destacados
                    </p>

                    <ul className="space-y-1">
                      {iaDestacados.map((destacado) => (
                        <li
                          key={destacado.id}
                          className="rounded border border-border/60 bg-background/70 px-2 py-1 text-[11px] text-foreground/80"
                        >
                          <span className="font-mono text-xs">
                            {destacado.id}
                          </span>

                          {destacado.motivo ? (
                            <span className="ml-1 text-foreground/60">
                              - {destacado.motivo}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </div>

      <div className="text-sm text-foreground/60">
        {iaResultado
          ? `${filtrados.length} resultado${filtrados.length === 1 ? "" : "s"}`
          : searchTerm
            ? `${filtrados.length} de ${baseFiltrados.length} resultados`
            : filtrados.length === 1
              ? "1 resultado"
              : `${filtrados.length} resultados`}
      </div>

      {equipos.length === 0 ? (
        <p className="text-sm text-foreground/60">
          No hay equipos registrados todavia. Anade el primero desde el panel de
          gestion.
        </p>
      ) : baseFiltrados.length === 0 ? (
        <p className="text-sm text-foreground/60">
          No hay equipos que coincidan con el filtro seleccionado.
        </p>
      ) : filtrados.length === 0 ? (
        <p className="text-sm text-foreground/60">
          {searchTerm ? (
            <>
              No se encontraron equipos que coincidan con{" "}
              <span className="font-medium">&ldquo;{searchTerm}&rdquo;</span>.
            </>
          ) : (
            "No se encontraron equipos que coincidan con el filtro seleccionado."
          )}
        </p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
          {filtrados.map((equipo) => {
            const tipo = equipo.tipo
              ? (tipoLabels[equipo.tipo.toLowerCase()] ?? equipo.tipo)
              : "-";

            const fabricante = equipo.fabricante?.nombre ?? "Sin fabricante";

            const usuario =
              obtenerNombreUsuario(equipo) ?? "Sin usuario asignado";

            const ubicacion = equipo.ubicacion?.nombre ?? "Sin ubicacion";

            const sistemaOperativo =
              equipo.sistema_operativo ?? "Sin sistema operativo";

            const esWindows10 = sistemaOperativo
              .toLowerCase()
              .includes("windows 10");

            const tieneSoPrecio =
              equipo.so_precio !== null &&
              equipo.so_precio !== undefined &&
              equipo.so_precio !== 0;

            const soPrecioTexto = tieneSoPrecio
              ? formatearImporte(equipo.so_precio)
              : null;

            const procesador = equipo.procesador ?? "Sin procesador";

            const tarjetaGrafica =
              equipo.tarjeta_grafica ?? "Sin tarjeta grafica";

            const nombreEquipo = equipo.nombre ?? "Equipo sin nombre";

            const observaciones =
              equipo.observaciones && equipo.observaciones.trim().length > 0
                ? equipo.observaciones.trim()
                : null;

            const soSerial = equipo.so_serial ?? "Sin numero de serie SO";

            const numeroSerie = equipo.numero_serie ?? "Sin numero de serie";

            const partNumber = equipo.part_number ?? "Sin part number";

            const admiteUpdateTexto =
              equipo.admite_update === null ||
              equipo.admite_update === undefined
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

            const pantallas = Array.isArray(equipo.pantallas)
              ? equipo.pantallas
              : [];

            const ramTexto = equipo.ram ? `${equipo.ram} GB RAM` : "";

            const ssdTexto = equipo.ssd ? `${equipo.ssd} GB SSD` : "";

            const hddTexto = equipo.hdd ? `${equipo.hdd} GB HDD` : "";

            const almacenamiento = [ramTexto, ssdTexto, hddTexto]
              .filter(Boolean)
              .join(" - ");

            const motivoIa = iaDestacadosMapa.get(equipo.id) ?? null;

            const esDestacadoIa = iaDestacadosMapa.has(equipo.id);

            const obtenerTimestampActuacion = (valor: string | null | undefined) => {
              if (!valor) return Number.NEGATIVE_INFINITY;
              const time = new Date(valor).getTime();
              return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
            };

            const actuacionesOrdenadas = Array.isArray(equipo.actuaciones)
              ? equipo.actuaciones
                  .slice()
                  .sort(
                    (a, b) =>
                      obtenerTimestampActuacion(b.fecha) -
                      obtenerTimestampActuacion(a.fecha),
                  )
              : [];

            return (
              <li
                key={equipo.id}
                className="relative flex flex-col gap-3 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm"
              >
                <Link
                  href={`/equipos/${equipo.id}/editar`}
                  aria-label={`Editar ${nombreEquipo}`}
                  className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/60 text-foreground/60 transition hover:bg-background hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/50"
                >
                  <svg
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path
                      d="M4.5 12.75V15.5h2.75L15 7.75 12.25 5l-7.75 7.75Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="m11.5 5.5 3 3"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>

                <div className="space-y-1 pr-10">
                  {iaResultado && esDestacadoIa ? (
                    <div className="mb-1 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold text-amber-800">
                      IA: {motivoIa ?? "Marcado como bajo retorno"}
                    </div>
                  ) : null}

                  <h3 className="text-lg font-semibold text-foreground">
                    {nombreEquipo}
                  </h3>

                  <p className="text-xs font-semibold italic text-foreground/60">
                    {usuario}
                  </p>

                  <p className="text-sm text-foreground/70">
                    {fabricante}

                    {equipo.modelo ? ` ${equipo.modelo}` : ""}
                  </p>

                  <p className="text-sm text-foreground/70">{procesador}</p>

                  {almacenamiento ? (
                    <p className="text-sm text-foreground/70">
                      {almacenamiento}
                    </p>
                  ) : null}

                  <p className="text-sm text-foreground/70">{tarjetaGrafica}</p>

                  <p
                    className={`text-sm ${esWindows10 ? "text-red-500" : "text-foreground/70"}`}
                  >
                    {tieneSoPrecio
                      ? `${sistemaOperativo} - ${soPrecioTexto}`
                      : sistemaOperativo}
                  </p>

                  <p className="text-[9px] leading-tight text-foreground/70">
                    SO serial: {soSerial}
                  </p>

                  <p className="text-sm text-foreground/70">
                    Numero serie: {numeroSerie}
                  </p>

                  <p className="text-sm text-foreground/70">
                    Part number: {partNumber}
                  </p>

                  <p className="text-sm text-foreground/70">
                    Admite update: {admiteUpdateTexto}
                  </p>

                  <div className="border-t border-border/60 pt-2" />
                </div>

                <dl className="grid gap-2 text-sm text-foreground/80">
                  <div className="flex justify-between gap-3">
                    <dt className="font-medium text-foreground/70">
                      Ubicacion
                    </dt>

                    <dd className="text-foreground">{ubicacion}</dd>
                  </div>

                  <div className="flex justify-between gap-3">
                    <dt className="font-medium text-foreground/70">Tipo</dt>

                    <dd className="text-foreground">{tipo}</dd>
                  </div>

                  <div className="flex justify-between gap-3">
                    <dt className="font-medium text-foreground/70">
                      Fecha compra
                    </dt>

                    <dd className="text-foreground">
                      {formatearFecha(equipo.fecha_compra)}
                    </dd>
                  </div>

                  <div className="flex justify-between gap-3">
                    <dt className="font-medium text-foreground/70">
                      Precio compra
                    </dt>

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

                    <dd className="text-foreground">
                      {equipo.en_garantia ? "Si" : "No"}
                    </dd>
                  </div>

                  <div className="flex justify-between gap-3">
                    <dt className="font-medium text-foreground/70">
                      Al garbigune
                    </dt>

                    <dd className="text-foreground">{alGarbiguneTexto}</dd>
                  </div>

                  {observaciones ? (
                    <div className="flex flex-col gap-1 border-t border-border/60 pt-2">
                      <dt className="font-medium text-foreground/70">
                        Observaciones
                      </dt>

                      <dd className="text-foreground whitespace-pre-line">
                        {observaciones}
                      </dd>
                    </div>
                  ) : null}
                </dl>

                {actuacionesOrdenadas.length > 0 ? (
                  <div className="border-t border-border/60 pt-3">
                    <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground/60">
                      Actuaciones
                    </h4>

                    <ul className="flex flex-col gap-3 text-xs text-foreground/70">
                      {actuacionesOrdenadas.map((actuacion) => {
                        const fechaTexto = formatearFecha(actuacion.fecha ?? null);

                        const costeValor =
                          typeof actuacion.coste === "number"
                            ? actuacion.coste
                            : actuacion.coste !== null &&
                                actuacion.coste !== undefined &&
                                actuacion.coste !== ""
                              ? Number(actuacion.coste)
                              : null;

                        const costeTexto =
                          costeValor !== null && Number.isFinite(costeValor)
                            ? formatearImporte(costeValor)
                            : null;

                        return (
                          <li
                            key={actuacion.id}
                            className="rounded-lg border border-border/60 bg-background/40 px-3 py-2"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-foreground/80">
                              <span className="text-xs font-semibold uppercase tracking-wide">
                                {actuacion.tipo}
                              </span>

                              <div className="flex items-center gap-2 text-[11px] font-medium text-foreground/60">
                                {fechaTexto ? (
                                  <span>{fechaTexto}</span>
                                ) : null}
                                {costeTexto ? (
                                  <span className="rounded bg-foreground/10 px-2 py-[1px] text-[10px] font-semibold text-foreground/70">
                                    {costeTexto}
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            {actuacion.descripcion ? (
                              <p className="mt-1 whitespace-pre-line text-[11px] leading-relaxed text-foreground/70">
                                {actuacion.descripcion}
                              </p>
                            ) : null}

                            {actuacion.hecha_por ? (
                              <p className="mt-1 text-[10px] uppercase tracking-wide text-foreground/50">
                                Hecha por: {actuacion.hecha_por}
                              </p>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}

                {pantallas.length > 0 ? (
                  <div className="border-t border-border/60 pt-3">
                    <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground/60">
                      Pantallas conectadas
                    </h4>

                    <div
                      className="flex flex-wrap gap-3"
                      aria-label="Pantallas conectadas"
                    >
                      {pantallas.map((pantalla, index) => {
                        const etiquetaFabricante =
                          pantalla?.fabricanteNombre ?? "";

                        const etiquetaModelo = pantalla?.modelo ?? "";

                        const descripcion =
                          `${etiquetaFabricante} ${etiquetaModelo}`.trim() ||
                          "Pantalla";

                        const pulgadasTexto =
                          pantalla?.pulgadas !== null &&
                          pantalla?.pulgadas !== undefined
                            ? `${pantalla.pulgadas}`
                            : "?";

                        return (
                          <div
                            key={
                              pantalla?.id ?? `${equipo.id}-pantalla-${index}`
                            }
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
