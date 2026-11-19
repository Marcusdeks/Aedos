import type { NextConfig } from "next";

/**
 * POLÍTICA DE SEGURIDAD DE CONTENIDO (CSP): lista blanca de a dónde puede
 * conectarse y de dónde puede cargar código esta web. Es la defensa principal
 * si alguien lograra inyectar código (XSS): aunque leyera la clave de Azure
 * del usuario, el navegador le impediría enviarla a un servidor suyo, porque
 * `connect-src` solo permite estos dominios.
 *
 *   - huggingface.co (y sus CDN *.hf.co): los modelos de voz.
 *   - cdn.jsdelivr.net: el motor ONNX Runtime y espeak-ng (WebAssembly).
 *   - *.speech.microsoft.com / *.cognitive.microsoft.com: Azure.
 *   - 'wasm-unsafe-eval': permite compilar WebAssembly (los modelos lo necesitan).
 *   - blob: en scripts: ONNX Runtime prepara parte de su código en memoria y lo
 *     importa desde una URL "blob:". Solo puede crearla código que ya corre aquí.
 *   - 'unsafe-inline' en scripts: Next mete pequeños scripts en la página. La
 *     alternativa (un "nonce" distinto en cada visita) obliga a generar la
 *     página en cada petición y perderíamos el prerenderizado.
 *   - 'unsafe-eval' solo en desarrollo: lo usa la recarga en caliente de Next.
 */
const isDev = process.env.NODE_ENV === "development";
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net${isDev ? " 'unsafe-eval'" : ""}`,
  "worker-src 'self' blob: https://cdn.jsdelivr.net",
  [
    "connect-src 'self'",
    "https://huggingface.co https://*.huggingface.co https://*.hf.co",
    "https://cdn.jsdelivr.net",
    "https://*.tts.speech.microsoft.com https://*.api.cognitive.microsoft.com",
  ].join(" "),
  "img-src 'self' blob: data:",
  "media-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // Nadie puede meter Aedos dentro de un <iframe> (evita el "clickjacking").
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Next genera por defecto un AGENTS.md al arrancar; este proyecto no lo usa.
  agentRules: false,

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
          { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
          // No "adivinar" el tipo de un fichero: un .txt nunca se ejecutará como script.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Al salir hacia otra web, no contarle qué página de Aedos estabas leyendo.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Esta web no usa cámara ni geolocalización: se niegan de entrada.
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=()" },
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
