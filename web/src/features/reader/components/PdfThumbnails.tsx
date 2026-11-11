import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";
import { getBookFile } from "@/features/library/lib/db";
import { loadPdfjs } from "@/features/library/lib/pdf";

/** Ancho de cada miniatura en píxeles CSS. */
const THUMB_WIDTH = 120;

type DocState =
  | { status: "loading" }
  | { status: "missing" }
  /** `ratio` = alto / ancho de la 1ª página: reserva el hueco de las miniaturas antes de dibujarlas. */
  | { status: "ready"; doc: PDFDocumentProxy; ratio: number };

interface Props {
  bookId: string;
  /** Página actual (base 0): se resalta y se mantiene a la vista. */
  page: number;
  onSelect: (page: number) => void;
}

/**
 * Columna con las páginas del PDF en miniatura: muestra dónde estás y permite
 * saltar a otra página con un clic.
 *
 * Un libro puede tener cientos de páginas, así que no se dibujan todas:
 * cada miniatura se dibuja solo cuando entra en la zona visible del scroll y
 * se borra al salir (VIRTUALIZACIÓN). La memoria usada es la de unas pocas
 * miniaturas, tenga el libro 10 páginas o 1.000.
 */
export function PdfThumbnails({ bookId, page, onSelect }: Props) {
  const state = usePdfDocument(bookId);
  const listRef = useRef<HTMLOListElement>(null);

  // Mantener la página actual centrada en la columna. Se desplaza la LISTA a
  // mano (no `scrollIntoView`), porque `scrollIntoView` también movería la
  // ventana entera y apartaría al usuario del texto que está leyendo.
  useEffect(() => {
    const list = listRef.current;
    const item = list?.children[page];
    if (!list || !(item instanceof HTMLElement)) return;
    list.scrollTo({ top: item.offsetTop - (list.clientHeight - item.offsetHeight) / 2, behavior: "smooth" });
  }, [page, state.status]);

  if (state.status === "missing") {
    return (
      <p className="rounded-2xl border border-dashed border-white/10 p-3 text-xs text-stone-400">
        Vuelve a subir este PDF para ver aquí sus páginas.
      </p>
    );
  }

  return (
    <ol
      ref={listRef}
      aria-label="Páginas del PDF"
      // `relative`: los `offsetTop` de las miniaturas se miden respecto a esta lista.
      className="relative flex h-full [scrollbar-width:thin] flex-col gap-3 overflow-y-auto overscroll-contain p-2"
    >
      {state.status === "ready"
        ? Array.from({ length: state.doc.numPages }, (_, n) => (
            <li key={n}>
              <Thumbnail doc={state.doc} index={n} ratio={state.ratio} active={n === page} onSelect={onSelect} />
            </li>
          ))
        : Array.from({ length: 4 }, (_, n) => (
            <li key={n} aria-hidden className="aspect-[1/1.41] animate-pulse rounded-lg bg-white/[0.06]" />
          ))}
    </ol>
  );
}

/** Abre el PDF guardado del libro y lo cierra al desmontar. */
function usePdfDocument(bookId: string): DocState {
  const [state, setState] = useState<DocState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    let task: PDFDocumentLoadingTask | null = null;

    (async () => {
      const file = await getBookFile(bookId);
      if (!file) {
        if (!cancelled) setState({ status: "missing" });
        return;
      }
      const [pdfjs, data] = await Promise.all([loadPdfjs(), file.arrayBuffer()]);
      if (cancelled) return; // comprobar ANTES de abrir: si no, quedaría un documento sin cerrar
      task = pdfjs.getDocument({ data });
      const doc = await task.promise;
      const { width, height } = (await doc.getPage(1)).getViewport({ scale: 1 });
      if (!cancelled) setState({ status: "ready", doc, ratio: height / width });
    })().catch(() => {
      if (!cancelled) setState({ status: "missing" });
    });

    return () => {
      cancelled = true;
      void task?.destroy(); // libera el documento (y su memoria en el Worker de pdf.js)
    };
  }, [bookId]);

  return state;
}

interface ThumbnailProps {
  doc: PDFDocumentProxy;
  index: number;
  ratio: number;
  active: boolean;
  onSelect: (page: number) => void;
}

function Thumbnail({ doc, index, ratio, active, onSelect }: ThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);

  // IntersectionObserver: el navegador avisa cuando el elemento entra o sale
  // de la zona visible, sin tener que escuchar el scroll y medir a mano.
  // `rootMargin` amplía esa zona 600px arriba y abajo: las miniaturas se
  // dibujan un poco ANTES de aparecer y no se ven en blanco al hacer scroll.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Si el elemento entra y sale muy rápido, llegan VARIOS avisos juntos:
    // el último (`at(-1)`) es el estado actual.
    const observer = new IntersectionObserver((entries) => setVisible(entries.at(-1)!.isIntersecting), {
      root: canvas.closest("ol"),
      rootMargin: "600px 0px",
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // Dibujar la página cuando es visible; borrarla (liberar memoria) al salir.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!visible || !canvas) return;
    let cancelled = false;
    let task: RenderTask | null = null;

    doc
      .getPage(index + 1) // pdf.js numera las páginas desde 1
      .then((pdfPage) => {
        if (cancelled) return;
        // Resolución = ancho en pantalla × densidad de píxeles (nítido en pantallas
        // "retina"), con tope de 2 para no gastar memoria de más.
        const scale = (THUMB_WIDTH * Math.min(devicePixelRatio, 2)) / pdfPage.getViewport({ scale: 1 }).width;
        const viewport = pdfPage.getViewport({ scale });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        task = pdfPage.render({ canvas, viewport });
        return task.promise.finally(() => pdfPage.cleanup());
      })
      // Al cancelar, pdf.js rechaza la promesa a propósito: no es un error.
      .catch(() => {});

    return () => {
      cancelled = true;
      task?.cancel();
      // Un canvas de 0×0 no ocupa memoria: así solo "pesan" las miniaturas visibles.
      canvas.width = 0;
      canvas.height = 0;
    };
  }, [visible, doc, index]);

  return (
    <button
      type="button"
      onClick={() => onSelect(index)}
      aria-label={`Ir a la página ${index + 1}`}
      aria-current={active ? "page" : undefined}
      className="group flex w-full flex-col items-center gap-1"
    >
      <span
        // El hueco se reserva con la proporción de la página aunque el canvas
        // aún no esté dibujado: así la lista no "salta" al hacer scroll.
        style={{ aspectRatio: 1 / ratio }}
        className={`block w-full overflow-hidden rounded-lg bg-white/[0.06] transition ${
          active
            ? "ring-brand-2 ring-2 ring-offset-2 ring-offset-stone-950"
            : "opacity-70 group-hover:opacity-100 group-hover:ring-1 group-hover:ring-white/30"
        }`}
      >
        {/* 0×0 al empezar: un <canvas> sin tamaño mide 300×150 por defecto. */}
        <canvas ref={canvasRef} width={0} height={0} className="size-full object-contain" />
      </span>
      <span className={`text-xs tabular-nums ${active ? "text-brand-1 font-semibold" : "text-stone-500"}`}>
        {index + 1}
      </span>
    </button>
  );
}
