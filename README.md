# Aedos

Lector de libros y textos con voces neuronales naturales, gratuito y privado. Sube un PDF o pega un texto y escúchalo en voz alta. La voz se genera **en el propio dispositivo** con [Piper](https://github.com/rhasspy/piper): sin servidores, sin cuotas y sin enviar tu texto a nadie.

> 🚧 Proyecto en desarrollo activo.

## Funcionalidades

- 📚 **Biblioteca local**: importa PDF (sin límite de páginas) o textos pegados. Todo se guarda en el navegador.
- 🔖 **Guarda por dónde vas**: página y frase exactas, también la voz y la velocidad elegidas.
- 🧭 Navegación por páginas y por **capítulos** (leídos del índice del PDF).
- 🗣️ 12 voces neuronales: 6 de español de España (3 femeninas y 3 masculinas) y 6 en inglés.
- ▶️ Lectura frase a frase con **resaltado**, salto con un clic y paso de página automático.
- ⚡ Precarga de la frase siguiente (también entre páginas): sin silencios.
- ⌨️ Atajos de teclado: <kbd>Espacio</kbd> reproducir/pausar, <kbd>←</kbd> <kbd>→</kbd> cambiar de página.
- 📴 Funciona sin conexión una vez descargada la voz.
- 📱 Diseño adaptado a móvil.

## Stack

| Parte                        | Tecnología                                                       |
| ---------------------------- | ---------------------------------------------------------------- |
| Web                          | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 |
| Síntesis de voz (web)        | Piper → WebAssembly + ONNX Runtime Web, en un Web Worker         |
| PDF                          | pdf.js (Mozilla), con su propio Worker                           |
| Almacenamiento               | IndexedDB (librería `idb`)                                       |
| Escritorio _(en desarrollo)_ | Go + Wails, con Piper nativo                                     |

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

El reproductor depende de una interfaz (`TtsEngine`), no de una implementación concreta. La web usa Piper compilado a WebAssembly y la app de escritorio usará Piper nativo desde Go, **reutilizando la misma lógica de reproducción**.

La librería de Piper para web lleva un pequeño parche (`web/patches/`, aplicado con `patch-package`) que permite elegir el hablante de los modelos con varias voces.

## Puesta en marcha

Requisitos: Node.js 20+.

```bash
cd web
npm install
npm run dev        # http://localhost:3000
```

Otros scripts: `npm run build`, `npm run lint`, `npm run format`.

## Hoja de ruta

- [x] Importar PDF y leer libros completos
- [x] Guardar el punto de lectura (página / frase)
- [ ] Importar EPUB
- [ ] App de escritorio (Go + Wails) con biblioteca en una carpeta local
- [ ] Cuentas de usuario y sincronización
- [ ] App móvil

## Créditos

Voces y motor: [Piper](https://github.com/rhasspy/piper) (Rhasspy). Cada modelo de voz tiene su propia licencia; consúltala en su ficha de [HuggingFace](https://huggingface.co/rhasspy/piper-voices).
