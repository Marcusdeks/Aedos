/**
 * Worker de pdf.js.
 *
 * pdf.js separa el trabajo en dos: la API (hilo principal) y el "parser" que
 * descomprime y analiza el PDF, que va en un Worker para no congelar la
 * interfaz con libros grandes. Este fichero solo carga ese parser: al
 * importarse dentro de un Worker, se conecta solo a los mensajes del hilo principal.
 *
 * Lo envolvemos en un fichero propio para crearlo con el mismo patrón que el
 * Worker de voz (`new Worker(new URL(...))`), que el bundler sabe empaquetar.
 */
import "pdfjs-dist/build/pdf.worker.mjs";
