# Aedos

Lector de libros y textos con voces neuronales naturales, gratuito y privado. Sube un PDF o pega un texto y escúchalo en voz alta. Por defecto la voz se genera **en el propio dispositivo** con modelos neuronales ([Supertonic 2](https://huggingface.co/Supertone/supertonic-2) y [Piper](https://github.com/rhasspy/piper)): sin servidores, sin cuotas y sin enviar tu texto a nadie. Opcionalmente, voces en la nube de Microsoft (Edge o tu propia cuenta de Azure).

> 🚧 Proyecto en desarrollo activo.

## Funcionalidades

- 📚 **Biblioteca local**: importa PDF (sin límite de páginas) o textos pegados. Todo se guarda en el navegador.
- 🔖 **Guarda por dónde vas**: página y frase exactas, también la voz, la velocidad y el volumen.
- 🧭 Navegación por páginas y por **capítulos** (leídos del índice del PDF).
- 🖼️ **Miniaturas del PDF** junto al texto: se ve en qué página estás y se salta a otra con un clic.
- 🗣️ 27 voces de España, de mujer y de hombre:
  - **En tu equipo**: 2 de Supertonic 2 (las más naturales) y 5 más ligeras de Piper.
  - **En la nube** (avisando de que el texto se envía a Microsoft): 2 de Microsoft Edge (solo en ese navegador) y 18 de Azure AI Speech con la clave del propio usuario.
- 🚀 Usa la tarjeta gráfica (WebGPU) cuando está disponible, o todos los núcleos de la CPU si no.
- 💾 El modelo de voz se descarga una sola vez y queda cargado al pasar de un libro a otro.
- ▶️ Lectura frase a frase con **resaltado**, salto con un clic y paso de página automático.
- ⚡ Precarga de la frase siguiente (también entre páginas) y de la actual antes de pulsar ▶: sin silencios.
- ⌨️ Atajos de teclado: <kbd>Espacio</kbd> reproducir/pausar, <kbd>←</kbd> <kbd>→</kbd> cambiar de página.
- 📴 Funciona sin conexión una vez descargada la voz.
- 📱 Diseño adaptado a móvil.

## Stack

| Parte                        | Tecnología                                                                                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Web                          | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4                                                                               |
| Síntesis de voz (web)        | Supertonic 2 (Transformers.js, WebGPU/WASM) y Piper (ONNX Runtime + espeak-ng, WASM), cada uno en su Web Worker; Web Speech API (Edge); REST de Azure AI Speech |
| PDF                          | pdf.js (Mozilla), con su propio Worker                                                                                                         |
| Almacenamiento               | IndexedDB (librería `idb`) para libros; OPFS para los modelos de voz                                                                           |
| Calidad                      | Vitest (tests unitarios) · ESLint · Prettier · GitHub Actions (CI)                                                                             |
| Escritorio _(en desarrollo)_ | Go + Wails, con Piper nativo                                                                                                                   |

## Arquitectura

```
web/src/
├── app/                   Rutas: biblioteca (/) y lector (/libro/[id])
├── components/            Piezas visuales compartidas
└── features/
    ├── library/           Importar PDF/texto, guardar libros y progreso (IndexedDB)
    └── reader/
        ├── lib/           Lógica pura: voces, segmentación en frases, caché LRU, preferencias
        ├── engine/        Motor TTS del navegador: Web Worker + cliente RPC basado en promesas
        ├── hooks/         useTtsPlayer: máquina de estados de reproducción
        └── components/    Lector, navegación por páginas y barra de reproducción
```

El reproductor depende de una interfaz (`TtsEngine`), no de una implementación concreta. La web usa modelos en WebAssembly/WebGPU (un Worker por modelo, creado solo cuando se usa) y la app de escritorio usará Piper nativo desde Go, **reutilizando la misma lógica de reproducción**.

Piper se ejecuta con un Worker propio (fonetizador espeak-ng en WebAssembly + ONNX Runtime) en vez de con una librería: el fonetizador se crea una sola vez y se usan tantos hilos como núcleos reales. Mientras suena una frase se preparan las 3 siguientes, y las que dejan de hacer falta (salto de frase, cambio de voz) se cancelan.

El modelo de Supertonic se guarda en OPFS (el sistema de ficheros privado del navegador) en vez de en la Cache API, que en Brave falla al guardar y obligaba a descargar 250 MB en cada visita. La web se sirve con aislamiento de origen (cabeceras COOP/COEP) para que ONNX Runtime pueda usar varios hilos.

### Seguridad de las voces de Azure

Cada usuario pone su propia clave de Azure. La clave **nunca pasa por el servidor de Aedos**: el navegador habla directamente con Microsoft y la cambia por un token temporal de 10 minutos. Se guarda solo en la pestaña (`sessionStorage`) salvo que el usuario marque «Recordar». La región se valida para que la clave no pueda enviarse a otro dominio, el texto se escapa antes de meterlo en el SSML, y una política de seguridad de contenido (CSP) limita a qué dominios puede conectarse la web. Se recomienda una clave del plan gratuito (F0), que no puede generar cobros.

## Puesta en marcha

Requisitos: Node.js 22+.

```bash
cd web
npm install
npm run dev        # http://localhost:3000
```

Otros scripts: `npm test`, `npm run typecheck`, `npm run lint`, `npm run format`, `npm run build`.

## Tests e integración continua

Los tests unitarios (Vitest) cubren la lógica pura: segmentación en frases, limpieza del texto de los PDF, caché LRU de audios, cola del Worker, validación de preferencias, catálogo de voces, credenciales de Azure, escape del SSML e ids de contenido. Están junto al código que prueban (`*.test.ts`).

En cada push, [GitHub Actions](.github/workflows/ci.yml) comprueba formato, tipos, lint, tests y que el proyecto compila.

## Hoja de ruta

- [x] Importar PDF y leer libros completos
- [x] Guardar el punto de lectura (página / frase)
- [ ] Importar EPUB
- [ ] App de escritorio (Go + Wails) con biblioteca en una carpeta local
- [ ] Cuentas de usuario y sincronización
- [ ] App móvil

## Créditos

- [Supertonic 2](https://huggingface.co/Supertone/supertonic-2) (Supertone), licencia OpenRAIL-M, ejecutado con [Transformers.js](https://github.com/huggingface/transformers.js).
- [Piper](https://github.com/rhasspy/piper) (Rhasspy), con su fonetizador para navegador [piper-wasm](https://github.com/diffusion-studio/piper-wasm) (MIT). Cada modelo de voz tiene su propia licencia; consúltala en su ficha de [HuggingFace](https://huggingface.co/rhasspy/piper-voices).
