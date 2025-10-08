import { fetchEquipos } from "@/lib/supabase";

const tipoLabels: Record<string, string> = {
  sobremesa: "Sobremesa",
  portatil: "Portátil",
  tablet: "Tablet",
};

type TipoClave = keyof typeof tipoLabels;

const tipoClaves: TipoClave[] = ["sobremesa", "portatil", "tablet"];

function formatearFecha(valor: string | null): string {
  if (!valor) return "Sin fecha";
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return "Fecha inválida";
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(fecha);
}

function formatearImporte(valor: number | null): string {
  if (valor === null || Number.isNaN(Number(valor))) return "—";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(Number(valor));
}

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
    <div className="flex flex-col gap-8 w-full">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">Inventario de equipos</h1>
        <p className="text-sm text-foreground/70 max-w-2xl">
          Resumen general del parque de equipos. Los totales se agrupan por tipo y las tarjetas
          muestran el detalle ordenado por fecha de compra más reciente.
        </p>
      </header>

      <section aria-label="Totales por tipo">
        <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
          {tipoClaves.map((clave) => (
            <article
              key={clave}
              className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-5"
            >
              <h2 className="text-sm font-medium text-foreground/70">{tipoLabels[clave]}</h2>
              <p className="mt-2 text-3xl font-semibold">{totales[clave]}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-label="Listado de equipos">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold text-foreground">Equipos</h2>
          <span className="text-sm text-foreground/60">
            {equipos.length === 1 ? "1 resultado" : `${equipos.length} resultados`}
          </span>
        </div>

        {equipos.length === 0 ? (
          <p className="text-sm text-foreground/60">
            No hay equipos registrados todavía. Añade el primero desde el panel de gestión.
          </p>
        ) : (
          <ul className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
            {equipos.map((equipo) => {
              const tipo = equipo.tipo ? tipoLabels[equipo.tipo.toLowerCase()] ?? equipo.tipo : "—";
              return (
                <li
                  key={equipo.id}
                  className="rounded-xl border border-border bg-card text-card-foreground shadow-sm flex flex-col gap-3 p-5"
                >
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      {equipo.nombre ?? "Equipo sin nombre"}
                    </h3>
                    {equipo.modelo ? (
                      <p className="text-sm text-foreground/70">{equipo.modelo}</p>
                    ) : null}
                  </div>

                  <dl className="grid gap-2 text-sm text-foreground/80">
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
                      <dd className="text-foreground">{formatearImporte(equipo.precio_compra)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="font-medium text-foreground/70">Garantía</dt>
                      <dd className="text-foreground">{equipo.en_garantia ? "Sí" : "No"}</dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
