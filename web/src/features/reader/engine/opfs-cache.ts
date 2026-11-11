/**
 * Caché de ficheros en OPFS (Origin Private File System).
 *
 * POR QUÉ EXISTE: Transformers.js guarda el modelo (262 MB) con la Cache API
 * del navegador. En Brave esa API está rota: cualquier `cache.put()` falla con
 * "Entry already exists", así que el modelo se volvía a descargar EN CADA
 * VISITA (medido: 95-126 s cada vez). OPFS es otro almacenamiento del navegador,
 * un pequeño sistema de ficheros privado de cada web, y en Brave sí funciona
 * (es el mismo que usa la librería de Piper para sus voces).
 *
 * Implementa los dos métodos de la Cache API que pide Transformers.js
 * (`match` y `put`), así que la librería la usa sin saber qué hay debajo.
 */

const DIR_NAME = "aedos-models";

/** `move()` (renombrar) existe en los navegadores con OPFS, pero aún no está en los tipos de TypeScript. */
type MovableFileHandle = FileSystemFileHandle & { move(newName: string): Promise<void> };

let dirPromise: Promise<FileSystemDirectoryHandle> | null = null;

/** Carpeta de la caché dentro de OPFS (se crea la primera vez). */
function dir(): Promise<FileSystemDirectoryHandle> {
  dirPromise ??= navigator.storage.getDirectory().then((root) => root.getDirectoryHandle(DIR_NAME, { create: true }));
  return dirPromise;
}

/**
 * Las claves son URLs ("https://huggingface.co/.../model.onnx"), con barras y
 * dos puntos que no valen en un nombre de fichero: las codificamos.
 */
const fileName = (key: string) => encodeURIComponent(key);

export const opfsCache = {
  /** Devuelve el fichero guardado como un `Response`, o `undefined` si no está. */
  async match(key: string): Promise<Response | undefined> {
    try {
      const file = await (await (await dir()).getFileHandle(fileName(key))).getFile();
      // El tamaño en la cabecera permite a la librería mostrar el progreso.
      return new Response(file, { headers: { "content-length": String(file.size) } });
    } catch {
      return undefined; // NotFoundError: no está en la caché
    }
  },

  /**
   * Guarda una respuesta. Se escribe primero en un fichero temporal y se
   * renombra al final: si se cierra la pestaña a mitad de los 262 MB, no queda
   * un fichero a medias que luego se leería como si fuera el modelo bueno.
   */
  async put(key: string, response: Response): Promise<void> {
    const folder = await dir();
    const name = fileName(key);
    const tmp = await folder.getFileHandle(`${name}.part`, { create: true });
    const writable = await tmp.createWritable();
    // `pipeTo` copia el cuerpo en trozos: no hace falta tenerlo entero en memoria.
    await response.body?.pipeTo(writable);
    if (!response.body) await writable.close();
    await (tmp as MovableFileHandle).move(name);
  },
};

/** `fetch` con caché en OPFS: la primera vez descarga, las siguientes lee del disco. */
export async function cachedFetch(url: string): Promise<Response> {
  const hit = await opfsCache.match(url);
  if (hit) return hit;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar ${url} (HTTP ${res.status})`);
  // `clone()`: un cuerpo solo se puede leer una vez; una copia va a disco y la otra se devuelve.
  // Si no se puede guardar (disco lleno...), no es grave: se usa igual y se descargará otra vez.
  await opfsCache.put(url, res.clone()).catch(() => {});
  return res;
}
