/**
 * Web Worker de síntesis con Kokoro (82 M de parámetros, licencia Apache 2.0).
 *
 * Kokoro tiene voces en varios idiomas, pero su librería para navegador
 * (kokoro-js) solo admite las inglesas: su fonetizador no trae el español.
 * Así que lo montamos a mano con las mismas piezas que usa ella:
 *   1. TEXTO → FONEMAS: con espeak-ng, el mismo fonetizador que ya usa Piper
 *      (su versión WebAssembly). Pronuncia como en España: "cien" → "θjen".
 *   2. FONEMAS → NÚMEROS: el tokenizador del modelo.
 *   3. NÚMEROS + ESTILO DE VOZ → AUDIO: el modelo, con Transformers.js.
 *
 * Modelo y diccionarios se guardan en OPFS (ver opfs-cache.ts): solo se
 * descargan la primera vez.
 */
import {
  AutoTokenizer,
  env,
  RawAudio,
  StyleTextToSpeech2Model,
  Tensor,
  type PreTrainedTokenizer,
  type ProgressInfo,
} from "@huggingface/transformers";
import { createPiperPhonemize } from "@mintplex-labs/piper-tts-web/phonemize";
import type { KokoroVoiceModel } from "../lib/engine";
import { pickDevice } from "./device";
import { cachedFetch, opfsCache } from "./opfs-cache";
import { createQueue, type WorkerRequest, type WorkerResponse } from "./protocol";

env.useBrowserCache = false;
env.useCustomCache = true;
env.customCache = opfsCache;

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
const VOICE_URL = (voice: string) => `https://huggingface.co/${MODEL_ID}/resolve/main/voices/${voice}.bin`;
/** La misma compilación de espeak-ng que descarga la librería de Piper (`TtsSession.WASM_LOCATIONS`). */
const ESPEAK_URL = "https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize";
const SAMPLE_RATE = 24_000;
/** Cada voz es una tabla de 510 filas × 256 números: una fila por longitud de frase (en fonemas). */
const STYLE_SIZE = 256;
const MAX_STYLE_ROW = 509;

const reply = (msg: WorkerResponse) => postMessage(msg);
const enqueue = createQueue(reply);
let activeId = -1;

// ── 1. Fonetizador ───────────────────────────────────────────────────────────

let espeak: Promise<{ wasm: ArrayBuffer; data: ArrayBuffer }> | null = null;

/** Descarga (una vez) el programa de espeak-ng (~0,6 MB) y sus diccionarios (~18 MB). */
function loadEspeak() {
  espeak ??= Promise.all([cachedFetch(`${ESPEAK_URL}.wasm`), cachedFetch(`${ESPEAK_URL}.data`)])
    .then(([wasm, data]) => Promise.all([wasm.arrayBuffer(), data.arrayBuffer()]))
    .then(([wasm, data]) => ({ wasm, data }));
  espeak.catch(() => (espeak = null));
  return espeak;
}

/**
 * Convierte texto en fonemas IPA: "Hola" → "ˈola".
 *
 * El módulo de Emscripten es un PROGRAMA de línea de comandos compilado a
 * WebAssembly: se ejecuta con `callMain(argumentos)` una vez y escribe el
 * resultado (un JSON) por su "salida estándar", que recogemos con `print`.
 * Por eso se crea uno por frase, como hace la librería de Piper. Le pasamos
 * los ficheros ya descargados para que no vuelva a pedirlos a la red.
 */
async function phonemize(text: string): Promise<string> {
  const { wasm, data } = await loadEspeak();
  return new Promise((resolve, reject) => {
    createPiperPhonemize({
      wasmBinary: wasm,
      // Copia: el módulo se queda con el buffer que recibe y lo usa como su disco.
      getPreloadedPackage: () => data.slice(0),
      print: (line) => resolve((JSON.parse(line) as { phonemes: string[] }).phonemes.join("")),
      printErr: (message) => reject(new Error(message)),
    }).then(
      (module) =>
        module.callMain(["-l", "es", "--input", JSON.stringify([{ text }]), "--espeak_data", "/espeak-ng-data"]),
      reject,
    );
  });
}

// ── 2 y 3. Modelo ────────────────────────────────────────────────────────────

let kokoro: Promise<{ model: StyleTextToSpeech2Model; tokenizer: PreTrainedTokenizer }> | null = null;

function getKokoro() {
  kokoro ??= pickDevice().then(async (device) => {
    console.info(`Kokoro: ejecutando en ${device}`);
    const [model, tokenizer] = await Promise.all([
      StyleTextToSpeech2Model.from_pretrained(MODEL_ID, {
        device,
        // Lo que recomienda kokoro-js: en la tarjeta gráfica, la versión
        // completa (~330 MB); en la CPU, la reducida "q8" (números de 8 bits,
        // ~90 MB), que pesa menos y va más rápida.
        dtype: device === "webgpu" ? "fp32" : "q8",
        progress_callback: (info: ProgressInfo) => {
          if (info.status === "progress_total") {
            reply({ id: activeId, type: "progress", progress: { loaded: info.loaded, total: info.total } });
          }
        },
      }),
      AutoTokenizer.from_pretrained(MODEL_ID),
    ]);
    return { model, tokenizer };
  });
  kokoro.catch(() => (kokoro = null)); // si falla la descarga, el siguiente intento empieza de cero
  return kokoro;
}

const styles = new Map<string, Promise<Float32Array>>();

function getStyle(voice: string): Promise<Float32Array> {
  let promise = styles.get(voice);
  if (!promise) {
    promise = cachedFetch(VOICE_URL(voice))
      .then((res) => res.arrayBuffer())
      .then((buffer) => new Float32Array(buffer));
    promise.catch(() => styles.delete(voice));
    styles.set(voice, promise);
  }
  return promise;
}

onmessage = ({ data }: MessageEvent<WorkerRequest<KokoroVoiceModel>>) => {
  const { id, text, voice } = data;
  enqueue(id, async () => {
    activeId = id;
    const [{ model, tokenizer }, style, phonemes] = await Promise.all([
      getKokoro(),
      getStyle(voice.voice),
      phonemize(text),
    ]);
    const { input_ids } = tokenizer(phonemes, { truncation: true });
    // El estilo depende de la longitud: se usa la fila nº (fonemas - 2), sin
    // contar los dos tokens que marcan el principio y el final.
    const tokens = input_ids.dims[1]; // forma [1, nº de tokens]
    const row = Math.min(Math.max(tokens - 2, 0), MAX_STYLE_ROW);
    const { waveform } = await model({
      input_ids,
      style: new Tensor("float32", style.slice(row * STYLE_SIZE, (row + 1) * STYLE_SIZE), [1, STYLE_SIZE]),
      // La velocidad se cambia al reproducir (playbackRate), no aquí: así un
      // mismo audio sirve para cualquier velocidad.
      speed: new Tensor("float32", [1], [1]),
    });
    return new RawAudio(waveform.data, SAMPLE_RATE).toBlob();
  });
};
