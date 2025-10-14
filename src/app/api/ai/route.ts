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
- tipo public.tipo_equipo_enum (portatil, sobremesa, servidor, tablet)
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
      { message: "OPENAI_API_KEY no está configurada en el entorno." },
      { status: 500 },
    );
  }

  let body: PeticionIA;
  try {
    body = (await request.json()) as PeticionIA;
  } catch {
    return NextResponse.json({ message: "Cuerpo de la petición inválido." }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ message: "El prompt no puede estar vacío." }, { status: 400 });
  }

  const equipos = Array.isArray(body.contexto?.equipos) ? body.contexto?.equipos : [];

  const userMessage = `
Pregunta del usuario:
${prompt}

Datos de contexto (total ${equipos.length} registros, resumidos):
${JSON.stringify(equipos, null, 2)}
`;

  try {
    const respuesta = await fetch("https://api.openai.com/v1/chat/completions", {
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
              "Eres un asistente especializado en filtrar datos del inventario descrito. " +
              "Debes analizar la petición del usuario y los registros facilitados y devolver únicamente un conjunto de filtros que satisfacen la petición. " +
              "Dispones de campos auxiliares como 'asignado' (boolean) y 'sistema_operativo_normalizado' (en minúsculas). " +
              "Considera coincidencias parciales y sin distinción de mayúsculas/minúsculas en campos de texto, por ejemplo, utiliza includes sobre 'sistema_operativo_normalizado'. " +
              "Trata un equipo como 'asignado' cuando su campo asignado es true o usuario_id no es null. " +
              "El campo admite_update puede ser true, false o null (desconocido); filtra únicamente con true/false cuando corresponda. " +
              "Responde EXCLUSIVAMENTE en JSON sin bloques de código ni texto adicional, con la forma {\"filters\": { ... }, \"summary\": \"texto opcional\"}. " +
              "Dentro de 'filters' utiliza solo claves conocidas como: sistema_operativo_contains (array de fragmentos), admite_update (\"true\"|\"false\"|\"unknown\"), asignado (boolean), al_garbigune (boolean), ubicacion_contains (array), tipo_in (array). " +
              "Si no hay coincidencias, devuelve un objeto 'filters' vacío y explica brevemente el motivo en 'summary'. " +
              "No inventes información ni sugieras acciones fuera del filtrado solicitado.",
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
    });

    if (!respuesta.ok) {
      const errorDetalles = await respuesta.text();
      throw new Error(errorDetalles || "Error desconocido en la API de OpenAI.");
    }

    const datos = (await respuesta.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const answer = datos.choices?.[0]?.message?.content?.trim();

    if (!answer) {
      throw new Error("La respuesta de la IA no contenía contenido utilizable.");
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
        throw new Error("La IA no devolvió JSON válido.");
      }

      parsed = JSON.parse(bloqueJson);
    }

    const filtersRaw = (parsed as { filters?: unknown }).filters;
    const summaryRaw = (parsed as { summary?: unknown }).summary;

    const filtros =
      filtersRaw && typeof filtersRaw === "object" ? (filtersRaw as Record<string, unknown>) : {};

    const summary =
      typeof summaryRaw === "string" && summaryRaw.trim().length > 0 ? summaryRaw.trim() : null;

    return NextResponse.json({ filters: filtros, summary });
  } catch (error) {
    const mensaje =
      error instanceof Error ? error.message : "Error inesperado al consultar la IA.";
    return NextResponse.json({ message: mensaje }, { status: 500 });
  }
}
