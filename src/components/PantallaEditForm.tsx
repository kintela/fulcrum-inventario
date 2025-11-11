"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useActionState,
  useEffect,
  useState,
  type ChangeEvent,
} from "react";
import { useFormStatus } from "react-dom";

import type {
  CatalogoItem,
  EquipoCatalogoItem,
  PantallaRecord,
} from "@/lib/supabase";
import { MAX_IMAGE_SIZE_BYTES } from "@/lib/supabase";

export type PantallaEditFormState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

type PantallaEditFormProps = {
  pantalla: PantallaRecord;
  fabricantes: CatalogoItem[];
  equipos: EquipoCatalogoItem[];
  action: (
    prevState: PantallaEditFormState,
    formData: FormData,
  ) => Promise<PantallaEditFormState>;
  initialState: PantallaEditFormState;
  mode?: "edit" | "create";
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

function obtenerEtiquetaEquipo(equipo: EquipoCatalogoItem) {
  const nombre = equipo.nombre?.trim();
  const modelo = equipo.modelo?.trim();

  if (nombre && modelo) {
    return `${nombre} (${modelo})`;
  }

  if (nombre) return nombre;
  if (modelo) return modelo;

  return `Equipo #${equipo.id}`;
}

export default function PantallaEditForm({
  pantalla,
  fabricantes,
  equipos,
  action,
  initialState,
  mode = "edit",
  submitLabel,
  title,
  description,
  backHref,
}: PantallaEditFormProps) {
  const [state, formAction] = useActionState(action, initialState);

  const fechaCompraValor = formatDateForInput(
    pantalla.fecha_compra ?? pantalla.equipo?.fecha_compra ?? null,
  );

  const enGarantiaDefault =
    pantalla.en_garantia === null || pantalla.en_garantia === undefined
      ? "unknown"
      : pantalla.en_garantia
        ? "true"
        : "false";
  const submitText =
    submitLabel ?? (mode === "create" ? "Crear pantalla" : "Guardar cambios");
  const heading =
    title ?? (mode === "create" ? "Nueva pantalla" : "Editar pantalla");
  const descriptionText =
    description ??
    (mode === "create"
      ? "Rellena los datos y guarda la nueva pantalla."
      : "Actualiza los datos y guarda los cambios cuando termines.");
  const backLinkHref = backHref ?? "/";

  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
      }
    };
  }, [localPreviewUrl]);

  const handleFotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] ?? null;
    setLocalPreviewUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return file ? URL.createObjectURL(file) : null;
    });
  };

  const previewSrc = localPreviewUrl ?? pantalla.thumbnailUrl ?? null;
  const maxImageSizeKb = Math.floor(MAX_IMAGE_SIZE_BYTES / 1024);

  return (
    <form
      action={formAction}
      className="space-y-6 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{heading}</h2>
          <p className="text-sm text-foreground/70">{descriptionText}</p>
        </div>

        <Link
          href={backLinkHref}
          className="inline-flex items-center justify-center rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground/80 transition hover:bg-foreground/10"
        >
          Volver al listado
        </Link>
      </div>

      {state.message ? (
        <div
          role="status"
          className={`rounded-md border px-3 py-2 text-sm ${
            state.status === "success"
              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
              : state.status === "error"
                ? "border-red-300 bg-red-50 text-red-700"
                : "border-border bg-background text-foreground"
          }`}
        >
          {state.message}
        </div>
      ) : null}

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
          Foto
        </h3>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex h-48 w-full items-center justify-center rounded-md border border-dashed border-border bg-background p-2 sm:w-48">
            {previewSrc ? (
              <Image
                src={previewSrc}
                alt={`Vista previa de la pantalla ${pantalla.modelo ?? pantalla.id}`}
                width={192}
                height={192}
                unoptimized
                className="h-full w-full max-h-44 object-contain"
              />
            ) : (
              <span className="text-xs text-foreground/60">
                Sin imagen registrada
              </span>
            )}
          </div>

          <div className="flex flex-1 flex-col gap-2 text-sm text-foreground/80">
            <label className="flex flex-col gap-1">
              <span className="font-medium text-foreground">
                Selecciona una foto
              </span>
              <input
                type="file"
                name="foto"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFotoChange}
                className="cursor-pointer rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30 file:cursor-pointer"
              />
            </label>
            <p className="text-xs text-foreground/60">
              Formatos permitidos: JPG, PNG o WEBP. Tamaño máximo{" "}
              {maxImageSizeKb} KB. Se mantiene la imagen actual si no subes un
              archivo nuevo.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
          Datos generales
        </h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-foreground/80 sm:col-span-2">
            <span className="font-medium text-foreground">Modelo</span>
            <input
              type="text"
              name="modelo"
              defaultValue={pantalla.modelo ?? ""}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-foreground/80">
            <span className="font-medium text-foreground">Fabricante</span>
            <select
              name="fabricante_id"
              defaultValue={
                typeof pantalla.fabricante_id === "number"
                  ? `${pantalla.fabricante_id}`
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
            <span className="font-medium text-foreground">Equipo asignado</span>
            <select
              name="equipo_id"
              defaultValue={pantalla.equipo_id ?? ""}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
            >
              <option value="">Sin equipo asignado</option>
              {equipos.map((equipo) => (
                <option key={equipo.id} value={equipo.id}>
                  {obtenerEtiquetaEquipo(equipo)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-foreground/80">
            <span className="font-medium text-foreground">Pulgadas</span>
            <input
              type="number"
              step="0.1"
              min="0"
              name="pulgadas"
              defaultValue={
                typeof pantalla.pulgadas === "number"
                  ? pantalla.pulgadas
                  : ""
              }
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-foreground/80">
            <span className="font-medium text-foreground">Precio</span>
            <input
              type="number"
              step="0.01"
              min="0"
              name="precio"
              defaultValue={
                typeof pantalla.precio === "number" ? pantalla.precio : ""
              }
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-foreground/80">
            <span className="font-medium text-foreground">Fecha compra</span>
            <input
              type="date"
              name="fecha_compra"
              defaultValue={fechaCompraValor}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-foreground/80">
            <span className="font-medium text-foreground">En garantia</span>
            <select
              name="en_garantia"
              defaultValue={enGarantiaDefault}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
            >
              <option value="unknown">Desconocido</option>
              <option value="true">Si</option>
              <option value="false">No</option>
            </select>
          </label>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
          Observaciones
        </h3>
        <label className="flex flex-col gap-1 text-sm text-foreground/80">
          <span className="sr-only">Observaciones</span>
          <textarea
            name="observaciones"
            rows={4}
            defaultValue={pantalla.observaciones ?? ""}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
          />
        </label>
      </section>

        <div className="flex justify-end">
          <SubmitButton label={submitText} />
        </div>
      </form>
  );
}
