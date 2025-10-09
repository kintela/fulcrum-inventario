"use client";

import { useMemo, useState } from "react";
import type { EquipoRecord } from "@/lib/supabase";

const tipoLabels: Record<string, string> = {
  sobremesa: "Sobremesa",
  portatil: "Portátil",
  tablet: "Tablet",
};

type EquiposListProps = {
  equipos: EquipoRecord[];
};

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

function normalizarValor(valor: unknown): string {
  if (valor === null || valor === undefined) {
    return "";
  }

  if (typeof valor === "boolean") {
    return valor ? "true 1 si sí yes" : "false 0 no";
  }

  if (typeof valor === "number") {
    const texto = valor.toString();
    return `${texto} ${texto.replace(".", ",")}`;
  }

  const texto = valor.toString().toLowerCase();
  const sinAcentos = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return `${texto} ${sinAcentos}`.trim();
}

export default function EquiposList({ equipos }: EquiposListProps) {
  const [query, setQuery] = useState("");

  const filtrados = useMemo(() => {
    const normalizada = query.trim().toLowerCase();
    if (!normalizada) return equipos;

    return equipos.filter((equipo) => {
      const valores = [...Object.values(equipo)];

      if (equipo.tipo) {
        const etiqueta = tipoLabels[equipo.tipo.toString().toLowerCase()];
        if (etiqueta) {
          valores.push(etiqueta);
        }
      }

      return valores.some((valor) => normalizarValor(valor).includes(normalizada));
    });
  }, [equipos, query]);

  return (
    <section aria-label="Listado de equipos" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex-1">
          <label className="flex flex-col gap-1 text-sm text-foreground/70">
            Buscar en todos los campos
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ej. portátil HP, en garantía, 2023..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground shadow-sm focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </label>
        </div>
        <div className="text-sm text-foreground/60">
          {filtrados.length === equipos.length
            ? filtrados.length === 1
              ? "1 resultado"
              : `${filtrados.length} resultados`
            : `${filtrados.length} de ${equipos.length} resultados`}
        </div>
      </div>

      {equipos.length === 0 ? (
        <p className="text-sm text-foreground/60">
          No hay equipos registrados todavía. Añade el primero desde el panel de gestión.
        </p>
      ) : filtrados.length === 0 ? (
        <p className="text-sm text-foreground/60">
          No se encontraron equipos que coincidan con “{query}”.
        </p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
          {filtrados.map((equipo) => {
            const tipo = equipo.tipo ? tipoLabels[equipo.tipo.toLowerCase()] ?? equipo.tipo : "—";

            return (
              <li
                key={equipo.id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm"
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
  );
}
