"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FormEvent, MouseEvent } from "react";

import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";

import { formatearFecha, formatearImporte } from "@/lib/format";
import { verifyAdminPassword } from "@/lib/verifyAdminPassword";

import type {
  EquipoRecord,
  PantallaRecord,
  SwitchPortRecord,
} from "@/lib/supabase";

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
  almacenamiento: "Almacenamiento",
};

const TARJETA_RED_TOLERANCIA_GBPS = 0.001;

function obtenerTarjetaRedGbps(valor: unknown): number | null {
  if (valor === null || valor === undefined) return null;

  if (typeof valor === "number") {
    if (!Number.isFinite(valor)) return null;
    if (valor >= 1000) return valor / 1000;
    return valor;
  }

  if (typeof valor === "string") {
    const limpio = valor.trim();
    if (!limpio) return null;

    const match = limpio.match(/([\d.,]+)/);
    if (!match) return null;
    const parsed = Number.parseFloat(match[1].replace(",", "."));
    if (!Number.isFinite(parsed)) return null;

    const lower = limpio.toLowerCase();
    if (lower.includes("tbps") || lower.includes("tbit")) {
      return parsed * 1000;
    }
    if (lower.includes("gbps") || lower.includes("gbit") || lower.includes("giga")) {
      return parsed;
    }
    if (lower.includes("mbps") || lower.includes("mbit") || lower.includes("mega")) {
      return parsed / 1000;
    }
    if (lower.includes("kbps") || lower.includes("kbit")) {
      return parsed / 1_000_000;
    }
    if (lower.includes("bps")) {
      return parsed / 1_000_000_000;
    }
    return parsed;
  }

  return null;
}

function coincideVelocidadGbps(valor: number | null, objetivo: number): boolean {
  if (valor === null) return false;
  return Math.abs(valor - objetivo) < TARJETA_RED_TOLERANCIA_GBPS;
}

