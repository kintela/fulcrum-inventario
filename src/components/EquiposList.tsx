"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";

import { formatearFecha, formatearImporte } from "@/lib/format";

import type { EquipoRecord, PantallaRecord } from "@/lib/supabase";

function obtenerTimestamp(fecha: string | null | undefined): number {
  if (!fecha) return Number.NEGATIVE_INFINITY;

  const time = new Date(fecha).getTime();

  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

const tipoLabels: Record<string, string> = {
  sobremesa: "Sobremesa",

  portatil: "Portatil",

  tablet: "Tablet",

  servidor: "Servidor",
};

type EquiposListProps = {
  equipos: EquipoRecord[];

  pantallasSinEquipo?: PantallaRecord[];

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
  pantallasSinEquipo = [],

  filtroTipo = null,

  filtroAnio = null,
}: EquiposListProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [iaPrompt, setIaPrompt] = useState("");
  const [mostrarPanelIa, setMostrarPanelIa] = useState(false);

  const getStringParam = (key: string) => searchParams?.get(key) ?? "";
  const getBoolParam = (key: string, defaultValue: boolean) => {
    const value = searchParams?.get(key);
    if (value === null) return defaultValue;
    if (value === "1") return true;
    if (value === "0") return false;
    return defaultValue;
  };
  const getNumberParam = (key: string) => {
    const value = searchParams?.get(key);
    if (!value) return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const getListParam = (key: string) => {
    const value = searchParams?.get(key);
    if (!value) return [];
    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  };

  const [searchTerm, setSearchTerm] = useState<string>(() =>
    getStringParam("q"),
  );
  const [mostrarAsignados, setMostrarAsignados] = useState<boolean>(() =>
    getBoolParam("asignados", true),
  );
  const [mostrarSinAsignar, setMostrarSinAsignar] = useState<boolean>(() =>
    getBoolParam("sinAsignar", true),
  );
  const [sistemaOperativoSeleccionado, setSistemaOperativoSeleccionado] =
    useState<string>(() => getStringParam("so"));
  const [ubicacionSeleccionada, setUbicacionSeleccionada] = useState<string>(
    () => getStringParam("ubicacion"),
  );
  const [fabricanteSeleccionado, setFabricanteSeleccionado] = useState<string>(
    () => getStringParam("fabricante"),
  );
  const [tipoSeleccionado, setTipoSeleccionado] = useState<string>(() =>
    getStringParam("tipoFiltro"),
  );
  const [antiguedadMinima, setAntiguedadMinima] = useState<number | null>(() =>
    getNumberParam("antiguedad"),
  );
  const [mostrarAdmitenUpdate, setMostrarAdmitenUpdate] = useState<boolean>(
    () => getBoolParam("admite", true),
  );
  const [mostrarNoAdmitenUpdate, setMostrarNoAdmitenUpdate] =
    useState<boolean>(() => getBoolParam("noadmite", true));
  const [mostrarGarbiguneSi, setMostrarGarbiguneSi] = useState<boolean>(() =>
    getBoolParam("garbiguneSi", true),
  );
  const [mostrarGarbiguneNo, setMostrarGarbiguneNo] = useState<boolean>(() =>
    getBoolParam("garbiguneNo", true),
  );
  const [usuariosSeleccionados, setUsuariosSeleccionados] = useState<string[]>(
    () => getListParam("usuarios"),
  );
  const [mostrarEquipos, setMostrarEquipos] = useState<boolean>(() =>
    getBoolParam("equipos", true),
  );
  const [mostrarPantallas, setMostrarPantallas] = useState<boolean>(() =>
    getBoolParam("pantallas", false),
  );
  const [pantallaPulgadasSeleccionadas, setPantallaPulgadasSeleccionadas] =
    useState<string>(() => getStringParam("pulgadas"));
  const currentQueryString = searchParams?.toString() ?? "";
  const fromQueryParam = currentQueryString
    ? `from=${encodeURIComponent(currentQueryString)}`
    : "";
  const router = useRouter();
  const handleSearchInputChange = (value: string) => {
    setSearchTerm(value);
    setIaResultado(null);
    setIaDestacados([]);
    setRespuestaIa(null);
    setErrorIa(null);
  };

  useEffect(() => {
    const params = new URLSearchParams();
    if (searchTerm) params.set("q", searchTerm);
    if (!mostrarAsignados) params.set("asignados", "0");
    if (!mostrarSinAsignar) params.set("sinAsignar", "0");
    if (sistemaOperativoSeleccionado)
      params.set("so", sistemaOperativoSeleccionado);
    if (ubicacionSeleccionada)
      params.set("ubicacion", ubicacionSeleccionada);
    if (fabricanteSeleccionado)
      params.set("fabricante", fabricanteSeleccionado);
    if (tipoSeleccionado) params.set("tipoFiltro", tipoSeleccionado);
    if (antiguedadMinima !== null)
      params.set("antiguedad", String(antiguedadMinima));
    if (!mostrarAdmitenUpdate) params.set("admite", "0");
    if (!mostrarNoAdmitenUpdate) params.set("noadmite", "0");
    if (!mostrarGarbiguneSi) params.set("garbiguneSi", "0");
    if (!mostrarGarbiguneNo) params.set("garbiguneNo", "0");
    if (usuariosSeleccionados.length > 0)
      params.set("usuarios", usuariosSeleccionados.join(","));
    if (!mostrarEquipos) params.set("equipos", "0");
    if (mostrarPantallas) params.set("pantallas", "1");
    if (pantallaPulgadasSeleccionadas)
      params.set("pulgadas", pantallaPulgadasSeleccionadas);

    const newQuery = params.toString();
    if (newQuery !== currentQueryString) {
      const targetUrl = newQuery ? `${pathname}?${newQuery}` : pathname;
      router.replace(targetUrl, { scroll: false });
    }
  }, [
    searchTerm,
    mostrarAsignados,
    mostrarSinAsignar,
    sistemaOperativoSeleccionado,
    ubicacionSeleccionada,
    fabricanteSeleccionado,
    tipoSeleccionado,
    antiguedadMinima,
    mostrarAdmitenUpdate,
    mostrarNoAdmitenUpdate,
    mostrarGarbiguneSi,
    mostrarGarbiguneNo,
    usuariosSeleccionados,
    mostrarEquipos,
    mostrarPantallas,
    pantallaPulgadasSeleccionadas,
    currentQueryString,
    pathname,
    router,
  ]);

  const [equipoEliminandoId, setEquipoEliminandoId] = useState<string | null>(
    null,
  );
  const [pantallaEliminandoId, setPantallaEliminandoId] = useState<
    number | null
  >(null);
  const [pantallaDesvinculandoId, setPantallaDesvinculandoId] = useState<
    number | null
  >(null);

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

  const handleEliminarEquipo = useCallback(
    async (equipoId: string) => {
      setEquipoEliminandoId(equipoId);
      try {
        const respuesta = await fetch(`/api/equipos/${equipoId}`, {
          method: "DELETE",
        });
        if (!respuesta.ok) {
          let detalle = "No se pudo eliminar el equipo.";
          try {
            const data = await respuesta.json();
            if (data?.error) detalle = data.error;
          } catch {
            // ignore json parse errors
          }
          throw new Error(detalle);
        }
        router.refresh();
      } catch (error) {
        console.error(error);
        // Silenciar, el diálogo muestra el error antes del envío
      } finally {
        setEquipoEliminandoId(null);
      }
    },
    [router],
  );

  const handleEliminarPantalla = useCallback(
    async (pantallaId: number) => {
      setPantallaEliminandoId(pantallaId);
      try {
        const respuesta = await fetch(`/api/pantallas/${pantallaId}`, {
          method: "DELETE",
        });
        if (!respuesta.ok) {
          let detalle = "No se pudo eliminar la pantalla.";
          try {
            const data = await respuesta.json();
            if (data?.error) detalle = data.error;
          } catch {
            // ignore json parse errors
          }
          throw new Error(detalle);
        }
        router.refresh();
      } catch (error) {
        console.error(error);
      } finally {
        setPantallaEliminandoId(null);
      }
    },
    [router],
  );

  const handleDesvincularPantalla = useCallback(
    async (pantallaId: number) => {
      setPantallaDesvinculandoId(pantallaId);
      try {
        const respuesta = await fetch(`/api/pantallas/${pantallaId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ equipo_id: null }),
        });
        if (!respuesta.ok) {
          let detalle = "No se pudo desvincular la pantalla.";
          try {
            const data = await respuesta.json();
            if (data?.error) detalle = data.error;
          } catch {
            // ignore json parse errors
          }
          throw new Error(detalle);
        }
        router.refresh();
      } catch (error) {
        console.error(error);
      } finally {
        setPantallaDesvinculandoId(null);
      }
    },
    [router],
  );

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

  const fabricantesDisponibles = useMemo(() => {
    const valores = new Set<string>();

    equipos.forEach((equipo) => {
      const nombre = equipo.fabricante?.nombre;
      if (typeof nombre === "string") {
        const limpio = nombre.trim();
        if (limpio) valores.add(limpio);
      }
    });

    return Array.from(valores).sort((a, b) => a.localeCompare(b, "es"));
  }, [equipos]);

  const usuariosDisponibles = useMemo(() => {
    const mapa = new Map<string, string>();

    equipos.forEach((equipo) => {
      if (equipo.usuario_id === null || equipo.usuario_id === undefined)
        return;

      const nombre = obtenerNombreUsuario(equipo);
      if (!nombre) return;

      const id = String(equipo.usuario_id);
      if (!mapa.has(id)) mapa.set(id, nombre);
    });

    return Array.from(mapa.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
  }, [equipos]);

  const opcionesAntiguedad = useMemo(
    () => Array.from({ length: 20 }, (_, indice) => indice + 1),

    [],
  );

  async function consultarIA() {
    const prompt = iaPrompt.trim();

    if (!prompt) return;

    setCargandoIa(true);

    setErrorIa(null);

    setRespuestaIa(null);

    setIaResultado(null);

    setIaDestacados([]);

    setSearchTerm("");
    setIaPrompt(prompt);

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
      setMostrarPanelIa(false);
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
    setIaPrompt("");
  }

  function limpiarFiltros() {
    limpiarFiltroIa();
    setMostrarPanelIa(false);
    handleSearchInputChange("");
    setMostrarAsignados(true);
    setMostrarSinAsignar(true);
    setSistemaOperativoSeleccionado("");
    setUbicacionSeleccionada("");
    setFabricanteSeleccionado("");
    setTipoSeleccionado("");
    setAntiguedadMinima(null);
    setMostrarAdmitenUpdate(true);
    setMostrarNoAdmitenUpdate(true);
    setMostrarGarbiguneSi(true);
    setMostrarGarbiguneNo(true);
    setUsuariosSeleccionados([]);
    setMostrarEquipos(true);
    setMostrarPantallas(false);
    setPantallaPulgadasSeleccionadas("");
  }

  function manejarCambioMostrarEquipos(checked: boolean) {
    if (!checked && !mostrarPantallas) {
      setMostrarPantallas(true);
    }

    setMostrarEquipos(checked);
  }

  function manejarCambioMostrarPantallas(checked: boolean) {
    if (!checked && !mostrarEquipos) {
      setMostrarEquipos(true);
    }

    setMostrarPantallas(checked);
  }

  const baseFiltrados = useMemo(() => {
    let dataset = equipos;
    const usuariosSeleccionadosSet = new Set(usuariosSeleccionados);

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

      const usuarioId =
        equipo.usuario_id !== null && equipo.usuario_id !== undefined
          ? String(equipo.usuario_id)
          : null;

      if (
        usuariosSeleccionadosSet.size > 0 &&
        (!usuarioId || !usuariosSeleccionadosSet.has(usuarioId))
      )
        return false;

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

      if (fabricanteSeleccionado) {
        const fabricanteNombre = equipo.fabricante?.nombre?.trim() ?? "";
        if (fabricanteNombre !== fabricanteSeleccionado) return false;
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

        if (antiguedad === null || antiguedad < antiguedadMinima) return false;
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

    return [...dataset].sort(
      (a, b) =>
        obtenerTimestamp(b.fecha_compra) - obtenerTimestamp(a.fecha_compra),
    );
  }, [
    equipos,

    filtroTipo,

    filtroAnio,

    mostrarAsignados,

    mostrarSinAsignar,

    sistemaOperativoSeleccionado,

    ubicacionSeleccionada,

    fabricanteSeleccionado,

    tipoSeleccionado,

    antiguedadMinima,

    mostrarAdmitenUpdate,

    mostrarNoAdmitenUpdate,

    mostrarGarbiguneSi,

    mostrarGarbiguneNo,

    usuariosSeleccionados,

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

  const pantallasVisibles = useMemo(() => {
    const lista: Array<{
      id: number;
      equipoId: string | null;
      equipoNombre: string;
      usuarioId: string | null;
      modelo: string | null;
      fabricanteNombre: string | null;
      pulgadas: number | null;
      precio: number | null;
      fechaCompra: string | null;
      enGarantia: boolean | null;
      sinEquipo: boolean;
      thumbnailUrl: string | null;
    }> = [];

    const terminoBusqueda = iaResultado
      ? ""
      : searchTerm.trim().toLowerCase();

    const coincideConBusqueda = (valores: unknown[]) => {
      if (!terminoBusqueda) return true;

      return valores.some((valor) =>
        normalizarValor(valor).includes(terminoBusqueda),
      );
    };

    filtrados.forEach((equipo) => {
      if (!Array.isArray(equipo.pantallas)) return;

      equipo.pantallas.forEach((pantalla) => {
        if (!pantalla) return;

        const precio =
          typeof pantalla.precio === "number" ? pantalla.precio : null;

        lista.push({
          id: pantalla.id,
          equipoId: equipo.id,
          equipoNombre: equipo.nombre ?? "Equipo sin nombre",
          usuarioId:
            equipo.usuario_id !== null && equipo.usuario_id !== undefined
              ? String(equipo.usuario_id)
              : null,
          modelo: pantalla.modelo ?? null,
          fabricanteNombre: pantalla.fabricanteNombre ?? null,
          pulgadas:
            typeof pantalla.pulgadas === "number" ? pantalla.pulgadas : null,
          precio,
          fechaCompra: pantalla.fecha_compra ?? null,
          enGarantia:
            pantalla.en_garantia === null || pantalla.en_garantia === undefined
              ? null
              : pantalla.en_garantia,
          sinEquipo: false,
          thumbnailUrl: pantalla.thumbnailUrl ?? null,
        });
      });
    });

    pantallasSinEquipo.forEach((pantalla) => {
      if (!pantalla) return;

      if (
        !coincideConBusqueda([
          pantalla.modelo,
          pantalla.fabricanteNombre,
          pantalla.pulgadas,
          pantalla.precio,
        ])
      ) {
        return;
      }

      const precio =
        typeof pantalla.precio === "number" ? pantalla.precio : null;

      lista.push({
        id: pantalla.id,
        equipoId: pantalla.equipo_id ?? null,
        equipoNombre: "Sin equipo asignado",
        usuarioId:
          pantalla.equipo_id !== null && pantalla.equipo_id !== undefined
            ? String(pantalla.equipo_id)
            : null,
        modelo: pantalla.modelo ?? null,
        fabricanteNombre: pantalla.fabricanteNombre ?? null,
        pulgadas:
          typeof pantalla.pulgadas === "number" ? pantalla.pulgadas : null,
        precio,
        fechaCompra: pantalla.fecha_compra ?? null,
        enGarantia:
          pantalla.en_garantia === null || pantalla.en_garantia === undefined
            ? null
            : pantalla.en_garantia,
        sinEquipo: true,
        thumbnailUrl: pantalla.thumbnailUrl ?? null,
      });
    });

    const usuariosSeleccionadosSet = new Set(usuariosSeleccionados);

    const listaFiltrada = lista.filter((pantalla) => {
      if (!mostrarAsignados && !pantalla.sinEquipo) return false;
      if (!mostrarSinAsignar && pantalla.sinEquipo) return false;

      if (usuariosSeleccionadosSet.size > 0) {
        if (!pantalla.usuarioId) return false;
        if (!usuariosSeleccionadosSet.has(pantalla.usuarioId)) return false;
      }

      if (!pantallaPulgadasSeleccionadas) return true;

      if (pantalla.pulgadas === null) {
        return pantallaPulgadasSeleccionadas === "sin_dato";
      }

      const valor = pantalla.pulgadas.toString();
      return valor === pantallaPulgadasSeleccionadas;
    });

    return listaFiltrada.sort(
      (a, b) => obtenerTimestamp(b.fechaCompra) - obtenerTimestamp(a.fechaCompra),
    );
  }, [
    filtrados,
    pantallasSinEquipo,
    searchTerm,
    iaResultado,
    pantallaPulgadasSeleccionadas,
    mostrarAsignados,
    mostrarSinAsignar,
    usuariosSeleccionados,
  ]);

  const pantallasPulgadasDisponibles = useMemo(() => {
    const valores = new Set<number>();
    let haySinDato = false;

    const registrar = (pulgadas: unknown) => {
      if (typeof pulgadas === "number" && Number.isFinite(pulgadas)) {
        valores.add(pulgadas);
      } else if (pulgadas === null || pulgadas === undefined) {
        haySinDato = true;
      }
    };

    filtrados.forEach((equipo) => {
      if (!Array.isArray(equipo.pantallas)) return;
      equipo.pantallas.forEach((pantalla) => {
        if (!pantalla) return;
        registrar(pantalla.pulgadas);
      });
    });

    pantallasSinEquipo.forEach((pantalla) => {
      registrar(pantalla?.pulgadas ?? null);
    });

    const opciones = Array.from(valores)
      .sort((a, b) => a - b)
      .map((valor) => ({
        value: valor.toString(),
        label: `${valor}"`,
      }));

    if (haySinDato) {
      opciones.push({ value: "sin_dato", label: "Sin dato" });
    }

    return opciones;
  }, [filtrados, pantallasSinEquipo]);

  const equiposResultadosTexto =
    iaResultado
      ? `${filtrados.length} resultado${filtrados.length === 1 ? "" : "s"}`
      : searchTerm
        ? `${filtrados.length} de ${baseFiltrados.length} resultados`
        : filtrados.length === 1
          ? "1 resultado"
          : `${filtrados.length} resultados`;

  const pantallasResultadosTexto = `${pantallasVisibles.length} pantalla${
    pantallasVisibles.length === 1 ? "" : "s"
  }`;

  let resumenResultados = equiposResultadosTexto;

  if (mostrarEquipos && mostrarPantallas) {
    resumenResultados = `${equiposResultadosTexto} - ${pantallasResultadosTexto}`;
  } else if (!mostrarEquipos && mostrarPantallas) {
    resumenResultados = pantallasResultadosTexto;
  }

  return (
    <section aria-label="Listado de equipos" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-sm text-foreground/70">
              Buscar en todos los campos
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => handleSearchInputChange(event.target.value)}
                placeholder="Filtra por nombre, usuario, sistema operativo, etc."
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground shadow-sm focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/20"
              />
            </label>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={limpiarFiltros}
                className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-foreground/70 transition hover:bg-foreground/10 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40"
              >
                Limpiar filtros
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:gap-4">
          <fieldset className="flex flex-col gap-2 rounded-lg border border-border bg-card/40 px-3 py-2 text-xs text-foreground/80 sm:w-44">
            <legend className="font-semibold uppercase tracking-wide text-foreground/60">
              Asignacion
            </legend>

            <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={mostrarAsignados}
              onChange={(event) => setMostrarAsignados(event.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-border text-foreground focus:ring-2 focus:ring-foreground/30"
            />

              <span>Asignados</span>
            </label>

            <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={mostrarSinAsignar}
              onChange={(event) => setMostrarSinAsignar(event.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-border text-foreground focus:ring-2 focus:ring-foreground/30"
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
                className="h-4 w-4 cursor-pointer rounded border-border text-foreground focus:ring-2 focus:ring-foreground/30"
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
                className="h-4 w-4 cursor-pointer rounded border-border text-foreground focus:ring-2 focus:ring-foreground/30"
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
                className="h-4 w-4 cursor-pointer rounded border-border text-foreground focus:ring-2 focus:ring-foreground/30"
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
                className="h-4 w-4 cursor-pointer rounded border-border text-foreground focus:ring-2 focus:ring-foreground/30"
              />

              <span>No</span>
            </label>
          </fieldset>
          <fieldset className="flex flex-col gap-2 rounded-lg border border-border bg-card/40 px-3 py-2 text-xs text-foreground/80 sm:w-56">
            <legend className="font-semibold uppercase tracking-wide text-foreground/60">
              Usuarios
            </legend>

            {usuariosDisponibles.length > 0 ? (
              <>
                <select
                  multiple
                  value={usuariosSeleccionados}
                  onChange={(event) =>
                    setUsuariosSeleccionados(
                      Array.from(
                        event.currentTarget.selectedOptions,
                        (option) => option.value,
                      ),
                    )
                  }
                  className="min-h-[3.5rem] rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/20"
                >
                  {usuariosDisponibles.map((usuario) => (
                    <option key={usuario.id} value={usuario.id}>
                      {usuario.nombre}
                    </option>
                  ))}
                </select>

                <span className="text-[11px] text-foreground/50">
                  Usa Ctrl o Cmd para seleccionar varios usuarios.
                </span>

                {usuariosSeleccionados.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setUsuariosSeleccionados([])}
                    className="self-start rounded border border-border bg-background px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-foreground/70 transition hover:bg-foreground/10 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/30"
                  >
                    Limpiar
                  </button>
                ) : null}
              </>
            ) : (
              <span className="text-foreground/50">
                No hay usuarios asignados.
              </span>
            )}
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

          {mostrarPantallas && (
            <label className="flex flex-col gap-1 rounded-lg border border-border bg-card/40 px-3 py-2 text-xs text-foreground/80 sm:w-48">
              <span className="font-semibold uppercase tracking-wide text-foreground/60">
                Pulgadas pantalla
              </span>

              <select
                value={pantallaPulgadasSeleccionadas}
                onChange={(event) =>
                  setPantallaPulgadasSeleccionadas(event.target.value)
                }
                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
              >
                <option value="">Todas</option>
                {pantallasPulgadasDisponibles.map((opcion) => (
                  <option key={opcion.value} value={opcion.value}>
                    {opcion.label}
                  </option>
                ))}
              </select>
            </label>
          )}

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

          <label className="flex flex-col gap-1 rounded-lg border border-border bg-card/40 px-3 py-2 text-xs text-foreground/80 sm:w-48">
            <span className="font-semibold uppercase tracking-wide text-foreground/60">
              Fabricante
            </span>

            <select
              value={fabricanteSeleccionado}
              onChange={(event) =>
                setFabricanteSeleccionado(event.target.value)
              }
              className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/20"
            >
              <option value="">Todos</option>

              {fabricantesDisponibles.map((fabricante) => (
                <option key={fabricante} value={fabricante}>
                  {fabricante}
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
                  {`≥ ${opcion}`}
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

      <div className="flex flex-col gap-2 text-sm text-foreground/60 sm:flex-row sm:items-center sm:justify-between">
        <div>{resumenResultados}</div>

        <div className="flex items-center gap-4 text-xs text-foreground/70 sm:text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={mostrarEquipos}
              onChange={(event) =>
                manejarCambioMostrarEquipos(event.target.checked)
              }
              className="h-4 w-4 cursor-pointer rounded border-border text-foreground focus:ring-2 focus:ring-foreground/30"
            />

            <span>Equipos</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={mostrarPantallas}
              onChange={(event) =>
                manejarCambioMostrarPantallas(event.target.checked)
              }
              className="h-4 w-4 cursor-pointer rounded border-border text-foreground focus:ring-2 focus:ring-foreground/30"
            />

            <span>Pantallas</span>
          </label>
        </div>
      </div>

      {mostrarEquipos &&
        (equipos.length === 0 ? (
          <p className="text-sm text-foreground/60">
            No hay equipos registrados todavia. Anade el primero desde el panel
            de gestion.
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

            const actuacionesOrdenadas = Array.isArray(equipo.actuaciones)
              ? equipo.actuaciones
                  .slice()
                  .sort(
                    (a, b) =>
                      obtenerTimestamp(b.fecha) - obtenerTimestamp(a.fecha),
                  )
              : [];
            const estaEliminandoEquipo = equipoEliminandoId === equipo.id;

            return (
              <li
                key={equipo.id}
                className="relative flex flex-col gap-3 rounded-xl border border-border bg-card p-5 pb-14 text-card-foreground shadow-sm"
              >
                <Link
                  href={
                    fromQueryParam
                      ? `/equipos/${equipo.id}/editar?${fromQueryParam}`
                      : `/equipos/${equipo.id}/editar`
                  }
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

                {pantallas.length > 0 || equipo.thumbnailUrl ? (
                  <div className="border-t border-border/60 pt-3">
                    <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground/60">
                      Pantallas conectadas
                    </h4>

                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div
                        className="flex min-w-[180px] flex-1 flex-wrap gap-3"
                        aria-label="Pantallas conectadas"
                      >
                        {pantallas.length > 0 ? (
                          pantallas.map((pantalla, index) => {
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

                        const idPantalla = pantalla?.id;
                        const miniaturaUrl =
                          pantalla?.thumbnailUrl ?? null;
                        const estaDesvinculando =
                          typeof idPantalla === "number" &&
                          pantallaDesvinculandoId === idPantalla;

                            return (
                              <div
                                key={
                                  idPantalla ?? `${equipo.id}-pantalla-${index}`
                                }
                                className="relative flex w-24 flex-col items-center gap-1 text-center text-foreground/70"
                              >
                                {typeof idPantalla === "number" ? (
                                  <Link
                                    href={
                                      fromQueryParam
                                        ? `/pantallas/${idPantalla}/editar?${fromQueryParam}`
                                        : `/pantallas/${idPantalla}/editar`
                                    }
                                    aria-label={`Editar pantalla ${descripcion}`}
                                    title="Editar pantalla"
                                    className="absolute -left-2 -top-2 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full border border-border/60 bg-background/80 text-foreground/60 transition hover:bg-background hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40"
                                  >
                                <svg
                                  viewBox="0 0 20 20"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-3 w-3"
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
                            ) : null}

                                {typeof idPantalla === "number" ? (
                                  <AlertDialogPrimitive.Root>
                                    <AlertDialogPrimitive.Trigger asChild>
                                      <button
                                        type="button"
                                        aria-label="Desvincular pantalla"
                                    title="Desvincular pantalla"
                                    disabled={estaDesvinculando}
                                    className="absolute -right-2 -top-2 z-10 inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-red-500 text-background transition hover:bg-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <svg
                                      viewBox="0 0 20 20"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                      className="h-3 w-3"
                                      aria-hidden="true"
                                    >
                                      <path
                                        d="M6 6l8 8m0-8l-8 8"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                      />
                                    </svg>
                                  </button>
                                </AlertDialogPrimitive.Trigger>
                                <AlertDialogPrimitive.Portal>
                                  <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
                                  <AlertDialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-6 text-card-foreground shadow-xl focus:outline-none">
                                    <div className="space-y-2">
                                      <AlertDialogPrimitive.Title className="text-lg font-semibold text-foreground">
                                        Desvincular pantalla
                                      </AlertDialogPrimitive.Title>
                                      <AlertDialogPrimitive.Description className="text-sm text-foreground/70">
                                        ¿Seguro que quieres desvincular{" "}
                                        <span className="font-medium text-foreground">
                                          {descripcion}
                                        </span>
                                        ? La pantalla pasará a la lista de pantallas sin asignar.
                                      </AlertDialogPrimitive.Description>
                                    </div>
                                    <div className="mt-6 flex justify-end gap-2">
                                      <AlertDialogPrimitive.Cancel className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground/70 transition hover:bg-foreground/10">
                                        Cancelar
                                      </AlertDialogPrimitive.Cancel>
                                      <AlertDialogPrimitive.Action
                                        className="rounded-md bg-red-500 px-3 py-1.5 text-sm font-semibold text-background transition hover:bg-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                                        onClick={() =>
                                          handleDesvincularPantalla(idPantalla)
                                        }
                                      >
                                        Desvincular
                                      </AlertDialogPrimitive.Action>
                                    </div>
                                  </AlertDialogPrimitive.Content>
                                </AlertDialogPrimitive.Portal>
                              </AlertDialogPrimitive.Root>
                            ) : null}

                            <div className="relative aspect-[16/10] w-full overflow-hidden rounded-md border border-border bg-foreground/[0.04]">
                              {miniaturaUrl ? (
                                <>
                                  <img
                                    src={miniaturaUrl}
                                    alt={`Foto de ${descripcion}`}
                                    className="absolute inset-0 h-full w-full object-cover"
                                    loading="lazy"
                                  />
                                  <span className="absolute inset-x-0 bottom-0 bg-black/50 px-1 text-[10px] font-semibold text-white">
                                    {pulgadasTexto}"
                                  </span>
                                </>
                              ) : (
                                <span className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-foreground">
                                  {pulgadasTexto}
                                </span>
                              )}
                            </div>

                                <span className="line-clamp-2 text-[10px] leading-tight text-foreground/60">
                                  {descripcion}
                                </span>
                              </div>
                            );
                          })
                        ) : (
                          <span className="rounded border border-dashed border-border px-3 py-2 text-xs text-foreground/50">
                            Sin pantallas conectadas
                          </span>
                        )}
                      </div>

                      {equipo.thumbnailUrl ? (
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <div className="h-20 w-28 overflow-hidden rounded-md border border-border/60 bg-background/80 shadow-sm">
                            <img
                              src={equipo.thumbnailUrl}
                              alt={`Foto de ${nombreEquipo}`}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          </div>
                          <span className="text-[10px] uppercase tracking-wide text-foreground/50">
                            Equipo
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <AlertDialogPrimitive.Root>
                  <AlertDialogPrimitive.Trigger asChild>
                    <button
                      type="button"
                      aria-label={`Eliminar ${nombreEquipo}`}
                      title="Eliminar equipo"
                      disabled={estaEliminandoEquipo}
                      className="absolute bottom-4 right-4 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-red-500 text-background transition hover:bg-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <svg
                        viewBox="0 0 20 20"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        aria-hidden="true"
                      >
                        <path
                          d="M5 6h10M8 6v8m4-8v8M7 6l.447-1.341A1 1 0 0 1 8.404 4h3.192a1 1 0 0 1 .957.659L13 6m-8 0v9a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </AlertDialogPrimitive.Trigger>
                  <AlertDialogPrimitive.Portal>
                    <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
                    <AlertDialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-6 text-card-foreground shadow-xl focus:outline-none">
                      <div className="space-y-2">
                        <AlertDialogPrimitive.Title className="text-lg font-semibold text-foreground">
                          Eliminar equipo
                        </AlertDialogPrimitive.Title>
                        <AlertDialogPrimitive.Description className="text-sm text-foreground/70">
                          ¿Seguro que quieres eliminar{" "}
                          <span className="font-medium text-foreground">
                            {nombreEquipo}
                          </span>
                          ? Esta acción no se puede deshacer.
                        </AlertDialogPrimitive.Description>
                      </div>
                      <div className="mt-6 flex justify-end gap-2">
                        <AlertDialogPrimitive.Cancel className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground/70 transition hover:bg-foreground/10">
                          Cancelar
                        </AlertDialogPrimitive.Cancel>
                        <AlertDialogPrimitive.Action
                          className="rounded-md bg-red-500 px-3 py-1.5 text-sm font-semibold text-background transition hover:bg-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => handleEliminarEquipo(equipo.id)}
                        >
                          Eliminar
                        </AlertDialogPrimitive.Action>
                      </div>
                    </AlertDialogPrimitive.Content>
                  </AlertDialogPrimitive.Portal>
                </AlertDialogPrimitive.Root>
              </li>
            );
          })}
        </ul>
      ))}

      {mostrarPantallas ? (
        <div className={mostrarEquipos ? "mt-6" : ""}>
          {pantallasVisibles.length === 0 ? (
            <p className="text-sm text-foreground/60">
              No hay pantallas que coincidan con el filtro seleccionado.
            </p>
          ) : (
            <ul className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
              {pantallasVisibles.map((pantalla) => {
                const modeloBruto = pantalla.modelo?.trim();
                const modelo = modeloBruto && modeloBruto.length > 0 ? modeloBruto : null;
                const fabricante =
                  pantalla.fabricanteNombre ?? "Sin fabricante";
                const pulgadasTexto =
                  pantalla.pulgadas !== null ? `${pantalla.pulgadas}"` : "?";
                const precioTexto =
                  pantalla.precio !== null
                    ? formatearImporte(pantalla.precio)
                    : null;
                const fechaTexto = formatearFecha(pantalla.fechaCompra);
                const enGarantiaTexto =
                  pantalla.enGarantia === null
                    ? "Desconocido"
                    : pantalla.enGarantia
                      ? "Si"
                      : "No";
                const estaEliminandoPantalla =
                  pantallaEliminandoId === pantalla.id;
                const miniaturaUrl = pantalla.thumbnailUrl ?? null;

                return (
                  <li
                    key={`pantalla-${pantalla.id}`}
                    className="relative flex flex-col gap-3 rounded-xl border border-border bg-card p-5 pb-14 text-card-foreground shadow-sm"
                  >
                    <Link
                      href={
                        fromQueryParam
                          ? `/pantallas/${pantalla.id}/editar?${fromQueryParam}`
                          : `/pantallas/${pantalla.id}/editar`
                      }
                      aria-label={`Editar pantalla ${modelo}`}
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

                    {miniaturaUrl ? (
                      <div className="absolute bottom-4 left-4 h-12 w-12 overflow-hidden rounded-md border border-border/60 bg-background/80 shadow-sm">
                        <img
                          src={miniaturaUrl}
                          alt={`Foto de ${modelo ?? fabricante ?? `Pantalla ${pantalla.id}`}`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    ) : null}

                    <div className="space-y-1 pr-10">
                      <h3 className="text-lg font-semibold text-foreground">
                        {fabricante}
                        {modelo ? ` - ${modelo}` : ""}
                      </h3>

                      <p className="flex items-center gap-2 text-xs font-semibold italic text-foreground/60">
                        {pantalla.sinEquipo ? (
                          <span className="rounded-full bg-amber-100 px-2 py-[1px] text-[10px] font-semibold normal-case text-amber-800">
                            Sin equipo
                          </span>
                        ) : (
                          pantalla.equipoNombre
                        )}
                      </p>

                      <p className="text-sm text-foreground/70">
                        {pulgadasTexto ? `${pulgadasTexto}` : ""}
                      </p>

                      <p className="text-sm text-foreground/70">
                        En garantia: {enGarantiaTexto}
                      </p>

                      <p className="text-sm text-foreground/70">
                        Fecha compra: {fechaTexto ?? "-"}
                      </p>

                      {precioTexto ? (
                        <p className="text-sm text-foreground/70">
                          Precio: {precioTexto}
                        </p>
                      ) : null}
                    </div>

                    <AlertDialogPrimitive.Root>
                      <AlertDialogPrimitive.Trigger asChild>
                        <button
                          type="button"
                          aria-label={`Eliminar pantalla ${modelo ?? fabricante ?? pantalla.id}`}
                          title="Eliminar pantalla"
                          disabled={estaEliminandoPantalla}
                          className="absolute bottom-4 right-4 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-red-500 text-background transition hover:bg-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <svg
                            viewBox="0 0 20 20"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            aria-hidden="true"
                          >
                            <path
                              d="M5 6h10M8 6v8m4-8v8M7 6l.447-1.341A1 1 0 0 1 8.404 4h3.192a1 1 0 0 1 .957.659L13 6m-8 0v9a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </AlertDialogPrimitive.Trigger>
                      <AlertDialogPrimitive.Portal>
                        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
                        <AlertDialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-6 text-card-foreground shadow-xl focus:outline-none">
                          <div className="space-y-2">
                            <AlertDialogPrimitive.Title className="text-lg font-semibold text-foreground">
                              Eliminar pantalla
                            </AlertDialogPrimitive.Title>
                            <AlertDialogPrimitive.Description className="text-sm text-foreground/70">
                              ¿Seguro que quieres eliminar{" "}
                              <span className="font-medium text-foreground">
                                {modelo ?? fabricante ?? `Pantalla ${pantalla.id}`}
                              </span>
                              ? Esta acción no se puede deshacer.
                            </AlertDialogPrimitive.Description>
                          </div>
                          <div className="mt-6 flex justify-end gap-2">
                            <AlertDialogPrimitive.Cancel className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground/70 transition hover:bg-foreground/10">
                              Cancelar
                            </AlertDialogPrimitive.Cancel>
                            <AlertDialogPrimitive.Action
                              className="rounded-md bg-red-500 px-3 py-1.5 text-sm font-semibold text-background transition hover:bg-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={() => handleEliminarPantalla(pantalla.id)}
                            >
                              Eliminar
                            </AlertDialogPrimitive.Action>
                          </div>
                        </AlertDialogPrimitive.Content>
                      </AlertDialogPrimitive.Portal>
                    </AlertDialogPrimitive.Root>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
        {mostrarPanelIa ? (
          <div className="w-80 rounded-lg border border-border bg-card p-4 text-sm text-card-foreground shadow-xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path
                    d="M19 10V7a3 3 0 0 0-3-3H8a3 3 0 0 0-3 3v3m14 0h1a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-1m0-4V9a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v1m14 0h-1m-13 0H4a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h1m0-4h1m-1 4v3a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-3m-14 0h14"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>Asistente IA</span>
              </div>
              <button
                type="button"
                onClick={() => setMostrarPanelIa(false)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border text-xs font-semibold text-foreground/70 transition hover:bg-foreground/10"
                aria-label="Cerrar asistente IA"
              >
                ×
              </button>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                consultarIA();
              }}
              className="flex flex-col gap-3"
            >
              <textarea
                value={iaPrompt}
                onChange={(event) => setIaPrompt(event.target.value)}
                rows={4}
                placeholder="Escribe tu prompt para la IA"
                className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/20"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={limpiarFiltroIa}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground/70 transition hover:bg-foreground/10"
                >
                  Limpiar
                </button>
                <button
                  type="submit"
                  disabled={cargandoIa}
                  className="inline-flex items-center gap-2 rounded-md bg-foreground px-3 py-1.5 text-xs font-semibold text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {cargandoIa ? "Consultando..." : "Consultar"}
                </button>
              </div>
            </form>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setMostrarPanelIa((prev) => !prev)}
          className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background shadow-lg transition hover:bg-foreground/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40"
          aria-label="Abrir asistente de búsqueda IA"
          title="Asistente IA"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="h-6 w-6"
            aria-hidden="true"
          >
            <path
              d="M19 10V7a3 3 0 0 0-3-3H8a3 3 0 0 0-3 3v3m14 0h1a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-1m0-4V9a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v1m14 0h-1m-13 0H4a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h1m0-4h1m-1 4v3a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-3m-14 0h14"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </section>
  );
}

