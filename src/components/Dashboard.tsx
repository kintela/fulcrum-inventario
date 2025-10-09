import EquiposList from "@/components/EquiposList";
import { fetchEquipos } from "@/lib/supabase";

const tipoLabels: Record<string, string> = {
  sobremesa: "Sobremesa",
  portatil: "Portátil",
  tablet: "Tablet",
};

type TipoClave = keyof typeof tipoLabels;

const tipoClaves: TipoClave[] = ["sobremesa", "portatil", "tablet"];

export default async function Dashboard() {
  const equipos = await fetchEquipos();

  const totales = equipos.reduce<Record<TipoClave, number>>(
    (acc, equipo) => {
      const clave = equipo.tipo?.toLowerCase() as TipoClave | undefined;
      if (clave && acc[clave] !== undefined) {
        acc[clave] += 1;
      }
      return acc;
    },
    { sobremesa: 0, portatil: 0, tablet: 0 },
  );

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
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
          {tipoClaves.map((clave) => (
            <article
              key={clave}
              className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm"
            >
              <h2 className="text-sm font-medium text-foreground/70">{tipoLabels[clave]}</h2>
              <p className="mt-2 text-3xl font-semibold">{totales[clave]}</p>
            </article>
          ))}
        </div>
      </section>

      <EquiposList equipos={equipos} />
    </div>
  );
}
