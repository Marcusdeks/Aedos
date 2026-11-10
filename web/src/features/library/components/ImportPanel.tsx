import { useRouter } from "next/navigation";
import { useState, type DragEvent } from "react";
import { importPdf, importText } from "../lib/import";
import { SAMPLE } from "../lib/sample";
import { PasteTextDialog } from "./PasteTextDialog";

/**
 * Estado de la importación como UNIÓN DISCRIMINADA: cada estado lleva solo los
 * datos que tienen sentido en él. Es imposible, por tipos, tener a la vez un
 * error y un progreso, algo que sí podría pasar con tres useState sueltos.
 */
type ImportState =
  { status: "idle" } | { status: "working"; done: number; total: number } | { status: "error"; message: string };

/** Formas de añadir un libro: soltar/elegir un PDF, pegar un texto o probar el ejemplo. */
export function ImportPanel() {
  const router = useRouter();
  const [state, setState] = useState<ImportState>({ status: "idle" });
  const [dragging, setDragging] = useState(false);

  /** Ejecuta una importación y, si va bien, abre el libro. Centraliza estados y errores. */
  const run = async (task: (onProgress: (done: number, total: number) => void) => Promise<string>) => {
    setState({ status: "working", done: 0, total: 0 });
    try {
      const id = await task((done, total) => setState({ status: "working", done, total }));
      router.push(`/libro/${id}`);
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : String(err) });
    }
  };

  const openPdf = (file: File | undefined) => {
    if (!file) return;
    // El `accept` del input no impide soltar (drag & drop) otro tipo de fichero.
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
      setState({ status: "error", message: `«${file.name}» no es un PDF.` });
      return;
    }
    void run((onProgress) => importPdf(file, onProgress));
  };

  // Para que el navegador permita SOLTAR un fichero hay que cancelar el
  // comportamiento por defecto de dragover (que es abrir el fichero en la pestaña).
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    openPdf(e.dataTransfer.files[0]);
  };

  const working = state.status === "working";

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <label
        onDragOver={handleDragOver}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`group relative flex min-h-56 cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-3xl border-2 border-dashed p-8 text-center transition lg:col-span-2 ${
          dragging
            ? "scale-[1.01] border-fuchsia-400 bg-fuchsia-500/10"
            : "border-white/15 bg-white/[0.03] hover:border-violet-400/60 hover:bg-white/[0.06]"
        } ${working ? "pointer-events-none" : ""}`}
      >
        {working ? (
          <ImportProgress done={state.done} total={state.total} />
        ) : (
          <>
            <span className="grid size-14 place-items-center rounded-2xl bg-linear-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-fuchsia-500/30 transition group-hover:-translate-y-1 group-hover:rotate-3">
              <UploadIcon />
            </span>
            <span className="text-lg font-semibold">Arrastra un PDF aquí</span>
            <span className="text-sm text-zinc-400">o haz clic para elegirlo · sin límite de páginas</span>
          </>
        )}
        <input
          type="file"
          accept=".pdf,application/pdf"
          disabled={working}
          // sr-only: invisible pero accesible. Toda la tarjeta es su <label>,
          // así que un clic en cualquier parte abre el selector de ficheros.
          className="sr-only"
          onChange={(e) => {
            openPdf(e.target.files?.[0]);
            e.target.value = ""; // permite volver a elegir el mismo fichero
          }}
        />
      </label>

      <div className="flex flex-col gap-4">
        <PasteTextDialog disabled={working} onSubmit={(text) => void run(() => importText(text))} />
        <button
          type="button"
          disabled={working}
          onClick={() => void run(() => importText(SAMPLE.text, SAMPLE.title))}
          className="flex flex-1 flex-col items-start justify-center gap-1 rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-left transition hover:border-amber-300/40 hover:bg-white/[0.06] disabled:opacity-50"
        >
          <span className="font-semibold">Probar con un ejemplo</span>
          <span className="text-sm text-zinc-400">El comienzo del Quijote, para escucharlo en segundos.</span>
        </button>
      </div>

      {state.status === "error" && (
        <p
          role="alert"
          className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 lg:col-span-3"
        >
          {state.message}
        </p>
      )}
    </div>
  );
}

function ImportProgress({ done, total }: { done: number; total: number }) {
  const percent = total > 0 ? (done / total) * 100 : 0;
  return (
    <div className="flex w-full max-w-sm flex-col gap-3" aria-live="polite">
      <span className="font-semibold">{total > 0 ? "Extrayendo el texto…" : "Preparando…"}</span>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-linear-to-r from-violet-500 via-fuchsia-500 to-amber-400 transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
      {total > 0 && (
        <span className="text-sm text-zinc-400 tabular-nums">
          Página {done} de {total}
        </span>
      )}
    </div>
  );
}

const UploadIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="size-7"
    fill="none"
    stroke="white"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </svg>
);
