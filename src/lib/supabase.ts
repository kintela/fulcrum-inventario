type SupabaseConfig = {
  url: string;
  anonKey: string;
  serviceRoleKey: string | null;
};

const STORAGE_BUCKET = "fotos";

export const MAX_IMAGE_SIZE_BYTES = 200 * 1024;

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const ALLOWED_IMAGE_MIME_TYPES_SET = new Set<string>(ALLOWED_IMAGE_MIME_TYPES);

const ALLOWED_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

const MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const EXTENSION_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export const TIPO_ACTUACION_ENUM_VALUES = [
  "reparación",
  "ampliación",
  "formateo",
] as const;

export type ActuacionTipo =
  (typeof TIPO_ACTUACION_ENUM_VALUES)[number];

function getSupabaseConfig(): SupabaseConfig {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase URL o clave anónima no configuradas. Añádelas al fichero .env.local.",
    );
  }

  return { url: url.replace(/\/$/, ""), anonKey, serviceRoleKey };
}

export type ActuacionRecord = {
  id: number;
  tipo: ActuacionTipo;
  descripcion: string | null;
  coste: number | null;
  fecha: string | null;
  hecha_por: string | null;
};

export type PantallaRecord = {
  id: number;
  equipo_id?: string | null;
  pulgadas: number | null;
  modelo: string | null;
  fabricante_id: number | null;
  fabricanteNombre?: string | null;
  precio: number | null;
  fecha_compra: string | null;
  en_garantia: boolean | null;
  equipo?: {
    id: string;
    nombre: string | null;
    fecha_compra?: string | null;
  } | null;
  observaciones?: string | null;
  thumbnailUrl?: string | null;
};

export type SwitchRecord = {
  id: string;
  nombre: string | null;
  modelo: string | null;
  fabricante_id: number | null;
  fabricante?: { nombre: string | null } | null;
  ubicacion_id: number | null;
  ubicacion?: { nombre: string | null } | null;
  ancho_banda_gbps: number | null;
  ip: string | null;
  puertos_totales: number | null;
  precio: number | null;
  precio_compra?: number | null;
  fecha_compra: string | null;
  en_garantia: boolean | null;
  puertos?: SwitchPortRecord[] | null;
};

export type SwitchPortRecord = {
  id: number;
  switch_id: number;
  numero: number;
  nombre: string | null;
  vlan: number | null;
  poe: boolean | null;
  velocidad_mbps: number | null;
  equipo_id: string | null;
  equipo?: { id: string; nombre: string | null; modelo: string | null } | null;
  switch?: { id: number; nombre: string | null } | null;
  observaciones: string | null;
};

export type SwitchPortUpsert = {
  id?: number;
  switch_id: number;
  numero: number;
  nombre?: string | null;
  vlan?: number | null;
  poe?: boolean | null;
  velocidad_mbps?: number | null;
  equipo_id?: string | null;
  observaciones?: string | null;
};

export type SwitchInsertPayload = {
  nombre?: string | null;
  modelo?: string | null;
  fabricante_id?: number | null;
  ubicacion_id?: number | null;
  ip?: string | null;
  ancho_banda_gbps?: number | null;
  puertos_totales?: number | null;
  precio?: number | null;
  fecha_compra?: string | null;
  en_garantia?: boolean | null;
};

export type SwitchUpdatePayload = {
  nombre?: string | null;
  modelo?: string | null;
  fabricante_id?: number | null;
  ubicacion_id?: number | null;
  ip?: string | null;
  ancho_banda_gbps?: number | null;
  puertos_totales?: number | null;
  precio?: number | null;
  fecha_compra?: string | null;
  en_garantia?: boolean | null;
};

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
  ip: string | null;
  toma_red: string | null;
  tarjeta_red: string | number | null;
  admin_local: string | null;
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
  pantallas: PantallaRecord[] | null;
  puertos_conectados?: SwitchPortRecord[] | null;
  actuaciones?: ActuacionRecord[] | null;
  thumbnailUrl?: string | null;
} & Record<string, unknown>;

export type CatalogoItem = {
  id: number;
  nombre: string | null;
};

