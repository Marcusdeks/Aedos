import type { FormEvent, ReactNode } from "react";
import type { Chapter } from "@/features/library/lib/db";

interface Props {
  /** Página actual (base 0). En pantalla se muestra +1: las personas cuentan desde 1. */
  page: number;
  pageCount: number;
  chapters: Chapter[];
  onChange: (page: number) => void;
}

/** Navegación por el libro: anterior/siguiente, ir a una página concreta y saltar a un capítulo. */
export function PageNav({ page, pageCount, chapters, onChange }: Props) {
  // Capítulo actual = el último que empieza en esta página o antes.
  const chapterIndex = chapters.findLastIndex((c) => c.page <= page);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const typed = Number(new FormData(e.currentTarget).get("page"));
    if (Number.isInteger(typed)) onChange(typed - 1);
  };

  return (
    <nav
      aria-label="Páginas del libro"
      className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2 backdrop-blur"
    >
      <NavButton label="Página anterior" disabled={page === 0} onClick={() => onChange(page - 1)}>
        <path d="m15 18-6-6 6-6" />
      </NavButton>

      {/*
        `key={page}`: el input NO está controlado (usa defaultValue). Al cambiar
        de página, la key nueva hace que React lo recree con el valor correcto.
        Así el usuario puede escribir libremente sin que cada tecla mueva la página.
      */}
      <form key={page} onSubmit={handleSubmit} className="flex items-center gap-2 text-sm text-stone-300">
        <label className="flex items-center gap-2">
          Página
          <input
            name="page"
            type="number"
            inputMode="numeric"
            min={1}
            max={pageCount}
            defaultValue={page + 1}
            // Al salir del campo también se aplica (además de con Enter).
            onBlur={(e) => e.currentTarget.form?.requestSubmit()}
            className="focus:border-brand-2 w-16 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-center tabular-nums outline-none"
          />
        </label>
        <span className="tabular-nums">de {pageCount}</span>
      </form>

      <NavButton label="Página siguiente" disabled={page === pageCount - 1} onClick={() => onChange(page + 1)}>
        <path d="m9 18 6-6-6-6" />
      </NavButton>

      {chapters.length > 0 && (
        <select
          value={chapterIndex}
          onChange={(e) => onChange(chapters[Number(e.target.value)].page)}
          aria-label="Capítulo"
          className="w-full min-w-0 rounded-lg border border-white/10 bg-stone-900 px-3 py-2 text-sm sm:ml-auto sm:w-64"
        >
          {/* Antes del primer capítulo (portada, prólogo...) no hay ninguno seleccionado. */}
          {chapterIndex === -1 && <option value={-1}>Capítulos…</option>}
          {chapters.map((chapter, i) => (
            <option key={i} value={i}>
              {chapter.title}
            </option>
          ))}
        </select>
      )}
    </nav>
  );
}

function NavButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-9 place-items-center rounded-full text-stone-300 transition hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {children}
      </svg>
    </button>
  );
}
