import { openDB, type DBSchema, type IDBPDatabase } from "idb";

/**
 * Almacenamiento local de la biblioteca con IndexedDB.
 *
 * Por qué IndexedDB y no localStorage:
 *   - localStorage solo guarda strings, es SÍNCRONO (bloquea la interfaz al leer)
 *   y tiene un límite de ~5 MB. Un libro de 500 páginas ya ronda 1-2 MB de texto.
 *   - IndexedDB es asíncrono, guarda objetos y admite cientos de MB.
 *
 * Su API nativa (eventos onsuccess/onerror) es incómoda; la librería `idb`
 * (de Jake Archibald, ~1 KB) la envuelve en promesas y añade tipos.
 */

/** Dónde se quedó el lector. */
export interface Position {
  page: number;
  sentence: number;
}

export interface Chapter {
  title: string;
  /** Página (base 0) donde empieza. */
  page: number;
}

/** Ficha de un libro: lo que necesita la biblioteca para listarlo, SIN el texto. */
export interface Book {
  /** Huella del contenido (SHA-256): el mismo PDF siempre tiene el mismo id. */
  id: string;
  title: string;
  kind: "pdf" | "text";
  pageCount: number;
  chapters: Chapter[];
  position: Position;
  addedAt: number;
  /** Última vez que se leyó: ordena la biblioteca ("seguir leyendo" primero). */
  openedAt: number;
}

/**
 * Esquema tipado: tres "tablas" (object stores).
 * El texto y el fichero van APARTE de la ficha para que listar la biblioteca
 * no cargue en memoria el contenido de todos los libros, solo sus fichas.
 */
interface AedosDB extends DBSchema {
  books: { key: string; value: Book; indexes: { "by-opened": number } };
  /** Texto de cada página. Clave = id del libro. */
  pages: { key: string; value: string[] };
  /** PDF original, para dibujar las miniaturas de sus páginas. Clave = id del libro. */
  files: { key: string; value: Blob };
}

let dbPromise: Promise<IDBPDatabase<AedosDB>> | null = null;

/**
 * Abre la base de datos una sola vez (las demás llamadas reutilizan la promesa).
 * Es perezoso a propósito: IndexedDB solo existe en el navegador, así que no
 * podemos abrirla al importar el módulo (en el servidor no hay `indexedDB`).
 */
function db() {
  dbPromise ??= openDB<AedosDB>("aedos", 2, {
    // `upgrade` se ejecuta al crear la base o al subir la versión: es el sitio
    // de las "MIGRACIONES". `oldVersion` dice de qué versión viene el usuario
    // (0 = no tenía base) y se aplican solo los pasos que le faltan, en orden.
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        database.createObjectStore("books", { keyPath: "id" }).createIndex("by-opened", "openedAt");
        database.createObjectStore("pages");
      }
      // Versión 2: se guarda también el PDF. Los libros importados antes no lo
      // tienen; se completa si el usuario vuelve a subir el mismo PDF.
      if (oldVersion < 2) database.createObjectStore("files");
    },
  });
  return dbPromise;
}

/** Libros ordenados del último leído al más antiguo. */
export async function listBooks(): Promise<Book[]> {
  const books = await (await db()).getAllFromIndex("books", "by-opened");
  return books.reverse(); // el índice ordena ascendente
}

export async function getBook(id: string): Promise<{ book: Book; pages: string[] } | undefined> {
  const database = await db();
  const [book, pages] = await Promise.all([database.get("books", id), database.get("pages", id)]);
  return book && pages ? { book, pages } : undefined;
}

/** ¿Existe ya? Consulta solo la clave, sin cargar el libro (que puede pesar megas). */
export async function hasBook(id: string): Promise<boolean> {
  return (await (await db()).getKey("books", id)) !== undefined;
}

/** El PDF original de un libro (undefined si es un texto pegado o se importó antes de guardarlos). */
export async function getBookFile(id: string): Promise<Blob | undefined> {
  return (await db()).get("files", id);
}

/** Guarda (o sustituye) el PDF original de un libro. */
export async function saveBookFile(id: string, file: Blob): Promise<void> {
  await (await db()).put("files", file, id);
}

/**
 * Guarda ficha, texto y (si lo hay) fichero en UNA transacción: o se guarda
 * todo o nada. Así nunca queda una ficha sin texto si algo falla a medias.
 */
export async function saveBook(book: Book, pages: string[], file?: Blob): Promise<void> {
  const tx = (await db()).transaction(["books", "pages", "files"], "readwrite");
  await Promise.all([
    tx.objectStore("books").put(book),
    tx.objectStore("pages").put(pages, book.id),
    file && tx.objectStore("files").put(file, book.id),
    tx.done,
  ]);
  // Pide al navegador que no borre estos datos si se queda sin espacio
  // (por defecto el almacenamiento es "best effort" y se puede vaciar).
  void navigator.storage?.persist?.();
}

/** Guarda por dónde va el lector. Se llama en cada frase: es una escritura pequeña y rápida. */
export async function savePosition(id: string, position: Position): Promise<void> {
  const tx = (await db()).transaction("books", "readwrite");
  const book = await tx.store.get(id);
  if (book) await tx.store.put({ ...book, position, openedAt: Date.now() });
  await tx.done;
}

export async function deleteBook(id: string): Promise<void> {
  const tx = (await db()).transaction(["books", "pages", "files"], "readwrite");
  await Promise.all([
    tx.objectStore("books").delete(id),
    tx.objectStore("pages").delete(id),
    tx.objectStore("files").delete(id),
    tx.done,
  ]);
}