export type EquipoCatalogoItem = {
  id: string;
  nombre: string | null;
  modelo?: string | null;
};

export type UsuarioCatalogo = {
  id: number;
  nombre: string | null;
  apellidos: string | null;
  nombre_completo: string | null;
};

function buildStorageProxyUrl(...segments: string[]): string {
  const encoded = segments
    .map((segment) =>
      segment
        .split("/")
        .map((part) => encodeURIComponent(part))
        .join("/"),
    )
    .join("/");

  return `/api/storage/image?path=${encoded}`;
}

type StorageFolder = "equipos" | "pantallas";

export type UploadableImage = Blob & { name?: string; type?: string };

function getStorageAuthKey(config: SupabaseConfig): string {
  const candidate =
    typeof config.serviceRoleKey === "string" &&
    config.serviceRoleKey.trim().length > 0
      ? config.serviceRoleKey
      : config.anonKey;
  return candidate.trim();
}

function encodeStoragePath(path: string): string {
  return path
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function sanitizeStorageFolder(
  folder: StorageFolder,
  identifier: string | number,
): {
  prefix: string;
  prefixWithSlash: string;
  identifierSegment: string;
} {
  const folderSegment = `${folder}`.replace(/\/+/g, "").trim();
  const identifierSegment = `${identifier}`
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/^\//, "")
    .replace(/\/$/, "");

  const combined = [folderSegment, identifierSegment]
    .filter((segment) => segment.length > 0)
    .join("/");

  const normalized = combined.replace(/\/+/g, "/").replace(/^\//, "");
  const prefix = normalized.replace(/\/$/, "");
  const prefixWithSlash =
    prefix.length > 0 ? `${prefix}/` : folderSegment.length > 0 ? `${folderSegment}/` : "";

  return { prefix, prefixWithSlash, identifierSegment };
}

function resolveObjectPathFromItem(
  prefixWithSlash: string,
  itemName: string,
): string {
  const sanitizedItem = itemName.replace(/\\/g, "/").replace(/\/+/g, "/");
  if (sanitizedItem.includes("/")) {
    return sanitizedItem.replace(/^\//, "").replace(/\/$/, "");
  }

  const trimmedPrefix = prefixWithSlash.replace(/\/$/, "");
  if (!trimmedPrefix) {
    return sanitizedItem.replace(/^\//, "").replace(/\/$/, "");
  }

  return `${trimmedPrefix}/${sanitizedItem}`
    .replace(/\\/g, "/")
    .replace(/^\//, "")
    .replace(/\/$/, "");
}

function sanitizeFileBaseName(rawName: string): string {
  const withoutExtension = rawName.replace(/\.[^.]+$/, "");
  const normalized = withoutExtension
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return normalized.length > 0 ? normalized.toLowerCase() : "foto";
}

function inferFileExtension(file: UploadableImage): string {
  if (typeof file.name === "string") {
    const fromName = file.name
      .trim()
      .match(/\.([a-zA-Z0-9]{1,10})$/)?.[1];
    if (fromName) {
      const normalized = fromName.toLowerCase();
      if (ALLOWED_IMAGE_EXTENSIONS.has(normalized)) {
        return normalized;
      }
    }
  }

  if (typeof file.type === "string") {
    const mime = file.type.toLowerCase();
    if (mime in MIME_TO_EXTENSION) {
      return MIME_TO_EXTENSION[mime];
    }
  }

  throw new Error("Formato de imagen no admitido. Usa archivos JPG, PNG o WEBP.");
}

function prepareImageUpload(file: UploadableImage): {
  extension: string;
  contentType: string;
} {
  const size = (file as { size?: number }).size;
  if (typeof size === "number") {
    if (size <= 0) {
      throw new Error("El archivo de imagen está vacío.");
    }
    if (size > MAX_IMAGE_SIZE_BYTES) {
      throw new Error("La imagen debe pesar 200 KB o menos.");
    }
  }

  const extensionRaw = inferFileExtension(file);
  const extension = extensionRaw === "jpeg" ? "jpg" : extensionRaw;

  const declaredType =
    typeof file.type === "string" && file.type.length > 0
      ? file.type.toLowerCase()
      : "";

  let contentType = declaredType;
  if (!ALLOWED_IMAGE_MIME_TYPES_SET.has(contentType)) {
    contentType = EXTENSION_TO_MIME[extension] ?? "";
  }

  if (
    !contentType ||
    !ALLOWED_IMAGE_MIME_TYPES_SET.has(contentType)
  ) {
    throw new Error("Formato de imagen no admitido. Usa archivos JPG, PNG o WEBP.");
  }

  return { extension, contentType };
}

export function ensureImageFileIsValid(file: UploadableImage): void {
  prepareImageUpload(file);
}

async function cleanStorageFolder(
  config: SupabaseConfig,
  prefixWithSlash: string,
  keepPath: string,
) {
  if (!prefixWithSlash) return;

  const authKey = getStorageAuthKey(config);

  const listUrl = `${config.url}/storage/v1/object/list/${STORAGE_BUCKET}`;
  const response = await fetch(listUrl, {
    method: "POST",
    headers: {
      apikey: authKey,
      Authorization: `Bearer ${authKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prefix: prefixWithSlash,
      limit: 100,
      offset: 0,
      sortBy: { column: "name", order: "asc" },
    }),
  });

  if (!response.ok) {
    return;
  }

  const payload = (await response.json()) as
    | Array<{ name?: string | null }>
    | {
        items?: Array<{ name?: string | null }>;
        data?: Array<{ name?: string | null }>;
        error?: unknown;
      };

  const posiblesItems = (
    Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.data)
          ? payload.data
          : []
  ).filter((archivo) => archivo?.name);

  const cleanedKeepPath = keepPath.replace(/^\//, "").replace(/\/+/g, "/");
  const trimmedPrefix = prefixWithSlash.replace(/\/+$/, "");

  const objetivos = posiblesItems
    .map((archivo) => {
      if (!archivo?.name) return null;
      const resolved = resolveObjectPathFromItem(
        `${trimmedPrefix}/`,
        archivo.name,
      );
      const cleaned = resolved.replace(/^\//, "").replace(/\/+/g, "/");
      return cleaned === cleanedKeepPath ? null : cleaned;
    })
    .filter((value): value is string => typeof value === "string");

  await Promise.all(
    objetivos.map(async (objectPath) => {
      try {
        const deleteUrl = `${config.url}/storage/v1/object/${STORAGE_BUCKET}/${encodeStoragePath(objectPath)}`;
        const deleteResponse = await fetch(deleteUrl, {
          method: "DELETE",
          headers: {
            apikey: authKey,
            Authorization: `Bearer ${authKey}`,
          },
        });

        if (!deleteResponse.ok) {
          const details = await deleteResponse.text().catch(() => "");
          console.error(
            "[cleanStorageFolder] error al eliminar objeto",
            objectPath,
            deleteResponse.status,
            details,
          );
        }
      } catch (error) {
        console.error("[cleanStorageFolder] fallo eliminando", objectPath, error);
      }
    }),
  );
}

async function uploadImageToStorage(
  folder: StorageFolder,
  identifier: string | number,
  file: UploadableImage,
): Promise<string> {
  const config = getSupabaseConfig();
  const { prefixWithSlash, identifierSegment } =
    sanitizeStorageFolder(folder, identifier);
  if (!prefixWithSlash || identifierSegment.length === 0) {
    throw new Error("No se pudo determinar la ruta de almacenamiento.");
  }

  const baseName = sanitizeFileBaseName(
    typeof file.name === "string" ? file.name : "foto",
  );
  const { extension, contentType } = prepareImageUpload(file);
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 17);
  const fileName = `${timestamp}-${baseName}.${extension}`;
  const objectPath = `${prefixWithSlash}${fileName}`.replace(/^\//, "");
  const normalizedObjectPath = objectPath.replace(/\/+/g, "/");

  const arrayBuffer = await file.arrayBuffer();
  const uploadUrl = `${config.url}/storage/v1/object/${STORAGE_BUCKET}/${encodeStoragePath(normalizedObjectPath)}`;
  const authKey = getStorageAuthKey(config);

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      apikey: authKey,
      Authorization: `Bearer ${authKey}`,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: Buffer.from(arrayBuffer),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(
      `No se pudo subir la imagen (${response.status} ${details})`,
    );
  }

  await cleanStorageFolder(config, prefixWithSlash, normalizedObjectPath);

  return normalizedObjectPath;
}

export async function uploadEquipoImage(
  equipoId: string,
  file: UploadableImage,
): Promise<string> {
  return uploadImageToStorage("equipos", equipoId, file);
}

export async function uploadPantallaImage(
  pantallaId: number,
  file: UploadableImage,
): Promise<string> {
  return uploadImageToStorage("pantallas", pantallaId, file);
}

async function obtenerMiniaturaDesdeStorage(
  config: SupabaseConfig,
  carpeta: "equipos" | "pantallas",
  identificador: string | number,
  cache: Map<string, string | null>,
): Promise<string | null> {
  const cacheKey = `${carpeta}:${identificador}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey) ?? null;
  }

  const listUrl = `${config.url}/storage/v1/object/list/${STORAGE_BUCKET}`;
  const authKey = getStorageAuthKey(config);

  const { prefix, prefixWithSlash } = sanitizeStorageFolder(
    carpeta,
    identificador,
  );

  const candidatePrefixes = Array.from(
    new Set(
      [
        prefixWithSlash,
        prefix,
        prefixWithSlash.replace(/\/+$/, ""),
      ].filter(
        (value): value is string =>
          typeof value === "string" && value.length > 0,
      ),
    ),
  );

  const normalizarPrefix = (valor: string) => {
    const limpio = valor.replace(/\\/g, "/").replace(/\/+/g, "/");
    const sinInicial = limpio.startsWith("/") ? limpio.slice(1) : limpio;
    if (sinInicial.length === 0) return "";
    return sinInicial.endsWith("/") ? sinInicial : `${sinInicial}/`;
  };

  const listarPrimerArchivo = async (prefixOriginal: string) => {
    const prefix = normalizarPrefix(prefixOriginal);

    let response: Response | null = null;
    for (let intento = 0; intento < 2; intento += 1) {
      response = await fetch(listUrl, {
        method: "POST",
        headers: {
          apikey: authKey,
          Authorization: `Bearer ${authKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prefix,
          limit: 1,
          offset: 0,
          sortBy: { column: "name", order: "desc" },
        }),
      });

      if (response.ok) break;

      const status = response.status;
      if (status >= 500 && intento === 0) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        continue;
      }

      console.error(
        "[obtenerMiniaturaDesdeStorage] respuesta no OK",
        carpeta,
        identificador,
        prefix,
        status,
        await response.text().catch(() => "<sin cuerpo>"),
      );
      return null;
    }

    if (!response || !response.ok) return null;

    const payload = (await response.json()) as
      | Array<{ name?: string | null }>
      | {
          items?: Array<{ name?: string | null }>;
          data?: Array<{ name?: string | null }>;
          error?: unknown;
        };

    const posiblesItems = (
      Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload?.data)
            ? payload.data
            : []
    ).filter((archivo) => {
      if (!archivo?.name || archivo.name.endsWith("/")) return false;
      return /\.[a-z0-9]+$/i.test(archivo.name);
    });

    if (posiblesItems.length === 0) {
      return null;
    }

    const item = posiblesItems.find(
      (archivo) =>
        archivo?.name !== undefined &&
        archivo.name !== null &&
        archivo.name.length > 0 &&
        !archivo.name.endsWith("/"),
    );

    if (!item || !item.name) {
      console.warn(
        "[obtenerMiniaturaDesdeStorage] sin archivo válido",
        carpeta,
        identificador,
        prefix,
        JSON.stringify(posiblesItems),
      );
      return null;
    }

    const relativePath = resolveObjectPathFromItem(prefix, item.name ?? "");

    return buildStorageProxyUrl(relativePath);
  };

  for (const candidato of candidatePrefixes) {
    try {
      const url = await listarPrimerArchivo(candidato);
      if (url) {
        cache.set(cacheKey, url);
        return url;
      }
    } catch (error) {
      console.error(
        "[obtenerMiniaturaDesdeStorage] error al listar",
        carpeta,
        identificador,
        candidato,
        error,
      );
    }
  }

  cache.set(cacheKey, null);
  return null;
}

async function completarFabricantesPantallas(
  equipos: EquipoRecord[],
  config: SupabaseConfig,
  pantallasAdicionales: PantallaRecord[] = [],
) {
  const fabricanteIds = new Set<number>();

  equipos.forEach((equipo) => {
    equipo.pantallas?.forEach((pantalla) => {
      if (typeof pantalla.fabricante_id === "number") {
        fabricanteIds.add(pantalla.fabricante_id);
      }
    });
  });

  pantallasAdicionales.forEach((pantalla) => {
    if (typeof pantalla.fabricante_id === "number") {
      fabricanteIds.add(pantalla.fabricante_id);
    }
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

  pantallasAdicionales.forEach((pantalla) => {
    if (typeof pantalla.fabricante_id === "number") {
      pantalla.fabricanteNombre =
        fabricantesMap.get(pantalla.fabricante_id) ?? null;
    } else if (pantalla.fabricanteNombre === undefined) {
      pantalla.fabricanteNombre = null;
    }
  });
}
export async function fetchEquipos(): Promise<EquipoRecord[]> {
  const config = getSupabaseConfig();
  const restUrl = `${config.url}/rest/v1/equipos`;

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
      "ip",
      "toma_red",
      "tarjeta_red",
      "admite_update",
      "al_garbigune",
      "procesador",
      "ram",
      "ssd",
      "hdd",
      "tarjeta_grafica",
      "observaciones",
      "admin_local",
      "fecha_bios",
      "url",
      "actuaciones:actuaciones(id,tipo,descripcion,coste,fecha,hecha_por)",
      "pantallas:pantallas(id,equipo_id,pulgadas,modelo,fabricante_id,precio,fecha_compra,en_garantia,observaciones)",
      "puertos_conectados:puertos(id,switch_id,numero,nombre,vlan,poe,velocidad_mbps,equipo_id,observaciones,switch:switches(id,nombre))",
      "fabricante:fabricantes(nombre)",
      "ubicacion:ubicaciones(nombre)",
      "usuario:usuarios(nombre,apellidos,nombre_completo)",
    ].join(","),
  );
  requestUrl.searchParams.set("order", "fecha_compra.desc.nullslast");

  const response = await fetch(requestUrl.toString(), {
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
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

  await completarFabricantesPantallas(equipos, config);

  const miniaturasCache = new Map<string, string | null>();

  await Promise.all(
    equipos.map(async (equipo) => {
      equipo.thumbnailUrl = await obtenerMiniaturaDesdeStorage(
        config,
        "equipos",
        equipo.id,
        miniaturasCache,
      );

      if (Array.isArray(equipo.pantallas)) {
        await Promise.all(
          equipo.pantallas.map(async (pantalla) => {
            if (!pantalla || typeof pantalla.id !== "number") return;

            pantalla.thumbnailUrl = await obtenerMiniaturaDesdeStorage(
              config,
              "pantallas",
              pantalla.id,
              miniaturasCache,
            );
          }),
        );
      }
    }),
  );

  return equipos;
}

export async function fetchPantallasSinEquipo(): Promise<PantallaRecord[]> {
  const config = getSupabaseConfig();
  const requestUrl = new URL(`${config.url}/rest/v1/pantallas`);
  requestUrl.searchParams.set(
    "select",
    "id,equipo_id,pulgadas,modelo,fabricante_id,precio,fecha_compra,en_garantia,observaciones",
  );
  requestUrl.searchParams.set("equipo_id", "is.null");

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
      `Error al recuperar pantallas sin equipo: ${response.status} ${details}`,
    );
  }

  const pantallas = (await response.json()) as PantallaRecord[];

  if (pantallas.length === 0) {
    return [];
  }

  await completarFabricantesPantallas([], config, pantallas);

  const miniaturasCache = new Map<string, string | null>();

  await Promise.all(
    pantallas.map(async (pantalla) => {
      if (!pantalla || typeof pantalla.id !== "number") return;

      pantalla.thumbnailUrl = await obtenerMiniaturaDesdeStorage(
        config,
        "pantallas",
        pantalla.id,
        miniaturasCache,
      );
    }),
  );

  return pantallas;
}

export async function fetchSwitches(): Promise<SwitchRecord[]> {
  const config = getSupabaseConfig();
  const requestUrl = new URL(`${config.url}/rest/v1/switches`);
  requestUrl.searchParams.set(
    "select",
    "*,fabricante:fabricantes(nombre),ubicacion:ubicaciones(nombre)",
  );
  requestUrl.searchParams.set("order", "fecha_compra.desc.nullslast");

  const response = await fetch(requestUrl.toString(), {
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `Error al recuperar switches: ${response.status} ${details}`,
    );
  }

  return (await response.json()) as SwitchRecord[];
}

export async function fetchSwitchById(
  id: string,
): Promise<SwitchRecord | null> {
  const config = getSupabaseConfig();
  const requestUrl = new URL(`${config.url}/rest/v1/switches`);
  requestUrl.searchParams.set(
    "select",
    [
      "id",
        "nombre",
        "modelo",
        "fabricante_id",
        "ubicacion_id",
        "ancho_banda_gbps",
        "ip",
        "puertos_totales",
        "precio",
        "fecha_compra",
        "en_garantia",
        "fabricante:fabricantes(nombre)",
        "ubicacion:ubicaciones(nombre)",
        "puertos:puertos(id,switch_id,numero,nombre,vlan,poe,velocidad_mbps,equipo_id,observaciones,equipo:equipos(id,nombre,modelo))",
      ].join(","),
  );
  requestUrl.searchParams.set("id", `eq.${id}`);
  requestUrl.searchParams.set("limit", "1");

  const response = await fetch(requestUrl.toString(), {
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `Error al recuperar el switch ${id}: ${response.status} ${details}`,
    );
  }

  const switches = (await response.json()) as SwitchRecord[];
  return switches.length > 0 ? switches[0] : null;
}

export async function upsertSwitchPorts(
  ports: SwitchPortUpsert[],
): Promise<void> {
  if (ports.length === 0) return;
  const config = getSupabaseConfig();
  const requestUrl = new URL(`${config.url}/rest/v1/puertos`);
  requestUrl.searchParams.set("on_conflict", "switch_id,numero");

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const payload = ports.map(({ id: _id, ...rest }) => rest);

  const response = await fetch(requestUrl.toString(), {
    method: "POST",
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `Error al guardar puertos: ${response.status} ${details}`,
    );
  }
}

export async function deleteSwitchPorts(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const config = getSupabaseConfig();
  const requestUrl = new URL(`${config.url}/rest/v1/puertos`);
  requestUrl.searchParams.set("id", `in.(${ids.join(",")})`);

  const response = await fetch(requestUrl.toString(), {
    method: "DELETE",
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      Prefer: "return=minimal",
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `Error al eliminar puertos: ${response.status} ${details}`,
    );
  }
}

export async function fetchPantallaById(
  id: number,
): Promise<PantallaRecord | null> {
  const config = getSupabaseConfig();
  const requestUrl = new URL(`${config.url}/rest/v1/pantallas`);
  requestUrl.searchParams.set(
    "select",
    "id,equipo_id,pulgadas,modelo,fabricante_id,precio,fecha_compra,en_garantia,observaciones,equipo:equipos(id,nombre,fecha_compra)",
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
      `Error al recuperar la pantalla ${id}: ${response.status} ${details}`,
    );
  }

  const pantallas = (await response.json()) as PantallaRecord[];
  if (pantallas.length === 0) {
    return null;
  }

  await completarFabricantesPantallas([], config, pantallas);

  const miniaturaCache = new Map<string, string | null>();
  const pantalla = pantallas[0];
  if (pantalla && typeof pantalla.id === "number") {
    pantalla.thumbnailUrl = await obtenerMiniaturaDesdeStorage(
      config,
      "pantallas",
      pantalla.id,
      miniaturaCache,
    );
  }

  return pantallas[0];
}

export async function updatePantalla(
  id: number,
  payload: PantallaUpdatePayload,
): Promise<void> {
  const config = getSupabaseConfig();
  const requestUrl = new URL(`${config.url}/rest/v1/pantallas`);
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
      `Error al actualizar la pantalla ${id}: ${response.status} ${details}`,
    );
  }
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
      "ip",
      "toma_red",
      "tarjeta_red",
      "admite_update",
      "al_garbigune",
      "procesador",
      "ram",
      "ssd",
      "hdd",
      "tarjeta_grafica",
      "observaciones",
      "url",
      "fecha_bios",
      "admin_local",
      "actuaciones:actuaciones(id,tipo,descripcion,coste,fecha,hecha_por)",
        "pantallas:pantallas(id,equipo_id,pulgadas,modelo,fabricante_id,precio,fecha_compra,en_garantia)",
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

  const miniaturasCache = new Map<string, string | null>();
  const equipo = equipos[0];
  if (equipo) {
    equipo.thumbnailUrl = await obtenerMiniaturaDesdeStorage(
      config,
      "equipos",
      equipo.id,
      miniaturasCache,
    );

    if (Array.isArray(equipo.pantallas)) {
      await Promise.all(
        equipo.pantallas.map(async (pantalla) => {
          if (!pantalla || typeof pantalla.id !== "number") return;
          pantalla.thumbnailUrl = await obtenerMiniaturaDesdeStorage(
            config,
            "pantallas",
            pantalla.id,
            miniaturasCache,
          );
        }),
      );
    }
  }

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
  ip?: string | null;
  toma_red?: string | null;
  tarjeta_red?: string | number | null;
  admin_local?: string | null;
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

export async function fetchEquiposCatalogo(): Promise<EquipoCatalogoItem[]> {
  const config = getSupabaseConfig();
  const requestUrl = new URL(`${config.url}/rest/v1/equipos`);
  requestUrl.searchParams.set("select", "id,nombre,modelo");
  requestUrl.searchParams.set("order", "nombre.asc.nullslast");

  const response = await fetch(requestUrl.toString(), {
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `Error al recuperar equipos para el catalogo: ${response.status} ${details}`,
    );
  }

  return (await response.json()) as EquipoCatalogoItem[];
}

export type PantallaUpdatePayload = {
  modelo?: string | null;
  fabricante_id?: number | null;
  precio?: number | null;
  fecha_compra?: string | null;
  en_garantia?: boolean | null;
  pulgadas?: number | null;
  equipo_id?: string | null;
  observaciones?: string | null;
};

export type EquipoInsertPayload = {
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
  ip?: string | null;
  toma_red?: string | null;
  tarjeta_red?: string | number | null;
  admin_local?: string | null;
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

export type PantallaInsertPayload = {
  modelo?: string | null;
  fabricante_id?: number | null;
  precio?: number | null;
  fecha_compra?: string | null;
  en_garantia?: boolean | null;
  pulgadas?: number | null;
  equipo_id?: string | null;
  observaciones?: string | null;
};

export async function deleteEquipo(id: string): Promise<void> {
  const config = getSupabaseConfig();
  const requestUrl = new URL(`${config.url}/rest/v1/equipos`);
  requestUrl.searchParams.set("id", `eq.${id}`);

  const response = await fetch(requestUrl.toString(), {
    method: "DELETE",
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      Prefer: "return=minimal",
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `Error al eliminar el equipo ${id}: ${response.status} ${details}`,
    );
  }
}

export async function deletePantalla(id: number): Promise<void> {
  const config = getSupabaseConfig();
  const requestUrl = new URL(`${config.url}/rest/v1/pantallas`);
  requestUrl.searchParams.set("id", `eq.${id}`);

  const response = await fetch(requestUrl.toString(), {
    method: "DELETE",
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      Prefer: "return=minimal",
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `Error al eliminar la pantalla ${id}: ${response.status} ${details}`,
    );
  }
}

export async function createEquipo(
  payload: EquipoInsertPayload,
): Promise<string> {
  const config = getSupabaseConfig();

  const cuerpo = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  );

  const response = await fetch(`${config.url}/rest/v1/equipos`, {
    method: "POST",
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(cuerpo),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `Error al crear el equipo: ${response.status} ${details}`,
    );
  }

  const data = (await response.json()) as Array<{ id: string }>;
  const creado = data[0];
  if (!creado?.id) {
    throw new Error("El equipo se creó pero no se recibió su identificador.");
  }

  return creado.id;
}

export async function createPantalla(
  payload: PantallaInsertPayload,
): Promise<number> {
  const config = getSupabaseConfig();

  const cuerpo = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  );

  const response = await fetch(`${config.url}/rest/v1/pantallas`, {
    method: "POST",
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(cuerpo),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `Error al crear la pantalla: ${response.status} ${details}`,
    );
  }

  const data = (await response.json()) as Array<{ id: number }>;
  const creado = data[0];
  if (!creado?.id) {
    throw new Error(
      "La pantalla se creó pero no se recibió su identificador.",
    );
  }

  return creado.id;
}

export async function createSwitch(
  payload: SwitchInsertPayload,
): Promise<number> {
  const config = getSupabaseConfig();

  const cuerpo = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  );

  const response = await fetch(`${config.url}/rest/v1/switches`, {
    method: "POST",
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(cuerpo),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `Error al crear el switch: ${response.status} ${details}`,
    );
  }

  const data = (await response.json()) as Array<{ id?: number }>;
  const creado = data[0];
  if (!creado?.id) {
    throw new Error(
      "El switch se creó pero no se recibió su identificador.",
    );
  }

  return creado.id;
}

export async function updateSwitch(
  id: string | number,
  payload: SwitchUpdatePayload,
): Promise<void> {
  const config = getSupabaseConfig();
  const requestUrl = new URL(`${config.url}/rest/v1/switches`);
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
      `Error al actualizar el switch ${id}: ${response.status} ${details}`,
    );
  }
}

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

export type ActuacionUpsert = {
  id?: number;
  tipo: ActuacionTipo;
  descripcion?: string | null;
  coste?: number | null;
  fecha?: string;
  hecha_por?: string | null;
};

export async function upsertActuaciones(
  equipoId: string,
  actuaciones: ActuacionUpsert[],
): Promise<void> {
  if (actuaciones.length === 0) return;

  const config = getSupabaseConfig();

  const crear = actuaciones.filter(
    (actuacion) => typeof actuacion.id !== "number",
  );
  const actualizar = actuaciones.filter(
    (actuacion): actuacion is ActuacionUpsert & { id: number } =>
      typeof actuacion.id === "number",
  );

  const headersBase = {
    apikey: config.anonKey,
    Authorization: `Bearer ${config.anonKey}`,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  };

  if (crear.length > 0) {
    const responses = await Promise.all(
      crear.map((actuacion) => {
        const body = { ...actuacion, equipo_id: equipoId } as {
          equipo_id: string;
          id?: number;
          tipo: string;
          descripcion?: string | null;
          coste?: number | null;
          fecha?: string;
          hecha_por?: string | null;
        };
        delete body.id;
        const payload = Object.fromEntries(
          Object.entries(body).filter(([, value]) => value !== undefined),
        );

        return fetch(`${config.url}/rest/v1/actuaciones`, {
          method: "POST",
          headers: headersBase,
          body: JSON.stringify(payload),
        });
      }),
    );

    for (const response of responses) {
      if (!response || response.ok) continue;
      const details = await response.text();
      throw new Error(
        `Error al crear una actuacion: ${response.status} ${details}`,
      );
    }
  }

  if (actualizar.length > 0) {
    const responses = await Promise.all(
      actualizar.map((actuacion) => {
        const { id, ...resto } = actuacion;
        const payload = Object.fromEntries(
          Object.entries(resto).filter(([, value]) => value !== undefined),
        );

        if (Object.keys(payload).length === 0) {
          return null;
        }

        return fetch(`${config.url}/rest/v1/actuaciones?id=eq.${id}`, {
          method: "PATCH",
          headers: headersBase,
          body: JSON.stringify(payload),
        });
      }),
    );

    for (const response of responses) {
      if (!response || response.ok) continue;
      const details = await response.text();
      throw new Error(
        `Error al actualizar una actuacion: ${response.status} ${details}`,
      );
    }
  }
}
