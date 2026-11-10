/**
 * Web Worker de síntesis de voz.
 *
 * La inferencia de la red neuronal (ONNX) es puro cálculo y tarda cientos de
 * milisegundos por frase. En el hilo principal congelaría la interfaz (botones
 * que no responden, scroll a tirones). En un Worker corre en otro hilo.
 *
 * Nota de rendimiento: ONNX Runtime avisa de que usa un solo hilo. El modo
 * multihilo exige aislamiento cross-origin (cabeceras COOP/COEP); se probó y
 * con esta librería la inferencia se queda bloqueada, así que se descartó.
 */
import { INFERENCE_PROGRESS_URL, TtsSession } from "@mintplex-labs/piper-tts-web";
import { env } from "onnxruntime-web/wasm";
import type { WorkerRequest, WorkerResponse } from "./protocol";

// La librería descarga por defecto los .wasm de ONNX Runtime 1.18 desde una CDN,
// pero el JavaScript instalado es otra versión: si no coinciden, la inferencia
// falla. Construimos la URL con la versión REAL instalada, así nunca se desfasan.
const ortVersion = env.versions.web;
if (!ortVersion) throw new Error("No se pudo detectar la versión de onnxruntime-web");

const WASM_PATHS = {
  ...TtsSession.WASM_LOCATIONS,
  onnxWasm: `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ortVersion}/dist/`,
};

/** Respuesta tipada: `postMessage` a secas aceptaría cualquier objeto. */
const reply = (msg: WorkerResponse) => postMessage(msg);

let session: Promise<TtsSession> | null = null;
let sessionModel = "";
/** Petición en curso: a ella se le atribuye el progreso de descarga del modelo. */
let activeId = -1;

/**
 * Devuelve la sesión del modelo pedido, creándola solo si cambia el MODELO.
 * Dos voces del mismo modelo (hablante masculino y femenino de "sharvard")
 * comparten sesión: cambiar entre ellas no vuelve a cargar nada.
 */
function getSession(model: string): Promise<TtsSession> {
  if (session && sessionModel === model) return session;

  // BUG de la librería: `TtsSession` es un singleton y, si ya existe, ignora el
  // nuevo `voiceId` (seguiría sonando la voz anterior). Lo reseteamos para
  // forzar una sesión nueva con el modelo correcto.
  TtsSession._instance = null;
  sessionModel = model;
  session = TtsSession.create({
    voiceId: model,
    wasmPaths: WASM_PATHS,
    progress: ({ url, loaded, total }) => {
      // La librería también reporta el avance de la inferencia; solo nos
      // interesa la descarga del modelo.
      if (url !== INFERENCE_PROGRESS_URL) {
        reply({ id: activeId, type: "progress", progress: { loaded, total } });
      }
    },
  });
  // Si la descarga falla (sin red...), olvidamos la sesión para poder reintentar.
  session.catch(() => {
    session = null;
  });
  return session;
}

/**
 * Cola de ejecución: cada petición espera a que termine la anterior.
 * Encadenar promesas es la forma más simple de serializar trabajo asíncrono
 * sin librerías. Evita, por ejemplo, descargar el mismo modelo dos veces si
 * llegan dos peticiones seguidas.
 */
let queue = Promise.resolve();

onmessage = ({ data }: MessageEvent<WorkerRequest>) => {
  const { id, text, model, speaker } = data;
  queue = queue.then(async () => {
    activeId = id;
    try {
      // `speaker` lo admite gracias a nuestro parche (web/patches/): la versión
      // publicada de la librería tiene el hablante fijado a 0.
      const audio = await (await getSession(model)).predict(text, speaker);
      reply({ id, type: "done", audio });
    } catch (err) {
      // try/catch DENTRO de la cola: un error no debe romper las peticiones siguientes.
      reply({ id, type: "error", message: err instanceof Error ? err.message : String(err) });
    }
  });
};
