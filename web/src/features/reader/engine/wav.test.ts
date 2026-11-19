import { describe, expect, it } from "vitest";
import { encodeWav } from "./wav";

describe("encodeWav", () => {
  it("escribe una cabecera WAV válida y las muestras en 16 bits", async () => {
    const blob = encodeWav(Float32Array.of(0, 1, -1, 2), 22050);
    const view = new DataView(await blob.arrayBuffer());
    const text = (offset: number) => String.fromCharCode(...new Uint8Array(view.buffer, offset, 4));

    expect(blob.type).toBe("audio/wav");
    expect(view.byteLength).toBe(44 + 4 * 2);
    expect([text(0), text(8), text(12), text(36)]).toEqual(["RIFF", "WAVE", "fmt ", "data"]);
    expect(view.getUint32(24, true)).toBe(22050); // frecuencia
    expect(view.getUint32(40, true)).toBe(8); // bytes de audio
    // 0 → 0; 1 → máximo; -1 → mínimo; 2 se recorta al máximo (no "da la vuelta").
    expect([0, 1, 2, 3].map((i) => view.getInt16(44 + i * 2, true))).toEqual([0, 32767, -32767, 32767]);
  });
});
