import { DEFAULT_VOICE, isVoiceId, type VoiceId } from "./voices";

/** Preferencias del oyente que se recuerdan entre visitas. */
export interface Preferences {
  voiceId: VoiceId;
  rate: number;
  /** De 0 (silencio) a 1 (volumen máximo del dispositivo). */
  volume: number;
}

export const RATE_RANGE = { min: 0.5, max: 2, step: 0.25 } as const;
export const VOLUME_RANGE = { min: 0, max: 1, step: 0.05 } as const;

const STORAGE_KEY = "aedos:preferences";

/** ¿Es un número dentro del rango? Sirve para validar lo que venga de localStorage. */
const inRange = (value: unknown, { min, max }: { min: number; max: number }): value is number =>
  typeof value === "number" && value >= min && value <= max;

/**
 * Lee las preferencias de localStorage.
 *
 * Nunca confíes en lo que hay guardado: pudo escribirlo una versión antigua de
 * la app (una voz que ya no existe) o el propio usuario desde las DevTools.
 * Validamos cada campo y, si algo no cuadra, usamos el valor por defecto.
 */
export function loadPreferences(): Preferences {
  let saved: Partial<Record<keyof Preferences, unknown>> = {};
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    // JSON corrupto o localStorage bloqueado (modo privado estricto): valores por defecto.
  }
  return {
    voiceId: isVoiceId(saved.voiceId) ? saved.voiceId : DEFAULT_VOICE,
    rate: inRange(saved.rate, RATE_RANGE) ? saved.rate : 1,
    volume: inRange(saved.volume, VOLUME_RANGE) ? saved.volume : 1,
  };
}

export function savePreferences(prefs: Preferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Sin espacio o bloqueado: no es crítico, la app sigue funcionando.
  }
}
