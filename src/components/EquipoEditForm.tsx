"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import type {
  CatalogoItem,
  EquipoRecord,
  UsuarioCatalogo,
} from "@/lib/supabase";

export type EquipoEditFormState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

type EquipoEditFormProps = {
  equipo: EquipoRecord;
  fabricantes: CatalogoItem[];
  ubicaciones: CatalogoItem[];
  usuarios: UsuarioCatalogo[];
  action: (
    prevState: EquipoEditFormState,
    formData: FormData,
  ) => Promise<EquipoEditFormState>;
  initialState: EquipoEditFormState;
};

type ActuacionFormItem = {
  key: string;
  id: number | null;
  tipo: string;
  descripcion: string;
  coste: string;
  fecha: string;
  hechaPor: string;
};

const tipoOptions: Array<{ value: string; label: string }> = [
  { value: "", label: "Selecciona un tipo" },
  { value: "sobremesa", label: "Sobremesa" },
  { value: "portatil", label: "Portatil" },
  { value: "servidor", label: "Servidor" },
  { value: "tablet", label: "Tablet" },
];

function formatDateForInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0] ?? "";
}

function obtenerNombreUsuario(usuario: UsuarioCatalogo) {
  const base =
    usuario.nombre_completo ||
    [usuario.nombre, usuario.apellidos]
      .filter((parte) => parte && `${parte}`.trim().length > 0)
      .join(" ")
      .trim();
  if (base && base.length > 0) {
    return base;
  }
  return `Usuario #${usuario.id}`;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-fit cursor-pointer items-center justify-center rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background transition hover:bg-foreground/80 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Guardando..." : "Guardar cambios"}
    </button>
  );
}

