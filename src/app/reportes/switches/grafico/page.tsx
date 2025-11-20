import Link from "next/link";

import SwitchesConnectionsGraph from "@/components/SwitchesConnectionsGraph";
import { fetchSwitches } from "@/lib/supabase";

export default async function ReporteSwitchesGraficoPage() {
  const switches = await fetchSwitches();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Esquema de conexiones</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3 text-sm">
          <Link
            href="/reportes/switches"
            className="text-blue-600 underline underline-offset-4 transition hover:text-blue-700"
          >
            Volver a conexiones
          </Link>
          <Link
            href="/"
            className="text-blue-600 underline underline-offset-4 transition hover:text-blue-700"
          >
            Volver al dashboard
          </Link>
        </div>
      </header>

      {switches.length === 0 ? (
        <p className="text-sm text-foreground/70">No hay switches registrados.</p>
      ) : (
        <SwitchesConnectionsGraph switches={switches} />
      )}
    </main>
  );
}
