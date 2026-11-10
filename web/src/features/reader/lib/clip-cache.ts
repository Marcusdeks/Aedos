/**
 * Caché LRU (Least Recently Used) de audios ya sintetizados.
 *
 * - Clave: voz + texto de la frase. Al indexar por CONTENIDO (no por posición)
 *   nunca hay que invalidar: si editas el texto, las frases que no cambian se
 *   reutilizan, y si vuelves a una voz anterior sus audios siguen aquí.
 * - Valor: la PROMESA de la URL, no la URL. Si dos partes del código piden la
 *   misma frase a la vez, comparten la misma síntesis en curso (deduplicación).
 * - LRU: un `Map` recuerda el orden de inserción. Al usar una entrada la
 *   reinsertamos al final, así la primera siempre es la menos usada y es la
 *   que se expulsa al superar el límite. Sin librerías.
 *
 * Gestión de memoria: `URL.createObjectURL` reserva el Blob hasta que se llame
 * a `revokeObjectURL`. Si no lo hacemos, cada frase leída se queda en RAM para
 * siempre (memory leak). Por eso toda URL expulsada se revoca.
 */
export class ClipCache {
  readonly #clips = new Map<string, Promise<string>>();
  readonly #maxClips: number;

  constructor(maxClips = 32) {
    this.#maxClips = maxClips;
  }

  /** Devuelve la URL del audio de `key`; si no existe, la crea con `load`. */
  get(key: string, load: () => Promise<Blob>): Promise<string> {
    const clip = this.#clips.get(key) ?? this.#create(key, load);
    // Reinsertar = marcar como "usado recientemente".
    this.#clips.delete(key);
    this.#clips.set(key, clip);

    while (this.#clips.size > this.#maxClips) {
      const oldest = this.#clips.keys().next().value!;
      revoke(this.#clips.get(oldest)!);
      this.#clips.delete(oldest);
    }
    return clip;
  }

  clear(): void {
    this.#clips.forEach(revoke);
    this.#clips.clear();
  }

  #create(key: string, load: () => Promise<Blob>): Promise<string> {
    const clip = load().then((blob) => URL.createObjectURL(blob));
    // Si falla, la quitamos para que el siguiente intento vuelva a sintetizar
    // (comprobando que no la haya sustituido otra entre medias).
    clip.catch(() => {
      if (this.#clips.get(key) === clip) this.#clips.delete(key);
    });
    return clip;
  }
}

function revoke(clip: Promise<string>): void {
  clip.then(
    (url) => URL.revokeObjectURL(url),
    () => {}, // falló al crearse: no hay URL que liberar
  );
}
