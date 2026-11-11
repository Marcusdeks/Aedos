import type { VoiceModel } from "./engine";

/**
 * Catálogo de voces en español de España.
 *
 * Dos familias de modelos:
 *   - Supertonic 2: las más naturales (entonación y tildes mucho mejores). Un
 *     solo modelo de ~260 MB sirve para todas sus voces. Trae 10 estilos, pero
 *     solo F5 y M5 suenan peninsulares; los demás tienen acento latinoamericano
 *     (comprobado escuchándolos), así que no se ofrecen.
 *   - Piper: más ligeras (~60 MB por voz) pero más robóticas. Son voces
 *     peninsulares (es_ES). El modelo `sharvard` trae DOS hablantes
 *     (masculino 0 y femenino 1): cada voz es la pareja modelo + hablante.
 *
 * Los nombres son inventados (los modelos solo tienen códigos): nombres
 * "elegantes" para las mejores y castizos para las más modestas.
 *
 * Las fichas de Piper no indican el género de las voces MLS. Se comprobó
 * midiendo el tono medio (frecuencia fundamental) del audio generado:
 * ~185-215 Hz en las femeninas, ~120 Hz en las masculinas.
 */
export type Voice = VoiceModel & {
  id: string;
  name: string;
  gender: "female" | "male";
};

export const VOICES = [
  // ── Supertonic ──
  { id: "st-f5", engine: "supertonic", style: "F5", name: "Cayetana", gender: "female" },
  { id: "st-m5", engine: "supertonic", style: "M5", name: "Íñigo", gender: "male" },
  // ── Piper ──
  { id: "es-sharvard-f", engine: "piper", model: "es_ES-sharvard-medium", speaker: 1, name: "Lola", gender: "female" },
  { id: "es-mls-9972", engine: "piper", model: "es_ES-mls_9972-low", speaker: 0, name: "Maripili", gender: "female" },
  { id: "es-mls-10246", engine: "piper", model: "es_ES-mls_10246-low", speaker: 0, name: "Conchi", gender: "female" },
  { id: "es-davefx", engine: "piper", model: "es_ES-davefx-medium", speaker: 0, name: "Pepe", gender: "male" },
  { id: "es-sharvard-m", engine: "piper", model: "es_ES-sharvard-medium", speaker: 0, name: "Manolo", gender: "male" },
  { id: "es-carlfm", engine: "piper", model: "es_ES-carlfm-x_low", speaker: 0, name: "Paco", gender: "male" },
] as const satisfies readonly Voice[];
// `as const` conserva los literales (el tipo de `id` es "st-f5" | ..., no
// `string`) y `satisfies` valida la forma contra `Voice` SIN ensanchar el tipo.

/** Unión de ids válidos derivada del array: si añades una voz, el tipo se actualiza solo. */
export type VoiceId = (typeof VOICES)[number]["id"];

export const DEFAULT_VOICE: VoiceId = "st-f5";

/** Título de cada grupo del selector de voz. */
export const ENGINE_LABEL: Record<Voice["engine"], string> = {
  supertonic: "Supertonic",
  piper: "Piper (más ligeras)",
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
