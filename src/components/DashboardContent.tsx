"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import EquiposList from "@/components/EquiposList";
import { formatearImporte } from "@/lib/format";
import type { EquipoRecord, PantallaRecord } from "@/lib/supabase";

const tipoLabels: Record<string, string> = {
  sobremesa: "Sobremesa",
  portatil: "Portátil",
  tablet: "Tablet",
};

type TipoClave = keyof typeof tipoLabels;

const tipoClaves: TipoClave[] = ["sobremesa", "portatil", "tablet"];

const currentYear = new Date().getFullYear();
const aniosReferencia = [currentYear, currentYear - 1, currentYear - 2];

type Indicadores = Record<
  TipoClave,
  {
    cantidad: number;
    gastoTotalCents: number;
    gastoPorAnioCents: Record<number, number>;
    equiposPorAnio: Record<number, number>;
  }
>;

function crearIndicadoresBase(): Indicadores {
  const valoresIniciales = Object.fromEntries(aniosReferencia.map((anio) => [anio, 0])) as Record<
    number,
    number
  >;

  return tipoClaves.reduce((acc, clave) => {
    acc[clave] = {
      cantidad: 0,
      gastoTotalCents: 0,
      gastoPorAnioCents: { ...valoresIniciales },
      equiposPorAnio: { ...valoresIniciales },
    };
    return acc;
  }, {} as Indicadores);
}

function calcularIndicadores(equipos: EquipoRecord[]): Indicadores {
  const indicadores = crearIndicadoresBase();

  equipos.forEach((equipo) => {
    const clave = equipo.tipo?.toLowerCase() as TipoClave | undefined;
    if (!clave || !(clave in indicadores)) return;

    const precioCents = Math.round(Number(equipo.precio_compra ?? 0) * 100);
    const soPrecioCents = Math.round(Number(equipo.so_precio ?? 0) * 100);
    const totalCents = precioCents + soPrecioCents;

    indicadores[clave].cantidad += 1;
    indicadores[clave].gastoTotalCents += totalCents;

    if (equipo.fecha_compra) {
      const fecha = new Date(equipo.fecha_compra);
      if (!Number.isNaN(fecha.getTime())) {
        const anio = fecha.getFullYear();
        if (anio in indicadores[clave].gastoPorAnioCents) {
          indicadores[clave].gastoPorAnioCents[anio] += totalCents;
          indicadores[clave].equiposPorAnio[anio] += 1;
        }
      }
    }
  });

  return indicadores;
}

type PantallasResumen = {
  cantidad: number;
  gastoTotalCents: number;
  gastoPorAnioCents: Record<number, number>;
  pantallasPorAnio: Record<number, number>;
};

function crearPantallasResumenBase(): PantallasResumen {
  const valoresIniciales = Object.fromEntries(
    aniosReferencia.map((anio) => [anio, 0]),
  ) as Record<number, number>;

  return {
    cantidad: 0,
    gastoTotalCents: 0,
    gastoPorAnioCents: { ...valoresIniciales },
    pantallasPorAnio: { ...valoresIniciales },
  };
}

function calcularResumenPantallas(
  equipos: EquipoRecord[],
  pantallasSinEquipo: PantallaRecord[] = [],
): PantallasResumen {
  const resumen = crearPantallasResumenBase();

  equipos.forEach((equipo) => {
    if (!Array.isArray(equipo.pantallas)) return;

    equipo.pantallas.forEach((pantalla) => {
      resumen.cantidad += 1;

      const precio = Number(pantalla.precio ?? 0);
      const precioCents = Number.isFinite(precio)
        ? Math.round(precio * 100)
        : 0;
      resumen.gastoTotalCents += precioCents;

      if (pantalla.fecha_compra) {
        const fecha = new Date(pantalla.fecha_compra);
        if (!Number.isNaN(fecha.getTime())) {
          const anio = fecha.getFullYear();
          if (anio in resumen.pantallasPorAnio) {
            resumen.pantallasPorAnio[anio] += 1;
            resumen.gastoPorAnioCents[anio] += precioCents;
          }
        }
      }
    });
  });

  pantallasSinEquipo.forEach((pantalla) => {
    resumen.cantidad += 1;

    const precio = Number(pantalla.precio ?? 0);
    const precioCents = Number.isFinite(precio) ? Math.round(precio * 100) : 0;
    resumen.gastoTotalCents += precioCents;

    if (pantalla.fecha_compra) {
      const fecha = new Date(pantalla.fecha_compra);
      if (!Number.isNaN(fecha.getTime())) {
        const anio = fecha.getFullYear();
        if (anio in resumen.pantallasPorAnio) {
          resumen.pantallasPorAnio[anio] += 1;
          resumen.gastoPorAnioCents[anio] += precioCents;
        }
      }
    }
  });

  return resumen;
}

type DashboardContentProps = {
  equipos: EquipoRecord[];
  pantallasSinEquipo: PantallaRecord[];
};

