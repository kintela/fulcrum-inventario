"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const [state, formAction] = useActionState(action, initialState);
  const [flashMessage, setFlashMessage] =
    useState<SwitchPortsFormState | null>(null);
  const storageKey = `switchPortsFlash:${switchId}`;
  const hasTriggeredRefreshRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.sessionStorage.getItem(storageKey);
    if (!stored) return;
    setFlashMessage({ status: "success", message: stored });
    window.sessionStorage.removeItem(storageKey);
  }, [storageKey]);

  useEffect(() => {
    if (state.status === "idle") {
      hasTriggeredRefreshRef.current = false;
    }

    if (state.status === "success" && state.message) {
      if (hasTriggeredRefreshRef.current) return;

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(storageKey, state.message);
      }
      hasTriggeredRefreshRef.current = true;
      router.refresh();
      return;
    }

    if (
      state.status === "error" &&
      state.message &&
      (flashMessage?.status !== "error" ||
        flashMessage.message !== state.message)
    ) {
      setFlashMessage({ status: "error", message: state.message });
    }
  }, [state, flashMessage, router, storageKey]);

  const messageToShow =
    flashMessage ??
    (state.status !== "idle" && state.message ? state : null);

  const mapaPuertos = new Map<number, SwitchPortRecord>();
  puertos.forEach((puerto) => {
    if (typeof puerto.numero === "number") {
      mapaPuertos.set(puerto.numero, puerto);
    }
  });

  const numeros = Array.from({ length: puertosTotales }, (_, index) => index + 1);
  const nombreNormalizado = (switchNombre ?? "").trim().toLowerCase();
  const switchIdNormalizado = switchId.trim();
  const showNombreColumn =
    nombreNormalizado === "modular" ||
    switchIdNormalizado === "8" ||
    Number.parseInt(switchIdNormalizado, 10) === 8;
  const tablaMinWidthClass = showNombreColumn
    ? "min-w-[720px]"
    : "min-w-[640px]";

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

      {messageToShow?.status === "success" && messageToShow.message ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {messageToShow.message}
        </p>
      ) : null}

      {messageToShow?.status === "error" && messageToShow.message ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {messageToShow.message}
        </p>
      ) : null}

      <input type="hidden" name="switch_id" value={switchId} />
      <input
        type="hidden"
        name="puertos_totales"
        value={String(puertosTotales)}
      />

      <div className="overflow-x-auto">
        <table
          className={`w-full ${tablaMinWidthClass} border-collapse text-sm`}
        >
          <thead>
            <tr className="bg-foreground/5 text-left text-foreground/70">
              <th className="px-3 py-2 font-medium">Puerto</th>
              {showNombreColumn ? (
                <th className="px-3 py-2 font-medium">Nombre</th>
              ) : null}
              <th className="px-3 py-2 font-medium">Equipo</th>
              <th className="px-3 py-2 font-medium">VLAN</th>
              <th className="px-3 py-2 font-medium">Velocidad (Mbps)</th>
              <th className="px-3 py-2 font-medium">Observaciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {numeros.map((numero) => {
              const puerto = mapaPuertos.get(numero);
              const campoBase = `puerto_${numero}`;
              const equipoDefaultValue =
                puerto?.equipo_id && puerto.equipo_id.toString().trim().length > 0
                  ? String(puerto.equipo_id)
                  : "";
              const nombreDefaultValue =
                typeof puerto?.nombre === "string" ? puerto.nombre : "";
              const vlanDefaultValue =
                typeof puerto?.vlan === "number" ? puerto.vlan : "";
              const velocidadDefaultValue =
                typeof puerto?.velocidad_mbps === "number"
                  ? puerto.velocidad_mbps
                  : "";
              const observacionesDefaultValue =
                typeof puerto?.observaciones === "string"
                  ? puerto.observaciones
                  : "";
              const poeDefaultValue = puerto?.poe === true ? "true" : "false";

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
                    {showNombreColumn ? null : (
                      <input
                        type="hidden"
                        name={`${campoBase}_nombre`}
                        value={nombreDefaultValue}
                      />
                    )}
                    <input
                      type="hidden"
                      name={`${campoBase}_poe`}
                      value={poeDefaultValue}
                    />
                  </td>
                  {showNombreColumn ? (
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        name={`${campoBase}_nombre`}
                        key={`${campoBase}_nombre_${nombreDefaultValue}`}
                        defaultValue={nombreDefaultValue}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
                        placeholder="Etiqueta"
                      />
                    </td>
                  ) : null}
                  <td className="px-3 py-2">
                    <select
                      key={`${campoBase}_equipo_${equipoDefaultValue}`}
                      name={`${campoBase}_equipo_id`}
                      defaultValue={equipoDefaultValue}
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
                      key={`${campoBase}_vlan_${vlanDefaultValue}`}
                      defaultValue={vlanDefaultValue}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
                      min="1"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      name={`${campoBase}_velocidad`}
                      key={`${campoBase}_velocidad_${velocidadDefaultValue}`}
                      defaultValue={velocidadDefaultValue}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
                      min="0"
                      step="10"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <textarea
                      name={`${campoBase}_observaciones`}
                      key={`${campoBase}_observaciones_${observacionesDefaultValue}`}
                      defaultValue={observacionesDefaultValue}
                      rows={2}
                      className="w-full min-w-[260px] rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
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
