import { useEffect, useState } from "react";
import { deleteBook, listBooks, type Book } from "../lib/db";

/**
 * Lista de libros guardados y la acción de borrar.
 * `books === null` significa "cargando" (distinto de "biblioteca vacía", que es `[]`).
 */
export function useLibrary() {
  const [books, setBooks] = useState<Book[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Mismo patrón que en el reproductor: si el componente se desmonta antes de
    // que responda IndexedDB, ignoramos la respuesta.
    let cancelled = false;
    listBooks().then(
      (list) => {
        if (!cancelled) setBooks(list);
      },
      () => {
        if (cancelled) return;
        setBooks([]);
        setError("No se pudo abrir la biblioteca. ¿Estás en modo incógnito?");
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const remove = async (id: string) => {
    await deleteBook(id);
    // Actualizamos la lista en memoria en vez de volver a leer toda la base de datos.
    setBooks((list) => list?.filter((b) => b.id !== id) ?? null);
  };

  return { books, error, remove };
}
