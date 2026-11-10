import type { DownloadProgress } from "../lib/engine";

/**
 * Mensajes entre el hilo principal y el Worker.
 *
 * `postMessage` no tiene tipos: acepta cualquier cosa. Definir el contrato en
 * un fichero compartido hace que TypeScript valide ambos lados.
 *
 * Cada petición lleva un `id` para emparejar respuestas: el Worker contesta de
 * forma asíncrona y puede haber varias peticiones en vuelo (frase actual + la
 * siguiente precargada).
 */
export interface WorkerRequest {
  id: number;
  text: string;
  voiceId: string;
}

/**
 * Unión discriminada por `type`: al hacer `switch (msg.type)` TypeScript sabe
 * qué campos existen en cada rama (por ejemplo, `audio` solo en "done").
 */
export type WorkerResponse =
  | { id: number; type: "progress"; progress: DownloadProgress }
  | { id: number; type: "done"; audio: Blob }
  | { id: number; type: "error"; message: string };
