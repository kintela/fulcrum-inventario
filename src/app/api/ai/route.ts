import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const SCHEMA_CONTEXT = `
Base de datos: inventario de equipos.
Tabla public.equipos (alias e):
- id uuid PRIMARY KEY
- fabricante_id bigint REFERENCES fabricantes(id)
- ubicacion_id bigint REFERENCES ubicaciones(id)
- nombre text
- modelo text
- numero_serie text
- part_number text
- codigo_sap text
- sistema_operativo text
- so_serial text
- admite_update boolean
- al_garbigune boolean
- procesador text
- ram numeric
- ssd numeric
- hdd numeric
- pantalla text
- tarjeta_grafica text
- fecha_compra date
- precio_compra numeric
- fecha_bios date
- tipo public.tipo_equipo_enum (portatil, sobremesa, servidor, tablet, almacenamiento)
- admin_local text
- usuario_id bigint REFERENCES usuarios(id)
- observaciones text
- url text
- so_precio numeric
- en_garantia boolean
- creado_el timestamptz
- actualizado_el timestamptz
`;

type PeticionIA = {
  prompt?: string;
  contexto?: {
    equipos?: Array<Record<string, unknown>>;
  };
};

export async function POST(request: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { message: "OPENAI_API_KEY no esta configurada en el entorno." },
      { status: 500 },
    );
  }

  let body: PeticionIA;
  try {
    body = (await request.json()) as PeticionIA;
  } catch {
    return NextResponse.json(
      { message: "Cuerpo de la peticion invalido." },
      { status: 400 },
    );
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json(
      { message: "El prompt no puede estar vacio." },
      { status: 400 },
    );
  }

  const equipos = Array.isArray(body.contexto?.equipos)
    ? body.contexto?.equipos
    : [];

  const userMessage = `
Pregunta del usuario:
${prompt}

Datos de contexto (total ${equipos.length} registros, resumidos):
${JSON.stringify(equipos, null, 2)}
`;

  try {
    const respuesta = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content:
                "Eres un asistente especializado en evaluar el inventario descrito. " +
                "Debes analizar la peticion del usuario y los registros facilitados, devolver un conjunto de filtros y, sobre todo, razonar que equipos destacan segun la pregunta. " +
                "Los datos incluyen campos utiles como 'sistema_operativo_normalizado', 'asignado', 'admite_update', 'fecha_compra', 'precio_compra', 'ram', 'ssd', 'hdd', 'procesador', 'tarjeta_grafica', 'antiguedad_anos' y 'en_garantia'. " +
                "Considera coincidencias parciales sin distincion de mayusculas/minusculas en campos de texto (por ejemplo, usa includes sobre 'sistema_operativo_normalizado'). " +
                "Trata un equipo como 'asignado' cuando 'asignado' es true o usuario_id no es null. " +
                'Devuelve EXCLUSIVAMENTE JSON sin bloques de codigo ni texto extra, con la forma {"filters": { ... }, "highlights": [ ... ], "summary": "..."}. ' +
                "En 'filters' utiliza solo claves conocidas (sistema_operativo_contains, admite_update, asignado, al_garbigune, ubicacion_contains, tipo_in, antiguedad_min, antiguedad_max, ram_min, ram_max, precio_max, etc.). " +
                '"highlights" debe ser un array con objetos {"id": string, "motivo": string}. El motivo debe explicar brevemente POR QUE el equipo encaja con la peticion, citando datos concretos (por ejemplo, antiguedad de X anos, especificaciones bajas, precio original, si requiere gasto mayor al valor, etc.). ' +
                "Si la peticion implica comparar coste/beneficio, justifica explicitamente por que no merece invertir los 280 en soporte (edad avanzada, hardware limitado, coste mayor que valor residual, etc.). " +
                "Si no hay equipos destacados, devuelve \"highlights\": [] y explica el motivo en 'summary'. " +
                "No inventes informacion ni propongas acciones fuera del ambito del inventario. Mantente conciso y preciso.",
            },
            {
              role: "system",
              content: `Contexto estructural de la base de datos:\n${SCHEMA_CONTEXT}`,
            },
            {
              role: "user",
              content: userMessage,
            },
          ],
        }),
      },
    );

    if (!respuesta.ok) {
      const errorDetalles = await respuesta.text();
      throw new Error(
        errorDetalles || "Error desconocido en la API de OpenAI.",
      );
    }

    const datos = (await respuesta.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const answer = datos.choices?.[0]?.message?.content?.trim();

    if (!answer) {
      throw new Error("La respuesta de la IA no contena contenido utilizable.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(answer);
    } catch {
      const bloqueJson =
        answer.match(/```json\s*([\s\S]*?)```/i)?.[1] ??
        answer.match(/```([\s\S]*?)```/i)?.[1] ??
        answer.match(/\{[\s\S]*\}/)?.[0];

      if (!bloqueJson) {
        throw new Error("La IA no devolvio JSON valido.");
      }

      parsed = JSON.parse(bloqueJson);
    }

    const filtersRaw = (parsed as { filters?: unknown }).filters;
    const summaryRaw = (parsed as { summary?: unknown }).summary;
    const highlightsRaw = (parsed as { highlights?: unknown }).highlights;

    const filtros =
      filtersRaw && typeof filtersRaw === "object"
        ? (filtersRaw as Record<string, unknown>)
        : {};

    const summary =
      typeof summaryRaw === "string" && summaryRaw.trim().length > 0
        ? summaryRaw.trim()
        : null;

    const highlights = Array.isArray(highlightsRaw)
      ? highlightsRaw
          .map((item) =>
            item &&
            typeof item === "object" &&
            typeof (item as { id?: unknown }).id === "string"
              ? {
                  id: (item as { id: string }).id,
                  motivo:
                    typeof (item as { motivo?: unknown }).motivo === "string"
                      ? (item as { motivo: string }).motivo.trim() || null
                      : null,
                }
              : null,
          )
          .filter((item): item is { id: string; motivo: string | null } =>
            Boolean(item),
          )
      : [];

    return NextResponse.json({ filters: filtros, highlights, summary });
  } catch (error) {
    const mensaje =
      error instanceof Error
        ? error.message
        : "Error inesperado al consultar la IA.";
    return NextResponse.json({ message: mensaje }, { status: 500 });
  }
}
