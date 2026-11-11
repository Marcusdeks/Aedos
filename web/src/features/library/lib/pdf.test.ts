import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { describe, expect, it } from "vitest";
import { normalizePageText } from "./pdf";

/** Un trozo de texto como los que da pdf.js (solo nos importan `str` y `hasEOL`). */
const item = (str: string, hasEOL = true) => ({ str, hasEOL }) as TextItem;
const page = (...items: TextItem[]) => normalizePageText({ items });

describe("normalizePageText", () => {
  it("une las líneas cortadas por el ancho de la columna", () => {
    expect(page(item("Era una mañana"), item("tranquila en el pueblo."))).toBe(
      "Era una mañana tranquila en el pueblo.",
    );
  });

  it("une las palabras partidas con guion a final de línea", () => {
    expect(page(item("los te-"), item("jados mojados."))).toBe("los tejados mojados.");
  });

  it("no une un guion seguido de mayúscula (nombres compuestos, rayas de diálogo)", () => {
    expect(page(item("Castilla-"), item("La Mancha."))).toBe("Castilla- La Mancha.");
  });

  it("quita los números de página sueltos", () => {
    expect(page(item("Fin del capítulo."), item("12"), item("Nuevo capítulo."))).toBe(
      "Fin del capítulo.\n\nNuevo capítulo.",
    );
  });

  it("conserva los saltos de párrafo tras un punto", () => {
    expect(page(item("Primer párrafo."), item("Segundo párrafo."))).toBe("Primer párrafo.\nSegundo párrafo.");
  });

  it("ignora los marcadores de estructura que no son texto", () => {
    const marker = { type: "beginMarkedContent" } as unknown as TextItem;
    expect(page(marker, item("Hola."))).toBe("Hola.");
  });
});
