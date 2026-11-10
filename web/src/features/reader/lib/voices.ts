/**
 * Catálogo curado de voces Piper.
 *
 * Piper ofrece +100 voces, pero mostrarlas todas empeora la UX. Mantenemos una
 * lista corta y revisada. El `id` coincide con el nombre del modelo en Piper
 * (`<locale>-<nombre>-<calidad>`), así que sirve tanto para la web como para
 * escritorio, que cargan el mismo fichero .onnx.
 */
export interface Voice {
  id: string;
  label: string;
  accent: string;
}

export const VOICES = [
  { id: "es_ES-davefx-medium", label: "Dave", accent: "España" },
  { id: "es_ES-sharvard-medium", label: "Sharvard", accent: "España" },
  { id: "es_MX-claude-high", label: "Claude", accent: "México" },
  { id: "en_US-lessac-medium", label: "Lessac", accent: "Inglés EE. UU." },
  { id: "en_GB-alba-medium", label: "Alba", accent: "Inglés RU" },
] as const satisfies readonly Voice[];
// `as const` conserva los literales (el tipo de `id` es "es_ES-davefx-medium" | ...,
// no `string`) y `satisfies` valida la forma contra `Voice` SIN ensanchar el tipo.

/** Unión de ids válidos derivada del array: si añades una voz, el tipo se actualiza solo. */
export type VoiceId = (typeof VOICES)[number]["id"];

export const DEFAULT_VOICE: VoiceId = "es_ES-davefx-medium";
