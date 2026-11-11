/**
 * Web Worker de síntesis con Supertonic 2 (voces de alta calidad).
 *
 * Supertonic (Supertone, 2026) es un modelo moderno de 66 M de parámetros.
 * Frente a Piper:
 *   - Lee directamente los CARACTERES del texto (no pasa por un fonetizador
 *     como espeak), así que acentúa mejor las palabras con tilde.
 *   - Un solo modelo para todas las voces: cada voz es un "estilo" de ~50 KB
 *     (un vector numérico), así que cambiar de voz es instantáneo.
 *   - Contrapartida: el modelo pesa ~260 MB. Se descarga UNA vez y se
 *     guarda en el navegador (OPFS, ver opfs-cache.ts).
 *
 * Lo ejecutamos con Transformers.js (Hugging Face), que usa ONNX Runtime por debajo.
 */
import { env, pipeline, type ProgressInfo, type TextToAudioPipeline } from "@huggingface/transformers";
import type { SupertonicVoiceModel } from "../lib/engine";
import { cachedFetch, opfsCache } from "./opfs-cache";
import { createQueue, type WorkerRequest, type WorkerResponse } from "./protocol";

// Guardar el modelo en OPFS en vez de en la Cache API (rota en Brave: ver opfs-cache.ts).
env.useBrowserCache = false;
env.useCustomCache = true;
env.customCache = opfsCache;

const MODEL_ID = "onnx-community/Supertonic-TTS-2-ONNX";
const STYLE_URL = (style: string) => `https://huggingface.co/${MODEL_ID}/resolve/main/voices/${style}.bin`;
/**
 * Pasos de "limpieza" del modelo de difusión: más pasos = algo más de calidad
 * pero más lento. 5 es el valor recomendado por el fabricante. Medido: con 8
 * pasos, en CPU, cada frase tardaba el DOBLE de lo que dura → cortes al leer.
 */
const INFERENCE_STEPS = 5;

/**
 * ¿Dónde ejecutar el modelo? WebGPU usa la tarjeta gráfica y es mucho más
 * rápido; si el navegador no lo ofrece, WebAssembly en la CPU.
 * `requestAdapter()` puede devolver null aunque exista `navigator.gpu` (GPU
 * en lista negra, drivers...), por eso no basta con comprobar que existe.
 */
async function pickDevice(): Promise<"webgpu" | "wasm"> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  return (await gpu?.requestAdapter().catch(() => null)) ? "webgpu" : "wasm";
}

const reply = (msg: WorkerResponse) => postMessage(msg);
const enqueue = createQueue(reply);

let tts: Promise<TextToAudioPipeline> | null = null;
/** Estilos ya descargados: cada voz se pide a la red una sola vez. */
const styles = new Map<string, Promise<Float32Array>>();
let activeId = -1;

function getTts(): Promise<TextToAudioPipeline> {
  if (tts) return tts;
  tts = pickDevice().then((device) => {
    console.info(`Supertonic: ejecutando en ${device}`);
    return pipeline("text-to-speech", MODEL_ID, {
      device,
      dtype: "fp32",
      progress_callback: (info: ProgressInfo) => {
        // `progress_total` agrega todos los ficheros del modelo en una sola cifra.
        if (info.status === "progress_total") {
          reply({ id: activeId, type: "progress", progress: { loaded: info.loaded, total: info.total } });
        }
      },
    });
  });
  tts.catch(() => {
    tts = null; // si falla la descarga, el siguiente intento empieza de cero
  });
  return tts;
}

function getStyle(style: string): Promise<Float32Array> {
  let promise = styles.get(style);
  if (!promise) {
    // También en OPFS: así, sin conexión, la voz sigue funcionando.
    promise = cachedFetch(STYLE_URL(style))
      .then((res) => res.arrayBuffer())
      .then((buffer) => new Float32Array(buffer));
    promise.catch(() => styles.delete(style));
    styles.set(style, promise);
  }
  return promise;
}

onmessage = ({ data }: MessageEvent<WorkerRequest<SupertonicVoiceModel>>) => {
  const { id, text, voice } = data;
  enqueue(id, async () => {
    activeId = id;
    const [synthesize, style] = await Promise.all([getTts(), getStyle(voice.style)]);
    // La etiqueta <es> indica el idioma: el mismo modelo habla 5 idiomas.
    const audio = await synthesize(`<es>${text}</es>`, {
      speaker_embeddings: style,
      num_inference_steps: INFERENCE_STEPS,
    });
    return (Array.isArray(audio) ? audio[0] : audio).toBlob();
  });
};
