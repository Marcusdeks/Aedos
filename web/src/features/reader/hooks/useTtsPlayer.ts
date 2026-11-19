import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { ClipCache } from "../lib/clip-cache";
import { findEdgeVoice, speak } from "../lib/edge-speech";
import type { DownloadProgress, TtsEngine } from "../lib/engine";
import { loadPreferences, savePreferences } from "../lib/preferences";
import { segmentSentences, type Segment } from "../lib/segment";
import { getVoice, type Voice, type VoiceId } from "../lib/voices";

export type PlaybackStatus = "stopped" | "playing" | "paused";

interface Options {
  /** Texto que se está leyendo (en un libro, la página actual). */
  text: string;
  /**
   * Motor de síntesis (inyección de dependencias): la web pasa el de
   * WebAssembly y la app de escritorio pasará el de Go. Lo crea quien usa el
   * hook, UNA vez para toda la app, para que el modelo siga cargado entre libros.
   */
  engine: TtsEngine;
  /** Frase por la que empezar (para continuar donde se dejó). Solo se lee al montar. */
  startIndex?: number;
  /**
   * Qué viene después de este texto (en un libro, la página siguiente).
   * Al acabar la última frase se llama a `go()` y se sigue leyendo sin parar;
   * `text` se usa para precargar su primera frase y que no haya silencio.
   */
  next?: { text: string; go: () => void };
}

/**
 * Cuántas frases se preparan por adelantado mientras suena la actual.
 * Con UNA sola, si a una frase corta le sigue una larga no da tiempo a
 * generarla y hay silencio (medido: hasta 16 s con Piper en un portátil de 2
 * núcleos). Con varias, el motor no para nunca y esas diferencias se compensan.
 * Más no ayuda: solo gasta memoria y trabajo que se tira si el usuario salta.
 */
const PREFETCH_AHEAD = 3;

/** Clave de un audio en la caché: la misma frase con otra voz es otro audio. */
const clipKey = (voice: Voice, segment: Segment) => `${voice.id}|${segment.text}`;

/**
 * Reproductor de texto a voz, frase a frase.
 *
 * Flujo cuando `status === "playing"`:
 *   1. Pide al motor el audio de la frase actual (o lo saca de la caché).
 *   2. Lo carga en el <audio> y anota su clave en `loadedKey`.
 *   3. Mientras suena, prepara las siguientes (Efecto 4) → sin silencios entre frases.
 *   4. Al terminar (`onEnded`) avanza a la siguiente frase (o página) y vuelve al paso 1.
 */
