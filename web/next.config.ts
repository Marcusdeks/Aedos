import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,

  // AISLAMIENTO DE ORIGEN (cross-origin isolation). Con estas dos cabeceras el
  // navegador activa `SharedArrayBuffer`, que es lo que permite a ONNX Runtime
  // usar VARIOS núcleos de la CPU (hilos de WebAssembly). Sin ellas el modelo
  // de voz corre en un solo núcleo.
  // `credentialless` deja cargar recursos de otros dominios (el modelo de
  // HuggingFace, el runtime de jsDelivr) sin que tengan que declararse
  // "incrustables": simplemente se piden sin cookies.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
    ];
  },

  turbopack: {
    // El fonemizador de Piper está compilado con Emscripten y contiene
    // `require("fs")` / `require("path")` dentro de una rama que solo se
    // ejecuta en Node. En el navegador nunca se llega ahí, pero el bundler
    // intenta resolverlos igualmente: los sustituimos por un módulo vacío.
    resolveAlias: {
      fs: { browser: "./src/empty-module.ts" },
      path: { browser: "./src/empty-module.ts" },
    },
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
