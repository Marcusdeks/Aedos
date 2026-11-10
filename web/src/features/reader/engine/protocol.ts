import type { DownloadProgress, VoiceModel } from "../lib/engine";

/**
 * Mensajes entre el hilo principal y los Workers de voz.
 *
 * `postMessage` no tiene tipos: acepta cualquier cosa. Definir el contrato en
 * un fichero compartido hace que TypeScript valide ambos lados.
 *
 * Cada petición lleva un `id` para emparejar respuestas: el Worker contesta de
 * forma asíncrona y puede haber varias peticiones en vuelo (frase actual + la
 * siguiente precargada).
 *
 * Es GENÉRICO (`<V>`): cada Worker declara qué tipo de voz recibe. El de Piper
 * usa `WorkerRequest<PiperVoiceModel>` y TypeScript sabe que trae `model` y `speaker`.
 */
export interface WorkerRequest<V extends VoiceModel = VoiceModel> {
  id: number;
  text: string;
  voice: V;
}

/**
 * Unión discriminada por `type`: al hacer `switch (msg.type)` TypeScript sabe
 * qué campos existen en cada rama (por ejemplo, `audio` solo en "done").
 */
export type WorkerResponse =
  | { id: number; type: "progress"; progress: DownloadProgress }
  | { id: number; type: "done"; audio: Blob }
  | { id: number; type: "error"; message: string };

/**
 * Cola de ejecución compartida por los Workers: cada petición espera a que
 * termine la anterior. Encadenar promesas es la forma más simple de serializar
 * trabajo asíncrono sin librerías. Evita, por ejemplo, cargar el mismo modelo
 * dos veces si llegan dos peticiones seguidas.
 *
 * El try/catch va DENTRO de la cola: un error no debe romper las peticiones siguientes.
 */
export function createQueue(reply: (msg: WorkerResponse) => void) {
  let queue = Promise.resolve();
  return (id: number, task: () => Promise<Blob>) => {
    queue = queue.then(async () => {
      try {
        reply({ id, type: "done", audio: await task() });
      } catch (err) {
        reply({ id, type: "error", message: err instanceof Error ? err.message : String(err) });
      }
    });
  };
}
