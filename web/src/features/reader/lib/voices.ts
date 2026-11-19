import type { VoiceModel } from "./engine";

/**
 * Catálogo de voces en español de España.
 *
 * Cuatro familias, de más a menos privada:
 *   - En tu equipo (el texto no sale del navegador; el modelo se descarga una vez):
 *       · Supertonic 2: las más naturales. Un modelo de ~260 MB para todas sus
 *         voces. Trae 10 estilos, pero solo F5 y M5 suenan peninsulares.
 *       · Piper: más ligeras (~60 MB por voz) pero más robóticas. Son todas
 *         las es_ES que existen. `sharvard` trae DOS hablantes (masculino 0 y
 *         femenino 1): cada voz es la pareja modelo + hablante.
 *   - En la nube de Microsoft (el texto se envía a Microsoft):
 *       · Edge: voces gratuitas que el navegador Microsoft Edge ofrece a
 *         cualquier web. En otros navegadores no existen.
 *       · Azure: el catálogo completo, con la clave de Azure del propio usuario.
 *
 * Kokoro se probó y se descartó: sus 3 voces en español son latinoamericanas.
 *
 * Los nombres son los oficiales de cada modelo, no inventados. Ximena no se
 * ofrece: Azure la publica como es-ES, pero Edge la etiqueta "Spanish
 * (Colombia)", y las voces latinoamericanas están descartadas.
 *
 * Las fichas de Piper no indican el género de las voces MLS. Se comprobó
 * midiendo el tono medio (frecuencia fundamental) del audio generado:
 * ~185-215 Hz en las femeninas, ~120 Hz en las masculinas.
 */
export type Voice = VoiceModel & {
  id: string;
  /** Nombre visible en el selector. */
  name: string;
  gender: "female" | "male";
};

/**
 * Atajo para las voces de Azure: todas siguen el patrón "es-ES-<Nombre>Neural"
 * (o "...MultilingualNeural", voces que además saben leer otros idiomas).
 */
const azure = <const Id extends string>(id: Id, name: string, gender: Voice["gender"], multilingual = false) =>
  ({
    id: `az-${id}`,
    engine: "azure",
    voiceName: `es-ES-${name}${multilingual ? "Multilingual" : ""}Neural`,
    name: multilingual ? `${name} (multilingüe)` : name,
    gender,
  }) as const;

export const VOICES = [
  // ── Supertonic ──
  { id: "st-f5", engine: "supertonic", style: "F5", name: "F5", gender: "female" },
  { id: "st-m5", engine: "supertonic", style: "M5", name: "M5", gender: "male" },
  // ── Piper ──
  {
    id: "es-sharvard-f",
    engine: "piper",
    model: "es_ES-sharvard-medium",
    speaker: 1,
    name: "Sharvard",
    gender: "female",
  },
  {
    id: "es-mls-10246",
    engine: "piper",
    model: "es_ES-mls_10246-low",
    speaker: 0,
    name: "MLS 10246",
    gender: "female",
  },
  { id: "es-davefx", engine: "piper", model: "es_ES-davefx-medium", speaker: 0, name: "DaveFX", gender: "male" },
  {
    id: "es-sharvard-m",
    engine: "piper",
    model: "es_ES-sharvard-medium",
    speaker: 0,
    name: "Sharvard",
    gender: "male",
  },
  { id: "es-carlfm", engine: "piper", model: "es_ES-carlfm-x_low", speaker: 0, name: "CarlFM", gender: "male" },
  // ── Edge ──
  { id: "edge-elvira", engine: "edge", voiceName: "Elvira", name: "Elvira", gender: "female" },
  { id: "edge-alvaro", engine: "edge", voiceName: "Alvaro", name: "Álvaro", gender: "male" },
  // ── Azure ── (lista oficial es-ES; sin Ximena ni las "HD", que cuestan más)
  azure("elvira", "Elvira", "female"),
  azure("alvaro", "Alvaro", "male"),
  azure("abril", "Abril", "female"),
  azure("arnau", "Arnau", "male"),
  azure("dario", "Dario", "male"),
  azure("elias", "Elias", "male"),
  azure("estrella", "Estrella", "female"),
  azure("irene", "Irene", "female"),
  azure("laia", "Laia", "female"),
  azure("lia", "Lia", "female"),
  azure("nil", "Nil", "male"),
  azure("saul", "Saul", "male"),
  azure("teo", "Teo", "male"),
  azure("triana", "Triana", "female"),
  azure("vera", "Vera", "female"),
  azure("arabella", "Arabella", "female", true),
  azure("isidora", "Isidora", "female", true),
  azure("tristan", "Tristan", "male", true),
] as const satisfies readonly Voice[];
// `as const` conserva los literales (el tipo de `id` es "st-f5" | ..., no
// `string`) y `satisfies` valida la forma contra `Voice` SIN ensanchar el tipo.

/** Unión de ids válidos derivada del array: si añades una voz, el tipo se actualiza solo. */
export type VoiceId = (typeof VOICES)[number]["id"];

export const DEFAULT_VOICE: VoiceId = "st-f5";

/** Tipos de voz del primer desplegable, en el orden en que se muestran. */
export const ENGINE_LABEL: Record<Voice["engine"], string> = {
  supertonic: "Supertonic (natural)",
  piper: "Piper (ligera)",
  edge: "Edge (solo en Edge)",
  azure: "Azure (tu clave)",
};

/**
 * TYPE GUARD: comprueba en tiempo de ejecución un valor desconocido (p. ej.
 * leído de localStorage) y, si devuelve true, TypeScript lo trata como VoiceId.
 * Una voz guardada que ya no existe (las que se quitaron) no pasa el filtro y
 * se usa la voz por defecto.
 */
export function isVoiceId(value: unknown): value is VoiceId {
  return VOICES.some((v) => v.id === value);
}

export function getVoice(id: VoiceId): Voice {
  // El `!` es seguro: el tipo VoiceId solo admite ids que existen en VOICES.
  return VOICES.find((v) => v.id === id)!;
}
