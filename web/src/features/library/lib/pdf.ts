import type { PDFDocumentProxy } from "pdfjs-dist";
import type { TextContent } from "pdfjs-dist/types/src/display/api";
import type { Chapter } from "./db";

export interface ExtractedPdf {
  pages: string[];
  chapters: Chapter[];
}

/**
 * Extrae el texto de un PDF, página a página, y su índice de capítulos.
 *
 * Usa pdf.js (de Mozilla, el visor de PDF de Firefox). Se importa de forma
 * DINÁMICA (`await import`) por dos motivos:
 *   1. Pesa cientos de KB: así solo se descarga cuando alguien sube un PDF,
 *      no en la carga inicial de la página (code splitting).
 *   2. Usa APIs del navegador: importarlo arriba del todo lo ejecutaría también
 *      en el servidor durante el renderizado, donde no existen.
 *
 * ¿Sin límite de páginas? Sí: procesamos una página cada vez y liberamos su
 * memoria (`page.cleanup()`) antes de pasar a la siguiente.
 */
export async function extractPdf(
  data: ArrayBuffer,
  onProgress?: (done: number, total: number) => void,
): Promise<ExtractedPdf> {
  const pdfjs = await import("pdfjs-dist");
  // Un único Worker para toda la sesión: `??=` solo lo crea la primera vez.
  pdfjs.GlobalWorkerOptions.workerPort ??= new Worker(new URL("./pdf.worker.ts", import.meta.url), { type: "module" });

  const loadingTask = pdfjs.getDocument({ data });
  try {
    const pdf = await loadingTask.promise;
    const pages: string[] = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n); // pdf.js numera las páginas desde 1
      pages.push(normalizePageText(await page.getTextContent()));
      page.cleanup();
      onProgress?.(n, pdf.numPages);
    }
    return { pages, chapters: await readChapters(pdf) };
  } finally {
    // `finally`: se libera el documento tanto si todo va bien como si falla
    // (también si el PDF está corrupto y ni siquiera llega a abrirse).
    await loadingTask.destroy();
  }
}

/**
 * Un PDF no guarda "párrafos": guarda trozos de texto colocados en la página.
 * pdf.js nos da esos trozos (`str`) y marca los finales de línea (`hasEOL`).
 * Reconstruimos el texto con reglas sencillas (heurísticas):
 */
function normalizePageText({ items }: TextContent): string {
  let raw = "";
  for (const item of items) {
    // `items` mezcla trozos de texto con marcadores de estructura sin texto.
    if ("str" in item) raw += item.str + (item.hasEOL ? "\n" : "");
  }
  return (
    raw
      // 1. Quitar líneas que solo son un número: casi siempre el nº de página.
      .replace(/^[ \t]*\d+[ \t]*$/gm, "")
      // 2. Unir palabras partidas a final de línea: "pala-\nbra" → "palabra".
      .replace(/(\p{L})-\n(?=\p{Ll})/gu, "$1")
      // 3. Un salto de línea que NO va tras un signo de cierre de frase es solo
      //    el ancho de la columna: lo cambiamos por un espacio. Los que sí van
      //    tras ". ! ? : » ”" se quedan: suelen ser fin de párrafo.
      .replace(/(?<![.!?…:»”"\n])\n(?!\n)/g, " ")
      // 4. Limpiar espacios repetidos y líneas en blanco de más.
      .replace(/[ \t]+/g, " ")
      .replace(/ ?\n ?/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/**
 * Lee el índice (outline) del PDF: los marcadores que ves en el panel lateral
 * de cualquier visor. Solo el primer nivel (capítulos, no subapartados).
 * Muchos PDF no tienen índice: entonces devolvemos una lista vacía.
 */
async function readChapters(pdf: PDFDocumentProxy): Promise<Chapter[]> {
  const outline = (await pdf.getOutline()) ?? [];
  const chapters = await Promise.all(
    outline.map(async ({ title, dest }) => {
      try {
        // El destino puede venir "con nombre" (hay que resolverlo) o explícito.
        // Su primer elemento identifica la página: una referencia interna o un número.
        const explicit = typeof dest === "string" ? await pdf.getDestination(dest) : dest;
        const target = explicit?.[0];
        const name = title.trim();
        if (target == null || name === "") return null;
        const page = typeof target === "number" ? target : await pdf.getPageIndex(target);
        return { title: name, page };
      } catch {
        return null; // destino roto: ignoramos ese capítulo, no todo el índice
      }
    }),
  );
  return chapters.filter((c) => c !== null);
}
