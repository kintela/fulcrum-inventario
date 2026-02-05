"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { FormEvent, MouseEvent } from "react";

import { formatearFecha } from "@/lib/format";
import { verifyAdminPassword } from "@/lib/verifyAdminPassword";
import type { PatchPanelRecord, PatchPanelPortRecord } from "@/lib/supabase";

type PatchPanelsListProps = {
  patchpanels: PatchPanelRecord[];
};

function obtenerTimestamp(fecha: string | null | undefined): number {
  if (!fecha) return Number.NEGATIVE_INFINITY;
  const date = new Date(fecha);
  if (Number.isNaN(date.getTime())) return Number.NEGATIVE_INFINITY;
  return date.getTime();
}

function extraerNumeroFinal(nombre: string | null | undefined): number | null {
  if (!nombre) return null;
  const match = nombre.trim().match(/(\d+)\s*$/);
  if (!match) return null;
  const parsed = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function sanitizePdfText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "");
}

function wrapText(text: string, width: number): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [""];
  const words = trimmed.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current.length === 0) {
      current = word;
      continue;
    }
    if (current.length + 1 + word.length <= width) {
      current = `${current} ${word}`;
      continue;
    }
    lines.push(current);
    if (word.length > width) {
      let remaining = word;
      while (remaining.length > width) {
        lines.push(remaining.slice(0, width));
        remaining = remaining.slice(width);
      }
      current = remaining;
    } else {
      current = word;
    }
  }
  if (current.length > 0) {
    lines.push(current);
  }
  return lines;
}

function buildPdfLines(
  panel: PatchPanelRecord,
  portsOverride?: PatchPanelRecord["puertos"],
): string[] {
  const nombre =
    panel.nombre && panel.nombre.trim().length > 0
      ? panel.nombre.trim()
      : `Patch panel #${panel.id}`;
  const sourcePorts = Array.isArray(portsOverride)
    ? portsOverride
    : panel.puertos;
  const puertosOrdenados =
    Array.isArray(sourcePorts) && sourcePorts.length > 0
      ? sourcePorts.slice().sort((a, b) => a.numero - b.numero)
      : [];

  const lines: string[] = [];
  lines.push(`Patch panel: ${nombre}`);
  lines.push(`Puertos configurados: ${puertosOrdenados.length}`);
  lines.push("");

  const colWidths = [14, 24, 16, 24, 46];
  const headerCells = [
    "Puerto patch",
    "Switch",
    "Puerto switch",
    "Equipo conectado",
    "Observaciones",
  ];

  const formatRow = (cells: string[]) => {
    const wrapped = cells.map((cell, idx) =>
      wrapText(cell, colWidths[idx]),
    );
    const maxLines = Math.max(...wrapped.map((arr) => arr.length));
    for (let i = 0; i < maxLines; i += 1) {
      const line = wrapped
        .map((arr, idx) => (arr[i] ?? "").padEnd(colWidths[idx], " "))
        .join(" | ");
      lines.push(line);
    }
  };

  formatRow(headerCells);
  lines.push("-".repeat(colWidths.reduce((acc, w) => acc + w, 0) + 12));

  puertosOrdenados.forEach((puerto) => {
    const etiqueta =
      typeof puerto.etiqueta === "string" && puerto.etiqueta.trim().length > 0
        ? puerto.etiqueta.trim()
        : null;
    const puertoPatchTexto = etiqueta
      ? `${puerto.numero} (${etiqueta})`
      : `${puerto.numero}`;
    const puertoSwitch = puerto.puerto_switch;
    const switchNombre =
      puertoSwitch && "switch" in puertoSwitch && puertoSwitch.switch
        ? puertoSwitch.switch.nombre?.trim() ||
          `Switch #${puertoSwitch.switch.id}`
        : puertoSwitch && "switch_id" in puertoSwitch
          ? `Switch #${puertoSwitch.switch_id}`
          : "Sin switch";
    const puertoSwitchTexto =
      puertoSwitch && "numero" in puertoSwitch
        ? `Puerto ${puertoSwitch.numero}`
        : "Sin puerto";
    const equipoNombre =
      puertoSwitch &&
      "equipo" in puertoSwitch &&
      puertoSwitch.equipo &&
      puertoSwitch.equipo.nombre
        ? puertoSwitch.equipo.nombre.trim()
        : "Sin equipo";
    const observacionPatch =
      typeof puerto.observaciones === "string" &&
      puerto.observaciones.trim().length > 0
        ? puerto.observaciones.trim()
        : null;
    const observacionSwitch =
      puertoSwitch &&
      "observaciones" in puertoSwitch &&
      typeof puertoSwitch.observaciones === "string" &&
      puertoSwitch.observaciones.trim().length > 0
        ? puertoSwitch.observaciones.trim()
        : null;
    const observaciones =
      observacionPatch || observacionSwitch
        ? [
            observacionPatch ? `Patch: ${observacionPatch}` : null,
            observacionSwitch ? `Switch: ${observacionSwitch}` : null,
          ]
            .filter(Boolean)
            .join(" | ")
        : "Sin observaciones";

    formatRow([
      puertoPatchTexto,
      switchNombre,
      puertoSwitchTexto,
      equipoNombre,
      observaciones,
    ]);
    lines.push("-".repeat(colWidths.reduce((acc, w) => acc + w, 0) + 12));
  });

  return lines.map((line) => sanitizePdfText(line));
}