export function useTtsPlayer({ text, engine, startIndex = 0, next }: Options) {
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
  // Ideales para objetos "del mundo exterior" (elementos DOM, cachés).
  const audioRef = useRef<HTMLAudioElement>(null);
  const cacheRef = useRef<ClipCache>(null);
  /** Frases que se están generando, con lo necesario para cancelarlas (ver Efecto 4). */
  const inFlightRef = useRef(new Map<string, AbortController>());

  // useMemo: re-segmentar solo cuando cambia el texto, no en cada render
  // (por ejemplo, con cada evento de progreso de descarga).
  const segments = useMemo(() => segmentSentences(text), [text]);
  const nextText = next?.text;
  const nextSegments = useMemo(() => (nextText === undefined ? [] : segmentSentences(nextText)), [nextText]);

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
  // Las frases que vienen detrás, aunque sean ya de la página siguiente.
  // useMemo: así la lista solo cambia cuando cambian de verdad (dependencia del Efecto 4).
  const upcoming = useMemo(
    () => [...segments.slice(index + 1), ...nextSegments].slice(0, PREFETCH_AHEAD),
    [segments, index, nextSegments],
  );
  const isCurrentLoaded = current !== undefined && loadedKey === clipKey(voice, current);
  const buffering = status === "playing" && !isCurrentLoaded;

  // ── Efecto 1: ciclo de vida (caché de audios y parada al salir) ────────────
  // Se crea al montar y se vacía al desmontar (la función de limpieza), que
  // libera la memoria de los audios. En desarrollo, React StrictMode
  // monta→desmonta→monta a propósito para detectar limpiezas mal hechas.
  //
  // OJO: con Cache Components, Next no desmonta la página al salir de ella: la
  // OCULTA (con <Activity>) y conserva su estado. Un <audio> oculto sigue
  // sonando, así que al ocultarse (o desmontarse) hay que callarlo y pausar.
  useEffect(() => {
    const cache = new ClipCache();
    const audio = audioRef.current;
    cacheRef.current = cache;
    const inFlight = inFlightRef.current;
    return () => {
      audio?.pause();
      inFlight.forEach((controller) => controller.abort()); // nadie va a oír esas frases
      setStatus((s) => (s === "playing" ? "paused" : s));
      setLoadedKey(null); // sus audios se liberan aquí abajo: habrá que volver a cargarlos
      cache.clear();
    };
  }, []);

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

  // ── Efecto 3: recordar voz, velocidad y volumen para la próxima visita ─────
  useEffect(() => savePreferences(prefs), [prefs]);

  // Un error al reproducir para la lectura y se muestra. `useEffectEvent`:
  // función estable que pueden usar los efectos sin ser una dependencia más.
  const fail = useEffectEvent((err: unknown) => {
    // AbortError = "play() interrumpido por pause()": es normal si el usuario
    // pausa muy rápido. No es un error real.
    if (err instanceof DOMException && err.name === "AbortError") return;
    setError(err instanceof Error ? err.message : String(err));
    setStatus("stopped");
  });

  /**
   * El audio de una frase: de la caché o, si no está, pidiéndoselo al motor.
   * Cada petición nueva guarda su AbortController para poder cancelarla. Es un
   * `useEffectEvent` porque solo lo usan los efectos y así no es una dependencia más.
   */
  const load = useEffectEvent((segment: Segment) => {
    // Nunca ocurre (los efectos no lo llaman con voces de Edge, ver Efecto 6),
    // pero así TypeScript sabe que aquí la voz siempre genera audio.
    if (voice.engine === "edge") return Promise.reject(new Error("Las voces de Edge no generan audio"));
    const key = clipKey(voice, segment);
    return cacheRef.current!.get(key, () => {
      const controller = new AbortController();
      const inFlight = inFlightRef.current;
      inFlight.set(key, controller);
      return engine
        .synthesize(segment.text, voice, { onProgress: setDownload, signal: controller.signal })
        .finally(() => {
          if (inFlight.get(key) === controller) inFlight.delete(key);
        });
    });
  });

  // ── Efecto 4: preparar los audios por adelantado ───────────────────────────
  // - En reposo, la frase actual: la primera vez obliga a cargar el modelo
  //   (decenas de segundos), mejor empezar mientras el usuario mira la página
  //   que cuando pulse ▶.
  // - Reproduciendo, la actual y las PREFETCH_AHEAD siguientes, en orden (la
  //   cola del Worker las genera en ese orden). Lo que ya no está en esa lista
  //   (el usuario saltó de frase o cambió de voz) se CANCELA: si no, el motor
  //   seguiría generando frases que nadie va a oír antes de la que hace falta.
  // Los fallos no se tratan aquí: la caché los olvida, y si la frase hace
  // falta, el Efecto 5 volverá a pedirla y mostrará el error.
  useEffect(() => {
    if (!cacheRef.current || !current || voice.engine === "edge") return;
    if (status !== "playing") {
      load(current).then(
        () => setDownload(null),
        () => setDownload(null),
      );
      return;
    }
    const wanted = [current, ...upcoming];
    const keys = new Set(wanted.map((segment) => clipKey(voice, segment)));
    for (const [key, controller] of inFlightRef.current) if (!keys.has(key)) controller.abort();
    for (const segment of wanted) load(segment).catch(() => {});
  }, [status, current, upcoming, voice]);

  // ── Efecto 5: reproducir (voces que generan audio) ─────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current) return; // !current: página sin texto (p. ej. una ilustración)
    // En pausa, o con una voz de Edge (la reproduce el navegador, Efecto 6), el <audio> se calla.
    if (status !== "playing" || voice.engine === "edge") {
      audio.pause();
      return;
    }

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

    return () => {
      cancelled = true;
    };
  }, [status, current, voice, isCurrentLoaded]);

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

  // ── Efecto 6: voces de Edge (las reproduce el navegador, no el <audio>) ────
  // Mismo ciclo que el Efecto 5, pero sin audio que guardar: se le da la frase
  // a `speechSynthesis` y, cuando termina, se pasa a la siguiente. Pausar corta
  // la frase (la limpieza la cancela) y reanudar la empieza de nuevo: la
  // pausa nativa de estas voces no es fiable. Cambiar velocidad o volumen
  // también la reinicia, para aplicarlos al momento.
  const onSpeechEnd = useEffectEvent(handleEnded);
  useEffect(() => {
    if (voice.engine !== "edge" || status !== "playing" || !current) return;

    let cancelled = false;
    let speech: ReturnType<typeof speak> | null = null;
    findEdgeVoice(voice.voiceName)
      .then((edgeVoice) => {
        if (cancelled) return;
        speech = speak(current.text, edgeVoice, {
          rate: prefs.rate,
          volume: prefs.volume,
          // Hasta que suena, el reproductor muestra "Generando audio…".
          onStart: () => setLoadedKey(clipKey(voice, current)),
        });
        return speech.done.then(() => {
          if (!cancelled) onSpeechEnd();
        });
      })
      .catch((err: unknown) => {
        if (!cancelled) fail(err);
      });

    return () => {
      cancelled = true;
      speech?.cancel();
    };
  }, [status, current, voice, prefs.rate, prefs.volume]);

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
