import { Equalizer } from "@/components/Equalizer";
import type { TtsPlayer } from "../hooks/useTtsPlayer";
import { RATE_RANGE, VOLUME_RANGE } from "../lib/preferences";
import { ENGINE_LABEL, VOICES, type Voice, type VoiceId } from "../lib/voices";

const ENGINES = Object.keys(ENGINE_LABEL) as Voice["engine"][];

interface Props {
  player: TtsPlayer;
  /** Progreso total del libro, de 0 a 1. */
  progress: number;
}

/** Barra de controles: play/pausa, stop, estado, voz, velocidad, volumen y progreso del libro. */
export function PlayerBar({ player, progress }: Props) {
  const { status, buffering, toggle, stop, voiceId, setVoiceId, rate, setRate, volume, setVolume, segments } = player;
  const isPlaying = status === "playing";

  return (
    // `sticky bottom-3`: la barra se queda pegada abajo al hacer scroll, al
    // alcance del pulgar, como en cualquier reproductor.
    <div className="sticky bottom-3 z-20 overflow-hidden rounded-3xl border border-white/10 bg-stone-900/75 shadow-2xl shadow-black/50 backdrop-blur-xl">
      <div
        role="progressbar"
        aria-label="Progreso del libro"
        aria-valuenow={Math.round(progress * 100)}
        className="h-1 bg-white/5"
      >
        <div
          className="from-brand-1 via-brand-2 to-brand-3 h-full bg-linear-to-r transition-[width] duration-700"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/*
        Dos filas con flex-wrap:
          [▶] [■] [≋] ........ estado
          [voz] [velocidad] [volumen]  ← `w-full` fuerza la 2ª línea
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
          className="from-brand-2 to-brand-3 shadow-brand-2/30 focus-visible:outline-brand-2 relative grid size-14 place-items-center rounded-full bg-linear-to-br text-white shadow-lg transition hover:scale-105 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-95 disabled:opacity-40"
        >
          {/* Onda que "late" mientras suena: refuerza visualmente el estado. */}
          {isPlaying && <span aria-hidden className="bg-brand-2/30 absolute inset-0 animate-ping rounded-full" />}
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>

        <button
          type="button"
          onClick={stop}
          disabled={status === "stopped"}
          aria-label="Detener"
          className="grid size-10 place-items-center rounded-full text-stone-300 transition hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <StopIcon />
        </button>

        {buffering ? (
          <span aria-hidden className="border-t-brand-2 size-5 animate-spin rounded-full border-2 border-white/15" />
        ) : (
          <Equalizer active={isPlaying} className="h-6" />
        )}

        <StatusText player={player} />

        <div className="flex w-full flex-wrap items-center gap-x-5 gap-y-2">
          <label className="flex min-w-0 items-center gap-2 text-sm">
            <span className="text-stone-400">Voz</span>
            <select
              value={voiceId}
              // El valor de un <select> llega como string: lo estrechamos a VoiceId,
              // seguro porque las <option> salen del mismo catálogo.
              onChange={(e) => setVoiceId(e.target.value as VoiceId)}
              // Ancho fijo: si no, el <select> mide lo que su opción más larga
              // y empuja velocidad y volumen a otra fila.
              className="w-52 min-w-0 rounded-xl border border-white/10 bg-stone-900 px-3 py-2"
            >
              {/* <optgroup> agrupa las voces por familia (calidad) dentro del desplegable. */}
              {ENGINES.map((engine) => (
                <optgroup key={engine} label={ENGINE_LABEL[engine]}>
                  {VOICES.filter((v) => v.engine === engine).map((v) => (
                    <option key={v.id} value={v.id}>
                      {voiceLabel(v)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <RangeControl
            label="Velocidad"
            range={RATE_RANGE}
            value={rate}
            onChange={setRate}
            format={(v) => `${v.toFixed(2)}×`}
          />
          <RangeControl
            label="Volumen"
            range={VOLUME_RANGE}
            value={volume}
            onChange={setVolume}
            format={(v) => `${Math.round(v * 100)} %`}
          />
        </div>
      </div>
    </div>
  );
}

interface RangeControlProps {
  label: string;
  range: { min: number; max: number; step: number };
  value: number;
  onChange: (value: number) => void;
  /** Cómo mostrar el valor al lado del control ("1.25×", "80 %"...). */
  format: (value: number) => string;
}

/**
 * Control deslizante con etiqueta y valor visible. Velocidad y volumen
 * comparten el mismo marcado: un componente en vez de copiarlo dos veces.
 */
function RangeControl({ label, range, value, onChange, format }: RangeControlProps) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-stone-400">{label}</span>
      <input
        type="range"
        {...range}
        value={value}
        // `valueAsNumber` evita el `Number(e.target.value)` manual.
        onChange={(e) => onChange(e.target.valueAsNumber)}
        className="accent-brand-2 w-20"
      />
      <output className="w-12 tabular-nums">{format(value)}</output>
    </label>
  );
}

/** "Supertonic F1 · Mujer", "Carlfm · Hombre · calidad baja"... */
function voiceLabel({ name, gender, quality }: Voice): string {
  const parts = [name, gender === "female" ? "Mujer" : "Hombre"];
  if (quality === "low") parts.push("calidad baja");
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
      className={`ml-auto text-right text-sm tabular-nums ${error ? "text-red-300" : "text-stone-400"}`}
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
