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
  al_garbigune: boolean | null;
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
  fecha_bios: string | null;
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

export type CatalogoItem = {
  id: number;
  nombre: string | null;
};

export type UsuarioCatalogo = {
  id: number;
  nombre: string | null;
  apellidos: string | null;
  nombre_completo: string | null;
};

async function completarFabricantesPantallas(
  equipos: EquipoRecord[],
  config: SupabaseConfig,
) {
  const fabricanteIds = new Set<number>();

  equipos.forEach((equipo) => {
    equipo.pantallas?.forEach((pantalla) => {
      if (typeof pantalla.fabricante_id === "number") {
        fabricanteIds.add(pantalla.fabricante_id);
      }
    });
  });

  if (fabricanteIds.size === 0) {
    return;
  }

  const fabricantesUrl = new URL(`${config.url}/rest/v1/fabricantes`);
  fabricantesUrl.searchParams.set(
    "id",
    `in.(${Array.from(fabricanteIds).join(",")})`,
  );
  fabricantesUrl.searchParams.set("select", "id,nombre");

  const fabricantesResponse = await fetch(fabricantesUrl.toString(), {
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
    },
    cache: "no-store",
  });

  if (!fabricantesResponse.ok) {
    const details = await fabricantesResponse.text();
    throw new Error(
      `Error al recuperar fabricantes: ${fabricantesResponse.status} ${details}`,
    );
  }

  const fabricantes = (await fabricantesResponse.json()) as Array<{
    id: number;
    nombre: string | null;
  }>;
  const fabricantesMap = new Map(
    fabricantes.map((fab) => [fab.id, fab.nombre ?? null]),
  );

  equipos.forEach((equipo) => {
    equipo.pantallas?.forEach((pantalla) => {
      if (typeof pantalla.fabricante_id === "number") {
        pantalla.fabricanteNombre =
          fabricantesMap.get(pantalla.fabricante_id) ?? null;
      }
    });
  });
}
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
      "al_garbigune",
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

  await completarFabricantesPantallas(equipos, { url, anonKey });

  return equipos;
}

export async function fetchEquipoById(
  id: string,
): Promise<EquipoRecord | null> {
  const config = getSupabaseConfig();
  const requestUrl = new URL(`${config.url}/rest/v1/equipos`);
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
      "al_garbigune",
      "procesador",
      "ram",
      "ssd",
      "hdd",
      "tarjeta_grafica",
      "observaciones",
      "fecha_bios",
      "url",
      "fecha_bios",
      "pantallas:pantallas(id,pulgadas,modelo,fabricante_id)",
      "fabricante:fabricantes(nombre)",
      "ubicacion:ubicaciones(nombre)",
      "usuario:usuarios(nombre,apellidos,nombre_completo)",
    ].join(","),
  );
  requestUrl.searchParams.set("id", `eq.${id}`);
  requestUrl.searchParams.set("limit", "1");

  const response = await fetch(requestUrl.toString(), {
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      Prefer: "return=representation",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `Error al recuperar el equipo ${id}: ${response.status} ${details}`,
    );
  }

  const equipos = (await response.json()) as EquipoRecord[];
  if (equipos.length === 0) {
    return null;
  }

  await completarFabricantesPantallas(equipos, config);

  return equipos[0];
}

async function fetchCatalogo<T extends Record<string, unknown>>(
  config: SupabaseConfig,
  tabla: string,
  select: string,
  order?: string,
): Promise<T[]> {
  const requestUrl = new URL(`${config.url}/rest/v1/${tabla}`);
  requestUrl.searchParams.set("select", select);
  if (order) {
    requestUrl.searchParams.set("order", order);
  }

  const response = await fetch(requestUrl.toString(), {
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Error al recuperar ${tabla}: ${response.status} ${details}`);
  }

  return (await response.json()) as T[];
}

export async function fetchFabricantesCatalogo(): Promise<CatalogoItem[]> {
  const config = getSupabaseConfig();
  const items = await fetchCatalogo<CatalogoItem>(
    config,
    "fabricantes",
    "id,nombre",
    "nombre.asc.nullslast",
  );
  return items;
}

export async function fetchUbicacionesCatalogo(): Promise<CatalogoItem[]> {
  const config = getSupabaseConfig();
  const items = await fetchCatalogo<CatalogoItem>(
    config,
    "ubicaciones",
    "id,nombre",
    "nombre.asc.nullslast",
  );
  return items;
}

export async function fetchUsuariosCatalogo(): Promise<UsuarioCatalogo[]> {
  const config = getSupabaseConfig();
  const items = await fetchCatalogo<UsuarioCatalogo>(
    config,
    "usuarios",
    "id,nombre,apellidos,nombre_completo",
    "nombre_completo.asc.nullslast",
  );
  return items;
}

export type EquipoUpdatePayload = {
  nombre?: string | null;
  modelo?: string | null;
  tipo?: string | null;
  fecha_compra?: string | null;
  en_garantia?: boolean;
  precio_compra?: number | null;
  fabricante_id?: number | null;
  ubicacion_id?: number | null;
  usuario_id?: number | null;
  sistema_operativo?: string | null;
  so_precio?: number | null;
  so_serial?: string | null;
  numero_serie?: string | null;
  part_number?: string | null;
  admite_update?: boolean | null;
  al_garbigune?: boolean | null;
  procesador?: string | null;
  ram?: number | null;
  ssd?: number | null;
  hdd?: number | null;
  tarjeta_grafica?: string | null;
  observaciones?: string | null;
  url?: string | null;
  fecha_bios?: string | null;
};

export async function updateEquipo(
  id: string,
  payload: EquipoUpdatePayload,
): Promise<void> {
  const config = getSupabaseConfig();
  const requestUrl = new URL(`${config.url}/rest/v1/equipos`);
  requestUrl.searchParams.set("id", `eq.${id}`);

  const cuerpo = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  );

  if (Object.keys(cuerpo).length === 0) {
    return;
  }

  const response = await fetch(requestUrl.toString(), {
    method: "PATCH",
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(cuerpo),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `Error al actualizar el equipo ${id}: ${response.status} ${details}`,
    );
  }
}
