"use client";
// "use client": usa estado, efectos y APIs del navegador (IndexedDB, ficheros).
// En el App Router todo es Server Component por defecto, y esta directiva marca
// la frontera a partir de la cual el código se envía y ejecuta en el cliente.

import { useLibrary } from "../hooks/useLibrary";
import { BookCard } from "./BookCard";
import { ImportPanel } from "./ImportPanel";

/** Portada de la biblioteca: añadir libros y ver los guardados. */
export function Library() {
  const { books, error, remove } = useLibrary();

  return (
    <div className="animate-fade-up flex flex-col gap-12 [animation-delay:150ms]">
      <ImportPanel />

      <section aria-labelledby="library-title" className="flex flex-col gap-5">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="library-title" className="text-2xl font-semibold tracking-tight">
            Tu biblioteca
          </h2>
          {books && books.length > 0 && <span className="text-sm text-zinc-400">{books.length} en total</span>}
        </div>

        {error && <p className="text-sm text-red-300">{error}</p>}

        {books === null ? (
          <SkeletonGrid />
        ) : books.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-zinc-400">
            Aún no tienes libros. Sube un PDF o prueba con el ejemplo para empezar.
          </p>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {books.map((book) => (
              <BookCard key={book.id} book={book} onDelete={(id) => void remove(id)} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Marcadores de posición mientras carga: evitan que la página "salte" al aparecer los libros. */
function SkeletonGrid() {
  return (
    <div aria-hidden className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-64 animate-pulse rounded-3xl bg-white/[0.04]" />
      ))}
    </div>
  );
}
