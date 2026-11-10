import type { TtsPlayer } from "../hooks/useTtsPlayer";
import { VOICES, type VoiceId } from "../lib/voices";

const RATE = { min: 0.5, max: 2, step: 0.25 };

/** Barra de controles: play/pausa, stop, voz, velocidad y estado. */
export function PlayerBar({ player }: { player: TtsPlayer }) {
  const { status, toggle, stop, voiceId, setVoiceId, rate, setRate, segments } = player;
  const isPlaying = status === "playing";

  return (
    // MOBILE FIRST: las clases sin prefijo son para móvil; `sm:` (≥640px) ajusta
    // para pantallas mayores. `sticky bottom-3`: la barra se queda pegada abajo
    // al hacer scroll, al alcance del pulgar, como en cualquier reproductor.
    //
    // Distribución con flex-wrap + `order` (un solo árbol de HTML para todos los tamaños):
    //   móvil:      [▶] [■] ........ estado
    //               [voz] [velocidad]            ← `w-full` fuerza la 2ª línea
    //   escritorio: [▶] [■] [voz] [velocidad] .. estado   ← `sm:order-last`
    <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 bg-white/90 p-3 shadow-lg backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
      <button
        type="button"
        onClick={toggle}
        disabled={segments.length === 0}
        // El texto accesible cambia con el estado: un lector de pantalla
        // anuncia "Pausar" o "Reproducir", no un icono mudo.
        aria-label={isPlaying ? "Pausar" : "Reproducir"}
        className="grid size-12 place-items-center rounded-full bg-indigo-600 text-white transition hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-40"
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>

      <button
        type="button"
        onClick={stop}
        disabled={status === "stopped"}
        aria-label="Detener"
        className="grid size-10 place-items-center rounded-full text-zinc-600 transition hover:bg-zinc-100 disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <StopIcon />
      </button>

      <StatusText player={player} />

      <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 sm:w-auto">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-zinc-500">Voz</span>
          <select
            value={voiceId}
            // El valor de un <select> llega como string: lo estrechamos a VoiceId,
            // seguro porque las <option> salen del mismo catálogo.
            onChange={(e) => setVoiceId(e.target.value as VoiceId)}
            className="rounded-lg border border-zinc-300 bg-transparent px-2 py-1.5 dark:border-zinc-700"
          >
            {VOICES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label} · {v.accent}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-zinc-500">Velocidad</span>
          <input
            type="range"
            min={RATE.min}
            max={RATE.max}
            step={RATE.step}
            value={rate}
            // `valueAsNumber` evita el `Number(e.target.value)` manual.
            onChange={(e) => setRate(e.target.valueAsNumber)}
            className="w-28 accent-indigo-600"
          />
          <output className="w-10 tabular-nums">{rate.toFixed(2)}×</output>
        </label>
      </div>
    </div>
  );
}

function StatusText({ player }: { player: TtsPlayer }) {
  const { error, download, buffering, status, index, segments } = player;

  let message = "";
  if (error) message = `Error: ${error}`;
  else if (download) message = `Descargando voz… ${formatProgress(download.loaded, download.total)}`;
  else if (buffering) message = "Generando audio…";
  else if (status !== "stopped") message = `Frase ${index + 1} de ${segments.length}`;

  return (
    // aria-live: los lectores de pantalla anuncian los cambios de este texto.
    // ml-auto empuja el estado a la derecha; en escritorio pasa al final de la fila.
    <p
      aria-live="polite"
      className={`ml-auto text-right text-sm sm:order-last ${error ? "text-red-600" : "text-zinc-500"}`}
    >
      {message}
    </p>
  );
}

function formatProgress(loaded: number, total: number): string {
  const mb = (bytes: number) => (bytes / 1_048_576).toFixed(1);
  return total > 0 ? `${Math.round((loaded / total) * 100)} % de ${mb(total)} MB` : `${mb(loaded)} MB`;
}

// Iconos SVG inline: sin dependencias y heredan el color del texto (currentColor).
// `aria-hidden` porque el botón ya tiene su `aria-label`.
const PlayIcon = () => (
  <svg viewBox="0 0 24 24" className="size-6 translate-x-0.5" fill="currentColor" aria-hidden>
    <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14Z" />
  </svg>
);
const PauseIcon = () => (
  <svg viewBox="0 0 24 24" className="size-6" fill="currentColor" aria-hidden>
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </svg>
);
const StopIcon = () => (
  <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);
