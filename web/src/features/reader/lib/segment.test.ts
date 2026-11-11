import { describe, expect, it } from "vitest";
import { hasWords, segmentSentences } from "./segment";

describe("segmentSentences", () => {
  it("divide un texto en frases y limpia los espacios de cada una", () => {
    const texts = segmentSentences("Hola, María. ¿Qué tal estás? ¡Muy bien!").map((s) => s.text);
    expect(texts).toEqual(["Hola, María.", "¿Qué tal estás?", "¡Muy bien!"]);
  });

  it("no pierde ni un carácter: las frases unidas reconstruyen el texto", () => {
    const text = "Era una mañana tranquila.\n\nLos pájaros cantaban… — Nadie lo esperaba. Fin.";
    const segments = segmentSentences(text);
    expect(segments.map((s) => s.raw).join("")).toBe(text);
  });

  it("nunca devuelve una frase sin palabras (no se podría leer en voz alta)", () => {
    const segments = segmentSentences("... Primera frase. — ... Segunda frase. ...");
    expect(segments.length).toBeGreaterThan(0);
    expect(segments.every((s) => hasWords(s.text))).toBe(true);
  });

  it("devuelve una lista vacía si no hay texto", () => {
    expect(segmentSentences("")).toEqual([]);
    expect(segmentSentences("   \n ")).toEqual([]);
  });
});

describe("hasWords", () => {
  it("distingue texto real de símbolos sueltos", () => {
    expect(hasWords("Capítulo 1")).toBe(true);
    expect(hasWords("2024")).toBe(true);
    expect(hasWords("... — ¡!")).toBe(false);
    expect(hasWords("")).toBe(false);
  });
});
