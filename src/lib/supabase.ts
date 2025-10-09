type SupabaseConfig = {
  url: string;
  anonKey: string;
};

function getSupabaseConfig(): SupabaseConfig {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase URL o clave anónima no configuradas. Añádelas al fichero .env.local.",
    );
  }

  return { url: url.replace(/\/$/, ""), anonKey };
}

export type EquipoRecord = {
  id: string;
  nombre: string | null;
  modelo: string | null;
  tipo: string | null;
  fecha_compra: string | null;
  en_garantia: boolean;
  precio_compra: number | null;
  fabricante_id: number | null;
  ubicacion_id: number | null;
  usuario_id: number | null;
  sistema_operativo: string | null;
  so_precio: number | null;
  fabricante: { nombre: string | null } | null;
  ubicacion: { nombre: string | null } | null;
  usuario:
    | {
        nombre: string | null;
        apellidos: string | null;
        nombre_completo: string | null;
      }
    | null;
  procesador: string | null;
  ram: number | null;
  ssd: number | null;
  hdd: number | null;
  tarjeta_grafica: string | null;
  observaciones: string | null;
} & Record<string, unknown>;

export async function fetchEquipos(): Promise<EquipoRecord[]> {
  const { url, anonKey } = getSupabaseConfig();
  const restUrl = `${url}/rest/v1/equipos`;

  const requestUrl = new URL(restUrl);
  requestUrl.searchParams.set(
    "select",
    [
      "id",
      "nombre",
      "modelo",
      "tipo",
      "fecha_compra",
      "en_garantia",
      "precio_compra",
      "fabricante_id",
      "ubicacion_id",
      "usuario_id",
      "sistema_operativo",
      "so_precio",
      "procesador",
      "ram",
      "ssd",
      "hdd",
      "tarjeta_grafica",
      "observaciones",
      "fabricante:fabricantes(nombre)",
      "ubicacion:ubicaciones(nombre)",
      "usuario:usuarios(nombre,apellidos,nombre_completo)",
    ].join(","),
  );
  requestUrl.searchParams.set("order", "fecha_compra.desc.nullslast");

  const response = await fetch(requestUrl.toString(), {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      Prefer: "return=representation",
    },
    cache: "no-store",
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Error al recuperar equipos: ${response.status} ${details}`);
  }

  return (await response.json()) as EquipoRecord[];
}
