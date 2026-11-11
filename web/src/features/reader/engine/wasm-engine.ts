import type { DownloadProgress, TtsEngine, VoiceModel } from "../lib/engine";
import type { WorkerRequest, WorkerResponse } from "./protocol";

interface PendingRequest {
  resolve: (audio: Blob) => void;
  reject: (err: Error) => void;
  onProgress?: (p: DownloadProgress) => void;
}

/**
 * Cómo crear el Worker de cada modelo. Esta sintaxis exacta
 * (`new Worker(new URL("./x.ts", import.meta.url))`) es la que reconoce el
 * bundler para compilar cada Worker como un fichero aparte. Por eso no se
 * puede construir la ruta con una variable: tiene que ser un texto literal.
 */
const WORKER_FACTORIES: Record<VoiceModel["engine"], () => Worker> = {
  supertonic: () => new Worker(new URL("./supertonic.worker.ts", import.meta.url), { type: "module" }),
  piper: () => new Worker(new URL("./piper.worker.ts", import.meta.url), { type: "module" }),
};

/**
 * Motor TTS del navegador: modelos neuronales en WebAssembly dentro de Web Workers.
 *
 * - Convierte la comunicación por mensajes del Worker (asíncrona, sin respuesta
 *   directa) en una API de promesas: `await engine.synthesize(...)`. Este patrón
 *   se llama RPC (Remote Procedure Call) sobre mensajes.
 * - Enruta cada petición al Worker de su modelo (Supertonic o Piper) y crea
 *   cada Worker de forma PEREZOSA: si nunca eliges una voz de Piper, nunca se
 *   descarga ni se ejecuta nada de Piper.
 * - Una vez creados, los Workers no se cierran: el modelo queda cargado en
 *   memoria y abrir otro libro no obliga a prepararlo de nuevo (~20 s en un
 *   portátil modesto).
 */
export class WasmTtsEngine implements TtsEngine {
  readonly #workers = new Map<VoiceModel["engine"], Worker>();
  readonly #pending = new Map<number, PendingRequest>();
  #nextId = 0;

  synthesize(text: string, voice: VoiceModel, onProgress?: (p: DownloadProgress) => void): Promise<Blob> {
    // Los ids son únicos entre TODOS los Workers: una sola tabla de pendientes basta.
    const id = this.#nextId++;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject, onProgress });
      this.#worker(voice.engine).postMessage({ id, text, voice } satisfies WorkerRequest);
    });
  }

  #worker(engine: VoiceModel["engine"]): Worker {
    let worker = this.#workers.get(engine);
    if (!worker) {
      worker = WORKER_FACTORIES[engine]();
      worker.onmessage = this.#handleMessage;
      this.#workers.set(engine, worker);
    }
    return worker;
  }

  // Función flecha como campo de clase: `this` queda fijado a la instancia
  // aunque la pasemos como callback (`worker.onmessage = this.#handleMessage`).
  #handleMessage = ({ data }: MessageEvent<WorkerResponse>) => {
    const request = this.#pending.get(data.id);
    if (!request) return;

    switch (data.type) {
      case "progress":
        request.onProgress?.(data.progress);
        break;
      case "done":
        this.#pending.delete(data.id);
        request.resolve(data.audio);
        break;
      case "error":
        this.#pending.delete(data.id);
        request.reject(new Error(data.message));
        break;
    }
  };
}
