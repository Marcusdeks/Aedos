import { DEFAULT_VOICE, isVoiceId, type VoiceId } from "./voices";

/** Preferencias del oyente que se recuerdan entre visitas. */
export interface Preferences {
  voiceId: VoiceId;
  rate: number;
}

export const RATE_RANGE = { min: 0.5, max: 2, step: 0.25 } as const;

const STORAGE_KEY = "aedos:preferences";

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
  const { rate } = saved;
  return {
    voiceId: isVoiceId(saved.voiceId) ? saved.voiceId : DEFAULT_VOICE,
    rate: typeof rate === "number" && rate >= RATE_RANGE.min && rate <= RATE_RANGE.max ? rate : 1,
  };
}

export function savePreferences(prefs: Preferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Sin espacio o bloqueado: no es crítico, la app sigue funcionando.
  }
}
