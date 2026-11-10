import type { VoiceModel } from "./engine";

/**
 * Catálogo de voces en español.
 *
 * Dos familias de modelos:
 *   - Supertonic 2: alta calidad (entonación y tildes mucho mejores). Un solo
 *     modelo de ~260 MB sirve para las 10 voces.
 *   - Piper: más ligeras (~60 MB por voz) pero más robóticas. Son voces
 *     peninsulares (es_ES). El modelo `sharvard` trae DOS hablantes
 *     (masculino 0 y femenino 1): cada voz es la pareja modelo + hablante.
 *
 * Las fichas de Piper no indican el género de las voces MLS. Se comprobó
 * midiendo el tono medio (frecuencia fundamental) del audio generado:
 * ~185-215 Hz en las femeninas, ~120 Hz en las masculinas.
 */
export type Voice = VoiceModel & {
  id: string;
  name: string;
  gender: "female" | "male";
  quality: "high" | "medium" | "low";
};

export const VOICES = [
  // ── Supertonic: alta calidad ──
  { id: "st-f1", engine: "supertonic", style: "F1", name: "Supertonic F1", gender: "female", quality: "high" },
  { id: "st-f2", engine: "supertonic", style: "F2", name: "Supertonic F2", gender: "female", quality: "high" },
  { id: "st-f3", engine: "supertonic", style: "F3", name: "Supertonic F3", gender: "female", quality: "high" },
  { id: "st-f4", engine: "supertonic", style: "F4", name: "Supertonic F4", gender: "female", quality: "high" },
  { id: "st-f5", engine: "supertonic", style: "F5", name: "Supertonic F5", gender: "female", quality: "high" },
  { id: "st-m1", engine: "supertonic", style: "M1", name: "Supertonic M1", gender: "male", quality: "high" },
  { id: "st-m2", engine: "supertonic", style: "M2", name: "Supertonic M2", gender: "male", quality: "high" },
  { id: "st-m3", engine: "supertonic", style: "M3", name: "Supertonic M3", gender: "male", quality: "high" },
  { id: "st-m4", engine: "supertonic", style: "M4", name: "Supertonic M4", gender: "male", quality: "high" },
  { id: "st-m5", engine: "supertonic", style: "M5", name: "Supertonic M5", gender: "male", quality: "high" },
  // ── Piper: ligeras ──
  {
    id: "es-sharvard-f",
    engine: "piper",
    model: "es_ES-sharvard-medium",
    speaker: 1,
    name: "Sharvard",
    gender: "female",
    quality: "medium",
  },
  {
    id: "es-mls-9972",
    engine: "piper",
    model: "es_ES-mls_9972-low",
    speaker: 0,
    name: "MLS 9972",
    gender: "female",
    quality: "low",
  },
  {
    id: "es-mls-10246",
    engine: "piper",
    model: "es_ES-mls_10246-low",
    speaker: 0,
    name: "MLS 10246",
    gender: "female",
    quality: "low",
  },
  {
    id: "es-davefx",
    engine: "piper",
    model: "es_ES-davefx-medium",
    speaker: 0,
    name: "Dave",
    gender: "male",
    quality: "medium",
  },
  {
    id: "es-sharvard-m",
    engine: "piper",
    model: "es_ES-sharvard-medium",
    speaker: 0,
    name: "Sharvard",
    gender: "male",
    quality: "medium",
  },
  {
    id: "es-carlfm",
    engine: "piper",
    model: "es_ES-carlfm-x_low",
    speaker: 0,
    name: "Carlfm",
    gender: "male",
    quality: "low",
  },
] as const satisfies readonly Voice[];
// `as const` conserva los literales (el tipo de `id` es "st-f1" | ..., no
// `string`) y `satisfies` valida la forma contra `Voice` SIN ensanchar el tipo.

/** Unión de ids válidos derivada del array: si añades una voz, el tipo se actualiza solo. */
export type VoiceId = (typeof VOICES)[number]["id"];

export const DEFAULT_VOICE: VoiceId = "st-f1";

/** Título de cada grupo del selector de voz. */
export const ENGINE_LABEL: Record<Voice["engine"], string> = {
  supertonic: "Alta calidad",
  piper: "Ligeras (Piper, menor calidad)",
};

/**
 * TYPE GUARD: comprueba en tiempo de ejecución un valor desconocido (p. ej.
 * leído de localStorage) y, si devuelve true, TypeScript lo trata como VoiceId.
 */
export function isVoiceId(value: unknown): value is VoiceId {
  return VOICES.some((v) => v.id === value);
}

export function getVoice(id: VoiceId): Voice {
  // El `!` es seguro: el tipo VoiceId solo admite ids que existen en VOICES.
  return VOICES.find((v) => v.id === id)!;
}
