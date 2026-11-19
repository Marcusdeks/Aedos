/**
 * Web Worker de síntesis con Piper (voces ligeras).
 *
 * La inferencia de la red neuronal (ONNX) es puro cálculo y tarda cientos de
 * milisegundos por frase. En el hilo principal congelaría la interfaz (botones
 * que no responden, scroll a tirones). En un Worker corre en otro hilo.
 *
 * Antes se usaba la librería @mintplex-labs/piper-tts-web, pero medida en un
 * portátil de 2 núcleos llegaba a tardar 40 s en una frase de 3 s. Hacía dos
 * cosas caras: volvía a crear el fonetizador (18 MB de diccionarios) en CADA
 * frase, y usaba tantos hilos como núcleos lógicos, que en una CPU con
 * HyperThreading es el doble de los reales. Este Worker hace lo mismo con las
 * piezas de base y sin esos dos problemas:
 *   1. TEXTO → FONEMAS: espeak-ng compilado a WebAssembly (piper_phonemize),
 *      creado UNA vez y reutilizado.
 *   2. FONEMAS → AUDIO: el modelo de la voz con ONNX Runtime.
 *   3. AUDIO → WAV: ver wav.ts.
 */
import createPiperPhonemize from "@diffusionstudio/piper-wasm/build/piper_phonemize.js";
import * as ort from "onnxruntime-web/wasm";
import type { DownloadProgress, PiperVoiceModel } from "../lib/engine";
import { cachedFetch } from "./opfs-cache";
import { createQueue, type WorkerMessage, type WorkerResponse } from "./protocol";
import { encodeWav } from "./wav";

/** Voces oficiales de Piper: https://huggingface.co/rhasspy/piper-voices */
const VOICES_URL = "https://huggingface.co/rhasspy/piper-voices/resolve/main";
/** El fonetizador: un programa de ~0,6 MB y sus diccionarios, ~18 MB. */
const ESPEAK_URL = "https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize";

