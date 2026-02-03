"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { FormEvent, MouseEvent } from "react";

import { formatearFecha } from "@/lib/format";
import { verifyAdminPassword } from "@/lib/verifyAdminPassword";
import type { PatchPanelRecord } from "@/lib/supabase";

type PatchPanelsListProps = {
  patchpanels: PatchPanelRecord[];
};

function obtenerTimestamp(fecha: string | null | undefined): number {
  if (!fecha) return Number.NEGATIVE_INFINITY;
  const date = new Date(fecha);
  if (Number.isNaN(date.getTime())) return Number.NEGATIVE_INFINITY;
  return date.getTime();
}

export default function PatchPanelsList({ patchpanels }: PatchPanelsListProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const fromQueryParam = searchParams?.toString();
  const [editDialog, setEditDialog] = useState<{
    href: string;
    context: string;
  } | null>(null);
  const [editPassword, setEditPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [isVerifyingEdit, setIsVerifyingEdit] = useState(false);

  const abrirProteccionEdicion = useCallback(
    (
      event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>,
      href: string,
      context: string,
    ) => {
      event.preventDefault();
      setEditDialog({ href, context });
      setEditPassword("");
      setShowEditPassword(false);
      setEditError(null);
      setIsVerifyingEdit(false);
    },
    [],
  );

  const cerrarProteccionEdicion = useCallback(() => {
    setEditDialog(null);
    setEditPassword("");
    setShowEditPassword(false);
    setEditError(null);
    setIsVerifyingEdit(false);
  }, []);

  const manejarSubmitEdicion = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!editDialog) return;
      const trimmed = editPassword.trim();
      if (!trimmed) {
        setEditError("Introduce la contrasena.");
        return;
      }
      setIsVerifyingEdit(true);
      setEditError(null);
      try {
        await verifyAdminPassword(trimmed);
        const destino = editDialog.href;
        cerrarProteccionEdicion();
        router.push(destino);
      } catch (error) {
        console.error(error);
        setEditError(
          error instanceof Error
            ? error.message
            : "No se pudo verificar la contrasena.",
        );
      } finally {
        setIsVerifyingEdit(false);
      }
    },
    [cerrarProteccionEdicion, editDialog, editPassword, router],
  );

  const ordenados = useMemo(() => {
    return [...patchpanels].sort((a, b) => {
      const fechaA = obtenerTimestamp(a.fecha_compra);
      const fechaB = obtenerTimestamp(b.fecha_compra);

      if (fechaA !== fechaB) {
        return fechaB - fechaA;
      }

      const nombreA = (a.nombre ?? "").toLowerCase();
      const nombreB = (b.nombre ?? "").toLowerCase();
      return nombreA.localeCompare(nombreB, "es");
    });
  }, [patchpanels]);

  if (patchpanels.length === 0) {
    return (
      <p className="text-sm text-foreground/70">
        No hay patch panels registrados.
      </p>
    );
  }

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold text-foreground">Patch panels</h2>
        <p className="text-sm text-foreground/70">
          Inventario general de patch panels. Total actuales: {patchpanels.length}.
        </p>
      </header>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
        {ordenados.map((item) => {
          const nombre =
            item.nombre && item.nombre.trim().length > 0
              ? item.nombre.trim()
              : "Patch panel sin nombre";
          const puertosTotalesNumero =
            typeof item.puertos_totales === "number" &&
            Number.isFinite(item.puertos_totales)
              ? Number(item.puertos_totales)
              : null;
          const puertosTexto =
            puertosTotalesNumero !== null ? `${puertosTotalesNumero}` : "Sin dato";
          const garantiaTexto = item.en_garantia ? "Si" : "No";
          const observaciones =
            typeof item.observaciones === "string" &&
            item.observaciones.trim().length > 0
              ? item.observaciones.trim()
              : null;

          const puertosHref =
            fromQueryParam && fromQueryParam.length > 0
              ? `/patchpanels/${item.id}/puertos?from=${encodeURIComponent(fromQueryParam)}`
              : `/patchpanels/${item.id}/puertos`;

          return (
            <article
              key={item.id}
              className="relative flex flex-col gap-3 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm"
            >
              <header className="space-y-1">
                <h3 className="text-lg font-semibold text-foreground">{nombre}</h3>
                <p className="text-sm text-foreground/70">
                  Puertos totales: {puertosTexto}
                </p>
              </header>

              <dl className="space-y-2 pr-4 text-sm text-foreground/80">
                <div className="flex flex-wrap items-baseline gap-2">
                  <dt className="font-medium text-foreground/60">Puertos:</dt>
                  <dd className="text-foreground">
                    {puertosTotalesNumero !== null ? (
                      <Link
                        href={puertosHref}
                        onClick={(event) =>
                          abrirProteccionEdicion(event, puertosHref, `${nombre} (puertos)`)
                        }
                        className="text-blue-600 underline underline-offset-4 transition hover:text-blue-700"
                      >
                        Puertos ({puertosTexto})
                      </Link>
                    ) : (
                      "Sin dato"
                    )}
                  </dd>
                </div>

                <div className="flex flex-wrap items-baseline gap-2">
                  <dt className="font-medium text-foreground/60">Fecha compra:</dt>
                  <dd className="text-foreground">{formatearFecha(item.fecha_compra)}</dd>
                </div>

                <div className="flex flex-wrap items-baseline gap-2">
                  <dt className="font-medium text-foreground/60">En garantia:</dt>
                  <dd className="text-foreground">{garantiaTexto}</dd>
                </div>

                {observaciones ? (
                  <div className="flex flex-col gap-1">
                    <dt className="font-medium text-foreground/60">Observaciones</dt>
                    <dd className="text-foreground/80 whitespace-pre-wrap break-words">
                      {observaciones}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </article>
          );
        })}
      </div>

      {editDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 text-sm text-card-foreground shadow-lg">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-foreground">
                Confirmar contrasena
              </h2>
              <p className="text-xs text-foreground/60">
                Introduce la contrasena para editar {editDialog.context}.
              </p>
            </div>

            <form
              className="space-y-4"
              onSubmit={manejarSubmitEdicion}
              autoComplete="off"
            >
              <label className="flex flex-col gap-1 text-xs text-foreground/70">
                Contrasena
                <div className="flex items-center gap-2">
                  <input
                    type={showEditPassword ? "text" : "password"}
                    value={editPassword}
                    onChange={(event) => setEditPassword(event.target.value)}
                    className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
                    placeholder="Introduce la contrasena"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword((prev) => !prev)}
                    className="inline-flex cursor-pointer items-center rounded-md border border-border bg-background px-2 py-1 text-xs font-semibold uppercase tracking-wide text-foreground/70 transition hover:bg-foreground/10 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40"
                  >
                    {showEditPassword ? "Ocultar" : "Ver"}
                  </button>
                </div>
              </label>

              {editError ? (
                <p className="text-xs text-red-500">{editError}</p>
              ) : null}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={cerrarProteccionEdicion}
                  className="inline-flex cursor-pointer items-center rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-foreground/70 transition hover:bg-foreground/10 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={isVerifyingEdit}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingEdit}
                  className="inline-flex cursor-pointer items-center rounded-md bg-foreground px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-background transition hover:bg-foreground/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isVerifyingEdit ? "Verificando..." : "Entrar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
