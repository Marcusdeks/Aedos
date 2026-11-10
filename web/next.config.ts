import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,

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
