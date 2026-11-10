import { hasWords } from "@/features/reader/lib/segment";
import { hasBook, saveBook, type Book } from "./db";
import { extractPdf } from "./pdf";

/**
 * Importar = convertir lo que trae el usuario (un PDF o un texto pegado) en un
 * libro de la biblioteca. Devuelven el id del libro para poder abrirlo.
 */

export async function importPdf(file: File, onProgress?: (done: number, total: number) => void): Promise<string> {
  const data = await file.arrayBuffer();
  const id = await contentId(data);
  // Si ya estaba, no lo volvemos a procesar: se abre y conserva su progreso.
  if (await hasBook(id)) return id;

  // OJO: pdf.js "se queda" el ArrayBuffer (lo transfiere a su Worker y deja
  // `data` vacío). Por eso calculamos el id ANTES de extraer.
  const { pages, chapters } = await extractPdf(data, onProgress);
  // Un PDF escaneado son solo imágenes: pdf.js no encuentra ninguna letra.
  if (!pages.some(hasWords)) {
    throw new Error("Este PDF no tiene texto seleccionable (probablemente es un escaneo de imágenes).");
  }

  await saveBook(newBook(id, file.name.replace(/\.pdf$/i, ""), "pdf", pages.length, chapters), pages);
  return id;
}

/** Guarda un texto pegado como un libro de una sola página. */
export async function importText(text: string, title?: string): Promise<string> {
  const clean = text.trim();
  if (!hasWords(clean)) throw new Error("El texto está vacío.");
  const id = await contentId(new TextEncoder().encode(clean));
  if (!(await hasBook(id))) await saveBook(newBook(id, title ?? titleFromText(clean), "text", 1, []), [clean]);
  return id;
}

function newBook(id: string, title: string, kind: Book["kind"], pageCount: number, chapters: Book["chapters"]): Book {
  const now = Date.now();
  return { id, title, kind, pageCount, chapters, position: { page: 0, sentence: 0 }, addedAt: now, openedAt: now };
}

/** Título de un texto pegado: su primera línea, recortada. */
function titleFromText(text: string, max = 60): string {
  const firstLine = text.split("\n", 1)[0].trim();
  return firstLine.length > max ? `${firstLine.slice(0, max).trimEnd()}…` : firstLine;
}

/**
 * Id derivado del CONTENIDO (hash SHA-256), no aleatorio. Ventajas:
 *   - Subir dos veces el mismo PDF no lo duplica, aunque cambie el nombre del fichero.
 *   - Es apto para URLs (solo caracteres hexadecimales).
 * `crypto.subtle` es la criptografía nativa del navegador: rápida y sin librerías.
 */
async function contentId(data: BufferSource): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  // 8 bytes = 16 caracteres hex: de sobra para no tener colisiones en una biblioteca personal.
  return Array.from(digest.subarray(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
}
