/**
 * Una frase del texto.
 * - `raw`:  el trozo original, con sus espacios y saltos de línea, para pintarlo tal cual.
 * - `text`: lo que se envía al motor de voz (sin espacios sobrantes).
 */
export interface Segment {
  raw: string;
  text: string;
}

/** ¿Contiene al menos una letra o un número (en cualquier alfabeto)? */
const HAS_WORDS = /[\p{L}\p{N}]/u;

/** ¿Hay algo que leer? Distingue un texto real de uno vacío o de solo símbolos. */
export const hasWords = (text: string) => HAS_WORDS.test(text);

/**
 * Divide un texto en frases.
 *
 * Usamos `Intl.Segmenter`, nativo del navegador, en lugar de una regex casera
 * tipo /[.!?]/. Sigue el estándar Unicode (UAX #29), así que entiende "¿...?",
 * puntos suspensivos, comillas, etc. sin reinventar la rueda.
 *
 * Por qué por frases: así podemos empezar a sonar en cuanto está lista la
 * primera (en vez de esperar a todo el texto), resaltar la frase actual y
 * saltar a cualquiera con un clic.
 */
export function segmentSentences(text: string, locale = "es"): Segment[] {
  const segmenter = new Intl.Segmenter(locale, { granularity: "sentence" });
  const segments: Segment[] = [];
  // Trozos sin palabras ("...", "—") no se pueden leer: se pegan a la frase
  // anterior, o a la siguiente si aún no hay ninguna.
  let carry = "";

  for (const { segment } of segmenter.segment(text.trim())) {
    if (!HAS_WORDS.test(segment)) {
      const last = segments.at(-1);
      if (last) last.raw += segment;
      else carry += segment;
      continue;
    }
    const raw = carry + segment;
    segments.push({ raw, text: raw.trim() });
    carry = "";
  }
  return segments;
}
