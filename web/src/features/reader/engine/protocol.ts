import type { DownloadProgress, LocalVoiceModel } from "../lib/engine";

/**
 * Mensajes entre el hilo principal y los Workers de voz.
 *
 * `postMessage` no tiene tipos: acepta cualquier cosa. Definir el contrato en
 * un fichero compartido hace que TypeScript valide ambos lados.
 *
 * Cada petición lleva un `id` para emparejar respuestas: el Worker contesta de
 * forma asíncrona y puede haber varias peticiones en vuelo (la frase actual y
 * las siguientes, que se preparan por adelantado).
 *
 * Es GENÉRICO (`<V>`): cada Worker declara qué tipo de voz recibe. El de Piper
 * usa `WorkerMessage<PiperVoiceModel>` y TypeScript sabe que trae `model` y `speaker`.
 */
export type WorkerMessage<V extends LocalVoiceModel = LocalVoiceModel> =
  | { type: "synthesize"; id: number; text: string; voice: V }
  /** Ya no hace falta (el usuario saltó de frase o cambió de voz): si aún no empezó, no se genera. */
  | { type: "cancel"; id: number };

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
 * `cancel(id)`: si esa petición aún está esperando turno, se salta. Así un
 * salto de frase no tiene que esperar a que se generen las que ya no se van a
 * leer. (La que ya está en marcha no se puede parar: termina y se descarta.)
 *
 * El try/catch va DENTRO de la cola: un error no debe romper las peticiones siguientes.
 */
export function createQueue(reply: (msg: WorkerResponse) => void) {
  let queue = Promise.resolve();
  const cancelled = new Set<number>();
  return {
    add(id: number, task: () => Promise<Blob>) {
      queue = queue.then(async () => {
        if (cancelled.delete(id)) return; // nadie espera ya la respuesta: ni se contesta
        try {
          reply({ id, type: "done", audio: await task() });
        } catch (err) {
          reply({ id, type: "error", message: err instanceof Error ? err.message : String(err) });
        }
      });
    },
    cancel(id: number) {
      cancelled.add(id);
    },
  };
}
