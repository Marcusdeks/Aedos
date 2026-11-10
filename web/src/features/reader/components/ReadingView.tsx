import { useEffect, useRef, type MouseEvent } from "react";
import type { Segment } from "../lib/segment";

interface Props {
  segments: Segment[];
  current: number;
  onSeek: (index: number) => void;
}

/** Texto en modo lectura: resalta la frase actual y permite saltar con un clic. */
export function ReadingView({ segments, current, onSeek }: Props) {
  const activeRef = useRef<HTMLSpanElement>(null);

  // Mantener la frase actual visible en textos largos. `block: "nearest"` solo
  // hace scroll si la frase se sale de la vista (no da saltos innecesarios).
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [current]);

  // DELEGACIÓN DE EVENTOS: un único listener en el contenedor en vez de uno por
  // frase. Con un texto de 2.000 frases son 2.000 funciones menos en memoria.
  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-index]");
    if (target) onSeek(Number(target.dataset.index));
  };

  return (
    <div
      onClick={handleClick}
      // whitespace-pre-wrap respeta los saltos de línea y párrafos originales.
      // Sin scroll interno: en móvil, una caja con scroll propio dentro de una
      // página que también hace scroll es muy incómoda. Scrollea la página.
      className="min-h-[60vh] rounded-2xl border border-zinc-200 bg-white p-4 text-lg leading-relaxed whitespace-pre-wrap sm:p-6 dark:border-zinc-800 dark:bg-zinc-900"
    >
      {segments.map((s, i) => (
        <span
          // Usar el índice como `key` está bien AQUÍ porque la lista no se
          // reordena ni se edita mientras se muestra. En listas editables, no.
          key={i}
          data-index={i}
          ref={i === current ? activeRef : undefined}
          aria-current={i === current ? "true" : undefined}
          // scroll-my-40: margen que respeta scrollIntoView, para que la frase
          // no quede escondida detrás de la barra fija de abajo.
          className={`cursor-pointer scroll-my-40 rounded transition-colors ${
            i === current
              ? "bg-amber-200 text-zinc-900 dark:bg-amber-400/30 dark:text-amber-50"
              : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          {s.raw}
        </span>
      ))}
    </div>
  );
}
