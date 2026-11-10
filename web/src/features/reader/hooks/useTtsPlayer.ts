import { useEffect, useMemo, useRef, useState } from "react";
import { ClipCache } from "../lib/clip-cache";
import type { DownloadProgress, TtsEngine } from "../lib/engine";
import { segmentSentences } from "../lib/segment";
import { DEFAULT_VOICE, type VoiceId } from "../lib/voices";

export type PlaybackStatus = "stopped" | "playing" | "paused";

/**
 * Reproductor de texto a voz, frase a frase.
 *
 * Flujo cuando `status === "playing"`:
 *   1. Pide al motor el audio de la frase `index` (o lo saca de la caché).
 *   2. Lo carga en el <audio> y marca esa frase como `loaded`.
 *   3. Mientras suena, precarga la frase siguiente → sin silencios entre frases.
 *   4. Al terminar (`onEnded`) avanza `index` y vuelve al paso 1.
 *
 * @param createEngine Fábrica del motor (inyección de dependencias): la web
 *   pasa el de WebAssembly y la app de escritorio pasará el de Go. DEBE tener
 *   identidad estable (definida fuera del componente), o se recrearía el motor
 *   en cada render.
 */
export function useTtsPlayer(text: string, createEngine: () => TtsEngine) {
  const [voiceId, setVoiceId] = useState<VoiceId>(DEFAULT_VOICE);
  const [rate, setRate] = useState(1);
  const [status, setStatus] = useState<PlaybackStatus>("stopped");
  const [index, setIndex] = useState(0);
  /** Qué frase (y con qué voz) está cargada ahora mismo en el <audio>. */
  const [loaded, setLoaded] = useState<{ index: number; voiceId: VoiceId } | null>(null);
  const [download, setDownload] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs = valores que persisten entre renders pero NO provocan re-render.
  // Ideales para objetos "del mundo exterior" (elementos DOM, workers, cachés).
  const audioRef = useRef<HTMLAudioElement>(null);
  const engineRef = useRef<TtsEngine>(null);
  const cacheRef = useRef<ClipCache>(null);

  // useMemo: re-segmentar solo cuando cambia el texto, no en cada render
  // (por ejemplo, con cada evento de progreso de descarga).
  const segments = useMemo(() => segmentSentences(text), [text]);

  // ESTADO DERIVADO: no guardamos "buffering" en un useState porque se puede
  // calcular. Guardarlo duplicaría la verdad y podría desincronizarse.
  const isCurrentLoaded = loaded?.index === index && loaded.voiceId === voiceId;
  const buffering = status === "playing" && !isCurrentLoaded;

  // ── Efecto 1: ciclo de vida del motor ──────────────────────────────────────
  // Se crea al montar y se destruye al desmontar (la función de limpieza).
  // En desarrollo, React StrictMode monta→desmonta→monta a propósito para
  // detectar limpiezas mal hechas: con este patrón no queda ningún Worker huérfano.
  useEffect(() => {
    const engine = createEngine();
    const cache = new ClipCache();
    engineRef.current = engine;
    cacheRef.current = cache;
    return () => {
      cache.clear();
      engine.dispose();
    };
  }, [createEngine]);

  // ── Efecto 2: sincronizar la velocidad con el <audio> ──────────────────────
  // `playbackRate` se reinicia al cambiar de `src`; `defaultPlaybackRate` no.
  // Por eso fijamos ambas. El navegador mantiene el tono (preservesPitch).
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.defaultPlaybackRate = rate;
    audio.playbackRate = rate;
  }, [rate]);

  // ── Efecto 3: la máquina de reproducción ───────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    const engine = engineRef.current;
    const cache = cacheRef.current;
    if (!audio || !engine || !cache) return;

    if (status !== "playing") {
      audio.pause();
      return;
    }

    const fail = (err: unknown) => {
      // AbortError = "play() interrumpido por pause()": es normal si el usuario
      // pausa muy rápido. No es un error real.
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : String(err));
      setStatus("stopped");
    };

    // La frase actual ya está cargada (reanudar tras pausa, o recién cargada).
    if (isCurrentLoaded) {
      audio.play().catch(fail);
      return;
    }

    // Se pide otra frase (salto o cambio de voz): callar la anterior ya, no
    // dejarla sonando mientras se genera la nueva. Si venimos de `onEnded`, el
    // audio ya está parado y esto no hace nada.
    audio.pause();

    const loadClip = (i: number) =>
      cache.get(`${voiceId}|${segments[i].text}`, () => engine.synthesize(segments[i].text, voiceId, setDownload));

    // `cancelled` evita una RACE CONDITION: si el usuario salta de frase o
    // cambia de voz mientras se sintetiza, la respuesta antigua llega tarde y
    // no debe pisar la nueva. La limpieza del efecto la marca como obsoleta.
    let cancelled = false;
    loadClip(index).then(
      (url) => {
        if (cancelled) return;
        setDownload(null);
        audio.src = url;
        setLoaded({ index, voiceId }); // re-ejecuta el efecto → rama `isCurrentLoaded` → play()
      },
      (err) => {
        if (!cancelled) fail(err);
      },
    );

    // Precarga: la siguiente frase se sintetiza mientras suena esta.
    // No hace falta `.catch`: la caché ya gestiona el fallo, y si se usa luego
    // el error saldrá por la llamada de arriba.
    if (index + 1 < segments.length) void loadClip(index + 1);

    return () => {
      cancelled = true;
    };
  }, [status, index, voiceId, segments, isCurrentLoaded]);

  // ── Acciones ───────────────────────────────────────────────────────────────
  // Una sola función para play/pausa: el estado anterior decide el siguiente.
  // Usamos la forma `setX(prev => ...)` para no depender de un valor capturado.
  const toggle = () => {
    if (segments.length === 0) return;
    setError(null);
    setStatus((s) => (s === "playing" ? "paused" : "playing"));
  };

  const stop = () => {
    setStatus("stopped");
    setIndex(0);
    setLoaded(null); // la próxima reproducción empieza desde el principio de la frase
  };

  /** Salta a una frase concreta (clic sobre el texto). */
  const seek = (i: number) => {
    // Misma frase: no cambia ningún estado, así que reiniciamos el audio a mano.
    if (i === index && audioRef.current) audioRef.current.currentTime = 0;
    setIndex(i);
    setStatus("playing");
  };

  const handleEnded = () => {
    if (index + 1 < segments.length) setIndex(index + 1);
    else stop();
  };

  return {
    segments,
    status,
    index,
    buffering,
    download,
    error,
    voiceId,
    setVoiceId,
    rate,
    setRate,
    toggle,
    stop,
    seek,
    /** Props para el <audio> oculto: `<audio {...player.audioProps} />`. */
    audioProps: { ref: audioRef, onEnded: handleEnded, preload: "auto" as const },
  };
}

/** Tipo del objeto que devuelve el hook, para tipar props de componentes. */
export type TtsPlayer = ReturnType<typeof useTtsPlayer>;
