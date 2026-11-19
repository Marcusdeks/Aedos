import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAzureCredentials,
  isAzureRemembered,
  loadAzureCredentials,
  parseAzureCredentials,
  saveAzureCredentials,
} from "./azure-credentials";

const KEY = "a".repeat(32);

/** Almacenamiento falso en memoria: los tests corren en Node, donde no hay navegador. */
function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe("parseAzureCredentials", () => {
  it("acepta una clave y una región válidas, limpiando espacios y mayúsculas", () => {
    expect(parseAzureCredentials(`  ${KEY} `, " West Europe ")).toEqual({ key: KEY, region: "westeurope" });
  });

  it("rechaza regiones que podrían desviar la clave a otro dominio", () => {
    // Con la región se construye `https://${region}.tts.speech.microsoft.com`:
    // "evil.com/x" o "a@b" la mandarían a otro servidor.
    for (const region of ["evil.com/x", "a@b", "x:8080", "west.europe", ""]) {
      expect(typeof parseAzureCredentials(KEY, region)).toBe("string");
    }
  });

  it("rechaza claves con formato imposible", () => {
    for (const key of ["", "corta", `${KEY}-`, "ñ".repeat(32)]) {
      expect(typeof parseAzureCredentials(key, "westeurope")).toBe("string");
    }
  });
});

describe("guardar las credenciales", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", fakeStorage());
    vi.stubGlobal("sessionStorage", fakeStorage());
  });

  it("por defecto solo dura lo que la pestaña (sessionStorage)", () => {
    saveAzureCredentials({ key: KEY, region: "westeurope" }, false);
    expect(loadAzureCredentials()).toEqual({ key: KEY, region: "westeurope" });
    expect(isAzureRemembered()).toBe(false);
  });

  it("con «Recordar» va a localStorage, y nunca queda en los dos sitios", () => {
    saveAzureCredentials({ key: KEY, region: "westeurope" }, false);
    saveAzureCredentials({ key: KEY, region: "francecentral" }, true);
    expect(isAzureRemembered()).toBe(true);
    expect(sessionStorage.getItem("aedos:azure")).toBeNull();
    expect(loadAzureCredentials()?.region).toBe("francecentral");
  });

  it("ignora lo guardado si alguien lo manipuló", () => {
    localStorage.setItem("aedos:azure", JSON.stringify({ key: KEY, region: "evil.com/x" }));
    expect(loadAzureCredentials()).toBeNull();
  });

  it("borrar las elimina de todas partes", () => {
    saveAzureCredentials({ key: KEY, region: "westeurope" }, true);
    clearAzureCredentials();
    expect(loadAzureCredentials()).toBeNull();
  });
});