type EquiposListProps = {
  equipos: EquipoRecord[];

  pantallasSinEquipo?: PantallaRecord[];

  filtroTipo?: string | null;

  filtroAnio?: number | null;

  filtroPantallasAnio?: number | null;

  forzarMostrarPantallas?: boolean;

  mostrarSwitches?: boolean;

  onToggleSwitches?: (next: boolean) => void;
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
  filtroPantallasAnio = null,
  forzarMostrarPantallas = false,
  mostrarSwitches = false,
  onToggleSwitches,
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
  const [mostrarEquiposConUnaPantalla, setMostrarEquiposConUnaPantalla] =
    useState<boolean>(() => getBoolParam("pantallas1", false));
  const [mostrarEquiposConDosPantallas, setMostrarEquiposConDosPantallas] =
    useState<boolean>(() => getBoolParam("pantallas2", false));
  const [mostrarTarjetaRed1Gbps, setMostrarTarjetaRed1Gbps] = useState<boolean>(
    () => getBoolParam("tarjeta1g", false),
  );
  const [mostrarTarjetaRed10Gbps, setMostrarTarjetaRed10Gbps] =
    useState<boolean>(() => getBoolParam("tarjeta10g", false));
  const [mostrarAdminLocalConValor, setMostrarAdminLocalConValor] =
    useState<boolean>(() => getBoolParam("adminLocalCon", true));
  const [mostrarAdminLocalSinValor, setMostrarAdminLocalSinValor] =
    useState<boolean>(() => getBoolParam("adminLocalSin", true));
  const [mostrarSoloServidores, setMostrarSoloServidores] = useState<boolean>(
    () => getBoolParam("servidores", false),
  );
  const [mostrarSoloTablets, setMostrarSoloTablets] = useState<boolean>(
    () => getBoolParam("tablets", false),
  );
  const [mostrarSoloAlmacenamiento, setMostrarSoloAlmacenamiento] =
    useState<boolean>(() => getBoolParam("almacenamiento", false));
  const [mostrarSoloImpresoras, setMostrarSoloImpresoras] = useState<boolean>(
    () => getBoolParam("impresoras", false),
  );
  const [mostrarSoloWifi, setMostrarSoloWifi] = useState<boolean>(() =>
    getBoolParam("wifi", false),
  );
  const [adminLocalVerificandoId, setAdminLocalVerificandoId] =
    useState<string | null>(null);
  const [adminLocalDialog, setAdminLocalDialog] = useState<{
    equipoId: string;
    adminLocal: string;
  } | null>(null);
  const [adminLocalPassword, setAdminLocalPassword] = useState<string>("");
  const [adminLocalShowPassword, setAdminLocalShowPassword] =
    useState<boolean>(false);
  const [adminLocalError, setAdminLocalError] = useState<string | null>(null);
  const [adminLocalResultado, setAdminLocalResultado] = useState<string | null>(
    null,
  );
  const [adminLocalInfo, setAdminLocalInfo] = useState<string | null>(null);
  const currentQueryString = searchParams?.toString() ?? "";
  const fromQueryParam = currentQueryString
    ? `from=${encodeURIComponent(currentQueryString)}`
    : "";
  const router = useRouter();
  const [editPasswordDialog, setEditPasswordDialog] = useState<{
    href: string;
    context: string;
  } | null>(null);
  const [editPassword, setEditPassword] = useState("");
  const [editShowPassword, setEditShowPassword] = useState(false);
  const [editPasswordError, setEditPasswordError] = useState<string | null>(
    null,
  );
  const [isVerifyingEditPassword, setIsVerifyingEditPassword] =
    useState(false);

  useEffect(() => {
    if (!forzarMostrarPantallas) return;
    setMostrarPantallas(true);
    setMostrarEquipos(false);
  }, [forzarMostrarPantallas]);

  const prevMostrarSwitches = useRef(mostrarSwitches);
  useEffect(() => {
    const anterior = prevMostrarSwitches.current;
    if (!anterior && mostrarSwitches) {
      setMostrarEquipos(false);
      setMostrarPantallas(false);
    } else if (anterior && !mostrarSwitches) {
      if (
        !mostrarEquipos &&
        !mostrarPantallas &&
        !mostrarSoloServidores &&
        !mostrarSoloTablets &&
        !mostrarSoloAlmacenamiento &&
        !mostrarSoloImpresoras &&
        !mostrarSoloWifi
      ) {
        setMostrarEquipos(true);
      }
    }
    prevMostrarSwitches.current = mostrarSwitches;
  }, [
    mostrarSwitches,
    mostrarEquipos,
    mostrarPantallas,
    mostrarSoloServidores,
    mostrarSoloTablets,
    mostrarSoloAlmacenamiento,
    mostrarSoloImpresoras,
    mostrarSoloWifi,
  ]);

  const handleSearchInputChange = (value: string) => {
    setSearchTerm(value);
    setIaResultado(null);
    setIaDestacados([]);
    setRespuestaIa(null);
    setErrorIa(null);
  };

  const abrirProteccionEdicion = useCallback(
    (
      event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>,
      href: string,
      context: string,
    ) => {
      event.preventDefault();
      setEditPasswordDialog({ href, context });
      setEditPassword("");
      setEditShowPassword(false);
      setEditPasswordError(null);
      setIsVerifyingEditPassword(false);
    },
    [],
  );

  const cerrarDialogoEdicionProtegida = useCallback(() => {
    setEditPasswordDialog(null);
    setEditPassword("");
    setEditShowPassword(false);
    setEditPasswordError(null);
    setIsVerifyingEditPassword(false);
  }, []);

  const manejarSubmitEdicionProtegida = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!editPasswordDialog) return;
      const trimmed = editPassword.trim();
      if (!trimmed) {
        setEditPasswordError("Introduce la contraseña.");
        return;
      }
      setIsVerifyingEditPassword(true);
      setEditPasswordError(null);
      try {
        await verifyAdminPassword(trimmed);
        const destino = editPasswordDialog.href;
        cerrarDialogoEdicionProtegida();
        router.push(destino);
      } catch (error) {
        console.error(error);
        setEditPasswordError(
          error instanceof Error
            ? error.message
            : "No se pudo verificar la contraseña.",
        );
      } finally {
        setIsVerifyingEditPassword(false);
      }
    },
    [
      cerrarDialogoEdicionProtegida,
      editPassword,
      editPasswordDialog,
      router,
    ],
  );

  const abrirDialogoAdminLocal = useCallback(
    (equipoId: string, adminLocal: string | null) => {
      if (!adminLocal || adminLocal.trim().length === 0) {
        window.alert("Este equipo no tiene un admin local registrado.");
        return;
      }
      setAdminLocalDialog({ equipoId, adminLocal: adminLocal.trim() });
      setAdminLocalPassword("");
      setAdminLocalShowPassword(false);
      setAdminLocalError(null);
      setAdminLocalResultado(null);
      setAdminLocalInfo(null);
    },
    [],
  );

  const cerrarDialogoAdminLocal = useCallback(() => {
    setAdminLocalDialog(null);
    setAdminLocalPassword("");
    setAdminLocalShowPassword(false);
    setAdminLocalError(null);
    setAdminLocalResultado(null);
    setAdminLocalInfo(null);
    setAdminLocalVerificandoId(null);
  }, []);

  const manejarSubmitAdminLocal = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!adminLocalDialog) return;
      const trimmed = adminLocalPassword.trim();
      if (!trimmed) {
        setAdminLocalError("Introduce la contraseña.");
        return;
      }

      setAdminLocalError(null);
      setAdminLocalInfo(null);
      setAdminLocalVerificandoId(adminLocalDialog.equipoId);
      try {
        await verifyAdminPassword(trimmed);
        setAdminLocalResultado(adminLocalDialog.adminLocal);
        setAdminLocalPassword("");
        setAdminLocalInfo(
          "Contraseña verificada. Puedes copiar el valor si lo necesitas.",
        );
      } catch (error) {
        console.error(error);
        setAdminLocalError(
          error instanceof Error
            ? error.message
            : "Se produjo un error al verificar la contraseña.",
        );
      } finally {
        setAdminLocalVerificandoId(null);
      }
    },
    [adminLocalDialog, adminLocalPassword],
  );

  const manejarCopiarAdminLocal = useCallback(async () => {
    if (!adminLocalResultado) return;
    try {
      await navigator.clipboard.writeText(adminLocalResultado);
      setAdminLocalInfo("Admin local copiado al portapapeles.");
    } catch (error) {
      console.error(error);
      setAdminLocalError("No se pudo copiar al portapapeles.");
    }
  }, [adminLocalResultado]);

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
    if (mostrarEquiposConUnaPantalla) params.set("pantallas1", "1");
    if (mostrarEquiposConDosPantallas) params.set("pantallas2", "1");
    if (mostrarTarjetaRed1Gbps) params.set("tarjeta1g", "1");
    if (mostrarTarjetaRed10Gbps) params.set("tarjeta10g", "1");
    if (!mostrarAdminLocalConValor) params.set("adminLocalCon", "0");
    if (!mostrarAdminLocalSinValor) params.set("adminLocalSin", "0");
    if (mostrarSoloServidores) params.set("servidores", "1");
    if (mostrarSoloTablets) params.set("tablets", "1");
    if (mostrarSoloAlmacenamiento) params.set("almacenamiento", "1");
    if (mostrarSoloImpresoras) params.set("impresoras", "1");
    if (mostrarSoloWifi) params.set("wifi", "1");
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
    mostrarEquiposConUnaPantalla,
    mostrarEquiposConDosPantallas,
    mostrarTarjetaRed1Gbps,
    mostrarTarjetaRed10Gbps,
    mostrarAdminLocalConValor,
    mostrarAdminLocalSinValor,
    mostrarSoloServidores,
    mostrarSoloTablets,
    mostrarSoloAlmacenamiento,
    mostrarSoloImpresoras,
    mostrarSoloWifi,
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
    setMostrarEquiposConUnaPantalla(false);
    setMostrarEquiposConDosPantallas(false);
    setMostrarTarjetaRed1Gbps(false);
    setMostrarTarjetaRed10Gbps(false);
    setMostrarAdminLocalConValor(true);
    setMostrarAdminLocalSinValor(true);
    setMostrarSoloServidores(false);
    setMostrarSoloTablets(false);
    setMostrarSoloAlmacenamiento(false);
    setMostrarSoloImpresoras(false);
    setMostrarSoloWifi(false);
    setMostrarSoloImpresoras(false);
    setPantallaPulgadasSeleccionadas("");
  }

  function manejarCambioMostrarEquipos(checked: boolean) {
    setMostrarEquipos(checked);
  }

  function manejarCambioMostrarPantallas(checked: boolean) {
    setMostrarPantallas(checked);
  }

  const estaVerificandoAdminLocal =
    adminLocalDialog !== null &&
    adminLocalVerificandoId === adminLocalDialog.equipoId;

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
      const tipoEquipo =
        typeof equipo.tipo === "string"
          ? equipo.tipo.trim().toLowerCase()
          : null;
      const tieneAdminLocal =
        typeof equipo.admin_local === "string" &&
        equipo.admin_local.trim().length > 0;
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
        if (!tipoEquipo || tipoEquipo !== tipoSeleccionado) return false;
      }

    const tiposRequeridos: string[] = [];
    if (mostrarSoloServidores) tiposRequeridos.push("servidor");
    if (mostrarSoloTablets) tiposRequeridos.push("tablet");
    if (mostrarSoloAlmacenamiento) tiposRequeridos.push("almacenamiento");
    if (mostrarSoloImpresoras) tiposRequeridos.push("impresora");
    if (mostrarSoloWifi) tiposRequeridos.push("wifi");
    if (tiposRequeridos.length > 0) {
      if (!tipoEquipo || !tiposRequeridos.includes(tipoEquipo)) return false;
    }

      if (!mostrarAdmitenUpdate && equipo.admite_update === true) return false;
      if (!mostrarNoAdmitenUpdate && equipo.admite_update === false)
        return false;
      if (
        mostrarAdmitenUpdate &&
        !mostrarNoAdmitenUpdate &&
        equipo.admite_update !== true
      )
        return false;

      if (
        !mostrarAdmitenUpdate &&
        mostrarNoAdmitenUpdate &&
        equipo.admite_update !== false
      )
        return false;

      if (!mostrarGarbiguneSi && equipo.al_garbigune === true) return false;

      if (!mostrarGarbiguneNo && equipo.al_garbigune === false) return false;

      const tarjetaRedGbps = obtenerTarjetaRedGbps(equipo.tarjeta_red);
      if (mostrarTarjetaRed1Gbps || mostrarTarjetaRed10Gbps) {
        const coincidencias: boolean[] = [];
        if (mostrarTarjetaRed1Gbps) {
          coincidencias.push(coincideVelocidadGbps(tarjetaRedGbps, 1));
        }
        if (mostrarTarjetaRed10Gbps) {
          coincidencias.push(coincideVelocidadGbps(tarjetaRedGbps, 10));
        }
        if (!coincidencias.some(Boolean)) return false;
      }

      const filtroAdminLocalActivo =
        !mostrarAdminLocalConValor || !mostrarAdminLocalSinValor;
      if (filtroAdminLocalActivo) {
        if (!mostrarAdminLocalConValor && !mostrarAdminLocalSinValor) {
          return false;
        }
        if (mostrarAdminLocalConValor && !tieneAdminLocal) {
          return false;
        }
        if (mostrarAdminLocalSinValor && tieneAdminLocal) {
          return false;
        }
      }

      if (mostrarEquiposConUnaPantalla || mostrarEquiposConDosPantallas) {
        const totalPantallas = Array.isArray(equipo.pantallas)
          ? equipo.pantallas.length
          : 0;
        const coincideFiltro =
          (mostrarEquiposConUnaPantalla && totalPantallas === 1) ||
          (mostrarEquiposConDosPantallas && totalPantallas === 2);
        if (!coincideFiltro) return false;
      }

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

    mostrarEquiposConUnaPantalla,

    mostrarEquiposConDosPantallas,

    mostrarTarjetaRed1Gbps,

    mostrarTarjetaRed10Gbps,
    mostrarAdminLocalConValor,
    mostrarAdminLocalSinValor,

    mostrarSoloServidores,

    mostrarSoloTablets,

    mostrarSoloAlmacenamiento,

    mostrarSoloImpresoras,

    mostrarSoloWifi,

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

      if (equipo.ip) valores.push(equipo.ip);
      if (equipo.toma_red) valores.push(equipo.toma_red);
      if (equipo.tarjeta_red !== null && equipo.tarjeta_red !== undefined) {
        valores.push(String(equipo.tarjeta_red));
      }

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
      anioCompra: number | null;
      enGarantia: boolean | null;
      sinEquipo: boolean;
      thumbnailUrl: string | null;
      observaciones: string | null;
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
        const fechaCompra = pantalla.fecha_compra ?? null;
        let anioCompra: number | null = null;
        if (fechaCompra) {
          const fecha = new Date(fechaCompra);
          if (!Number.isNaN(fecha.getTime())) {
            anioCompra = fecha.getFullYear();
          }
        }

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
          fechaCompra,
          anioCompra,
        enGarantia:
          pantalla.en_garantia === null || pantalla.en_garantia === undefined
            ? null
            : pantalla.en_garantia,
        sinEquipo: false,
        thumbnailUrl: pantalla.thumbnailUrl ?? null,
        observaciones:
          typeof pantalla.observaciones === "string"
            ? pantalla.observaciones
            : null,
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
      const fechaCompra = pantalla.fecha_compra ?? null;
      let anioCompra: number | null = null;
      if (fechaCompra) {
        const fecha = new Date(fechaCompra);
        if (!Number.isNaN(fecha.getTime())) {
          anioCompra = fecha.getFullYear();
        }
      }

      lista.push({
        id: pantalla.id,
        equipoId: pantalla.equipo_id ?? null,
        equipoNombre: "Sin equipo asignado",
        usuarioId: null,
        modelo: pantalla.modelo ?? null,
        fabricanteNombre: pantalla.fabricanteNombre ?? null,
        pulgadas:
          typeof pantalla.pulgadas === "number" ? pantalla.pulgadas : null,
        precio,
        fechaCompra,
        anioCompra,
        enGarantia:
          pantalla.en_garantia === null || pantalla.en_garantia === undefined
            ? null
            : pantalla.en_garantia,
        sinEquipo: true,
        thumbnailUrl: pantalla.thumbnailUrl ?? null,
        observaciones:
          typeof pantalla.observaciones === "string"
            ? pantalla.observaciones
            : null,
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

      if (
        filtroPantallasAnio !== null &&
        filtroPantallasAnio !== undefined
      ) {
        if (pantalla.anioCompra === null) return false;
        if (pantalla.anioCompra !== filtroPantallasAnio) return false;
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
    filtroPantallasAnio,
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

  const mostrarListadoEquipos =
    mostrarEquipos ||
    mostrarSoloServidores ||
    mostrarSoloTablets ||
    mostrarSoloAlmacenamiento ||
    mostrarSoloImpresoras ||
    mostrarSoloWifi;

  if (mostrarEquipos && mostrarPantallas) {
    resumenResultados = `${equiposResultadosTexto} - ${pantallasResultadosTexto}`;
  } else if (!mostrarEquipos && mostrarPantallas) {
    resumenResultados = pantallasResultadosTexto;
  } else if (
    !mostrarEquipos &&
    (mostrarSoloServidores ||
      mostrarSoloTablets ||
      mostrarSoloAlmacenamiento ||
      mostrarSoloImpresoras ||
      mostrarSoloWifi)
  ) {
    resumenResultados = equiposResultadosTexto;
  }

  const filtrosActivos: string[] = [];

  if (searchTerm.trim().length > 0) {
    filtrosActivos.push(`Búsqueda: "${searchTerm.trim()}"`);
  }

  if (sistemaOperativoSeleccionado) {
    filtrosActivos.push(`SO: ${sistemaOperativoSeleccionado}`);
  }

  if (fabricanteSeleccionado) {
    filtrosActivos.push(`Fabricante: ${fabricanteSeleccionado}`);
  }

  if (ubicacionSeleccionada) {
    filtrosActivos.push(`Ubicación: ${ubicacionSeleccionada}`);
  }

  if (tipoSeleccionado) {
    filtrosActivos.push(
      `Tipo: ${tipoLabels[tipoSeleccionado] ?? tipoSeleccionado}`,
    );
  }

  if (antiguedadMinima !== null) {
    filtrosActivos.push(`Antigüedad ≥ ${antiguedadMinima}`);
  }

  if (pantallaPulgadasSeleccionadas) {
    const pulgadasTexto =
      pantallaPulgadasSeleccionadas === "sin_dato"
        ? "Sin dato"
        : `${pantallaPulgadasSeleccionadas}"`;
    filtrosActivos.push(`Pulgadas: ${pulgadasTexto}`);
  }

  if (mostrarEquiposConUnaPantalla || mostrarEquiposConDosPantallas) {
    const partes: string[] = [];
    if (mostrarEquiposConUnaPantalla) partes.push("1");
    if (mostrarEquiposConDosPantallas) partes.push("2");
    const textoPantallas =
      partes.length === 1
        ? `${partes[0]} ${partes[0] === "1" ? "pantalla" : "pantallas"}`
        : `${partes.join(" y ")} pantallas`;
    filtrosActivos.push(`Pantallas conectadas: ${textoPantallas}`);
  }

  if (mostrarTarjetaRed1Gbps || mostrarTarjetaRed10Gbps) {
    const partes: string[] = [];
    if (mostrarTarjetaRed1Gbps) partes.push("1 Gbps");
    if (mostrarTarjetaRed10Gbps) partes.push("10 Gbps");
    const textoTarjeta =
      partes.length === 1 ? partes[0] : partes.join(" o ");
    filtrosActivos.push(`Tarjeta red: ${textoTarjeta}`);
  }

  if (!mostrarAdminLocalConValor || !mostrarAdminLocalSinValor) {
    if (mostrarAdminLocalConValor && !mostrarAdminLocalSinValor) {
      filtrosActivos.push("Admin local: con valor");
    } else if (!mostrarAdminLocalConValor && mostrarAdminLocalSinValor) {
      filtrosActivos.push("Admin local: sin valor");
    } else if (!mostrarAdminLocalConValor && !mostrarAdminLocalSinValor) {
      filtrosActivos.push("Admin local: ninguno");
    }
  }

  if (
    mostrarSoloServidores ||
    mostrarSoloTablets ||
    mostrarSoloAlmacenamiento ||
    mostrarSoloImpresoras ||
    mostrarSoloWifi
  ) {
    const partes: string[] = [];
    if (mostrarSoloServidores) partes.push("Servidores");
    if (mostrarSoloTablets) partes.push("Tablets");
    if (mostrarSoloAlmacenamiento) partes.push("Almacenamiento");
    if (mostrarSoloImpresoras) partes.push("Impresoras");
    if (mostrarSoloWifi) partes.push("WiFi");
    const textoTipo =
      partes.length === 1
        ? partes[0]
        : `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
    filtrosActivos.push(`Tipo: solo ${textoTipo}`);
  }

  if (usuariosSeleccionados.length > 0) {
    const usuariosSeleccionadosNombres = usuariosDisponibles
      .filter((usuario) => usuariosSeleccionados.includes(usuario.id))
      .map((usuario) => usuario.nombre);
    const textoUsuarios =
      usuariosSeleccionadosNombres.length > 0
        ? usuariosSeleccionadosNombres
            .slice(0, 3)
            .join(", ")
            .concat(
              usuariosSeleccionadosNombres.length > 3
                ? ` (+${usuariosSeleccionadosNombres.length - 3})`
                : "",
            )
        : `${usuariosSeleccionados.length} seleccionado(s)`;
    filtrosActivos.push(`Usuarios: ${textoUsuarios}`);
  }

  if (mostrarAsignados !== mostrarSinAsignar) {
    if (mostrarAsignados && !mostrarSinAsignar) {
      filtrosActivos.push("Asignación: solo asignados");
    } else if (!mostrarAsignados && mostrarSinAsignar) {
      filtrosActivos.push("Asignación: sin asignar");
    } else {
      filtrosActivos.push("Asignación: ninguno");
    }
  }

  if (mostrarAdmitenUpdate !== mostrarNoAdmitenUpdate) {
    if (mostrarAdmitenUpdate && !mostrarNoAdmitenUpdate) {
      filtrosActivos.push("Admite update: sí");
    } else if (!mostrarAdmitenUpdate && mostrarNoAdmitenUpdate) {
      filtrosActivos.push("Admite update: no");
    } else {
      filtrosActivos.push("Admite update: ninguno");
    }
  }

  if (mostrarGarbiguneSi !== mostrarGarbiguneNo) {
    if (mostrarGarbiguneSi && !mostrarGarbiguneNo) {
      filtrosActivos.push("Garbigune: sí");
    } else if (!mostrarGarbiguneSi && mostrarGarbiguneNo) {
      filtrosActivos.push("Garbigune: no");
    } else {
      filtrosActivos.push("Garbigune: ninguno");
    }
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
            <div className="flex justify-end" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4 lg:auto-rows-[minmax(0,1fr)]">
          <fieldset className="flex flex-col gap-2 rounded-lg border border-border bg-card/40 px-3 py-3 text-xs text-foreground/80 lg:col-start-1 lg:row-start-1">
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

          <fieldset className="flex flex-col gap-2 rounded-lg border border-border bg-card/40 px-3 py-3 text-xs text-foreground/80 lg:col-start-2 lg:row-start-1">
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

          <fieldset className="flex flex-col gap-2 rounded-lg border border-border bg-card/40 px-3 py-3 text-xs text-foreground/80 lg:col-start-3 lg:row-start-1">
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

          <label className="flex flex-col gap-2 rounded-lg border border-border bg-card/40 px-3 py-3 text-xs text-foreground/80 lg:col-start-1 lg:row-start-2">
            <span className="font-semibold uppercase tracking-wide text-foreground/60">
              Fabricante
            </span>

            <select
              value={fabricanteSeleccionado}
              onChange={(event) =>
                setFabricanteSeleccionado(event.target.value)
              }
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/20"
            >
              <option value="">Todos</option>

              {fabricantesDisponibles.map((fabricante) => (
                <option key={fabricante} value={fabricante}>
                  {fabricante}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 rounded-lg border border-border bg-card/40 px-3 py-3 text-xs text-foreground/80 lg:col-start-2 lg:row-start-2">
            <span className="font-semibold uppercase tracking-wide text-foreground/60">
              Sistema operativo
            </span>

            <select
              value={sistemaOperativoSeleccionado}
              onChange={(event) =>
                setSistemaOperativoSeleccionado(event.target.value)
              }
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/20"
            >
              <option value="">Todos</option>

              {sistemasOperativos.map((so) => (
                <option key={so} value={so}>
                  {so}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 rounded-lg border border-border bg-card/40 px-3 py-3 text-xs text-foreground/80 lg:col-start-3 lg:row-start-2">
            <span className="font-semibold uppercase tracking-wide text-foreground/60">
              Tipo
            </span>

            <select
              value={tipoSeleccionado}
              onChange={(event) => setTipoSeleccionado(event.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/20"
            >
              <option value="">Todos</option>

              {tiposDisponibles.map((tipoClave) => (
                <option key={tipoClave} value={tipoClave}>
                  {tipoLabels[tipoClave] ?? tipoClave}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 rounded-lg border border-border bg-card/40 px-3 py-3 text-xs text-foreground/80 lg:col-start-3 lg:row-start-3">
            <span className="font-semibold uppercase tracking-wide text-foreground/60">
              Pulgadas pantalla
            </span>

            <select
              value={pantallaPulgadasSeleccionadas}
              onChange={(event) =>
                setPantallaPulgadasSeleccionadas(event.target.value)
              }
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/20"
            >
              <option value="">Todas</option>

              {pantallasPulgadasDisponibles.map((opcion) => (
                <option key={opcion.value} value={opcion.value}>
                  {opcion.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 rounded-lg border border-border bg-card/40 px-3 py-3 text-xs text-foreground/80 lg:col-start-1 lg:row-start-3">
            <span className="font-semibold uppercase tracking-wide text-foreground/60">
              Ubicacion
            </span>

            <select
              value={ubicacionSeleccionada}
              onChange={(event) => setUbicacionSeleccionada(event.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/20"
            >
              <option value="">Todas</option>

              {ubicacionesDisponibles.map((ubic) => (
                <option key={ubic} value={ubic}>
                  {ubic}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 rounded-lg border border-border bg-card/40 px-3 py-3 text-xs text-foreground/80 lg:col-start-2 lg:row-start-3">
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
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/20"
            >
              <option value="">Todas</option>

              {opcionesAntiguedad.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {`= ${opcion}`}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="flex flex-col gap-2 rounded-lg border border-border bg-card/40 px-3 py-3 text-xs text-foreground/80 lg:col-start-1 lg:row-start-4">
            <legend className="font-semibold uppercase tracking-wide text-foreground/60">
              Pantallas conectadas
            </legend>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={mostrarEquiposConUnaPantalla}
                onChange={(event) =>
                  setMostrarEquiposConUnaPantalla(event.target.checked)
                }
                className="h-4 w-4 cursor-pointer rounded border-border text-foreground focus:ring-2 focus:ring-foreground/30"
              />

              <span>1 pantalla</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={mostrarEquiposConDosPantallas}
                onChange={(event) =>
                  setMostrarEquiposConDosPantallas(event.target.checked)
                }
                className="h-4 w-4 cursor-pointer rounded border-border text-foreground focus:ring-2 focus:ring-foreground/30"
              />

              <span>2 pantallas</span>
            </label>
          </fieldset>

          <fieldset className="flex flex-col gap-2 rounded-lg border border-border bg-card/40 px-3 py-3 text-xs text-foreground/80 lg:col-start-2 lg:row-start-4">
            <legend className="font-semibold uppercase tracking-wide text-foreground/60">
              Tarjeta de red
            </legend>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={mostrarTarjetaRed1Gbps}
                onChange={(event) =>
                  setMostrarTarjetaRed1Gbps(event.target.checked)
                }
                className="h-4 w-4 cursor-pointer rounded border-border text-foreground focus:ring-2 focus:ring-foreground/30"
              />

              <span>1 Gbps</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={mostrarTarjetaRed10Gbps}
                onChange={(event) =>
                  setMostrarTarjetaRed10Gbps(event.target.checked)
                }
                className="h-4 w-4 cursor-pointer rounded border-border text-foreground focus:ring-2 focus:ring-foreground/30"
              />

              <span>10 Gbps</span>
            </label>
          </fieldset>

          <fieldset className="flex flex-col gap-2 rounded-lg border border-border bg-card/40 px-3 py-3 text-xs text-foreground/80 lg:col-start-3 lg:row-start-4">
            <legend className="font-semibold uppercase tracking-wide text-foreground/60">
              Admin local
            </legend>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={mostrarAdminLocalConValor}
                onChange={(event) =>
                  setMostrarAdminLocalConValor(event.target.checked)
                }
                className="h-4 w-4 cursor-pointer rounded border-border text-foreground focus:ring-2 focus:ring-foreground/30"
              />

              <span>Con valor</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={mostrarAdminLocalSinValor}
                onChange={(event) =>
                  setMostrarAdminLocalSinValor(event.target.checked)
                }
                className="h-4 w-4 cursor-pointer rounded border-border text-foreground focus:ring-2 focus:ring-foreground/30"
              />

              <span>Sin valor</span>
            </label>
          </fieldset>

          <fieldset className="flex flex-col gap-2 rounded-lg border border-border bg-card/40 px-3 py-3 text-xs text-foreground/80 lg:col-start-4 lg:row-start-1 lg:row-span-4">
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
                  className="min-h-[22rem] rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/20"
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

      <div className="flex flex-col gap-3 text-sm text-foreground/60">
        <div className="flex flex-wrap items-center gap-3">
          <div>{resumenResultados}</div>
          {filtrosActivos.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <ul className="flex flex-wrap items-center gap-2 text-xs text-foreground/70 sm:text-sm">
                {filtrosActivos.map((texto, index) => (
                  <li
                    key={`${texto}-${index}`}
                    className="rounded-full border border-border bg-card/60 px-3 py-1"
                  >
                    {texto}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={limpiarFiltros}
                className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-foreground/70 transition hover:bg-foreground/10 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40"
              >
                Limpiar filtros
              </button>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-foreground/70 sm:text-sm">
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

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={mostrarSoloTablets}
              onChange={(event) => setMostrarSoloTablets(event.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-border text-foreground focus:ring-2 focus:ring-foreground/30"
            />

            <span>Tablets</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={mostrarSoloServidores}
              onChange={(event) => setMostrarSoloServidores(event.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-border text-foreground focus:ring-2 focus:ring-foreground/30"
            />

            <span>Servidores</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={mostrarSoloAlmacenamiento}
              onChange={(event) =>
                setMostrarSoloAlmacenamiento(event.target.checked)
              }
              className="h-4 w-4 cursor-pointer rounded border-border text-foreground focus:ring-2 focus:ring-foreground/30"
            />

            <span>Almacenamiento</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={mostrarSoloImpresoras}
              onChange={(event) =>
                setMostrarSoloImpresoras(event.target.checked)
              }
              className="h-4 w-4 cursor-pointer rounded border-border text-foreground focus:ring-2 focus:ring-foreground/30"
            />

            <span>Impresoras</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={mostrarSoloWifi}
              onChange={(event) =>
                setMostrarSoloWifi(event.target.checked)
              }
              className="h-4 w-4 cursor-pointer rounded border-border text-foreground focus:ring-2 focus:ring-foreground/30"
            />

            <span>WiFi</span>
          </label>

          {onToggleSwitches ? (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={mostrarSwitches}
                onChange={(event) =>
                  onToggleSwitches(event.target.checked)
                }
                className="h-4 w-4 cursor-pointer rounded border-border text-foreground focus:ring-2 focus:ring-foreground/30"
              />
              <span>Switches</span>
            </label>
          ) : null}
        </div>
      </div>

      {mostrarListadoEquipos &&
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

            const ipEquipo = equipo.ip ?? null;
            const tomaRed =
              typeof equipo.toma_red === "string" &&
              equipo.toma_red.trim().length > 0
                ? equipo.toma_red.trim()
                : null;
            const tarjetaRedGbpsValor = obtenerTarjetaRedGbps(
              equipo.tarjeta_red,
            );
            let tarjetaRedVelocidad: string | null = null;
            if (typeof equipo.tarjeta_red === "string") {
              const limpio = equipo.tarjeta_red.trim();
              tarjetaRedVelocidad = limpio.length > 0 ? limpio : null;
            } else if (
              typeof equipo.tarjeta_red === "number" &&
              Number.isFinite(equipo.tarjeta_red)
            ) {
              const valor = equipo.tarjeta_red;
              tarjetaRedVelocidad =
                valor >= 1000
                  ? `${valor} Mbps`
                  : valor >= 1
                    ? `${valor} Gbps`
                    : String(valor);
            }
            if (!tarjetaRedVelocidad && tarjetaRedGbpsValor !== null) {
              const aproximado = Math.round(tarjetaRedGbpsValor);
              const esEntero =
                Math.abs(aproximado - tarjetaRedGbpsValor) <
                TARJETA_RED_TOLERANCIA_GBPS;
              tarjetaRedVelocidad = esEntero
                ? `${aproximado} Gbps`
                : `${tarjetaRedGbpsValor.toFixed(2)} Gbps`;
            }

            const adminLocalValor =
              typeof equipo.admin_local === "string" &&
              equipo.admin_local.trim().length > 0
                ? equipo.admin_local.trim()
                : null;

            const puertosConectados = Array.isArray(equipo.puertos_conectados)
              ? equipo.puertos_conectados.filter(
                  (puerto): puerto is SwitchPortRecord =>
                    Boolean(puerto) && typeof puerto.numero === "number",
                )
              : [];

            const detallesPuertos = puertosConectados.map((puerto) => {
              const nombreSwitchCrudo = puerto.switch?.nombre ?? null;
              const nombreSwitch =
                nombreSwitchCrudo && nombreSwitchCrudo.trim().length > 0
                  ? nombreSwitchCrudo.trim()
                  : `Switch #${puerto.switch_id}`;
              const numeroTexto =
                typeof puerto.numero === "number" && Number.isFinite(puerto.numero)
                  ? `Puerto ${puerto.numero}`
                  : "Puerto sin dato";
              const velocidadTexto =
                typeof puerto.velocidad_mbps === "number" &&
                Number.isFinite(puerto.velocidad_mbps)
                  ? `${puerto.velocidad_mbps} Mbps`
                  : "Velocidad sin dato";
              return `${nombreSwitch} · ${numeroTexto} · ${velocidadTexto}`;
            });

            const tieneDatosRed =
              Boolean(ipEquipo) ||
              Boolean(tomaRed) ||
              Boolean(tarjetaRedVelocidad) ||
              detallesPuertos.length > 0;

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
            const enlaceEdicion =
              fromQueryParam
                ? `/equipos/${equipo.id}/editar?${fromQueryParam}`
                : `/equipos/${equipo.id}/editar`;

            return (
              <li
                key={equipo.id}
                className="relative flex flex-col gap-3 rounded-xl border border-border bg-card p-5 pb-14 text-card-foreground shadow-sm"
              >
                <Link
                  href={enlaceEdicion}
                  onClick={(event) =>
                    abrirProteccionEdicion(event, enlaceEdicion, nombreEquipo)
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

                  <div className="flex items-center justify-between text-sm text-foreground/70">
                    <span>
                      Admin local:{" "}
                      {adminLocalValor ? "********" : "Sin dato"}
                    </span>
                    {adminLocalValor ? (
                      <button
                        type="button"
                        onClick={() =>
                          abrirDialogoAdminLocal(equipo.id, adminLocalValor)
                        }
                        disabled={adminLocalVerificandoId === equipo.id}
                        title="Mostrar admin local"
                        className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-border/60 bg-background text-foreground/70 transition hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          aria-hidden="true"
                        >
                          <path
                            d="M2.25 12s3.273-6 9.75-6 9.75 6 9.75 6-3.273 6-9.75 6-9.75-6-9.75-6Z"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M12 14.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    ) : null}
                  </div>

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

                  {tieneDatosRed ? (
                    <div className="flex flex-col gap-1 border-t border-border/60 pt-2">
                      <dt className="font-medium text-foreground/70">Red</dt>
                    <dd className="text-foreground space-y-1">
                      {ipEquipo ? <p>IP: {ipEquipo}</p> : null}
                      {detallesPuertos.map((texto, index) => (
                        <p key={`${equipo.id}-puerto-${index}`}>{texto}</p>
                      ))}
                      {tarjetaRedVelocidad ? (
                        <p>Tarjeta red: {tarjetaRedVelocidad}</p>
                      ) : null}
                      {tomaRed ? <p>Toma red: {tomaRed}</p> : null}
                    </dd>
                    </div>
                  ) : null}

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
                        const enlacePantallaEdicion =
                          typeof idPantalla === "number"
                            ? fromQueryParam
                              ? `/pantallas/${idPantalla}/editar?${fromQueryParam}`
                              : `/pantallas/${idPantalla}/editar`
                            : null;
                        const miniaturaUrl =
                          pantalla?.thumbnailUrl ?? null;
                        const estaDesvinculando =
                          typeof idPantalla === "number" &&
                          pantallaDesvinculandoId === idPantalla;
                        const observacionesPantalla =
                          typeof pantalla?.observaciones === "string" &&
                          pantalla.observaciones.trim().length > 0
                            ? pantalla.observaciones.trim()
                            : null;

                        return (
                          <div
                            key={
                              idPantalla ?? `${equipo.id}-pantalla-${index}`
                            }
                            className="relative flex w-24 flex-col items-center gap-1 text-center text-foreground/70"
                          >
                            {typeof idPantalla === "number" &&
                            enlacePantallaEdicion ? (
                              <Link
                                href={enlacePantallaEdicion}
                                onClick={(event) =>
                                  abrirProteccionEdicion(
                                    event,
                                    enlacePantallaEdicion,
                                    descripcion.trim().length > 0
                                      ? `pantalla ${descripcion}`
                                      : "esta pantalla",
                                  )
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
                                    {pulgadasTexto}&quot;
                                  </span>
                                </>
                              ) : (
                                <span className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-foreground">
                                  {pulgadasTexto}
                                </span>
                              )}
                            </div>

                            <div className="flex flex-col gap-1 text-[10px] leading-tight text-foreground/60">
                              <span className="line-clamp-2">{descripcion}</span>
                              {observacionesPantalla ? (
                                <span className="line-clamp-3 whitespace-pre-line text-foreground/70">
                                  {observacionesPantalla}
                                </span>
                              ) : null}
                            </div>
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
                const observacionesTextoRaw =
                  typeof pantalla.observaciones === "string"
                    ? pantalla.observaciones.trim()
                    : "";
                const observacionesTexto =
                  observacionesTextoRaw.length > 0 ? observacionesTextoRaw : null;
                const estaEliminandoPantalla =
                  pantallaEliminandoId === pantalla.id;
                const miniaturaUrl = pantalla.thumbnailUrl ?? null;
                const enlacePantallaEdicion =
                  fromQueryParam
                    ? `/pantallas/${pantalla.id}/editar?${fromQueryParam}`
                    : `/pantallas/${pantalla.id}/editar`;
                const contextoPantalla =
                  modelo && modelo.length > 0
                    ? `pantalla ${modelo}`
                    : "esta pantalla";

                return (
                  <li
                    key={`pantalla-${pantalla.id}`}
                    className="relative flex flex-col gap-3 rounded-xl border border-border bg-card p-5 pb-14 text-card-foreground shadow-sm"
                  >
                    <Link
                      href={enlacePantallaEdicion}
                      onClick={(event) =>
                        abrirProteccionEdicion(
                          event,
                          enlacePantallaEdicion,
                          contextoPantalla,
                        )
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

                      {observacionesTexto ? (
                        <p className="text-sm text-foreground/70 whitespace-pre-line">
                          {observacionesTexto}
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

      {editPasswordDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 text-sm text-card-foreground shadow-lg">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-foreground">
                Confirmar contrasena
              </h2>
              <p className="text-xs text-foreground/60">
                Introduce la contrasena para editar {editPasswordDialog.context}.
              </p>
            </div>
            <form
              className="space-y-4"
              onSubmit={manejarSubmitEdicionProtegida}
              autoComplete="off"
            >
              <label className="flex flex-col gap-1 text-xs text-foreground/70">
                Contrasena
                <div className="flex items-center gap-2">
                  <input
                    type={editShowPassword ? "text" : "password"}
                    value={editPassword}
                    onChange={(event) => setEditPassword(event.target.value)}
                    className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
                    placeholder="Introduce la contrasena"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setEditShowPassword((prev) => !prev)}
                    className="inline-flex cursor-pointer items-center rounded-md border border-border bg-background px-2 py-1 text-xs font-semibold uppercase tracking-wide text-foreground/70 transition hover:bg-foreground/10 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40"
                  >
                    {editShowPassword ? "Ocultar" : "Ver"}
                  </button>
                </div>
              </label>

              {editPasswordError ? (
                <p className="text-xs text-red-500">{editPasswordError}</p>
              ) : null}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={cerrarDialogoEdicionProtegida}
                  className="inline-flex cursor-pointer items-center rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-foreground/70 transition hover:bg-foreground/10 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={isVerifyingEditPassword}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingEditPassword}
                  className="inline-flex cursor-pointer items-center rounded-md bg-foreground px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-background transition hover:bg-foreground/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isVerifyingEditPassword ? "Verificando..." : "Editar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {adminLocalDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 text-sm text-card-foreground shadow-lg">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Mostrar admin local
                </h2>
                <p className="text-xs text-foreground/60">
                  Introduce la contraseña para ver la credencial guardada.
                </p>
              </div>
              <button
                type="button"
                onClick={cerrarDialogoAdminLocal}
                title="Cerrar"
                className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-border/60 bg-background text-foreground/60 transition hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40"
              >
                <span className="text-lg leading-none">&times;</span>
              </button>
            </div>

            {adminLocalResultado ? (
              <div className="space-y-4">
                <div className="rounded-md border border-border bg-background/80 px-3 py-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-foreground/60">
                    Admin local
                  </p>
                  <p className="mt-1 font-mono text-sm break-all text-foreground">
                    {adminLocalResultado}
                  </p>
                </div>

                {adminLocalInfo ? (
                  <p className="text-xs text-foreground/60">{adminLocalInfo}</p>
                ) : null}

                {adminLocalError ? (
                  <p className="text-xs text-red-500">{adminLocalError}</p>
                ) : null}

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={manejarCopiarAdminLocal}
                    className="inline-flex cursor-pointer items-center rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-foreground/70 transition hover:bg-foreground/10 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40"
                  >
                    Copiar
                  </button>
                  <button
                    type="button"
                    onClick={cerrarDialogoAdminLocal}
                    className="inline-flex cursor-pointer items-center rounded-md bg-foreground px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-background transition hover:bg-foreground/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={manejarSubmitAdminLocal}
                className="space-y-4"
                autoComplete="off"
              >
                <label className="flex flex-col gap-1 text-xs text-foreground/70">
                  Contraseña
                  <div className="flex items-center gap-2">
                    <input
                      type={adminLocalShowPassword ? "text" : "password"}
                      value={adminLocalPassword}
                      onChange={(event) =>
                        setAdminLocalPassword(event.target.value)
                      }
                      className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
                      placeholder="Introduce la contraseña"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setAdminLocalShowPassword((prev) => !prev)
                      }
                      className="inline-flex cursor-pointer items-center rounded-md border border-border bg-background px-2 py-1 text-xs font-semibold uppercase tracking-wide text-foreground/70 transition hover:bg-foreground/10 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40"
                    >
                      {adminLocalShowPassword ? "Ocultar" : "Ver"}
                    </button>
                  </div>
                </label>

                {adminLocalError ? (
                  <p className="text-xs text-red-500">{adminLocalError}</p>
                ) : null}

                {adminLocalInfo ? (
                  <p className="text-xs text-foreground/60">{adminLocalInfo}</p>
                ) : null}

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={cerrarDialogoAdminLocal}
                    className="inline-flex cursor-pointer items-center rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-foreground/70 transition hover:bg-foreground/10 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40"
                    disabled={estaVerificandoAdminLocal}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={estaVerificandoAdminLocal}
                    className="inline-flex cursor-pointer items-center rounded-md bg-foreground px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-background transition hover:bg-foreground/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {estaVerificandoAdminLocal
                      ? "Verificando..."
                      : "Ver credencial"}
                  </button>
                </div>
              </form>
            )}
          </div>
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


