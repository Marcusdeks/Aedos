import { useRef, type FormEvent } from "react";

interface Props {
  disabled: boolean;
  onSubmit: (text: string) => void;
}

/**
 * Botón + ventana modal para pegar un texto.
 *
 * Usamos el elemento nativo <dialog> con `showModal()` en vez de un modal
 * hecho a mano: el navegador ya gestiona el foco, la tecla Escape, el fondo
 * (::backdrop) y bloquea el resto de la página. Accesible "gratis".
 *
 * El <textarea> no está controlado (sin useState): solo necesitamos su valor
 * al enviar, y lo leemos con FormData. Menos renders y menos código.
 */
export function PasteTextDialog({ disabled, onSubmit }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = String(new FormData(e.currentTarget).get("text") ?? "");
    dialogRef.current?.close();
    e.currentTarget.reset();
    onSubmit(text);
  };

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => dialogRef.current?.showModal()}
        className="flex flex-1 flex-col items-start justify-center gap-1 rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-left transition hover:border-cyan-300/40 hover:bg-white/[0.06] disabled:opacity-50"
      >
        <span className="font-semibold">Pegar un texto</span>
        <span className="text-sm text-zinc-400">Un artículo, un correo, apuntes… se guarda en tu biblioteca.</span>
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="paste-title"
        // `m-auto`: el reset de Tailwind quita el margen con el que el navegador centra el <dialog>.
        className="m-auto w-[min(42rem,calc(100%-2rem))] rounded-3xl border border-white/10 bg-zinc-900/95 p-0 text-zinc-100 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
          <h2 id="paste-title" className="text-lg font-semibold">
            Pegar un texto
          </h2>
          <textarea
            name="text"
            required
            autoFocus
            placeholder="Pega aquí el texto que quieres escuchar…"
            className="min-h-64 resize-y rounded-2xl border border-white/10 bg-black/30 p-4 font-serif text-lg leading-relaxed outline-none focus:border-violet-400"
          />
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-full px-5 py-2.5 text-zinc-300 transition hover:bg-white/10"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 py-2.5 font-semibold shadow-lg shadow-fuchsia-500/25 transition hover:brightness-110"
            >
              Escuchar
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
