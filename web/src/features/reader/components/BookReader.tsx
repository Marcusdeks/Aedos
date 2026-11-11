"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getBook, type Book } from "@/features/library/lib/db";
import { BookPlayer } from "./BookPlayer";

type LoadState = { status: "loading" } | { status: "missing" } | { status: "ready"; book: Book; pages: string[] };

/**
 * Carga un libro de IndexedDB y, cuando está listo, monta el lector.
 *
 * Separar "cargar" (este componente) de "leer" (BookPlayer) simplifica mucho:
 * BookPlayer recibe el libro YA cargado, así que no tiene que manejar el caso
 * "todavía no hay libro" en cada línea, y puede inicializar su estado (página,
 * frase) directamente con la posición guardada.
 */
export function BookReader({ id }: { id: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getBook(id).then(
      (found) => {
        if (!cancelled) setState(found ? { status: "ready", ...found } : { status: "missing" });
      },
      () => {
        if (!cancelled) setState({ status: "missing" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.status === "loading") return <ReaderSkeleton />;

  if (state.status === "missing") {
    return (
      <div className="mx-auto mt-16 flex max-w-3xl flex-col items-center gap-4 text-center">
        <p className="text-xl font-semibold">Este libro no está en tu biblioteca</p>
        <p className="text-stone-400">
          Los libros se guardan en este navegador. Quizá lo borraste o lo subiste en otro dispositivo.
        </p>
        <Link href="/" className="rounded-full bg-white/10 px-5 py-2.5 transition hover:bg-white/15">
          Volver a la biblioteca
        </Link>
      </div>
    );
  }

  return <BookPlayer book={state.book} pages={state.pages} />;
}

export function ReaderSkeleton() {
  return (
    <div aria-hidden className="mx-auto flex w-full max-w-3xl animate-pulse flex-col gap-4 pt-4">
      <div className="h-8 w-2/3 rounded-xl bg-white/[0.06]" />
      <div className="h-12 rounded-2xl bg-white/[0.04]" />
      <div className="h-[60vh] rounded-3xl bg-white/[0.04]" />
    </div>
  );
}
