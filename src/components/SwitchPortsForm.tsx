"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type {
  EquipoCatalogoItem,
  SwitchPortRecord,
} from "@/lib/supabase";

export type SwitchPortsFormState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

type SwitchPortsFormProps = {
  switchId: string;
  switchNombre: string | null;
  puertosTotales: number;
  puertos: SwitchPortRecord[];
  equipos: EquipoCatalogoItem[];
  action: (
    prevState: SwitchPortsFormState,
    formData: FormData,
  ) => Promise<SwitchPortsFormState>;
  initialState: SwitchPortsFormState;
  backHref: string;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background transition hover:bg-foreground/80 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Guardando..." : label}
    </button>
  );
}

export default function SwitchPortsForm({
  switchId,
  switchNombre,
  puertosTotales,
  puertos,
  equipos,
  action,
  initialState,
  backHref,
}: SwitchPortsFormProps) {
  const [state, formAction] = useActionState(action, initialState);

  const mapaPuertos = new Map<number, SwitchPortRecord>();
  puertos.forEach((puerto) => {
    if (typeof puerto.numero === "number") {
      mapaPuertos.set(puerto.numero, puerto);
    }
  });

  const numeros = Array.from({ length: puertosTotales }, (_, index) => index + 1);

  return (
    <form
      action={formAction}
      className="space-y-6 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
    >
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Puertos de {switchNombre ?? `Switch #${switchId}`}
          </h2>
          <p className="text-sm text-foreground/70">
            Gestiona los {puertosTotales} puertos disponibles. Solo se guardarán los puertos con datos.
          </p>
        </div>
        <Link
          href={backHref}
          className="inline-flex items-center justify-center rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground/80 transition hover:bg-foreground/10"
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

      <input type="hidden" name="switch_id" value={switchId} />
      <input
        type="hidden"
        name="puertos_totales"
        value={String(puertosTotales)}
      />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="bg-foreground/5 text-left text-foreground/70">
              <th className="px-3 py-2 font-medium">Puerto</th>
              <th className="px-3 py-2 font-medium">Nombre</th>
              <th className="px-3 py-2 font-medium">Equipo</th>
              <th className="px-3 py-2 font-medium">VLAN</th>
              <th className="px-3 py-2 font-medium">Velocidad (Mbps)</th>
              <th className="px-3 py-2 font-medium">PoE</th>
              <th className="px-3 py-2 font-medium">Observaciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {numeros.map((numero) => {
              const puerto = mapaPuertos.get(numero);
              const campoBase = `puerto_${numero}`;
              return (
                <tr key={numero} className="align-top">
                  <td className="px-3 py-3 text-sm font-semibold text-foreground">
                    {numero}
                    <input
                      type="hidden"
                      name={`${campoBase}_numero`}
                      value={String(numero)}
                    />
                    <input
                      type="hidden"
                      name={`${campoBase}_id`}
                      defaultValue={puerto?.id ?? ""}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      name={`${campoBase}_nombre`}
                      defaultValue={puerto?.nombre ?? ""}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
                      placeholder="Etiqueta"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      name={`${campoBase}_equipo_id`}
                      defaultValue={
                        puerto?.equipo_id ? String(puerto.equipo_id) : ""
                      }
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
                    >
                      <option value="">Sin equipo</option>
                      {equipos.map((equipo) => (
                        <option key={equipo.id} value={equipo.id}>
                          {equipo.nombre?.trim().length
                            ? equipo.nombre
                            : `Equipo #${equipo.id}`}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      name={`${campoBase}_vlan`}
                      defaultValue={
                        typeof puerto?.vlan === "number" ? puerto.vlan : ""
                      }
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
                      min="1"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      name={`${campoBase}_velocidad`}
                      defaultValue={
                        typeof puerto?.velocidad_mbps === "number"
                          ? puerto.velocidad_mbps
                          : ""
                      }
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
                      min="0"
                      step="10"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <label className="flex items-center justify-center gap-2 text-sm text-foreground/80">
                      <input
                        type="checkbox"
                        name={`${campoBase}_poe`}
                        defaultChecked={puerto?.poe === true}
                        className="h-4 w-4 cursor-pointer rounded border-border text-foreground focus:ring-2 focus:ring-foreground/30"
                      />
                      <span>PoE</span>
                    </label>
                  </td>
                  <td className="px-3 py-2">
                    <textarea
                      name={`${campoBase}_observaciones`}
                      defaultValue={puerto?.observaciones ?? ""}
                      rows={2}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <SubmitButton label="Guardar puertos" />
      </div>
    </form>
  );
}