function buildPdfFromLines(lines: string[]): string {
  const pageWidth = 842;
  const pageHeight = 595;
  const marginX = 36;
  const marginY = 36;
  const fontSize = 10;
  const lineHeight = 14;
  const linesPerPage = Math.floor((pageHeight - marginY * 2) / lineHeight);

  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage));
  }

  const objects: string[] = [];
  const addObject = (content: string) => {
    objects.push(content);
    return objects.length;
  };

  const pagesId = addObject("");
  const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>");

  const pageIds: number[] = [];

  pages.forEach((pageLines) => {
    const contentLines = [
      "BT",
      `/F1 ${fontSize} Tf`,
      `${marginX} ${pageHeight - marginY - fontSize} Td`,
      `${lineHeight} TL`,
      ...pageLines.map((line) => `(${line.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")}) Tj T*`),
      "ET",
    ];

    const content = contentLines.join("\n");
    const contentId = addObject(
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    );
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    pageIds.push(pageId);
  });

  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds
    .map((id) => `${id} 0 R`)
    .join(" ")}] /Count ${pageIds.length} >>`;

  const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  let pdf = "%PDF-1.3\n";
  const offsets: number[] = [0];

  objects.forEach((obj, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${obj}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i += 1) {
    const offset = String(offsets[i]).padStart(10, "0");
    pdf += `${offset} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF`;

  return pdf;
}
export default function PatchPanelsList({ patchpanels }: PatchPanelsListProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const fromQueryParam = searchParams?.toString();
  const [editDialog, setEditDialog] = useState<{
    href: string;
    context: string;
  } | null>(null);
  const [editPassword, setEditPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [isVerifyingEdit, setIsVerifyingEdit] = useState(false);
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(
    () => new Set(),
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [showFreePorts, setShowFreePorts] = useState(false);
  const [printTargetId, setPrintTargetId] = useState<string | null>(null);
  const isPrintActive = printTargetId !== null;

  useEffect(() => {
    if (!printTargetId) return;
    if (typeof window === "undefined") return;

    const handleAfterPrint = () => setPrintTargetId(null);
    window.addEventListener("afterprint", handleAfterPrint);
    const timer = window.setTimeout(() => window.print(), 0);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [printTargetId]);

  const abrirProteccionEdicion = useCallback(
    (
      event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>,
      href: string,
      context: string,
    ) => {
      event.preventDefault();
      setEditDialog({ href, context });
      setEditPassword("");
      setShowEditPassword(false);
      setEditError(null);
      setIsVerifyingEdit(false);
    },
    [],
  );

  const cerrarProteccionEdicion = useCallback(() => {
    setEditDialog(null);
    setEditPassword("");
    setShowEditPassword(false);
    setEditError(null);
    setIsVerifyingEdit(false);
  }, []);

  const manejarSubmitEdicion = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!editDialog) return;
      const trimmed = editPassword.trim();
      if (!trimmed) {
        setEditError("Introduce la contrasena.");
        return;
      }
      setIsVerifyingEdit(true);
      setEditError(null);
      try {
        await verifyAdminPassword(trimmed);
        const destino = editDialog.href;
        cerrarProteccionEdicion();
        router.push(destino);
      } catch (error) {
        console.error(error);
        setEditError(
          error instanceof Error
            ? error.message
            : "No se pudo verificar la contrasena.",
        );
      } finally {
        setIsVerifyingEdit(false);
      }
    },
    [cerrarProteccionEdicion, editDialog, editPassword, router],
  );

  const ordenados = useMemo(() => {
    return [...patchpanels].sort((a, b) => {
      const numeroA = extraerNumeroFinal(a.nombre);
      const numeroB = extraerNumeroFinal(b.nombre);

      if (numeroA !== null || numeroB !== null) {
        if (numeroA === null) return 1;
        if (numeroB === null) return -1;
        if (numeroA !== numeroB) return numeroA - numeroB;
      }

      const fechaA = obtenerTimestamp(a.fecha_compra);
      const fechaB = obtenerTimestamp(b.fecha_compra);

      if (fechaA !== fechaB) {
        return fechaB - fechaA;
      }

      const nombreA = (a.nombre ?? "").toLowerCase();
      const nombreB = (b.nombre ?? "").toLowerCase();
      return nombreA.localeCompare(nombreB, "es");
    });
  }, [patchpanels]);

  if (patchpanels.length === 0) {
    return (
      <p className="text-sm text-foreground/70">
        No hay patch panels registrados.
      </p>
    );
  }

  const toggleExpanded = (id: string) => {
    setExpandedPanels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSavePdf = (
    panel: PatchPanelRecord,
    portsOverride?: PatchPanelRecord["puertos"],
  ) => {
    if (typeof window === "undefined") return;
    const lines = buildPdfLines(panel, portsOverride);
    const pdfContent = buildPdfFromLines(lines);
    const blob = new Blob([pdfContent], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);
    const nombreArchivo =
      panel.nombre && panel.nombre.trim().length > 0
        ? panel.nombre.trim()
        : `patchpanel-${panel.id}`;
    const safeName = sanitizePdfText(nombreArchivo)
      .replace(/\s+/g, "_")
      .replace(/[^\w.-]/g, "");

    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeName}_conexiones.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const trimmedSearch = searchTerm.trim().toLowerCase();
  const isSearchActive = trimmedSearch.length > 0;
  const isFilterActive = isSearchActive || showFreePorts;

  const normalizeValue = (value: string | null | undefined) =>
    value ? value.toLowerCase().trim() : "";

  const resolvePortInfo = (puerto: PatchPanelPortRecord) => {
    const etiquetaTexto =
      typeof puerto.etiqueta === "string" && puerto.etiqueta.trim().length > 0
        ? puerto.etiqueta.trim()
        : null;
    const puertoSwitch = puerto.puerto_switch;
    const switchNombre =
      puertoSwitch && "switch" in puertoSwitch && puertoSwitch.switch
        ? puertoSwitch.switch.nombre?.trim() ||
          `Switch #${puertoSwitch.switch.id}`
        : puertoSwitch && "switch_id" in puertoSwitch
          ? `Switch #${puertoSwitch.switch_id}`
          : "Sin switch";
    const puertoSwitchTexto =
      puertoSwitch && "numero" in puertoSwitch
        ? `Puerto ${puertoSwitch.numero}`
        : "Sin puerto";
    const equipoNombre =
      puertoSwitch &&
      "equipo" in puertoSwitch &&
      puertoSwitch.equipo &&
      puertoSwitch.equipo.nombre
        ? puertoSwitch.equipo.nombre.trim()
        : "Sin equipo";
    const observacionPatch =
      typeof puerto.observaciones === "string" &&
      puerto.observaciones.trim().length > 0
        ? puerto.observaciones.trim()
        : null;
    const observacionSwitch =
      puertoSwitch &&
      "observaciones" in puertoSwitch &&
      typeof puertoSwitch.observaciones === "string" &&
      puertoSwitch.observaciones.trim().length > 0
        ? puertoSwitch.observaciones.trim()
        : null;

    return {
      etiquetaTexto,
      switchNombre,
      puertoSwitchTexto,
      equipoNombre,
      observacionPatch,
      observacionSwitch,
    };
  };

  const portMatchesSearch = (puerto: PatchPanelPortRecord) => {
    if (!isSearchActive) return true;
    const info = resolvePortInfo(puerto);
    const valores = [
      info.etiquetaTexto,
      info.observacionPatch,
      info.observacionSwitch,
      info.switchNombre,
      info.equipoNombre,
    ]
      .map((valor) => normalizeValue(valor))
      .filter((valor) => valor.length > 0);
    return valores.some((valor) => valor.includes(trimmedSearch));
  };

  const portMatchesFilters = (puerto: PatchPanelPortRecord) => {
    const hasSwitchPort =
      typeof puerto.puerto_switch_id === "number" &&
      Number.isFinite(puerto.puerto_switch_id);
    const isFree = !hasSwitchPort;
    if (showFreePorts && !isFree) return false;
    return portMatchesSearch(puerto);
  };

  const panelsForConnections = useMemo(() => {
    const basePanels = isFilterActive
      ? ordenados
      : ordenados.filter((panel) => expandedPanels.has(String(panel.id)));

    return basePanels
      .map((panel) => {
        const puertosOrdenados =
          Array.isArray(panel.puertos) && panel.puertos.length > 0
            ? panel.puertos.slice().sort((a, b) => a.numero - b.numero)
            : [];
        const puertosFiltrados = isFilterActive
          ? puertosOrdenados.filter((puerto) => portMatchesFilters(puerto))
          : puertosOrdenados;

        return {
          panel,
          puertosOrdenados,
          puertosFiltrados,
        };
      })
      .filter((entry) => !isFilterActive || entry.puertosFiltrados.length > 0);
  }, [expandedPanels, isFilterActive, ordenados, portMatchesFilters, trimmedSearch, showFreePorts]);

  return (
    <section className="space-y-4">
      <div className={isPrintActive ? "print:hidden" : ""}>
        <header className="space-y-1">
          <h2 className="text-xl font-semibold text-foreground">Patch panels</h2>
          <p className="text-sm text-foreground/70">
            Inventario general de patch panels. Total actuales: {patchpanels.length}.
          </p>
        </header>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
        {ordenados.map((item) => {
          const nombre =
            item.nombre && item.nombre.trim().length > 0
              ? item.nombre.trim()
              : "Patch panel sin nombre";
          const puertosTotalesNumero =
            typeof item.puertos_totales === "number" &&
            Number.isFinite(item.puertos_totales)
              ? Number(item.puertos_totales)
              : null;
          const puertosTexto =
            puertosTotalesNumero !== null ? `${puertosTotalesNumero}` : "Sin dato";
          const garantiaTexto = item.en_garantia ? "Si" : "No";
          const observaciones =
            typeof item.observaciones === "string" &&
            item.observaciones.trim().length > 0
              ? item.observaciones.trim()
              : null;
          const mostrarDetalle = expandedPanels.has(String(item.id));

          const puertosHref =
            fromQueryParam && fromQueryParam.length > 0
              ? `/patchpanels/${item.id}/puertos?from=${encodeURIComponent(fromQueryParam)}`
              : `/patchpanels/${item.id}/puertos`;

          return (
            <article
              key={item.id}
              className="relative flex flex-col gap-3 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm"
            >
              <header className="space-y-1">
                <h3 className="text-lg font-semibold text-foreground">{nombre}</h3>
                <p className="text-sm text-foreground/70">
                  Puertos totales: {puertosTexto}
                </p>
              </header>

              <dl className="space-y-2 pr-4 text-sm text-foreground/80">
                <div className="flex flex-wrap items-baseline gap-2">
                  <dt className="font-medium text-foreground/60">Puertos:</dt>
                  <dd className="text-foreground">
                    {puertosTotalesNumero !== null ? (
                      <Link
                        href={puertosHref}
                        onClick={(event) =>
                          abrirProteccionEdicion(event, puertosHref, `${nombre} (puertos)`)
                        }
                        className="text-blue-600 underline underline-offset-4 transition hover:text-blue-700"
                      >
                        Puertos ({puertosTexto})
                      </Link>
                    ) : (
                      "Sin dato"
                    )}
                  </dd>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <dt className="font-medium text-foreground/60">Detalles:</dt>
                  <dd className="text-foreground">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground/70">
                      <input
                        type="checkbox"
                        checked={mostrarDetalle}
                        onChange={() => toggleExpanded(String(item.id))}
                        className="h-4 w-4 cursor-pointer rounded border-border text-foreground focus:ring-2 focus:ring-foreground/30"
                      />
                      Mostrar conexiones
                    </label>
                  </dd>
                </div>

                <div className="flex flex-wrap items-baseline gap-2">
                  <dt className="font-medium text-foreground/60">Fecha compra:</dt>
                  <dd className="text-foreground">{formatearFecha(item.fecha_compra)}</dd>
                </div>

                <div className="flex flex-wrap items-baseline gap-2">
                  <dt className="font-medium text-foreground/60">En garantia:</dt>
                  <dd className="text-foreground">{garantiaTexto}</dd>
                </div>

                {observaciones ? (
                  <div className="flex flex-col gap-1">
                    <dt className="font-medium text-foreground/60">Observaciones</dt>
                    <dd className="text-foreground/80 whitespace-pre-wrap break-words">
                      {observaciones}
                    </dd>
                  </div>
                ) : null}
              </dl>

            </article>
          );
        })}
        </div>
      </div>

      <div className="space-y-2 print:hidden">
        <label className="text-sm font-medium text-foreground/70">
          Buscar tomas del patch panel
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Etiqueta, observaciones, switch o equipo..."
            className="w-full max-w-2xl flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
          />
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground/70">
            <input
              type="checkbox"
              checked={showFreePorts}
              onChange={(event) => setShowFreePorts(event.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-border text-foreground focus:ring-2 focus:ring-foreground/30"
            />
            Puertos libres
          </label>
        </div>
      </div>

      {isFilterActive || expandedPanels.size > 0 ? (
        <section className="space-y-4">
          <header className="space-y-1">
            <h3 className="text-lg font-semibold text-foreground">Conexiones</h3>
            <p className="text-sm text-foreground/70">
              {isFilterActive
                ? `Resultados para: "${searchTerm.trim() || "Puertos libres"}".`
                : "Detalle de los patch panels seleccionados."}
            </p>
          </header>

          {panelsForConnections.length === 0 ? (
            <p className="text-sm text-foreground/60">
              No hay tomas que coincidan con la búsqueda.
            </p>
          ) : (
            panelsForConnections.map((entry) => {
              const { panel, puertosOrdenados, puertosFiltrados } = entry;
              const nombre =
                panel.nombre && panel.nombre.trim().length > 0
                  ? panel.nombre.trim()
                  : `Patch panel #${panel.id}`;
              const puertosToRender = isFilterActive ? puertosFiltrados : puertosOrdenados;
              const ocultarEnImpresion =
                isPrintActive &&
                printTargetId !== null &&
                String(panel.id) !== printTargetId;

              return (
                <article
                  key={`detalle-${panel.id}`}
                  className={`space-y-3 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm ${
                    ocultarEnImpresion ? "print:hidden" : ""
                  }`}
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="text-base font-semibold text-foreground">{nombre}</h4>
                      <p className="text-xs text-foreground/60">
                        {isFilterActive
                          ? `Coincidencias: ${puertosToRender.length}`
                          : `Puertos configurados: ${puertosOrdenados.length}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSavePdf(panel, puertosToRender)}
                        title="Guardar PDF"
                        aria-label={`Guardar PDF de ${nombre}`}
                        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-border/60 bg-background text-foreground/60 transition hover:bg-background hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40 print:hidden"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          aria-hidden="true"
                        >
                          <path
                            d="M6 3h9l3 3v15H6V3Z"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M9 3v5h6V3"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M8 12h8M8 15h8"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrintTargetId(String(panel.id))}
                        title="Imprimir tabla"
                        aria-label={`Imprimir conexiones de ${nombre}`}
                        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-border/60 bg-background text-foreground/60 transition hover:bg-background hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40 print:hidden"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          aria-hidden="true"
                        >
                          <path
                            d="M7 7V3.75C7 3.336 7.336 3 7.75 3h8.5C16.664 3 17 3.336 17 3.75V7"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <rect
                            x="5"
                            y="13"
                            width="14"
                            height="8"
                            rx="2"
                            stroke="currentColor"
                            strokeWidth="1.5"
                          />
                          <rect
                            x="4"
                            y="7"
                            width="16"
                            height="7"
                            rx="2"
                            stroke="currentColor"
                            strokeWidth="1.5"
                          />
                          <path
                            d="M8 16h8M8 18.5h8"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                      <Link
                        href={
                          fromQueryParam && fromQueryParam.length > 0
                            ? `/patchpanels/${panel.id}/puertos?from=${encodeURIComponent(fromQueryParam)}`
                            : `/patchpanels/${panel.id}/puertos`
                        }
                        className="text-xs text-blue-600 underline underline-offset-4 transition hover:text-blue-700 print:hidden"
                      >
                        Editar conexiones
                      </Link>
                    </div>
                  </div>

                  {puertosToRender.length === 0 ? (
                    <p className="text-sm text-foreground/60">
                      {isFilterActive
                        ? "No hay tomas que coincidan con la búsqueda."
                        : "No hay puertos configurados en este patch panel."}
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px] border-collapse text-sm">
                        <thead>
                          <tr className="bg-foreground/5 text-left text-foreground/70">
                            <th className="px-3 py-2 font-medium">Puerto patch</th>
                            <th className="px-3 py-2 font-medium">Switch</th>
                            <th className="px-3 py-2 font-medium">Puerto switch</th>
                            <th className="px-3 py-2 font-medium">Equipo conectado</th>
                            <th className="px-3 py-2 font-medium">Observaciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {puertosToRender.map((puerto) => {
                            const {
                              etiquetaTexto,
                              switchNombre,
                              puertoSwitchTexto,
                              equipoNombre,
                              observacionPatch,
                              observacionSwitch,
                            } = resolvePortInfo(puerto);

                            return (
                              <tr key={puerto.id}>
                                <td className="px-3 py-2 text-foreground">
                                  {etiquetaTexto ? (
                                    <span>
                                      <span className="font-semibold">
                                        {etiquetaTexto}
                                      </span>{" "}
                                      - {puerto.numero}
                                    </span>
                                  ) : (
                                    <span>{puerto.numero}</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-foreground">{switchNombre}</td>
                                <td className="px-3 py-2 text-foreground">{puertoSwitchTexto}</td>
                                <td className="px-3 py-2 text-foreground">{equipoNombre}</td>
                                <td className="px-3 py-2 text-foreground">
                                  {observacionPatch || observacionSwitch ? (
                                    <div className="flex flex-col gap-1">
                                      {observacionPatch ? (
                                        <span>Patch: {observacionPatch}</span>
                                      ) : null}
                                      {observacionSwitch ? (
                                        <span>Switch: {observacionSwitch}</span>
                                      ) : null}
                                    </div>
                                  ) : (
                                    "Sin observaciones"
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </section>
      ) : null}

      {editDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 text-sm text-card-foreground shadow-lg">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-foreground">
                Confirmar contrasena
              </h2>
              <p className="text-xs text-foreground/60">
                Introduce la contrasena para editar {editDialog.context}.
              </p>
            </div>

            <form
              className="space-y-4"
              onSubmit={manejarSubmitEdicion}
              autoComplete="off"
            >
              <label className="flex flex-col gap-1 text-xs text-foreground/70">
                Contrasena
                <div className="flex items-center gap-2">
                  <input
                    type={showEditPassword ? "text" : "password"}
                    value={editPassword}
                    onChange={(event) => setEditPassword(event.target.value)}
                    className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
                    placeholder="Introduce la contrasena"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword((prev) => !prev)}
                    className="inline-flex cursor-pointer items-center rounded-md border border-border bg-background px-2 py-1 text-xs font-semibold uppercase tracking-wide text-foreground/70 transition hover:bg-foreground/10 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40"
                  >
                    {showEditPassword ? "Ocultar" : "Ver"}
                  </button>
                </div>
              </label>

              {editError ? (
                <p className="text-xs text-red-500">{editError}</p>
              ) : null}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={cerrarProteccionEdicion}
                  className="inline-flex cursor-pointer items-center rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-foreground/70 transition hover:bg-foreground/10 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={isVerifyingEdit}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingEdit}
                  className="inline-flex cursor-pointer items-center rounded-md bg-foreground px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-background transition hover:bg-foreground/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isVerifyingEdit ? "Verificando..." : "Entrar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