export default function DashboardContent({
  equipos,
  pantallasSinEquipo,
}: DashboardContentProps) {
  const searchParams = useSearchParams();
  const currentQueryString = searchParams?.toString() ?? "";
  const fromQuery = currentQueryString
    ? `from=${encodeURIComponent(currentQueryString)}`
    : "";
  const [selectedTipo, setSelectedTipo] = useState<TipoClave | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const indicadores = useMemo(() => calcularIndicadores(equipos), [equipos]);
  const resumenPantallas = useMemo(
    () => calcularResumenPantallas(equipos, pantallasSinEquipo),
    [equipos, pantallasSinEquipo],
  );

  const handleFilter = (tipo: TipoClave, year: number | null = null) => {
    if (selectedTipo === tipo && selectedYear === year) {
      setSelectedTipo(null);
      setSelectedYear(null);
      return;
    }

    setSelectedTipo(tipo);
    setSelectedYear(year);
  };

  const limpiarFiltro = () => {
    setSelectedTipo(null);
    setSelectedYear(null);
  };

  const filtroActivoTexto = useMemo(() => {
    if (!selectedTipo) return null;
    const base = tipoLabels[selectedTipo];
    return selectedYear ? `${base} · ${selectedYear}` : base;
  }, [selectedTipo, selectedYear]);

  return (
    <div className="flex w-full flex-col gap-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">Inventario de equipos</h1>
        <p className="text-sm text-foreground/70 whitespace-nowrap">
          Resumen general del parque de equipos. Los totales se agrupan por tipo y las tarjetas
          muestran el detalle ordenado por fecha de compra más reciente.
        </p>
      </header>

      <section aria-label="Totales por tipo">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
          {tipoClaves.map((clave) => (
            <article
              key={clave}
              className="relative rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm"
            >
              <Link
                href={
                  fromQuery
                    ? `/equipos/nuevo?tipo=${encodeURIComponent(clave)}&${fromQuery}`
                    : `/equipos/nuevo?tipo=${encodeURIComponent(clave)}`
                }
                aria-label={`Añadir ${tipoLabels[clave]}`}
                title="Añadir equipo"
                className="absolute right-4 top-4 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-border/60 bg-background text-foreground/70 transition hover:bg-background/80 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40"
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path
                    d="M10 4v12M4 10h12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>

              <h2 className="text-sm font-medium text-foreground/70">{tipoLabels[clave]}</h2>
              <p className="mt-2 text-3xl font-semibold">{indicadores[clave].cantidad}</p>

              <div className="mt-4 grid grid-cols-4 gap-3 text-xs sm:text-sm">
                <div className="space-y-1">
                  <p className="font-medium text-foreground/60">Gasto total</p>
                  <button
                    type="button"
                    onClick={() => handleFilter(clave)}
                    className={`inline-flex w-full cursor-pointer justify-start font-semibold underline-offset-4 transition ${
                      selectedTipo === clave && selectedYear === null
                        ? "text-blue-800 underline"
                        : "text-blue-600 hover:text-blue-700 hover:underline"
                    }`}
                  >
                    {formatearImporte(indicadores[clave].gastoTotalCents / 100)}
                  </button>
                </div>
                {aniosReferencia.map((anio) => (
                  <div key={anio} className="space-y-1">
                    <p className="font-medium text-foreground/60">
                      {anio} ({indicadores[clave].equiposPorAnio[anio] ?? 0})
                    </p>
                    <button
                      type="button"
                      onClick={() => handleFilter(clave, anio)}
                      className={`inline-flex w-full cursor-pointer justify-start font-semibold underline-offset-4 transition ${
                        selectedTipo === clave && selectedYear === anio
                          ? "text-blue-800 underline"
                          : "text-blue-600 hover:text-blue-700 hover:underline"
                      }`}
                    >
                      {formatearImporte((indicadores[clave].gastoPorAnioCents[anio] ?? 0) / 100)}
                    </button>
                  </div>
                ))}
              </div>
            </article>
          ))}

          <article className="relative rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
            <Link
              href={fromQuery ? `/pantallas/nueva?${fromQuery}` : "/pantallas/nueva"}
              aria-label="Añadir pantalla"
              title="Añadir pantalla"
              className="absolute right-4 top-4 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-border/60 bg-background text-foreground/70 transition hover:bg-background/80 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40"
            >
              <svg
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path
                  d="M10 4v12M4 10h12"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
            <h2 className="text-sm font-medium text-foreground/70">Pantallas</h2>
            <p className="mt-2 text-3xl font-semibold">{resumenPantallas.cantidad}</p>

            <div className="mt-4 grid grid-cols-4 gap-3 text-xs sm:text-sm">
              <div className="space-y-1">
                <p className="font-medium text-foreground/60">Gasto total</p>
                <span className="inline-flex w-full justify-start font-semibold text-foreground transition">
                  {formatearImporte(resumenPantallas.gastoTotalCents / 100)}
                </span>
              </div>
              {aniosReferencia.map((anio) => (
                <div key={`pantallas-${anio}`} className="space-y-1">
                  <p className="font-medium text-foreground/60">
                    {anio} ({resumenPantallas.pantallasPorAnio[anio] ?? 0})
                  </p>
                  <span className="inline-flex w-full justify-start font-semibold text-foreground transition">
                    {formatearImporte(
                      (resumenPantallas.gastoPorAnioCents[anio] ?? 0) / 100,
                    )}
                  </span>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      {filtroActivoTexto ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card/40 px-3 py-2 text-sm text-foreground/80">
          <span>
            Filtro activo: <span className="font-semibold text-foreground">{filtroActivoTexto}</span>
          </span>
          <button
            type="button"
            onClick={limpiarFiltro}
            className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground/70 transition hover:bg-foreground/10"
          >
            Limpiar
          </button>
        </div>
      ) : null}

      <EquiposList
        equipos={equipos}
        filtroTipo={selectedTipo}
        filtroAnio={selectedYear}
        pantallasSinEquipo={pantallasSinEquipo}
      />
    </div>
  );
}
