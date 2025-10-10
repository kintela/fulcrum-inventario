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
  so_serial: string | null;
  numero_serie: string | null;
  part_number: string | null;
  admite_update: boolean | null;
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
  url: string | null;
  pantallas:
    | Array<{
        id: number;
        pulgadas: number | null;
        modelo: string | null;
        fabricante_id: number | null;
        fabricanteNombre?: string | null;
      }>
    | null;
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
      "so_serial",
      "numero_serie",
      "part_number",
      "admite_update",
      "procesador",
      "ram",
      "ssd",
      "hdd",
      "tarjeta_grafica",
      "observaciones",
      "url",
      "pantallas:pantallas(id,pulgadas,modelo,fabricante_id)",
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

  const equipos = (await response.json()) as EquipoRecord[];

  const fabricanteIds = new Set<number>();
  equipos.forEach((equipo) => {
    equipo.pantallas?.forEach((pantalla) => {
      if (typeof pantalla.fabricante_id === "number") {
        fabricanteIds.add(pantalla.fabricante_id);
      }
    });
  });

  if (fabricanteIds.size === 0) {
    return equipos;
  }

  const fabricantesUrl = new URL(`${url}/rest/v1/fabricantes`);
  fabricantesUrl.searchParams.set("id", `in.(${Array.from(fabricanteIds).join(",")})`);
  fabricantesUrl.searchParams.set("select", "id,nombre");

  const fabricantesResponse = await fetch(fabricantesUrl.toString(), {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    cache: "no-store",
  });

  if (!fabricantesResponse.ok) {
    const details = await fabricantesResponse.text();
    throw new Error(`Error al recuperar fabricantes: ${fabricantesResponse.status} ${details}`);
  }

  const fabricantes = (await fabricantesResponse.json()) as Array<{ id: number; nombre: string }>;
  const fabricantesMap = new Map(fabricantes.map((fab) => [fab.id, fab.nombre]));

  equipos.forEach((equipo) => {
    equipo.pantallas?.forEach((pantalla) => {
      if (typeof pantalla.fabricante_id === "number") {
        pantalla.fabricanteNombre = fabricantesMap.get(pantalla.fabricante_id) ?? null;
      }
    });
  });

  return equipos;
}
