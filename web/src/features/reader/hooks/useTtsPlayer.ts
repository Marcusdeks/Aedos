import { useEffect, useMemo, useRef, useState } from "react";
import { ClipCache } from "../lib/clip-cache";
import type { DownloadProgress, TtsEngine } from "../lib/engine";
import { loadPreferences, savePreferences } from "../lib/preferences";
import { segmentSentences, type Segment } from "../lib/segment";
import { getVoice, type Voice, type VoiceId } from "../lib/voices";

export type PlaybackStatus = "stopped" | "playing" | "paused";

interface Options {
  /** Texto que se está leyendo (en un libro, la página actual). */
  text: string;
  /**
   * Fábrica del motor (inyección de dependencias): la web pasa el de
   * WebAssembly y la app de escritorio pasará el de Go. DEBE tener identidad
   * estable (definida fuera del componente), o se recrearía el motor en cada render.
   */
  createEngine: () => TtsEngine;
  /** Frase por la que empezar (para continuar donde se dejó). Solo se lee al montar. */
  startIndex?: number;
  /**
   * Qué viene después de este texto (en un libro, la página siguiente).
   * Al acabar la última frase se llama a `go()` y se sigue leyendo sin parar;
   * `text` se usa para precargar su primera frase y que no haya silencio.
   */
  next?: { text: string; go: () => void };
}

/** Clave de un audio en la caché: la misma frase con otra voz es otro audio. */
const clipKey = (voice: Voice, segment: Segment) => `${voice.id}|${segment.text}`;

/**
 * Reproductor de texto a voz, frase a frase.
 *
 * Flujo cuando `status === "playing"`:
 *   1. Pide al motor el audio de la frase actual (o lo saca de la caché).
 *   2. Lo carga en el <audio> y anota su clave en `loadedKey`.
 *   3. Mientras suena, precarga la frase siguiente → sin silencios entre frases.
 *   4. Al terminar (`onEnded`) avanza a la siguiente frase (o página) y vuelve al paso 1.
 */
