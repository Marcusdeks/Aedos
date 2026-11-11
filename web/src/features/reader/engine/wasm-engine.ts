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
 * - Enruta cada petición al Worker de su modelo (Supertonic o Piper) y lo crea
 *   de forma PEREZOSA: si nunca eliges una voz de Piper, nunca se descarga ni
 *   se ejecuta nada de Piper.
 * - Mientras no cambies de motor, el Worker no se cierra: el modelo queda
 *   cargado y abrir otro libro no obliga a prepararlo de nuevo (~20 s en un
 *   portátil modesto).
 */
export class WasmTtsEngine implements TtsEngine {
  /** El Worker activo y su modelo. Solo hay uno a la vez (ver `#worker`). */
  #active: { engine: VoiceModel["engine"]; worker: Worker } | null = null;
  readonly #pending = new Map<number, PendingRequest>();
  #nextId = 0;

  synthesize(text: string, voice: VoiceModel, onProgress?: (p: DownloadProgress) => void): Promise<Blob> {
    // Primero el Worker: si hay que cambiar de modelo, se cancelan las
    // peticiones pendientes del anterior, y esta no debe estar entre ellas.
    const worker = this.#worker(voice.engine);
    const id = this.#nextId++;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject, onProgress });
      worker.postMessage({ id, text, voice } satisfies WorkerRequest);
    });
  }

  /**
   * UN SOLO MODELO EN MEMORIA: al pasar de una voz de Supertonic a una de
   * Piper (o al revés) se cierra el Worker anterior. Tener los dos cargados
   * (~260 MB + ~60 MB, más lo que ocupa ejecutarlos) llegó a tumbar la pestaña
   * en un portátil con 8 GB de RAM. Volver al otro motor obliga a recargarlo
   * (desde el disco, sin descargar), pero es raro: se suele elegir una voz y ya.
   */
  #worker(engine: VoiceModel["engine"]): Worker {
    if (this.#active?.engine !== engine) {
      this.#active?.worker.terminate();
      // Nadie se queda esperando una respuesta de un Worker que ya no existe.
      this.#pending.forEach(({ reject }) => reject(new Error("Se cambió de motor de voz")));
      this.#pending.clear();
      const worker = WORKER_FACTORIES[engine]();
      worker.onmessage = this.#handleMessage;
      this.#active = { engine, worker };
    }
    return this.#active.worker;
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
