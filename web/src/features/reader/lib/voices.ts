import type { VoiceModel } from "./engine";

/**
 * Catálogo curado de voces Piper.
 *
 * Piper ofrece +100 voces; mostrarlas todas empeora la UX, así que mantenemos
 * una lista corta y revisada. En español, solo voces peninsulares (es_ES).
 *
 * Un MODELO (.onnx) puede contener varios HABLANTES: `es_ES-sharvard-medium`
 * trae una voz masculina (0) y una femenina (1). Por eso cada voz del catálogo
 * es la pareja `model` + `speaker`, y su `id` es único aunque comparta modelo.
 *
 * Las fichas de Piper no indican el género de las voces MLS. Se comprobó
 * midiendo el tono medio (frecuencia fundamental) del audio generado:
 * ~185-215 Hz en las femeninas, ~125 Hz en las masculinas.
 */
export interface Voice extends VoiceModel {
  id: string;
  name: string;
  gender: "female" | "male";
  language: "es" | "en";
  /** Acento, solo cuando el idioma tiene varios en el catálogo. */
  accent?: string;
  /** Calidad del modelo en Piper: más calidad = más peso de descarga. */
  quality: "x_low" | "low" | "medium";
}

export const VOICES = [
  // ── Español de España ──
  {
    id: "es-sharvard-f",
    model: "es_ES-sharvard-medium",
    speaker: 1,
    name: "Sharvard",
    gender: "female",
    language: "es",
    quality: "medium",
  },
  {
    id: "es-mls-9972",
    model: "es_ES-mls_9972-low",
    speaker: 0,
    name: "MLS 9972",
    gender: "female",
    language: "es",
    quality: "low",
  },
  {
    id: "es-mls-10246",
    model: "es_ES-mls_10246-low",
    speaker: 0,
    name: "MLS 10246",
    gender: "female",
    language: "es",
    quality: "low",
  },
  {
    id: "es-davefx",
    model: "es_ES-davefx-medium",
    speaker: 0,
    name: "Dave",
    gender: "male",
    language: "es",
    quality: "medium",
  },
  {
    id: "es-sharvard-m",
    model: "es_ES-sharvard-medium",
    speaker: 0,
    name: "Sharvard",
    gender: "male",
    language: "es",
    quality: "medium",
  },
  {
    id: "es-carlfm",
    model: "es_ES-carlfm-x_low",
    speaker: 0,
    name: "Carlfm",
    gender: "male",
    language: "es",
    quality: "x_low",
  },
  // ── Inglés ──
  {
    id: "en-lessac",
    model: "en_US-lessac-medium",
    speaker: 0,
    name: "Lessac",
    gender: "female",
    language: "en",
    accent: "EE. UU.",
    quality: "medium",
  },
  {
    id: "en-amy",
    model: "en_US-amy-medium",
    speaker: 0,
    name: "Amy",
    gender: "female",
    language: "en",
    accent: "EE. UU.",
    quality: "medium",
  },
  {
    id: "en-ryan",
    model: "en_US-ryan-medium",
    speaker: 0,
    name: "Ryan",
    gender: "male",
    language: "en",
    accent: "EE. UU.",
    quality: "medium",
  },
  {
    id: "en-alba",
    model: "en_GB-alba-medium",
    speaker: 0,
    name: "Alba",
    gender: "female",
    language: "en",
    accent: "Reino Unido",
    quality: "medium",
  },
  {
    id: "en-cori",
    model: "en_GB-cori-medium",
    speaker: 0,
    name: "Cori",
    gender: "female",
    language: "en",
    accent: "Reino Unido",
    quality: "medium",
  },
  {
    id: "en-alan",
    model: "en_GB-alan-medium",
    speaker: 0,
    name: "Alan",
    gender: "male",
    language: "en",
    accent: "Reino Unido",
    quality: "medium",
  },
] as const satisfies readonly Voice[];
// `as const` conserva los literales (el tipo de `id` es "es-davefx" | ..., no
// `string`) y `satisfies` valida la forma contra `Voice` SIN ensanchar el tipo.

/** Unión de ids válidos derivada del array: si añades una voz, el tipo se actualiza solo. */
export type VoiceId = (typeof VOICES)[number]["id"];

export const DEFAULT_VOICE: VoiceId = "es-sharvard-f";

export const LANGUAGE_LABEL: Record<Voice["language"], string> = { es: "Español (España)", en: "Inglés" };

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
