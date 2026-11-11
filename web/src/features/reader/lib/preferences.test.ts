import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadPreferences, savePreferences } from "./preferences";
import { DEFAULT_VOICE } from "./voices";

const KEY = "aedos:preferences";

/** localStorage falso en memoria: los tests corren en Node, donde no hay navegador. */
function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe("preferencias", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", fakeStorage());
  });

  it("usa los valores por defecto la primera vez", () => {
    expect(loadPreferences()).toEqual({ voiceId: DEFAULT_VOICE, rate: 1, volume: 1 });
  });

  it("recuerda lo que se guardó", () => {
    savePreferences({ voiceId: "es-davefx", rate: 1.5, volume: 0.4 });
    expect(loadPreferences()).toEqual({ voiceId: "es-davefx", rate: 1.5, volume: 0.4 });
  });

  it("descarta campo a campo lo que no es válido", () => {
    // "st-f1" existió en una versión anterior y se retiró (acento latinoamericano).
    localStorage.setItem(KEY, JSON.stringify({ voiceId: "st-f1", rate: 9, volume: 0.5 }));
    expect(loadPreferences()).toEqual({ voiceId: DEFAULT_VOICE, rate: 1, volume: 0.5 });
  });

  it("no rompe la app si lo guardado está corrupto", () => {
    localStorage.setItem(KEY, "{esto no es JSON");
    expect(loadPreferences()).toEqual({ voiceId: DEFAULT_VOICE, rate: 1, volume: 1 });
  });
});
