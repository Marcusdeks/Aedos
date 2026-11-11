import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Tests unitarios con Vitest: prueban la lógica pura (sin interfaz ni
 * navegador), que es donde viven las reglas más fáciles de romper sin darse
 * cuenta (segmentar frases, limpiar el texto del PDF, validar preferencias...).
 */
export default defineConfig({
  resolve: {
    // El mismo alias que en tsconfig.json: `@/x` → `src/x`.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
