/**
 * Tipos del fonetizador de Piper (espeak-ng compilado con Emscripten). El
 * paquete no trae los suyos: describimos solo la parte que usamos.
 */
declare module "@diffusionstudio/piper-wasm/build/piper_phonemize.js" {
  interface PiperPhonemizeModule {
    /** Ejecuta el programa como si fuera la línea de comandos. */
    callMain(args: string[]): void;
  }

  interface PiperPhonemizeOptions {
    /** No "cerrar" el programa al terminar: así se puede ejecutar más veces. */
    noExitRuntime?: boolean;
    /** El .wasm ya descargado (evita que el módulo lo pida a la red). */
    wasmBinary?: ArrayBuffer;
    /** Devuelve el .data ya descargado: los diccionarios de espeak-ng. */
    getPreloadedPackage?: (name: string, size: number) => ArrayBuffer;
    /** Recibe cada línea de la salida estándar (un JSON por texto). */
    print: (line: string) => void;
    printErr?: (message: string) => void;
  }

  export default function createPiperPhonemize(options: PiperPhonemizeOptions): Promise<PiperPhonemizeModule>;
}
