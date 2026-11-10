import { useEffect, useRef, type MouseEvent } from "react";
import type { Segment } from "../lib/segment";

interface Props {
  segments: Segment[];
  current: number;
  onSeek: (index: number) => void;
}

/**
 * Texto en modo lectura: resalta la frase actual, atenúa las ya leídas y
 * permite saltar a cualquier frase con un clic.
 */
export function ReadingView({ segments, current, onSeek }: Props) {
  const activeRef = useRef<HTMLSpanElement>(null);

  // Mantener la frase actual visible. `block: "nearest"` solo hace scroll si
  // la frase se sale de la vista (no da saltos innecesarios).
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [current]);

  // DELEGACIÓN DE EVENTOS: un único listener en el contenedor en vez de uno por
  // frase. Con una página de 300 frases son 300 funciones menos en memoria.
  const handleClick = (e: MouseEvent<HTMLElement>) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-index]");
    if (target) onSeek(Number(target.dataset.index));
  };

  return (
    <article
      onClick={handleClick}
      // whitespace-pre-wrap respeta los saltos de línea y párrafos originales.
      // Sin scroll interno: en móvil, una caja con scroll propio dentro de una
      // página que también hace scroll es muy incómoda. Scrollea la página.
      className="min-h-[50vh] rounded-3xl border border-white/10 bg-stone-900/60 p-5 font-serif text-xl leading-loose whitespace-pre-wrap text-stone-200 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-10"
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
          // box-decoration-clone: si la frase ocupa varias líneas, cada línea
          // lleva su propio fondo redondeado (en vez de un bloque cortado).
          className={`cursor-pointer scroll-my-40 rounded-md box-decoration-clone transition-colors duration-300 ${
            i === current
              ? "from-brand-2/35 to-brand-3/35 bg-linear-to-r text-white"
              : i < current
                ? "text-stone-500 hover:text-stone-300"
                : "hover:bg-white/5 hover:text-white"
          }`}
        >
          {s.raw}
        </span>
      ))}
    </article>
  );
}
