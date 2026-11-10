/**
 * Contrato del motor de síntesis.
 *
 * El reproductor (hook + UI) solo conoce esta interfaz, no CÓMO se genera el
 * audio. Es el principio de inversión de dependencias (la "D" de SOLID):
 *   - Web:        Piper compilado a WebAssembly dentro de un Web Worker.
 *   - Escritorio: Piper nativo ejecutado por Go (Wails).
 * Cambiar de motor = pasar otra implementación; el resto del código no se toca.
 */
export interface TtsEngine {
  /** Genera el audio (WAV) de un texto corto, normalmente una frase. */
  synthesize(text: string, voiceId: string, onProgress?: (p: DownloadProgress) => void): Promise<Blob>;
  /** Libera recursos (hilos, procesos...). Se llama al desmontar el reproductor. */
  dispose(): void;
}

/** Progreso de descarga del modelo de voz (solo ocurre la primera vez). */
export interface DownloadProgress {
  loaded: number;
  /** 0 si el servidor no envía Content-Length: la UI muestra progreso indeterminado. */
  total: number;
}
