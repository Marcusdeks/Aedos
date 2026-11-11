import Link from "next/link";
import { useEffect, useEffectEvent, useState } from "react";
import { savePosition, type Book } from "@/features/library/lib/db";
import { WasmTtsEngine } from "../engine/wasm-engine";
import { useTtsPlayer } from "../hooks/useTtsPlayer";
import { hasWords } from "../lib/segment";
import { PageNav } from "./PageNav";
import { PdfThumbnails } from "./PdfThumbnails";
import { PlayerBar } from "./PlayerBar";
import { ReadingView } from "./ReadingView";

// UN motor para toda la pestaña, fuera del componente: sobrevive al cambiar de
// libro o volver a la biblioteca, así el modelo de voz no se prepara otra vez.
// (Crearlo aquí es barato: los Workers no se crean hasta la primera frase.)
const engine = new WasmTtsEngine();

/** Siguiente página con texto a partir de `from` (las de solo imágenes se saltan). -1 si no queda ninguna. */
const nextReadablePage = (pages: string[], from: number) => pages.findIndex((p, i) => i >= from && hasWords(p));

interface Props {
  book: Book;
  pages: string[];
}

/**
 * El lector de un libro: muestra UNA página cada vez y la lee en voz alta.
 *
 * Por qué una página y no el libro entero: 500 páginas son decenas de miles de
 * frases. Pintarlas todas haría la página lentísima (miles de nodos en el DOM).
 * Paginando, el coste es el mismo para un libro de 5 páginas que de 5.000.
 */
export function BookPlayer({ book, pages }: Props) {
  // Se inicializa con la posición guardada: así "continúa donde lo dejaste".
  const [page, setPage] = useState(book.position.page);
  const nextPage = nextReadablePage(pages, page + 1);

  const player = useTtsPlayer({
    text: pages[page],
    engine,
    startIndex: book.position.sentence,
    // Al terminar la página, pasa sola a la siguiente y sigue leyendo.
    next: nextPage === -1 ? undefined : { text: pages[nextPage], go: () => setPage(nextPage) },
  });

  // Guardar el progreso cada vez que cambia la frase o la página. Es una
  // escritura diminuta en IndexedDB, así que no hace falta agruparlas.
  useEffect(() => {
    void savePosition(book.id, { page, sentence: player.index });
  }, [book.id, page, player.index]);

  const goToPage = (target: number) => {
    setPage(Math.min(Math.max(target, 0), pages.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Atajos de teclado ──────────────────────────────────────────────────────
  // `useEffectEvent` (React 19.2): una función que SIEMPRE ve el estado más
  // reciente (page, player...) pero que no es dependencia del efecto. Así el
  // listener se registra UNA vez, en vez de quitarse y ponerse en cada render.
  const handleKey = useEffectEvent((e: KeyboardEvent) => {
    // Si el foco está en un campo o desplegable, la tecla es suya (las flechas
    // mueven el control de velocidad, cambian de opción...).
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest("input, textarea, select")) return;
    if (e.code === "Space") {
      // En un botón o enlace, Espacio lo pulsa. Las flechas no hacen nada en
      // ellos, así que sí cambian de página (p. ej. tras clicar una miniatura).
      if (target?.closest("button, a")) return;
      e.preventDefault(); // si no, Espacio también hace scroll
      player.toggle();
    } else if (e.key === "ArrowRight") goToPage(page + 1);
    else if (e.key === "ArrowLeft") goToPage(page - 1);
  });

  useEffect(() => {
    const listener = (e: KeyboardEvent) => handleKey(e);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  // Progreso total del libro (0-1): páginas completas + la parte leída de la actual.
  const progress = (page + (player.index + 1) / Math.max(player.segments.length, 1)) / pages.length;

  const isPdf = book.kind === "pdf";

  return (
    // En pantallas grandes, los PDF se muestran en dos columnas: el texto y, a
    // su derecha, las miniaturas de las páginas. El texto mantiene un ancho
    // cómodo de lectura; los textos pegados (sin PDF) van en una sola columna.
    <div
      className={`animate-fade-up mx-auto w-full max-w-3xl ${isPdf ? "lg:grid lg:max-w-5xl lg:grid-cols-[minmax(0,1fr)_9.5rem] lg:gap-8" : ""}`}
    >
      <div className="flex min-w-0 flex-col gap-5">
        <header className="flex flex-col gap-2 pt-2">
          <Link href="/" className="w-fit text-sm text-stone-400 transition hover:text-white">
            ← Biblioteca
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{book.title}</h1>
        </header>

        {pages.length > 1 && (
          <PageNav page={page} pageCount={pages.length} chapters={book.chapters} onChange={goToPage} />
        )}

        {player.segments.length > 0 ? (
          <ReadingView segments={player.segments} current={player.index} onSeek={player.seek} />
        ) : (
          <p className="grid min-h-[40vh] place-items-center rounded-3xl border border-dashed border-white/10 p-8 text-center text-stone-400">
            Esta página no tiene texto (puede ser una imagen o una página en blanco).
          </p>
        )}

        <p className="hidden text-center text-xs text-stone-500 sm:block">
          Atajos: <Kbd>Espacio</Kbd> reproducir o pausar · <Kbd>←</Kbd> <Kbd>→</Kbd> cambiar de página · clic en una
          frase para saltar a ella
        </p>

        {/* Va DESPUÉS del texto: `sticky bottom` la pega al borde inferior mientras se lee. */}
        <PlayerBar player={player} progress={progress} />
      </div>

      {isPdf && (
        // `sticky` + alto de la ventana: la columna se queda fija mientras el
        // texto hace scroll, y tiene su PROPIO scroll para recorrer las páginas.
        // En móvil no cabe al lado del texto: se oculta (la navegación de arriba basta).
        <aside className="sticky top-4 hidden h-[calc(100dvh-2rem)] self-start lg:block">
          <PdfThumbnails bookId={book.id} page={page} onSelect={goToPage} />
        </aside>
      )}

      <audio {...player.audioProps} hidden />
    </div>
  );
}

const Kbd = ({ children }: { children: string }) => (
  <kbd className="rounded-md border border-white/15 bg-white/5 px-1.5 py-0.5 font-sans text-stone-300">{children}</kbd>
);
