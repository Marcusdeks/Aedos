import Link from "next/link";
import type { Book } from "../lib/db";

interface Props {
  book: Book;
  onDelete: (id: string) => void;
}

/** Tarjeta de un libro: portada generada, título, progreso y botón de borrar. */
export function BookCard({ book, onDelete }: Props) {
  const { id, title, kind, pageCount, position, chapters } = book;
  // Portada GENERADA a partir del id: cada libro tiene su color, siempre el
  // mismo, sin guardar ni descargar imágenes. El id es hexadecimal, así que
  // sus primeros caracteres son un número que convertimos en un tono (0-359).
  const hue = parseInt(id.slice(0, 4), 16) % 360;
  const progress = (position.page + 1) / pageCount;

  return (
    // `relative` + botón `absolute`: el botón de borrar queda encima de la
    // tarjeta pero FUERA del enlace (un botón dentro de un <a> es HTML inválido).
    <li className="group relative">
      <Link
        href={`/libro/${id}`}
        className="flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.07] hover:shadow-2xl hover:shadow-black/60"
      >
        <div
          className="relative flex aspect-[16/9] items-end overflow-hidden p-5"
          style={{ background: `linear-gradient(135deg, hsl(${hue} 85% 62%), hsl(${hue + 60} 75% 38%))` }}
        >
          {/* Inicial gigante recortada: da personalidad a la portada. */}
          <span className="absolute -top-6 right-2 font-serif text-[9rem] leading-none font-bold text-white/20 transition duration-500 group-hover:scale-110">
            {title.charAt(0).toUpperCase()}
          </span>
          <span className="rounded-full bg-black/25 px-2.5 py-1 text-xs font-semibold tracking-wide text-white uppercase backdrop-blur">
            {kind === "pdf" ? "PDF" : "Texto"}
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-3 p-5">
          <h3 className="line-clamp-2 font-semibold">{title}</h3>
          <p className="mt-auto text-sm text-stone-400">
            {kind === "pdf" ? `Página ${position.page + 1} de ${pageCount}` : "Texto pegado"}
            {chapters.length > 0 && ` · ${chapters.length} capítulos`}
          </p>
          {kind === "pdf" && (
            <div
              role="progressbar"
              aria-label="Progreso de lectura"
              aria-valuenow={Math.round(progress * 100)}
              className="h-1.5 overflow-hidden rounded-full bg-white/10"
            >
              <div
                className="from-brand-1 to-brand-2 h-full rounded-full bg-linear-to-r"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          )}
        </div>
      </Link>

      <button
        type="button"
        onClick={() => {
          if (confirm(`¿Eliminar «${title}» de tu biblioteca?`)) onDelete(id);
        }}
        aria-label={`Eliminar ${title}`}
        // En pantallas táctiles no hay "hover": el botón se ve siempre. Con ratón,
        // aparece al pasar por encima de la tarjeta o al llegar con el teclado.
        className="absolute top-3 right-3 grid size-9 place-items-center rounded-full bg-black/30 text-white/80 backdrop-blur transition hover:bg-red-500/80 hover:text-white focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
      >
        <TrashIcon />
      </button>
    </li>
  );
}

const TrashIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="size-4"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    aria-hidden
  >
    <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
  </svg>
);
