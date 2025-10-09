import EquiposList from "@/components/EquiposList";
import { formatearImporte } from "@/lib/format";
import { fetchEquipos } from "@/lib/supabase";

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

export default async function Dashboard() {
  const equipos = await fetchEquipos();

  const indicadores = equipos.reduce<Indicadores>((acc, equipo) => {
    const clave = equipo.tipo?.toLowerCase() as TipoClave | undefined;
    if (!clave || acc[clave] === undefined) {
      return acc;
    }

    const precioCents = Math.round(Number(equipo.precio_compra ?? 0) * 100);
    const soPrecioCents = Math.round(Number(equipo.so_precio ?? 0) * 100);
    const totalCents = precioCents + soPrecioCents;

    acc[clave].cantidad += 1;
    acc[clave].gastoTotalCents += totalCents;

    if (equipo.fecha_compra) {
      const fecha = new Date(equipo.fecha_compra);
      if (!Number.isNaN(fecha.getTime())) {
        const anio = fecha.getFullYear();
        if (anio in acc[clave].gastoPorAnioCents) {
          acc[clave].gastoPorAnioCents[anio] += totalCents;
          acc[clave].equiposPorAnio[anio] += 1;
        }
      }
    }

    return acc;
  }, crearIndicadoresBase());

  return (
    <div className="flex w-full flex-col gap-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">Inventario de equipos</h1>
        <p className="max-w-2xl text-sm text-foreground/70">
          Resumen general del parque de equipos. Los totales se agrupan por tipo y las tarjetas
          muestran el detalle ordenado por fecha de compra más reciente.
        </p>
      </header>

      <section aria-label="Totales por tipo">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
          {tipoClaves.map((clave) => (
            <article
              key={clave}
              className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm"
            >
              <h2 className="text-sm font-medium text-foreground/70">{tipoLabels[clave]}</h2>
              <p className="mt-2 text-3xl font-semibold">{indicadores[clave].cantidad}</p>

              <div className="mt-4 grid grid-cols-4 gap-3 text-xs sm:text-sm">
                <div className="space-y-1">
                  <p className="font-medium text-foreground/60">Gasto total</p>
                  <p className="font-semibold text-foreground">
                    {formatearImporte(indicadores[clave].gastoTotalCents / 100)}
                  </p>
                </div>
                {aniosReferencia.map((anio) => (
                  <div key={anio} className="space-y-1">
                    <p className="font-medium text-foreground/60">
                      {anio} ({indicadores[clave].equiposPorAnio[anio] ?? 0})
                    </p>
                    <p className="font-semibold text-foreground">
                      {formatearImporte((indicadores[clave].gastoPorAnioCents[anio] ?? 0) / 100)}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <EquiposList equipos={equipos} />
    </div>
  );
}
