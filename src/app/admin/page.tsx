import Link from "next/link";

export default function AdminPage() {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <article className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Planos</h2>
        <p className="mt-2 text-sm text-foreground/70">
          Coloca visualmente los equipos dentro de cada SVG y guarda sus coordenadas.
        </p>
        <Link
          href="/admin/planos"
          className="mt-4 inline-flex items-center rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background transition hover:bg-foreground/90"
        >
          Abrir editor de planos
        </Link>
      </article>
    </section>
  );
}
