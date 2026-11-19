/**
 * Contrato del motor de síntesis.
 *
 * El reproductor (hook + UI) solo conoce esta interfaz, no CÓMO se genera el
 * audio. Es el principio de inversión de dependencias (la "D" de SOLID):
 *   - Web:        modelos neuronales en WebAssembly (Web Workers) o Azure.
 *   - Escritorio: Piper nativo ejecutado por Go (Wails).
 * Cambiar de motor = pasar otra implementación; el resto del código no se toca.
 *
 * El motor vive mientras la app está abierta (no hay `dispose`): preparar un
 * modelo de voz cuesta muchos segundos, así que se mantiene cargado al pasar de
 * un libro a otro en vez de cerrarlo y volver a cargarlo.
 */
export interface TtsEngine {
  /** Genera el audio (WAV o MP3) de un texto corto, normalmente una frase. */
  synthesize(text: string, voice: ClipVoiceModel, options?: SynthesizeOptions): Promise<Blob>;
}

export interface SynthesizeOptions {
  /** Progreso de descarga del modelo (solo la primera vez). */
  onProgress?: (p: DownloadProgress) => void;
  /**
   * Para cancelar una frase que ya no hace falta (salto de frase, cambio de
   * voz). Es la forma estándar de cancelar en la web: la misma que usa `fetch`.
   */
  signal?: AbortSignal;
}

/**
 * Lo mínimo que un motor necesita saber de una voz. Es una UNIÓN DISCRIMINADA
 * por `engine`: cada modelo de IA identifica sus voces de forma distinta.
 */
export type VoiceModel = ClipVoiceModel | EdgeVoiceModel;

/**
 * Voces que generan un FICHERO de audio (Blob) por frase. Las de Edge no: el
 * navegador las reproduce él mismo (Web Speech API) y nunca nos da el audio.
 */
export type ClipVoiceModel = LocalVoiceModel | AzureVoiceModel;

/** Voces que se ejecutan en el propio equipo (modelos en Web Workers). */
export type LocalVoiceModel = SupertonicVoiceModel | PiperVoiceModel;

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

/** Azure AI Speech (nube de Microsoft, con la clave del propio usuario). */
export interface AzureVoiceModel {
  engine: "azure";
  /** Nombre oficial de la voz en Azure, p. ej. "es-ES-ElviraNeural". */
  voiceName: string;
}

/** Voces "online" que Microsoft Edge ofrece a cualquier web (Web Speech API). */
export interface EdgeVoiceModel {
  engine: "edge";
  /** Parte del nombre con el que Edge expone la voz: "Elvira" → "Microsoft Elvira Online (Natural) - Spanish (Spain)". */
  voiceName: string;
}

/** Progreso de descarga del modelo de voz (solo ocurre la primera vez). */
export interface DownloadProgress {
  loaded: number;
  /** 0 si el servidor no envía Content-Length: la UI muestra progreso indeterminado. */
  total: number;
}
