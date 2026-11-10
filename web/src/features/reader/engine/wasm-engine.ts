import type { DownloadProgress, TtsEngine, VoiceModel } from "../lib/engine";
import type { WorkerRequest, WorkerResponse } from "./protocol";

interface PendingRequest {
  resolve: (audio: Blob) => void;
  reject: (err: Error) => void;
  onProgress?: (p: DownloadProgress) => void;
}

/**
 * Motor TTS del navegador: Piper (WebAssembly) dentro de un Web Worker.
 *
 * Convierte la comunicación por mensajes del Worker (asíncrona, sin respuesta
 * directa) en una API de promesas: `await engine.synthesize(...)`. Este patrón
 * se llama RPC (Remote Procedure Call) sobre mensajes.
 */
export class WasmTtsEngine implements TtsEngine {
  // Esta sintaxis exacta (`new URL(..., import.meta.url)`) es la que reconoce el
  // bundler (Turbopack/webpack) para compilar el Worker como un fichero aparte.
  readonly #worker = new Worker(new URL("./tts.worker.ts", import.meta.url), { type: "module" });
  readonly #pending = new Map<number, PendingRequest>();
  #nextId = 0;

  constructor() {
    this.#worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
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

  synthesize(text: string, { model, speaker }: VoiceModel, onProgress?: (p: DownloadProgress) => void): Promise<Blob> {
    const id = this.#nextId++;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject, onProgress });
      this.#worker.postMessage({ id, text, model, speaker } satisfies WorkerRequest);
    });
  }

  dispose(): void {
    this.#worker.terminate();
    // Nadie se queda esperando una promesa que nunca se resolverá.
    this.#pending.forEach(({ reject }) => reject(new Error("Motor de voz cerrado")));
    this.#pending.clear();
  }
}