export function useTtsPlayer({ text, createEngine, startIndex = 0, next }: Options) {
  // `useState(loadPreferences)`: pasamos la FUNCIÓN, no su resultado. Así React
  // solo la ejecuta en el primer render (inicialización perezosa), no en cada uno.
  const [prefs, setPrefs] = useState(loadPreferences);
  const [status, setStatus] = useState<PlaybackStatus>("stopped");
  // La posición se guarda "atada" al texto en el que se fijó (ver `index` abajo).
  const [position, setPosition] = useState({ text, index: startIndex });
  /** Clave del audio que hay cargado ahora mismo en el <audio>. */
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
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
  const nextText = next?.text;
  const nextFirst = useMemo(() => (nextText === undefined ? undefined : segmentSentences(nextText)[0]), [nextText]);

  // ── ESTADO DERIVADO ─────────────────────────────────────────────────────────
  // Se calcula en cada render en vez de guardarse en un useState: guardarlo
  // duplicaría la verdad y podría desincronizarse.
  //
  // `index`: si el texto cambió (otra página), la posición guardada era de otro
  // texto y empezamos por la frase 0. Sin efectos ni renders extra. `Math.min`
  // protege de una posición guardada que ya no existe.
  const index = position.text === text ? Math.min(position.index, Math.max(segments.length - 1, 0)) : 0;
  const voice = getVoice(prefs.voiceId);
  const current = segments.at(index);
  const upcoming = segments.at(index + 1) ?? nextFirst;
  const isCurrentLoaded = current !== undefined && loadedKey === clipKey(voice, current);
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

  // ── Efecto 2: sincronizar velocidad y volumen con el <audio> ───────────────
  // `playbackRate` se reinicia al cambiar de `src`; `defaultPlaybackRate` no.
  // Por eso fijamos ambas. El navegador mantiene el tono (preservesPitch).
  // `volume` sí se conserva entre audios. (En iPhone, Safari lo ignora: allí
  // el volumen solo se controla con los botones físicos.)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.defaultPlaybackRate = prefs.rate;
    audio.playbackRate = prefs.rate;
    audio.volume = prefs.volume;
  }, [prefs.rate, prefs.volume]);

  // ── Efecto 3: recordar voz y velocidad para la próxima visita ──────────────
  useEffect(() => savePreferences(prefs), [prefs]);

  // ── Efecto 4: la máquina de reproducción ───────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    const engine = engineRef.current;
    const cache = cacheRef.current;
    if (!audio || !engine || !cache || !current) return; // !current: página sin texto (p. ej. una ilustración)

    const load = (segment: Segment) =>
      cache.get(clipKey(voice, segment), () => engine.synthesize(segment.text, voice, setDownload));

    if (status !== "playing") {
      audio.pause();
      // PRECARGA EN REPOSO: aunque no se esté reproduciendo, generamos ya la
      // frase actual. La primera vez esto obliga a cargar el modelo (decenas de
      // segundos), así que mejor empezar mientras el usuario mira la página que
      // cuando pulse ▶. Solo la deja en la caché: no toca el <audio>.
      // Si falla, no pasa nada: la caché olvida el fallo y se reintenta al pulsar ▶.
      load(current).then(
        () => setDownload(null),
        () => setDownload(null),
      );
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

    // Se pide otra frase (salto, cambio de página o de voz): callar la anterior
    // ya, no dejarla sonando mientras se genera la nueva. Si venimos de
    // `onEnded`, el audio ya está parado y esto no hace nada.
    audio.pause();

    // `cancelled` evita una RACE CONDITION: si el usuario salta de frase o
    // cambia de voz mientras se sintetiza, la respuesta antigua llega tarde y
    // no debe pisar la nueva. La limpieza del efecto la marca como obsoleta.
    let cancelled = false;
    load(current).then(
      (url) => {
        if (cancelled) return;
        setDownload(null);
        audio.src = url;
        setLoadedKey(clipKey(voice, current)); // re-ejecuta el efecto → rama `isCurrentLoaded` → play()
      },
      (err) => {
        if (!cancelled) fail(err);
      },
    );

    // Precarga: la siguiente frase (o la primera de la página siguiente) se
    // sintetiza mientras suena esta. No hace falta `.catch`: la caché ya
    // gestiona el fallo, y si se usa luego el error saldrá por la llamada de arriba.
    if (upcoming) void load(upcoming);

    return () => {
      cancelled = true;
    };
  }, [status, current, upcoming, voice, isCurrentLoaded]);

  // ── Acciones ───────────────────────────────────────────────────────────────
  const setIndex = (i: number) => setPosition({ text, index: i });

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
    setLoadedKey(null); // la próxima reproducción empieza desde el principio de la frase
  };

  /** Salta a una frase concreta (clic sobre el texto) y la lee. */
  const seek = (i: number) => {
    // Misma frase: no cambia ningún estado, así que reiniciamos el audio a mano.
    if (i === index && audioRef.current) audioRef.current.currentTime = 0;
    setIndex(i);
    setStatus("playing");
  };

  const handleEnded = () => {
    if (index + 1 < segments.length) setIndex(index + 1);
    else if (next) next.go();
    else stop();
  };

  return {
    segments,
    status,
    index,
    buffering,
    download,
    error,
    voiceId: prefs.voiceId,
    setVoiceId: (voiceId: VoiceId) => setPrefs((p) => ({ ...p, voiceId })),
    rate: prefs.rate,
    setRate: (rate: number) => setPrefs((p) => ({ ...p, rate })),
    volume: prefs.volume,
    setVolume: (volume: number) => setPrefs((p) => ({ ...p, volume })),
    toggle,
    stop,
    seek,
    /** Props para el <audio> oculto: `<audio {...player.audioProps} />`. */
    audioProps: { ref: audioRef, onEnded: handleEnded, preload: "auto" as const },
  };
}

/** Tipo del objeto que devuelve el hook, para tipar props de componentes. */
export type TtsPlayer = ReturnType<typeof useTtsPlayer>;
