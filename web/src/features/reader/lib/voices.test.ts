import { describe, expect, it } from "vitest";
import { DEFAULT_VOICE, getVoice, isVoiceId, VOICES } from "./voices";

describe("catálogo de voces", () => {
  it("no repite ids", () => {
    const ids = VOICES.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("solo tiene voces de España", () => {
    // Piper: el código de idioma va en el nombre del modelo.
    for (const v of VOICES) if (v.engine === "piper") expect(v.model).toMatch(/^es_ES-/);
    // Supertonic: solo F5 y M5 suenan peninsulares; el resto está prohibido.
    const styles = VOICES.flatMap((v) => (v.engine === "supertonic" ? [v.style] : []));
    expect(styles.sort()).toEqual(["F5", "M5"]);
  });

  it("tiene voces de mujer y de hombre en cada motor", () => {
    for (const engine of ["supertonic", "piper"] as const) {
      const genders = new Set(VOICES.filter((v) => v.engine === engine).map((v) => v.gender));
      expect(genders).toEqual(new Set(["female", "male"]));
    }
  });

  it("la voz por defecto existe", () => {
    expect(getVoice(DEFAULT_VOICE).id).toBe(DEFAULT_VOICE);
  });

  it("isVoiceId reconoce solo voces del catálogo", () => {
    expect(isVoiceId("st-f5")).toBe(true);
    expect(isVoiceId("st-f1")).toBe(false); // retirada
    expect(isVoiceId(42)).toBe(false);
    expect(isVoiceId(undefined)).toBe(false);
  });
});
