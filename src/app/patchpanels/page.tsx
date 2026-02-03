import Link from "next/link";

import PatchPanelsList from "@/components/PatchPanelsList";
import { fetchPatchpanels } from "@/lib/supabase";

export default async function PatchPanelsPage() {
  const patchpanels = await fetchPatchpanels();
  const total = patchpanels.length;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Patch panels</h1>
          <p className="text-sm text-foreground/70">
            Total registrados: <span className="font-semibold text-foreground">{total}</span>
          </p>
        </div>
        <Link
          href="/"
          className="text-sm text-blue-600 underline underline-offset-4 transition hover:text-blue-700"
        >
          Volver al dashboard
        </Link>
      </header>

      <PatchPanelsList patchpanels={patchpanels} />
    </main>
  );
}
