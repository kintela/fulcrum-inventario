import Link from "next/link";

import IpsTable, { type IpRegistro } from "@/components/IpsTable";
import { fetchEquipos, fetchSwitches } from "@/lib/supabase";

function parseIp(ip: string): number[] {
  return ip.split(".").map((segment) => {
    const num = Number.parseInt(segment, 10);
    if (Number.isNaN(num) || num < 0 || num > 255) {
      return 0;
    }
    return num;
  });
}

function compareIps(a: string, b: string): number {
  const segA = parseIp(a);
  const segB = parseIp(b);
  for (let i = 0; i < 4; i += 1) {
    const diff = (segA[i] ?? 0) - (segB[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function formatUsuario(equipo: Awaited<ReturnType<typeof fetchEquipos>>[number]) {
  const usuario = equipo.usuario;
  if (!usuario) return "Sin usuario asignado";
  if (usuario.nombre_completo && usuario.nombre_completo.trim().length > 0) {
    return usuario.nombre_completo.trim();
  }
  const partes = [usuario.nombre, usuario.apellidos]
    .filter((parte) => typeof parte === "string" && parte.trim().length > 0)
    .map((parte) => parte!.trim());
  if (partes.length > 0) return partes.join(" ");
  return "Sin usuario asignado";
}

const tipoLabels: Record<string, string> = {
  sobremesa: "Sobremesa",
  portatil: "Portátil",
  servidor: "Servidor",
  tablet: "Tablet",
  almacenamiento: "Almacenamiento",
  impresora: "Impresora",
  wifi: "WiFi",
  virtual: "Virtual",
  firewall: "Firewall",
  ups: "UPS",
};

function formatTipo(valor: string | null | undefined): string {
  if (!valor) return "Sin tipo";
  const normalized = valor.trim().toLowerCase();
  if (!normalized) return "Sin tipo";
  return (
    tipoLabels[normalized] ??
    normalized.charAt(0).toUpperCase() + normalized.slice(1)
  );
}

export default async function ReporteIpsPage() {
  const [equipos, switches] = await Promise.all([fetchEquipos(), fetchSwitches()]);

  const registrosEquipos: IpRegistro[] = equipos
    .filter((equipo) => typeof equipo.ip === "string" && equipo.ip.trim().length > 0)
    .map((equipo) => {
      const ip = equipo.ip!.trim();
      const tipoCrudo = (() => {
        const directo =
          typeof equipo.tipo === "string" && equipo.tipo.trim().length > 0
            ? equipo.tipo.trim()
            : null;
        if (directo) return directo;

        for (const [clave, valor] of Object.entries(
          equipo as Record<string, unknown>,
        )) {
          if (!clave.toLowerCase().includes("tipo")) continue;
          if (typeof valor === "string" && valor.trim().length > 0) {
            return valor.trim();
          }
        }

        return null;
      })();
      const puertos =
        Array.isArray(equipo.puertos_conectados) &&
        equipo.puertos_conectados.length > 0
          ? equipo.puertos_conectados.map((puerto) => {
              const switchNombre =
                puerto?.switch?.nombre?.trim() ?? "Switch sin nombre";
              const puertoNumero =
                typeof puerto?.numero === "number"
                  ? `Puerto ${puerto.numero}`
                  : "Sin puerto";
              const vlan =
                typeof puerto?.vlan === "number" ? `VLAN ${puerto.vlan}` : null;
              return {
                switchNombre,
                puertoLabel: vlan ? `${puertoNumero} (${vlan})` : puertoNumero,
              };
            })
          : [
              {
                switchNombre: "Sin switch asociado",
                puertoLabel: "—",
              },
            ];

      return {
        ip,
        equipoNombre: equipo.nombre?.trim() || "Equipo sin nombre",
        tipo: formatTipo(tipoCrudo),
        usuario: formatUsuario(equipo),
        ubicacion: equipo.ubicacion?.nombre?.trim() || "Sin ubicación",
        tomaRed: equipo.toma_red?.trim() || "Sin dato",
        puertos,
      };
    });

  const registrosSwitches: IpRegistro[] = switches
    .filter((sw) => typeof sw.ip === "string" && sw.ip.trim().length > 0)
    .map((sw) => ({
      ip: sw.ip!.trim(),
      equipoNombre: sw.nombre?.trim() || "Switch sin nombre",
      tipo: "Switch",
      usuario: "Switch",
      ubicacion: sw.ubicacion?.nombre?.trim() || "Sin ubicación",
      tomaRed: "—",
      puertos: [
        {
          switchNombre: sw.nombre?.trim() || "Switch sin nombre",
          puertoLabel: "—",
        },
      ],
    }));

  const registrosCombinados = [...registrosEquipos, ...registrosSwitches].sort((a, b) =>
    compareIps(a.ip, b.ip),
  );

  const totalIps = registrosCombinados.length;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Listado de IPs</h1>
          <p className="text-sm text-foreground/70">
            Número total de IPs asignadas:{" "}
            <span className="font-semibold text-foreground">{totalIps}</span>
          </p>
        </div>
        <Link
          href="/"
          className="text-sm text-blue-600 underline underline-offset-4 transition hover:text-blue-700"
        >
          Volver al dashboard
        </Link>
      </header>

      {registrosCombinados.length === 0 ? (
        <p className="text-sm text-foreground/70">No hay IPs registradas.</p>
      ) : (
        <IpsTable entries={registrosCombinados} />
      )}
    </main>
  );
}
