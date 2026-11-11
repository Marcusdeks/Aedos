import { afterEach, describe, expect, it, vi } from "vitest";
import { ClipCache } from "./clip-cache";

const audio = () => Promise.resolve(new Blob(["audio"], { type: "audio/wav" }));

describe("ClipCache", () => {
  afterEach(() => vi.restoreAllMocks());

  it("sintetiza cada frase una sola vez, aunque se pida dos veces a la vez", async () => {
    const cache = new ClipCache();
    const load = vi.fn(audio);
    const [a, b] = await Promise.all([cache.get("frase", load), cache.get("frase", load)]);
    expect(load).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it("expulsa la menos usada al superar el límite y libera su memoria", async () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    const cache = new ClipCache(2);
    const urlA = await cache.get("a", audio);
    await cache.get("b", audio);
    await cache.get("a", audio); // usar "a" la marca como reciente → la menos usada pasa a ser "b"
    await cache.get("c", audio); // supera el límite: sale "b", no "a"

    const load = vi.fn(audio);
    expect(await cache.get("a", load)).toBe(urlA);
    expect(load).not.toHaveBeenCalled();
    await cache.get("b", load); // "b" se había expulsado: hay que volver a generarla
    expect(load).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalled();
  });

  it("olvida los fallos para poder reintentar", async () => {
    const cache = new ClipCache();
    await expect(cache.get("frase", () => Promise.reject(new Error("sin red")))).rejects.toThrow("sin red");
    const load = vi.fn(audio);
    await cache.get("frase", load);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("clear() libera todas las URLs", async () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    const cache = new ClipCache();
    await cache.get("a", audio);
    await cache.get("b", audio);
    cache.clear();
    await vi.waitFor(() => expect(revoke).toHaveBeenCalledTimes(2));
  });
});
