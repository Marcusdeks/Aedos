"use client";
// "use client": este componente usa estado, efectos y APIs del navegador
// (Worker, <audio>). En el App Router todo es Server Component por defecto, y
// esta directiva marca la frontera a partir de la cual el código va al cliente.

import { useState } from "react";
import { WasmTtsEngine } from "../engine/wasm-engine";
import { useTtsPlayer } from "../hooks/useTtsPlayer";
import { PlayerBar } from "./PlayerBar";
import { ReadingView } from "./ReadingView";

// Fuera del componente → misma referencia en cada render. Si la definiéramos
// dentro, el efecto del hook vería una función "nueva" y recrearía el Worker.
const createEngine = () => new WasmTtsEngine();

const SAMPLE_TEXT = `Bienvenido a Aedos, un lector de texto con voces neuronales.

Pega aquí cualquier texto y pulsa reproducir. La voz se genera en tu propio navegador: no se envía nada a ningún servidor. La primera vez se descargará el modelo de voz; después funciona incluso sin conexión.

Haz clic en cualquier frase para saltar a ella.`;

export function Reader() {
  const [text, setText] = useState(SAMPLE_TEXT);
  const player = useTtsPlayer(text, createEngine);

  return (
    <div className="flex flex-col gap-4">
      {/* Parado → editar. Reproduciendo o en pausa → leer con resaltado. */}
      {player.status === "stopped" ? (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Pega o escribe el texto que quieres escuchar…"
          aria-label="Texto a leer"
          className="min-h-[60vh] resize-y rounded-2xl border border-zinc-200 bg-white p-4 text-lg leading-relaxed outline-none focus:border-indigo-500 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900"
        />
      ) : (
        <ReadingView segments={player.segments} current={player.index} onSeek={player.seek} />
      )}

      {/* Va DESPUÉS del texto: `sticky bottom` la pega al borde inferior mientras se lee. */}
      <PlayerBar player={player} />

      <audio {...player.audioProps} hidden />
    </div>
  );
}
