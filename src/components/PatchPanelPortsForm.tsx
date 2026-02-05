"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import type { PatchPanelPortRecord } from "@/lib/supabase";

export type PatchPanelPortsFormState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

type Opcion = { value: string; label: string; numero?: number };

type PatchPanelPortsFormProps = {
  patchpanelId: string;
  patchpanelNombre: string | null;
  puertosTotales: number;
  puertos: PatchPanelPortRecord[];
  opcionesSwitches: Opcion[];
  opcionesPuertosPorSwitch: Record<string, Opcion[]>;
  action: (
    prevState: PatchPanelPortsFormState,
    formData: FormData,
  ) => Promise<PatchPanelPortsFormState>;
  initialState: PatchPanelPortsFormState;
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

export default function PatchPanelPortsForm({
  patchpanelId,
  patchpanelNombre,
  puertosTotales,
  puertos,
  opcionesSwitches,
  opcionesPuertosPorSwitch,
  action,
  initialState,
  backHref,
}: PatchPanelPortsFormProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(action, initialState);
  const [flashMessage, setFlashMessage] =
    useState<PatchPanelPortsFormState | null>(null);
  const storageKey = `patchPanelPortsFlash:${patchpanelId}`;
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

  const mapaPuertos = new Map<number, PatchPanelPortRecord>();
  puertos.forEach((puerto) => {
    if (typeof puerto.numero === "number") {
      mapaPuertos.set(puerto.numero, puerto);
    }
  });

  const { initialSwitches, initialPorts } = useMemo(() => {
    const switches: Record<number, string> = {};
    const ports: Record<number, string> = {};
    puertos.forEach((puerto) => {
      if (typeof puerto.numero !== "number") return;
      if (puerto.puerto_switch?.switch_id) {
        switches[puerto.numero] = String(puerto.puerto_switch.switch_id);
        if (puerto.puerto_switch_id) {
          ports[puerto.numero] = String(puerto.puerto_switch_id);
        }
      }
    });
    return { initialSwitches: switches, initialPorts: ports };
  }, [puertos]);

  const [selectedSwitches, setSelectedSwitches] = useState<Record<number, string>>(
    () => initialSwitches,
  );
  const [selectedPorts, setSelectedPorts] = useState<Record<number, string>>(
    () => initialPorts,
  );

  useEffect(() => {
    setSelectedSwitches(initialSwitches);
    setSelectedPorts(initialPorts);
  }, [initialSwitches, initialPorts]);

  const numeros = Array.from({ length: puertosTotales }, (_, index) => index + 1);

  return (
    <form
      action={formAction}
      className="space-y-6 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
    >
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Puertos del patch panel{" "}
            {patchpanelNombre ?? `Patch panel #${patchpanelId}`}
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

      <input type="hidden" name="patchpanel_id" value={patchpanelId} />
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
              <th className="px-3 py-2 font-medium">Switch</th>
              <th className="px-3 py-2 font-medium">Puerto switch</th>
              <th className="px-3 py-2 font-medium">Observaciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {numeros.map((numero) => {
              const puerto = mapaPuertos.get(numero);
              const campoBase = `puerto_${numero}`;
              const selectedSwitch = selectedSwitches[numero] ?? "";
              const selectedPort = selectedPorts[numero] ?? "";
              const etiquetaTexto =
                typeof puerto?.etiqueta === "string" && puerto.etiqueta.trim().length > 0
                  ? puerto.etiqueta.trim()
                  : null;
              const etiquetaDefaultValue = etiquetaTexto ?? "";
              const observacionesDefaultValue =
                typeof puerto?.observaciones === "string" ? puerto.observaciones : "";
              const opcionesPuertos =
                selectedSwitch && opcionesPuertosPorSwitch[selectedSwitch]
                  ? opcionesPuertosPorSwitch[selectedSwitch]
                  : [];

              return (
                <tr key={numero} className="align-top">
                  <td className="px-3 py-3 text-sm font-semibold text-foreground">
                    <div className="flex flex-col gap-1">
                      <span>{numero}</span>
                      {etiquetaTexto ? (
                        <span className="text-xs font-medium text-foreground/60">
                          {etiquetaTexto}
                        </span>
                      ) : null}
                    </div>
                    <input
                      type="hidden"
                      name={`${campoBase}_numero`}
                      value={String(numero)}
                    />
                    <input
                      type="hidden"
                      name={`${campoBase}_etiqueta`}
                      value={etiquetaDefaultValue}
                    />
                    <input
                      type="hidden"
                      name={`${campoBase}_id`}
                      defaultValue={puerto?.id ?? ""}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      name={`${campoBase}_switch_id`}
                      value={selectedSwitch}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setSelectedSwitches((prev) => ({
                          ...prev,
                          [numero]: nextValue,
                        }));
                        setSelectedPorts((prev) => ({
                          ...prev,
                          [numero]: "",
                        }));
                      }}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30"
                    >
                      <option value="">Sin switch</option>
                      {opcionesSwitches.map((opcion) => (
                        <option key={opcion.value} value={opcion.value}>
                          {opcion.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      name={`${campoBase}_puerto_switch_id`}
                      value={selectedPort}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setSelectedPorts((prev) => ({
                          ...prev,
                          [numero]: nextValue,
                        }));
                      }}
                      disabled={!selectedSwitch}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-inner focus:border-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/30 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <option value="">Sin puerto</option>
                      {opcionesPuertos.map((opcion) => (
                        <option key={opcion.value} value={opcion.value}>
                          {opcion.label}
                        </option>
                      ))}
                    </select>
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
