import { Equalizer } from "@/components/Equalizer";
import type { TtsPlayer } from "../hooks/useTtsPlayer";
import { RATE_RANGE } from "../lib/preferences";
import { LANGUAGE_LABEL, VOICES, type Voice, type VoiceId } from "../lib/voices";

const LANGUAGES = Object.keys(LANGUAGE_LABEL) as Voice["language"][];

interface Props {
  player: TtsPlayer;
  /** Progreso total del libro, de 0 a 1. */
  progress: number;
}

/** Barra de controles: play/pausa, stop, estado, voz, velocidad y progreso del libro. */
export function PlayerBar({ player, progress }: Props) {
  const { status, buffering, toggle, stop, voiceId, setVoiceId, rate, setRate, segments } = player;
  const isPlaying = status === "playing";

  return (
    // `sticky bottom-3`: la barra se queda pegada abajo al hacer scroll, al
    // alcance del pulgar, como en cualquier reproductor.
    <div className="sticky bottom-3 z-20 overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/75 shadow-2xl shadow-violet-950/50 backdrop-blur-xl">
      <div
        role="progressbar"
        aria-label="Progreso del libro"
        aria-valuenow={Math.round(progress * 100)}
        className="h-1 bg-white/5"
      >
        <div
          className="h-full bg-linear-to-r from-violet-500 via-fuchsia-500 to-amber-400 transition-[width] duration-700"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/*
        Dos filas con flex-wrap:
          [▶] [■] [≋] ........ estado
          [voz] [velocidad]            ← `w-full` fuerza la 2ª línea
        Los ajustes van en su propia fila también en escritorio: el lector mide
        como mucho 768px (buena anchura para leer) y en una sola fila no cabían.
      */}
      <div className="flex flex-wrap items-center gap-3 p-3 sm:gap-4">
        <button
          type="button"
          onClick={toggle}
          disabled={segments.length === 0}
          // El texto accesible cambia con el estado: un lector de pantalla
          // anuncia "Pausar" o "Reproducir", no un icono mudo.
          aria-label={isPlaying ? "Pausar" : "Reproducir"}
          className="relative grid size-14 place-items-center rounded-full bg-linear-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/30 transition hover:scale-105 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-400 active:scale-95 disabled:opacity-40"
        >
          {/* Onda que "late" mientras suena: refuerza visualmente el estado. */}
          {isPlaying && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-fuchsia-500/30" />}
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>

        <button
          type="button"
          onClick={stop}
          disabled={status === "stopped"}
          aria-label="Detener"
          className="grid size-10 place-items-center rounded-full text-zinc-300 transition hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <StopIcon />
        </button>

        {buffering ? (
          <span
            aria-hidden
            className="size-5 animate-spin rounded-full border-2 border-white/15 border-t-fuchsia-400"
          />
        ) : (
          <Equalizer active={isPlaying} className="h-6" />
        )}

        <StatusText player={player} />

        <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 sm:gap-x-6">
          <label className="flex min-w-0 items-center gap-2 text-sm">
            <span className="text-zinc-400">Voz</span>
            <select
              value={voiceId}
              // El valor de un <select> llega como string: lo estrechamos a VoiceId,
              // seguro porque las <option> salen del mismo catálogo.
              onChange={(e) => setVoiceId(e.target.value as VoiceId)}
              className="min-w-0 rounded-xl border border-white/10 bg-zinc-900 px-3 py-2"
            >
              {/* <optgroup> agrupa las voces por idioma dentro del desplegable. */}
              {LANGUAGES.map((language) => (
                <optgroup key={language} label={LANGUAGE_LABEL[language]}>
                  {VOICES.filter((v) => v.language === language).map((v) => (
                    <option key={v.id} value={v.id}>
                      {voiceLabel(v)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <span className="text-zinc-400">Velocidad</span>
            <input
              type="range"
              min={RATE_RANGE.min}
              max={RATE_RANGE.max}
              step={RATE_RANGE.step}
              value={rate}
              // `valueAsNumber` evita el `Number(e.target.value)` manual.
              onChange={(e) => setRate(e.target.valueAsNumber)}
              className="w-24 accent-fuchsia-500"
            />
            <output className="w-10 tabular-nums">{rate.toFixed(2)}×</output>
          </label>
        </div>
      </div>
    </div>
  );
}

/** "Sharvard · Mujer", "Amy · Mujer · EE. UU.", "Carlfm · Hombre · calidad baja"... */
function voiceLabel({ name, gender, accent, quality }: Voice): string {
  const parts = [name, gender === "female" ? "Mujer" : "Hombre"];
  if (accent) parts.push(accent);
  if (quality !== "medium") parts.push("calidad baja");
  return parts.join(" · ");
}

function StatusText({ player }: { player: TtsPlayer }) {
  const { error, download, buffering, status, index, segments } = player;

  let message = "Listo para leer";
  if (error) message = `Error: ${error}`;
  else if (download) message = `Descargando voz… ${formatProgress(download.loaded, download.total)}`;
  else if (buffering) message = "Generando audio…";
  else if (status !== "stopped") message = `Frase ${index + 1} de ${segments.length}`;

  return (
    // aria-live: los lectores de pantalla anuncian los cambios de este texto.
    // ml-auto empuja el estado al extremo derecho de la primera fila.
    <p
      aria-live="polite"
      className={`ml-auto text-right text-sm tabular-nums ${error ? "text-red-300" : "text-zinc-400"}`}
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
  <svg viewBox="0 0 24 24" className="relative size-6 translate-x-0.5" fill="currentColor" aria-hidden>
    <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14Z" />
  </svg>
);
const PauseIcon = () => (
  <svg viewBox="0 0 24 24" className="relative size-6" fill="currentColor" aria-hidden>
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </svg>
);
const StopIcon = () => (
  <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);
