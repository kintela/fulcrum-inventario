"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

import { formatearFecha, formatearImporte } from "@/lib/format";
import type { SwitchRecord } from "@/lib/supabase";

export type SwitchesYearFilter = number | "total" | null;

type SwitchesListProps = {
  switches: SwitchRecord[];
  filtro: SwitchesYearFilter;
};

function obtenerTimestamp(fecha: string | null | undefined): number {
  if (!fecha) return Number.NEGATIVE_INFINITY;
  const date = new Date(fecha);
  if (Number.isNaN(date.getTime())) return Number.NEGATIVE_INFINITY;
  return date.getTime();
}

export default function SwitchesList({
  switches,
  filtro,
}: SwitchesListProps) {
  const searchParams = useSearchParams();
  const fromQueryParam = searchParams?.toString();

  const ordenados = useMemo(() => {
    return [...switches].sort((a, b) => {
      const fechaA = obtenerTimestamp(a.fecha_compra);
      const fechaB = obtenerTimestamp(b.fecha_compra);

      if (fechaA !== fechaB) {
        return fechaB - fechaA;
      }

      const nombreA = (a.nombre ?? "").toLowerCase();
      const nombreB = (b.nombre ?? "").toLowerCase();
      return nombreA.localeCompare(nombreB, "es");
    });
  }, [switches]);

  const filtrados = useMemo(() => {
    if (typeof filtro !== "number") {
      return ordenados;
    }

    return ordenados.filter((item) => {
      if (!item.fecha_compra) return false;
      const fecha = new Date(item.fecha_compra);
      if (Number.isNaN(fecha.getTime())) return false;
      return fecha.getFullYear() === filtro;
    });
  }, [filtro, ordenados]);

  const descripcionFiltro = useMemo(() => {
    if (filtro === "total") {
      return `Mostrando todos los switches (${filtrados.length})`;
    }
    if (typeof filtro === "number") {
      return `Switches comprados en ${filtro}: ${filtrados.length}`;
    }
    return null;
  }, [filtro, filtrados.length]);

  if (switches.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold text-foreground">Switches</h2>
        <p className="text-sm text-foreground/70">
          {descripcionFiltro ??
            `Inventario general de switches. Total actuales: ${switches.length}.`}
        </p>
      </header>

      {filtrados.length === 0 ? (
        <p className="text-sm text-foreground/60">
          No hay switches que coincidan con el filtro seleccionado.
        </p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
          {filtrados.map((item) => {
            const nombre =
              item.nombre && item.nombre.trim().length > 0
                ? item.nombre.trim()
                : "Switch sin nombre";
            const fabricante =
              item.fabricante?.nombre && item.fabricante.nombre.trim().length > 0
                ? item.fabricante.nombre.trim()
                : "Sin fabricante";
            const modelo =
              item.modelo && item.modelo.trim().length > 0
                ? item.modelo.trim()
                : null;
            const banda =
              item.ancho_banda_gbps !== null &&
              item.ancho_banda_gbps !== undefined &&
              Number.isFinite(Number(item.ancho_banda_gbps))
                ? `${item.ancho_banda_gbps} Gbps`
                : null;
            const ubicacion =
              item.ubicacion?.nombre && item.ubicacion.nombre.trim().length > 0
                ? item.ubicacion.nombre.trim()
                : "Sin ubicacion";

            const partesDescripcion = [fabricante];
            if (modelo) {
              partesDescripcion.push(modelo);
            }
            const cabeceraDetalle = `${partesDescripcion.join(" - ")}${
              banda ? ` (${banda})` : ""
            }`;

            const ipTexto =
              item.ip && item.ip.trim().length > 0 ? item.ip.trim() : "Sin IP";
            const puertosTotalesNumero =
              typeof item.puertos_totales === "number" &&
              Number.isFinite(item.puertos_totales)
                ? Number(item.puertos_totales)
                : null;
            const puertosTexto =
              puertosTotalesNumero !== null ? `${puertosTotalesNumero}` : "Sin dato";
            const garantiaTexto = item.en_garantia ? "Si" : "No";
            const precioReferencia =
              item.precio ?? item.precio_compra ?? null;

            const editHref =
              fromQueryParam && fromQueryParam.length > 0
                ? `/switches/${item.id}/editar?from=${encodeURIComponent(fromQueryParam)}`
                : `/switches/${item.id}/editar`;

            return (
              <article
                key={item.id}
                className="relative flex flex-col gap-3 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm"
              >
                <Link
                  href={editHref}
                  aria-label={`Editar ${nombre}`}
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

                <header className="space-y-1 pr-10">
                  <h3 className="text-lg font-semibold text-foreground">
                    {nombre}
                  </h3>
                  <p className="text-sm text-foreground/70">{cabeceraDetalle}</p>
                </header>

                <dl className="grid gap-2 text-sm text-foreground/80 pr-4">
                  <div className="flex justify-between gap-3">
                    <dt className="font-medium text-foreground/60">Ubicacion</dt>
                    <dd className="text-foreground">{ubicacion}</dd>
                  </div>

                  <div className="flex justify-between gap-3">
                    <dt className="font-medium text-foreground/60">IP</dt>
                    <dd className="text-foreground">{ipTexto}</dd>
                  </div>

                  <div className="flex justify-between gap-3">
                    <dt className="font-medium text-foreground/60">
                      Puertos totales
                    </dt>
                    <dd className="text-foreground">
                      {puertosTotalesNumero !== null ? (
                        <Link
                          href={`/switches/${item.id}/puertos`}
                          className="text-blue-600 underline underline-offset-4 transition hover:text-blue-700"
                        >
                          {puertosTexto}
                        </Link>
                      ) : (
                        puertosTexto
                      )}
                    </dd>
                  </div>

                  <div className="flex justify-between gap-3">
                    <dt className="font-medium text-foreground/60">
                      Ancho de banda
                    </dt>
                    <dd className="text-foreground">{banda ?? "Sin dato"}</dd>
                  </div>

                  <div className="flex justify-between gap-3">
                    <dt className="font-medium text-foreground/60">Precio</dt>
                    <dd className="text-foreground">
                      {formatearImporte(precioReferencia)}
                    </dd>
                  </div>

                  <div className="flex justify-between gap-3">
                    <dt className="font-medium text-foreground/60">
                      Fecha compra
                    </dt>
                    <dd className="text-foreground">
                      {formatearFecha(item.fecha_compra)}
                    </dd>
                  </div>

                  <div className="flex justify-between gap-3">
                    <dt className="font-medium text-foreground/60">
                      En garantia
                    </dt>
                    <dd className="text-foreground">{garantiaTexto}</dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
