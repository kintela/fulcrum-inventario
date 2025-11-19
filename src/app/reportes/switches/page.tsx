import Link from "next/link";

import SwitchConnectionsReport from "@/components/SwitchConnectionsReport";
import { fetchSwitches } from "@/lib/supabase";

export default async function ReporteSwitchesPage() {
  const switches = await fetchSwitches();
  const totalSwitches = switches.length;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Conexiones por switch</h1>
          <p className="text-sm text-foreground/70">
            Selecciona en el filtro de abajo los switches que quieras revisar.
            Hay{" "}
            <span className="font-semibold text-foreground">
              {totalSwitches}
            </span>{" "}
            datos disponibles.
          </p>
        </div>
        <Link
          href="/"
          className="text-sm text-blue-600 underline underline-offset-4 transition hover:text-blue-700"
        >
          Volver al dashboard
        </Link>
      </header>

      {switches.length === 0 ? (
        <p className="text-sm text-foreground/70">No hay switches registrados.</p>
      ) : (
        <SwitchConnectionsReport switches={switches} />
      )}
    </main>
  );
}
