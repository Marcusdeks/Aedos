import type { DownloadProgress, LocalVoiceModel, SynthesizeOptions } from "../lib/engine";
import type { WorkerMessage, WorkerResponse } from "./protocol";

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
const WORKER_FACTORIES: Record<LocalVoiceModel["engine"], () => Worker> = {
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
export class WasmTtsEngine {
  /** El Worker activo y su modelo. Solo hay uno a la vez (ver `#worker`). */
  #active: { engine: LocalVoiceModel["engine"]; worker: Worker } | null = null;
  readonly #pending = new Map<number, PendingRequest>();
  #nextId = 0;

  synthesize(text: string, voice: LocalVoiceModel, { onProgress, signal }: SynthesizeOptions = {}): Promise<Blob> {
    // Primero el Worker: si hay que cambiar de modelo, se cancelan las
    // peticiones pendientes del anterior, y esta no debe estar entre ellas.
    const worker = this.#worker(voice.engine);
    const id = this.#nextId++;
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(signal.reason);
      this.#pending.set(id, { resolve, reject, onProgress });
      worker.postMessage({ type: "synthesize", id, text, voice } satisfies WorkerMessage);
      // Cancelar: el Worker se salta la frase si aún no la empezó, y la
      // promesa se rechaza ya (quien la pidió no tiene que esperar).
      signal?.addEventListener(
        "abort",
        () => {
          if (!this.#pending.delete(id)) return; // ya había terminado
          worker.postMessage({ type: "cancel", id } satisfies WorkerMessage);
          reject(signal.reason);
        },
        { once: true },
      );
    });
  }

  /**
   * UN SOLO MODELO EN MEMORIA: al pasar, por ejemplo, de una voz de Supertonic a una de
   * Piper (o al revés) se cierra el Worker anterior. Tener los dos cargados
   * (~260 MB + ~60 MB, más lo que ocupa ejecutarlos) llegó a tumbar la pestaña
   * en un portátil con 8 GB de RAM. Volver al otro motor obliga a recargarlo
   * (desde el disco, sin descargar), pero es raro: se suele elegir una voz y ya.
   */
  #worker(engine: LocalVoiceModel["engine"]): Worker {
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
