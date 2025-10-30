"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { CatalogoItem } from "@/lib/supabase";

export type SwitchEditFormState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

export type SwitchFormValues = {
  nombre: string | null;
  modelo: string | null;
  fabricante_id: number | null;
  ubicacion_id: number | null;
  ip: string | null;
  ancho_banda_gbps: number | null;
  puertos_totales: number | null;
  precio: number | null;
  fecha_compra: string | null;
  en_garantia: boolean | null;
};

type SwitchEditFormProps = {
  values: SwitchFormValues;
  fabricantes: CatalogoItem[];
  ubicaciones: CatalogoItem[];
  action: (
    prevState: SwitchEditFormState,
    formData: FormData,
  ) => Promise<SwitchEditFormState>;
  initialState: SwitchEditFormState;
  mode?: "create" | "edit";
  submitLabel?: string;
  title?: string;
  description?: string;
  backHref?: string;
};

function formatDateForInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0] ?? "";
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-fit cursor-pointer items-center justify-center rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background transition hover:bg-foreground/80 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Guardando..." : label}
    </button>
  );
}

export default function SwitchEditForm({
  values,
  fabricantes,
  ubicaciones,
  action,
  initialState,
  mode = "edit",
  submitLabel,
  title,
  description,
  backHref = "/",
}: SwitchEditFormProps) {
  const [state, formAction] = useActionState(action, initialState);

  const heading =
    title ?? (mode === "create" ? "Nuevo switch" : "Editar switch");
  const submitText =
    submitLabel ?? (mode === "create" ? "Crear switch" : "Guardar cambios");

  const enGarantiaDefault = values.en_garantia ? "true" : "false";

  return (
    <form
      action={formAction}
      className="space-y-6 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
    >
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{heading}</h1>
          <p className="text-sm text-foreground/70">
            {description ??
              "Completa los datos basicos del switch y guarda los cambios."}
          </p>
        </div>
        <Link
          href={backHref}
          className="inline-flex items-center justify-center rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground/70 transition hover:bg-foreground/10"
        >
          Volver
        </Link>
      </header>

      {state.status === "success" && state.message ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {state.message}
        </p>
      ) : null}

      {state.status === "error" && state.message ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.message}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-foreground/80">
          <span className="font-semibold text-foreground/70">Nombre</span>
          <input
            type="text"
            name="nombre"
            defaultValue={values.nombre ?? ""}
            placeholder="Switch principal planta 1"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-foreground/80">
          <span className="font-semibold text-foreground/70">Modelo</span>
          <input
            type="text"
            name="modelo"
            defaultValue={values.modelo ?? ""}
            placeholder="Aruba 2530-24G"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-foreground/80">
          <span className="font-semibold text-foreground/70">Fabricante</span>
          <select
            name="fabricante_id"
            defaultValue={
              typeof values.fabricante_id === "number"
                ? String(values.fabricante_id)
                : ""
            }
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
          >
            <option value="">Sin fabricante</option>
            {fabricantes.map((fabricante) => (
              <option key={fabricante.id} value={fabricante.id}>
                {fabricante.nombre ?? `Fabricante #${fabricante.id}`}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-foreground/80">
          <span className="font-semibold text-foreground/70">Ubicacionn</span>
          <select
            name="ubicacion_id"
            defaultValue={
              typeof values.ubicacion_id === "number"
                ? String(values.ubicacion_id)
                : ""
            }
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
          >
            <option value="">Sin ubicacion</option>
            {ubicaciones.map((ubicacion) => (
              <option key={ubicacion.id} value={ubicacion.id}>
                {ubicacion.nombre ?? `Ubicacionn #${ubicacion.id}`}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-foreground/80">
          <span className="font-semibold text-foreground/70">IP</span>
          <input
            type="text"
            name="ip"
            defaultValue={values.ip ?? ""}
            placeholder="192.168.0.5"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-foreground/80">
          <span className="font-semibold text-foreground/70">
            Ancho de banda (Gbps)
          </span>
          <input
            type="number"
            name="ancho_banda_gbps"
            min="0"
            step="0.01"
            defaultValue={
              typeof values.ancho_banda_gbps === "number"
                ? values.ancho_banda_gbps
                : ""
            }
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-foreground/80">
          <span className="font-semibold text-foreground/70">
            Puertos totales
          </span>
          <input
            type="number"
            name="puertos_totales"
            min="0"
            step="1"
            defaultValue={
              typeof values.puertos_totales === "number"
                ? values.puertos_totales
                : ""
            }
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-foreground/80">
          <span className="font-semibold text-foreground/70">Precio (EUR)</span>
          <input
            type="number"
            name="precio"
            min="0"
            step="0.01"
            defaultValue={
              typeof values.precio === "number" ? values.precio : ""
            }
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-foreground/80">
          <span className="font-semibold text-foreground/70">
            Fecha de compra
          </span>
          <input
            type="date"
            name="fecha_compra"
            defaultValue={formatDateForInput(values.fecha_compra)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-foreground/80">
          <span className="font-semibold text-foreground/70">
            En garantia
          </span>
          <select
            name="en_garantia"
            defaultValue={enGarantiaDefault}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
          >
            <option value="true">Si</option>
            <option value="false">No</option>
          </select>
        </label>
      </div>

        <div className="flex justify-end">
          <SubmitButton label={submitText} />
        </div>
      </form>
  );
}
