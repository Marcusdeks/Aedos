import { describe, expect, it } from "vitest";
import { contentId } from "./import";

const bytes = (text: string) => new TextEncoder().encode(text);

describe("contentId", () => {
  it("son los 8 primeros bytes del SHA-256, en hexadecimal", async () => {
    // SHA-256("abc") = ba7816bf8f01cfea414140de5dae2223... (vector de prueba oficial del estándar)
    expect(await contentId(bytes("abc"))).toBe("ba7816bf8f01cfea");
  });

  it("el mismo contenido da el mismo id; otro contenido, otro id", async () => {
    expect(await contentId(bytes("Don Quijote"))).toBe(await contentId(bytes("Don Quijote")));
    expect(await contentId(bytes("Don Quijote"))).not.toBe(await contentId(bytes("Don Quijote.")));
  });
});
