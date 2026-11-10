# Aedos

Lector de texto con voces neuronales naturales, gratuito y privado. La voz se genera **en el propio dispositivo** con [Piper](https://github.com/rhasspy/piper): sin servidores, sin cuotas y sin enviar tu texto a nadie.

> 🚧 Proyecto en desarrollo activo.

## Funcionalidades

- 🗣️ Voces neuronales en español (España y México) e inglés.
- ▶️ Lectura frase a frase con **resaltado** de la frase actual y salto con un clic.
- ⚡ Precarga de la frase siguiente: sin silencios entre frases.
- 🎚️ Control de velocidad (0,5×–2×) manteniendo el tono.
- 📴 Funciona sin conexión una vez descargada la voz.
- 📱 Diseño adaptado a móvil.

## Stack

| Parte | Tecnología |
|---|---|
| Web | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 |
| Síntesis de voz (web) | Piper → WebAssembly + ONNX Runtime Web, en un Web Worker |
| Escritorio *(en desarrollo)* | Go + Wails, con Piper nativo |

## Arquitectura

```
web/src/features/reader/
├── lib/         Lógica pura: voces, segmentación en frases, caché LRU, contrato del motor
├── engine/      Motor TTS del navegador: Web Worker + cliente RPC basado en promesas
├── hooks/       useTtsPlayer: máquina de estados de reproducción
└── components/  Interfaz
```

El reproductor depende de una interfaz (`TtsEngine`), no de una implementación concreta. La web usa Piper compilado a WebAssembly y la app de escritorio usará Piper nativo desde Go, **reutilizando la misma lógica de reproducción**.

## Puesta en marcha

Requisitos: Node.js 20+.

```bash
cd web
npm install
npm run dev        # http://localhost:3000
```

Otros scripts: `npm run build`, `npm run lint`, `npm run format`.

## Hoja de ruta

- [ ] Importar PDF / EPUB y leer libros completos
- [ ] Guardar el punto de lectura (capítulo / página)
- [ ] App de escritorio (Go + Wails) con biblioteca en una carpeta local
- [ ] Cuentas de usuario y sincronización
- [ ] App móvil

## Créditos

Voces y motor: [Piper](https://github.com/rhasspy/piper) (Rhasspy). Cada modelo de voz tiene su propia licencia; consúltala en su ficha de [HuggingFace](https://huggingface.co/rhasspy/piper-voices).
