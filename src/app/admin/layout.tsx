import Link from "next/link";

import { AdminPasswordGate } from "@/components/AdminPasswordGate";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AdminPasswordGate context="acceder al área de administración">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-10">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-foreground">Administración</h1>
            <p className="text-sm text-foreground/70">
              Herramientas internas de configuración y mantenimiento.
            </p>
          </div>
          <Link
            href="/"
            className="text-sm text-blue-600 underline underline-offset-4 transition hover:text-blue-700"
          >
            Volver al dashboard
          </Link>
        </header>

        {children}
      </main>
    </AdminPasswordGate>
  );
}
