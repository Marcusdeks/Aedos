import { useRef, useState, type FormEvent } from "react";
import {
  clearAzureCredentials,
  isAzureRemembered,
  loadAzureCredentials,
  parseAzureCredentials,
  saveAzureCredentials,
} from "../lib/azure-credentials";

/**
 * Botón "Configurar Azure" + ventana para poner la clave propia de Azure.
 *
 * Usa el elemento nativo <dialog> con `showModal()`: el navegador ya se
 * encarga de bloquear el resto de la página, cerrar con Escape y devolver el
 * foco al botón al cerrar. Sin librerías ni código de accesibilidad a mano.
 */
export function AzureSettings() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState({ key: "", region: "", remember: false });
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const open = () => {
    // Se rellena al abrir (no al montar): lo guardado pudo cambiar en otra pestaña.
    const saved = loadAzureCredentials();
    setForm({ key: saved?.key ?? "", region: saved?.region ?? "westeurope", remember: isAzureRemembered() });
    setMessage(null);
    dialogRef.current?.showModal();
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseAzureCredentials(form.key, form.region);
    if (typeof parsed === "string") return setMessage({ text: parsed, isError: true });
    saveAzureCredentials(parsed, form.remember);
    dialogRef.current?.close();
  };

  const forget = () => {
    clearAzureCredentials();
    setForm((f) => ({ ...f, key: "" }));
    setMessage({ text: "Clave borrada de este navegador.", isError: false });
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="rounded-xl border border-white/10 px-3 py-2 text-sm text-stone-300 transition hover:bg-white/10 hover:text-white"
      >
        Configurar Azure
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="azure-title"
        className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-3xl border border-white/10 bg-stone-900 p-6 text-stone-200 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <form onSubmit={save} className="flex flex-col gap-4">
          <h2 id="azure-title" className="text-lg font-semibold text-white">
            Tu cuenta de Azure
          </h2>
          <p className="text-sm text-stone-400">
            La clave se queda en este navegador y solo se envía a Microsoft, nunca a Aedos. Usa una clave del plan
            gratuito (F0): si alguien la consiguiera, no podría cobrarte nada.
          </p>

          <label className="flex flex-col gap-1 text-sm">
            Clave
            {/* type="password": no se ve por encima del hombro ni en capturas de pantalla. */}
            <input
              type="password"
              value={form.key}
              onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
              autoComplete="off"
              spellCheck={false}
              required
              className="rounded-xl border border-white/10 bg-stone-950 px-3 py-2 font-mono"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Región
            <input
              value={form.region}
              onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
              placeholder="westeurope"
              autoComplete="off"
              spellCheck={false}
              required
              className="rounded-xl border border-white/10 bg-stone-950 px-3 py-2 font-mono"
            />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.remember}
              onChange={(e) => setForm((f) => ({ ...f, remember: e.target.checked }))}
              className="accent-brand-2"
            />
            Recordar en este navegador (si no, se borra al cerrar la pestaña)
          </label>

          {message && (
            <p role="status" className={`text-sm ${message.isError ? "text-red-300" : "text-stone-400"}`}>
              {message.text}
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={forget}
              className="mr-auto rounded-xl px-3 py-2 text-sm text-red-300 transition hover:bg-red-500/10"
            >
              Borrar clave
            </button>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-xl px-3 py-2 text-sm text-stone-300 transition hover:bg-white/10"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="from-brand-2 to-brand-3 rounded-xl bg-linear-to-br px-4 py-2 text-sm font-medium text-white transition hover:brightness-110"
            >
              Guardar
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
