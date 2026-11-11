/**
 * Contrato del motor de síntesis.
 *
 * El reproductor (hook + UI) solo conoce esta interfaz, no CÓMO se genera el
 * audio. Es el principio de inversión de dependencias (la "D" de SOLID):
 *   - Web:        modelos neuronales en WebAssembly dentro de Web Workers.
 *   - Escritorio: Piper nativo ejecutado por Go (Wails).
 * Cambiar de motor = pasar otra implementación; el resto del código no se toca.
 *
 * El motor vive mientras la app está abierta (no hay `dispose`): preparar un
 * modelo de voz cuesta muchos segundos, así que se mantiene cargado al pasar de
 * un libro a otro en vez de cerrarlo y volver a cargarlo.
 */
export interface TtsEngine {
  /** Genera el audio (WAV) de un texto corto, normalmente una frase. */
  synthesize(text: string, voice: VoiceModel, onProgress?: (p: DownloadProgress) => void): Promise<Blob>;
}

/**
 * Lo mínimo que un motor necesita saber de una voz. Es una UNIÓN DISCRIMINADA
 * por `engine`: cada modelo de IA identifica sus voces de forma distinta.
 */
export type VoiceModel = SupertonicVoiceModel | PiperVoiceModel;

/** Supertonic: un único modelo para todas las voces; cada voz es un "estilo" (F1…F5, M1…M5). */
export interface SupertonicVoiceModel {
  engine: "supertonic";
  style: string;
}

/** Piper: un modelo (.onnx) por voz, que puede traer varios hablantes. */
export interface PiperVoiceModel {
  engine: "piper";
  /** Nombre del modelo en Piper: `<locale>-<nombre>-<calidad>`, p. ej. "es_ES-davefx-medium". */
  model: string;
  /** Índice del hablante dentro del modelo (0 si el modelo solo tiene uno). */
  speaker: number;
}

/** Progreso de descarga del modelo de voz (solo ocurre la primera vez). */
export interface DownloadProgress {
  loaded: number;
  /** 0 si el servidor no envía Content-Length: la UI muestra progreso indeterminado. */
  total: number;
}