// ONNX Runtime descarga sus .wasm de una CDN: construimos la URL con la versión
// REALMENTE instalada, así el JavaScript y el WebAssembly nunca se desfasan.
ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ort.env.versions.web}/dist/`;
// Hilos = la MITAD de los núcleos lógicos (los reales en una CPU con
// HyperThreading). Medido en un i3 de 2 núcleos/4 lógicos, 5,6 s de audio:
// 1 hilo ~3,7 s; 2 hilos ~3,2 s; 4 hilos de 3,6 a 6,8 s (se estorban entre sí
// y con la propia página).
ort.env.wasm.numThreads = Math.max(1, Math.floor(navigator.hardwareConcurrency / 2));

const reply = (msg: WorkerResponse) => postMessage(msg);
const queue = createQueue(reply);

// ── 1. Fonetizador ───────────────────────────────────────────────────────────

/** Lo que imprime piper_phonemize por cada texto (solo los campos que usamos). */
interface PhonemizeOutput {
  phoneme_ids: number[];
}

let phonemizer: Promise<(text: string) => Promise<number[]>> | null = null;

/**
 * El fonetizador es un PROGRAMA de línea de comandos compilado a WebAssembly
 * (Emscripten): se ejecuta con `callMain(argumentos)` y escribe el resultado
 * (un JSON) por su "salida estándar", que recogemos con `print`.
 * Con `noExitRuntime` el programa no se "cierra" al terminar y se puede volver
 * a ejecutar: crearlo cuesta ~300 ms y reutilizarlo ~70 ms por frase.
 * Sus ficheros se guardan en OPFS como el modelo: también funciona sin conexión.
 */
function getPhonemizer() {
  phonemizer ??= (async () => {
    const [wasm, data] = await Promise.all(
      [".wasm", ".data"].map((ext) => cachedFetch(ESPEAK_URL + ext).then((res) => res.arrayBuffer())),
    );
    // Cada llamada deja aquí su `resolve`: la salida estándar es una sola para todas.
    let onOutput: (line: string) => void = () => {};
    const espeak = await createPiperPhonemize({
      noExitRuntime: true,
      wasmBinary: wasm,
      getPreloadedPackage: () => data,
      print: (line: string) => onOutput(line),
      printErr: () => {}, // avisos de espeak sin importancia
    });
    // Seguro llamarlo varias veces seguidas: la cola procesa una frase cada vez.
    return (text: string) =>
      new Promise<number[]>((resolve) => {
        onOutput = (line) => resolve((JSON.parse(line) as PhonemizeOutput).phoneme_ids);
        espeak.callMain(["-l", "es", "--input", JSON.stringify([{ text }]), "--espeak_data", "/espeak-ng-data"]);
      });
  })();
  phonemizer.catch(() => (phonemizer = null)); // si falla la descarga, se reintenta en la siguiente frase
  return phonemizer;
}

// ── 2. Modelo de la voz ──────────────────────────────────────────────────────

interface PiperConfig {
  audio: { sample_rate: number };
  inference: { noise_scale: number; length_scale: number; noise_w: number };
}

interface LoadedModel {
  session: ort.InferenceSession;
  config: PiperConfig;
}

let loaded: { model: string; promise: Promise<LoadedModel> } | null = null;

/** "es_ES-davefx-medium" → ".../es/es_ES/davefx/medium/es_ES-davefx-medium.onnx" */
function modelUrl(model: string): string {
  const [locale, name, quality] = model.split("-");
  return `${VOICES_URL}/${locale.split("_")[0]}/${locale}/${name}/${quality}/${model}.onnx`;
}

/**
 * Carga el modelo pedido, solo si cambia el MODELO. Las dos voces de
 * "sharvard" (hombre y mujer) comparten modelo: cambiar entre ellas no recarga.
 * Se guarda UN modelo: el anterior se libera para no acumular memoria.
 */
function getModel(model: string, onProgress: (p: DownloadProgress) => void): Promise<LoadedModel> {
  if (loaded?.model === model) return loaded.promise;
  const previous = loaded?.promise;
  const promise = (async () => {
    void previous?.then(
      ({ session }) => session.release(),
      () => {},
    );
    const url = modelUrl(model);
    const [onnx, config] = await Promise.all([
      cachedFetch(url).then((res) => readWithProgress(res, onProgress)),
      cachedFetch(`${url}.json`).then((res) => res.json() as Promise<PiperConfig>),
    ]);
    return { session: await ort.InferenceSession.create(onnx), config };
  })();
  loaded = { model, promise };
  promise.catch(() => {
    if (loaded?.promise === promise) loaded = null; // reintentar en la siguiente frase
  });
  return promise;
}

/** Lee una respuesta entera avisando de cuántos bytes lleva: la barra de "Cargando voz…". */
async function readWithProgress(res: Response, onProgress: (p: DownloadProgress) => void): Promise<Uint8Array> {
  const total = Number(res.headers.get("content-length")) || 0;
  const chunks: Uint8Array[] = [];
  let received = 0;
  // Con `getReader()` y no con `for await`: Safari aún no permite recorrer un stream así.
  const reader = res.body!.getReader();
  for (let part = await reader.read(); !part.done; part = await reader.read()) {
    chunks.push(part.value);
    received += part.value.length;
    onProgress({ loaded: received, total });
  }
  // Unir los trozos en un solo bloque de memoria, que es lo que pide ONNX Runtime.
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

// ── 3. Síntesis ──────────────────────────────────────────────────────────────

async function synthesize(id: number, text: string, voice: PiperVoiceModel): Promise<Blob> {
  const progress = (p: DownloadProgress) => reply({ id, type: "progress", progress: p });
  const [{ session, config }, phonemize] = await Promise.all([getModel(voice.model, progress), getPhonemizer()]);
  const ids = await phonemize(text);

  const { noise_scale, length_scale, noise_w } = config.inference;
  const feeds: Record<string, ort.Tensor> = {
    input: new ort.Tensor("int64", BigInt64Array.from(ids, BigInt), [1, ids.length]),
    input_lengths: new ort.Tensor("int64", BigInt64Array.of(BigInt(ids.length)), [1]),
    scales: new ort.Tensor("float32", Float32Array.of(noise_scale, length_scale, noise_w), [3]),
  };
  // Los modelos con varios hablantes (sharvard) piden además cuál.
  if (session.inputNames.includes("sid"))
    feeds.sid = new ort.Tensor("int64", BigInt64Array.of(BigInt(voice.speaker)), [1]);

  const { output } = await session.run(feeds);
  return encodeWav(output.data as Float32Array, config.audio.sample_rate);
}

onmessage = ({ data }: MessageEvent<WorkerMessage<PiperVoiceModel>>) => {
  if (data.type === "cancel") queue.cancel(data.id);
  else queue.add(data.id, () => synthesize(data.id, data.text, data.voice));
};
