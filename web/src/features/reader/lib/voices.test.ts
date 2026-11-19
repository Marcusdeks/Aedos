import { describe, expect, it } from "vitest";
import { DEFAULT_VOICE, getVoice, isVoiceId, VOICES } from "./voices";

describe("catálogo de voces", () => {
  it("no repite ids", () => {
    const ids = VOICES.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("solo tiene voces de España", () => {
    for (const v of VOICES) {
      // Piper y Azure: el código de idioma va en el nombre del modelo o de la voz.
      if (v.engine === "piper") expect(v.model).toMatch(/^es_ES-/);
      if (v.engine === "azure") expect(v.voiceName).toMatch(/^es-ES-/);
      // Kokoro: "e" = español, "f"/"m" = mujer/hombre.
      if (v.engine === "kokoro") expect(v.voice).toMatch(/^e[fm]_/);
    }
    // Supertonic: solo F5 y M5 suenan peninsulares; el resto está prohibido.
    const styles = VOICES.flatMap((v) => (v.engine === "supertonic" ? [v.style] : []));
    expect(styles.sort()).toEqual(["F5", "M5"]);
    // Ximena: Edge la etiqueta como colombiana.
    expect(VOICES.some((v) => v.name.includes("Ximena"))).toBe(false);
  });

  it("tiene voces de mujer y de hombre en cada motor", () => {
    for (const engine of ["supertonic", "kokoro", "piper", "edge", "azure"] as const) {
      const genders = new Set(VOICES.filter((v) => v.engine === engine).map((v) => v.gender));
      expect(genders).toEqual(new Set(["female", "male"]));
    }
  });

  it("la voz por defecto existe y es local (no envía el texto fuera)", () => {
    const voice = getVoice(DEFAULT_VOICE);
    expect(voice.id).toBe(DEFAULT_VOICE);
    expect(["supertonic", "kokoro", "piper"]).toContain(voice.engine);
  });

  it("isVoiceId reconoce solo voces del catálogo", () => {
    expect(isVoiceId("st-f5")).toBe(true);
    expect(isVoiceId("st-f1")).toBe(false); // retirada
    expect(isVoiceId("es-mls-9972")).toBe(false); // retirada
    expect(isVoiceId(42)).toBe(false);
    expect(isVoiceId(undefined)).toBe(false);
  });
});
