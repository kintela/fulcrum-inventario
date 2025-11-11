import Link from "next/link";

import { fetchEquipos } from "@/lib/supabase";

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

export default async function ReporteIpsPage() {
  const equipos = await fetchEquipos();

  const registros = equipos
    .filter((equipo) => typeof equipo.ip === "string" && equipo.ip.trim().length > 0)
    .map((equipo) => {
      const ip = equipo.ip!.trim();
      const puertos = Array.isArray(equipo.puertos_conectados)
        ? equipo.puertos_conectados
            .map((puerto) => {
              const switchNombre =
                puerto?.switch?.nombre?.trim() ?? "Switch sin nombre";
              const puertoNumero =
                typeof puerto?.numero === "number" ? `Puerto ${puerto.numero}` : null;
              const vlan =
                typeof puerto?.vlan === "number" ? `VLAN ${puerto.vlan}` : null;
              return [switchNombre, puertoNumero, vlan]
                .filter((parte) => parte && parte.length > 0)
                .join(" · ");
            })
            .filter((texto) => texto && texto.length > 0)
        : [];

      return {
        ip,
        equipoNombre: equipo.nombre?.trim() || "Equipo sin nombre",
        usuario: formatUsuario(equipo),
        ubicacion: equipo.ubicacion?.nombre?.trim() || "Sin ubicación",
        tomaRed: equipo.toma_red?.trim() || "Sin dato",
        puertos: puertos.length > 0 ? puertos : ["Sin switch asociado"],
      };
    })
    .sort((a, b) => compareIps(a.ip, b.ip));

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Listado de IPs asignadas
          </h1>
          <p className="text-sm text-foreground/70">
            Equipos con dirección IP ordenados de menor a mayor.
          </p>
        </div>
        <Link
          href="/"
          className="text-sm text-blue-600 underline underline-offset-4 transition hover:text-blue-700"
        >
          Volver al dashboard
        </Link>
      </header>

      {registros.length === 0 ? (
        <p className="text-sm text-foreground/70">
          No hay equipos con IP registrada.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card text-sm text-card-foreground shadow-sm">
          <table className="w-full border-collapse text-left">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-foreground/60">
              <tr>
                <th className="px-4 py-3">IP</th>
                <th className="px-4 py-3">Equipo</th>
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">Ubicación</th>
                <th className="px-4 py-3">Toma de red</th>
                <th className="px-4 py-3">Switch / Puerto</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((registro) => (
                <tr
                  key={`${registro.ip}-${registro.equipoNombre}`}
                  className="border-t border-border/80 transition hover:bg-muted/30"
                >
                  <td className="px-4 py-3 font-mono text-foreground">{registro.ip}</td>
                  <td className="px-4 py-3">{registro.equipoNombre}</td>
                  <td className="px-4 py-3">{registro.usuario}</td>
                  <td className="px-4 py-3">{registro.ubicacion}</td>
                  <td className="px-4 py-3">{registro.tomaRed}</td>
                  <td className="px-4 py-3">
                    <ul className="list-disc pl-4">
                      {registro.puertos.map((texto, index) => (
                        <li key={`${registro.ip}-puerto-${index}`}>{texto}</li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