export default function EquipoEditForm({
  equipo,
  fabricantes,
  ubicaciones,
  usuarios,
  action,
  initialState,
}: EquipoEditFormProps) {
  const [state, formAction] = useActionState(action, initialState);

  const fechaCompraValor = formatDateForInput(equipo.fecha_compra);
  const fechaBiosValor = formatDateForInput(equipo.fecha_bios ?? null);

  const admiteUpdateDefault =
    equipo.admite_update === null || equipo.admite_update === undefined
      ? "unknown"
      : equipo.admite_update
        ? "true"
        : "false";

  const alGarbiguneDefault =
    equipo.al_garbigune === null || equipo.al_garbigune === undefined
      ? "unknown"
      : equipo.al_garbigune
        ? "true"
        : "false";

  const [actuacionesForm, setActuacionesForm] = useState<ActuacionFormItem[]>(
    () =>
      (equipo.actuaciones ?? []).map((actuacion) => ({
        key: `act-${actuacion.id}`,
        id: typeof actuacion.id === "number" ? actuacion.id : null,
        tipo: actuacion.tipo ?? "",
        descripcion: actuacion.descripcion ?? "",
        coste:
          actuacion.coste !== null && actuacion.coste !== undefined
            ? `${actuacion.coste}`
            : "",
        fecha: formatDateForInput(actuacion.fecha ?? null),
        hechaPor: actuacion.hecha_por ?? "",
      })),
  );

  const handleAddActuacion = () => {
    setActuacionesForm((prev) => [
      ...prev,
      {
        key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        id: null,
        tipo: "",
        descripcion: "",
        coste: "",
        fecha: "",
        hechaPor: "",
      },
    ]);
  };

  const handleRemoveActuacion = (key: string) => {
    setActuacionesForm((prev) => prev.filter((item) => item.key !== key));
  };

  return (
    <form
      action={formAction}
      className="space-y-6 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Editar equipo
          </h2>
          <p className="text-sm text-foreground/70">
            Actualiza los datos y guarda los cambios cuando termines.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground/80 transition hover:bg-foreground/10"
        >
          Volver al listado
        </Link>
      </div>

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

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
          Datos generales
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-foreground/80">
            <span className="font-medium text-foreground">Nombre</span>
            <input
              type="text"
              name="nombre"
              defaultValue={equipo.nombre ?? ""}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-foreground/80">
            <span className="font-medium text-foreground">Modelo</span>
            <input
              type="text"
              name="modelo"
              defaultValue={equipo.modelo ?? ""}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-foreground/80">
            <span className="font-medium text-foreground">Tipo</span>
            <select
              name="tipo"
              defaultValue={equipo.tipo ?? ""}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
            >
              {tipoOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-foreground/80">
            <span className="font-medium text-foreground">Fecha de compra</span>
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
              defaultValue={equipo.en_garantia ? "true" : "false"}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
            >
              <option value="true">Si</option>
              <option value="false">No</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-foreground/80">
            <span className="font-medium text-foreground">
              Precio compra (EUR)
            </span>
            <input
              type="number"
              step="0.01"
              name="precio_compra"
              defaultValue={
                typeof equipo.precio_compra === "number"
                  ? equipo.precio_compra
                  : ""
              }
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-foreground/80">
            <span className="font-medium text-foreground">Precio SO (EUR)</span>
            <input
              type="number"
              step="0.01"
              name="so_precio"
              defaultValue={
                typeof equipo.so_precio === "number" ? equipo.so_precio : ""
              }
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-foreground/80">
            <span className="font-medium text-foreground">Fabricante</span>
            <select
              name="fabricante_id"
              defaultValue={
                typeof equipo.fabricante_id === "number"
                  ? equipo.fabricante_id
                  : ""
              }
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
            >
              <option value="">Sin fabricante</option>
              {fabricantes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nombre?.trim().length
                    ? item.nombre
                    : `Fabricante #${item.id}`}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-foreground/80">
            <span className="font-medium text-foreground">Ubicacion</span>
            <select
              name="ubicacion_id"
              defaultValue={
                typeof equipo.ubicacion_id === "number"
                  ? equipo.ubicacion_id
                  : ""
              }
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
            >
              <option value="">Sin ubicacion</option>
              {ubicaciones.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nombre?.trim().length
                    ? item.nombre
                    : `Ubicacion #${item.id}`}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-foreground/80">
            <span className="font-medium text-foreground">Usuario asignado</span>
            <select
              name="usuario_id"
              defaultValue={
                typeof equipo.usuario_id === "number"
                  ? equipo.usuario_id
                  : ""
              }
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
            >
              <option value="">Sin usuario</option>
              {usuarios.map((usuario) => (
                <option key={usuario.id} value={usuario.id}>
                  {obtenerNombreUsuario(usuario)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-foreground/80 sm:col-span-2">
            <span className="font-medium text-foreground">
              Sistema operativo
            </span>
            <input
              type="text"
              name="sistema_operativo"
              defaultValue={equipo.sistema_operativo ?? ""}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-foreground/80">
            <span className="font-medium text-foreground">Serial SO</span>
            <input
              type="text"
              name="so_serial"
              defaultValue={equipo.so_serial ?? ""}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-foreground/80">
            <span className="font-medium text-foreground">
              Numero de serie
            </span>
            <input
              type="text"
              name="numero_serie"
              defaultValue={equipo.numero_serie ?? ""}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-foreground/80">
            <span className="font-medium text-foreground">Part number</span>
            <input
              type="text"
              name="part_number"
              defaultValue={equipo.part_number ?? ""}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-foreground/80">
            <span className="font-medium text-foreground">Admite update</span>
            <select
              name="admite_update"
              defaultValue={admiteUpdateDefault}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
            >
              <option value="unknown">Desconocido</option>
              <option value="true">Si</option>
              <option value="false">No</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-foreground/80">
            <span className="font-medium text-foreground">Al garbigune</span>
            <select
              name="al_garbigune"
              defaultValue={alGarbiguneDefault}
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
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
            Actuaciones
          </h3>
          <button
            type="button"
            onClick={handleAddActuacion}
            className="inline-flex items-center justify-center rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground/70 transition hover:bg-foreground/10"
          >
            Anadir actuacion
          </button>
        </div>

        <input
          type="hidden"
          name="actuaciones_count"
          value={String(actuacionesForm.length)}
          readOnly
        />

        {actuacionesForm.length === 0 ? (
          <p className="text-sm text-foreground/60">
            Todavia no hay actuaciones para este equipo.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {actuacionesForm.map((item, index) => (
              <div
                key={item.key}
                className="rounded-lg border border-border bg-background/60 p-4"
              >
                <input
                  type="hidden"
                  name={`actuaciones_${index}_id`}
                  defaultValue={item.id ?? ""}
                />
                <div className="flex flex-col gap-3 sm:grid sm:grid-cols-2 sm:gap-4">
                  <label className="flex flex-col gap-1 text-sm text-foreground/80">
                    <span className="font-medium text-foreground">Tipo</span>
                    <input
                      type="text"
                      name={`actuaciones_${index}_tipo`}
                      defaultValue={item.tipo}
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-sm text-foreground/80">
                    <span className="font-medium text-foreground">
                      Fecha
                    </span>
                    <input
                      type="date"
                      name={`actuaciones_${index}_fecha`}
                      defaultValue={item.fecha}
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-sm text-foreground/80 sm:col-span-2">
                    <span className="font-medium text-foreground">
                      Descripcion
                    </span>
                    <textarea
                      name={`actuaciones_${index}_descripcion`}
                      rows={3}
                      defaultValue={item.descripcion}
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-sm text-foreground/80">
                    <span className="font-medium text-foreground">
                      Coste (EUR)
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name={`actuaciones_${index}_coste`}
                      defaultValue={item.coste}
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-sm text-foreground/80">
                    <span className="font-medium text-foreground">
                      Hecha por
                    </span>
                    <input
                      type="text"
                      name={`actuaciones_${index}_hecha_por`}
                      defaultValue={item.hechaPor}
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
                    />
                  </label>
                </div>

                {item.id === null ? (
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleRemoveActuacion(item.key)}
                      className="inline-flex items-center justify-center rounded-md border border-border px-3 py-1 text-xs font-medium text-foreground/70 transition hover:bg-foreground/10"
                    >
                      Quitar formulario
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
          Especificaciones tecnicas
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-foreground/80 sm:col-span-2">
            <span className="font-medium text-foreground">Procesador</span>
            <input
              type="text"
              name="procesador"
              defaultValue={equipo.procesador ?? ""}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-foreground/80">
            <span className="font-medium text-foreground">RAM (GB)</span>
            <input
              type="number"
              step="1"
              min="0"
              name="ram"
              defaultValue={
                typeof equipo.ram === "number" ? equipo.ram : ""
              }
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-foreground/80">
            <span className="font-medium text-foreground">SSD (GB)</span>
            <input
              type="number"
              step="1"
              min="0"
              name="ssd"
              defaultValue={
                typeof equipo.ssd === "number" ? equipo.ssd : ""
              }
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-foreground/80">
            <span className="font-medium text-foreground">HDD (GB)</span>
            <input
              type="number"
              step="1"
              min="0"
              name="hdd"
              defaultValue={
                typeof equipo.hdd === "number" ? equipo.hdd : ""
              }
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-foreground/80 sm:col-span-2">
            <span className="font-medium text-foreground">
              Tarjeta grafica
            </span>
            <input
              type="text"
              name="tarjeta_grafica"
              defaultValue={equipo.tarjeta_grafica ?? ""}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-foreground/80">
            <span className="font-medium text-foreground">Fecha BIOS</span>
            <input
              type="date"
              name="fecha_bios"
              defaultValue={fechaBiosValor}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-foreground/80 sm:col-span-2">
            <span className="font-medium text-foreground">URL de compra</span>
            <input
              type="url"
              name="url"
              defaultValue={equipo.url ?? ""}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
            />
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
            rows={5}
            defaultValue={equipo.observaciones ?? ""}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
          />
        </label>
      </section>

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}
