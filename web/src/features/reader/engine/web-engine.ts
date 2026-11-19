import type { ClipVoiceModel, DownloadProgress, TtsEngine } from "../lib/engine";
import { AzureTtsEngine } from "./azure-engine";
import { WasmTtsEngine } from "./wasm-engine";

/**
 * Motor de la versión web: decide QUIÉN genera cada frase según la voz.
 *   - Voces locales (Supertonic, Kokoro, Piper) → modelos en Web Workers.
 *   - Voces de Azure → la nube de Microsoft, con la clave del usuario.
 * (Las de Edge no pasan por aquí: no producen audio que podamos guardar; las
 * reproduce el propio navegador, ver edge-speech.ts.)
 *
 * Es el patrón FACHADA: el reproductor ve un único `TtsEngine` y no sabe que
 * por detrás hay dos implementaciones muy distintas.
 */
export class WebTtsEngine implements TtsEngine {
  readonly #local = new WasmTtsEngine();
  readonly #azure = new AzureTtsEngine();

  synthesize(text: string, voice: ClipVoiceModel, onProgress?: (p: DownloadProgress) => void): Promise<Blob> {
    return voice.engine === "azure"
      ? this.#azure.synthesize(text, voice)
      : this.#local.synthesize(text, voice, onProgress);
  }
}
