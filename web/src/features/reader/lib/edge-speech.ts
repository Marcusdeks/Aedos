/**
 * Voces de Microsoft Edge a través de la Web Speech API (`speechSynthesis`).
 *
 * Cualquier navegador tiene `speechSynthesis`, pero cada uno ofrece voces
 * distintas: Edge añade las voces "Online (Natural)" de Microsoft, las mismas
 * de su lector en voz alta, y gratis. Brave o Chrome no las tienen.
 *
 * Diferencia clave con el resto de motores: aquí NO recibimos el audio. Le
 * damos el texto al navegador y él lo reproduce (y, en estas voces, lo envía a
 * Microsoft para generarlo). Por eso el reproductor las trata aparte.
 */

/** Mensaje que ve el usuario si elige una de estas voces fuera de Edge. */
const NOT_AVAILABLE = "Esta voz solo existe en el navegador Microsoft Edge. Ábrelo allí o elige otra voz.";

/**
 * La lista de voces llega de forma ASÍNCRONA: la primera llamada a
 * `getVoices()` suele devolver [] y el navegador avisa con "voiceschanged"
 * cuando la tiene. Esperamos ese evento (como mucho 3 s, por si no llega).
 */
function loadVoices(synth: SpeechSynthesis): Promise<SpeechSynthesisVoice[]> {
  const voices = synth.getVoices();
  if (voices.length > 0) return Promise.resolve(voices);
  return new Promise((resolve) => {
    const done = () => resolve(synth.getVoices());
    synth.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, 3000);
  });
}

/** Busca la voz "Microsoft <nombre> Online (Natural) - Spanish (Spain)". */
export async function findEdgeVoice(name: string): Promise<SpeechSynthesisVoice> {
  const synth = globalThis.speechSynthesis;
  const voice =
    synth && (await loadVoices(synth)).find((v) => v.lang === "es-ES" && v.name.startsWith(`Microsoft ${name} Online`));
  if (!voice) throw new Error(NOT_AVAILABLE);
  return voice;
}

/**
 * La frase que está sonando. Guardarla en una variable del módulo no es
 * capricho: Chrome y Edge tienen un fallo conocido por el que, si nadie
 * referencia el `SpeechSynthesisUtterance`, el recolector de basura lo borra y
 * su evento `end` nunca llega (la lectura se quedaría atascada).
 */
let speaking: SpeechSynthesisUtterance | null = null;

interface SpeakOptions {
  rate: number;
  volume: number;
  /** Cuando empieza a sonar de verdad (las voces online tardan un poco en arrancar). */
  onStart: () => void;
}

/**
 * Lee una frase. Devuelve una promesa que se cumple al terminar y una función
 * para cortarla. Cortar no es un error: la promesa se cumple igualmente y
 * quien llama decide qué hacer (normalmente nada, porque ya ha pasado a otra cosa).
 */
export function speak(text: string, voice: SpeechSynthesisVoice, { rate, volume, onStart }: SpeakOptions) {
  const synth = globalThis.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.rate = rate;
  utterance.volume = volume;

  const done = new Promise<void>((resolve, reject) => {
    utterance.onstart = onStart;
    utterance.onend = () => resolve();
    utterance.onerror = ({ error }) =>
      // "interrupted"/"canceled": lo hemos cortado nosotros con `cancel()`.
      error === "interrupted" || error === "canceled"
        ? resolve()
        : reject(new Error(`Edge no pudo leer la frase (${error}).`));
  });

  speaking = utterance;
  synth.cancel(); // vaciar la cola por si quedaba algo de antes
  synth.speak(utterance);

  return {
    done,
    cancel: () => {
      if (speaking === utterance) speaking = null;
      synth.cancel();
    },
  };
}
