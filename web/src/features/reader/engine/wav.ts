/**
 * Convierte muestras de audio (números entre -1 y 1) en un fichero WAV que el
 * elemento <audio> sabe reproducir.
 *
 * Un WAV es lo más simple que existe: una cabecera de 44 bytes que describe el
 * audio (frecuencia, canales, bits) seguida de las muestras tal cual, cada una
 * como un entero de 16 bits. Escribirlo a mano son 20 líneas y nos ahorra una
 * dependencia.
 */
export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const BYTES_PER_SAMPLE = 2; // 16 bits, mono
  const dataSize = samples.length * BYTES_PER_SAMPLE;
  const view = new DataView(new ArrayBuffer(44 + dataSize));
  const text = (offset: number, value: string) =>
    [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));

  text(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true); // tamaño del fichero menos 8 bytes
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true); // tamaño de este bloque
  view.setUint16(20, 1, true); // formato 1 = PCM sin comprimir
  view.setUint16(22, 1, true); // 1 canal (mono)
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * BYTES_PER_SAMPLE, true); // bytes por segundo
  view.setUint16(32, BYTES_PER_SAMPLE, true); // bytes por muestra
  view.setUint16(34, 16, true); // bits por muestra
  text(36, "data");
  view.setUint32(40, dataSize, true);

  // `true` en cada set = little-endian, el orden de bytes que exige WAV.
  samples.forEach((sample, i) => {
    const clamped = Math.max(-1, Math.min(1, sample)); // evita que un pico se "dé la vuelta"
    view.setInt16(44 + i * BYTES_PER_SAMPLE, clamped * 0x7fff, true);
  });
  return new Blob([view.buffer], { type: "audio/wav" });
}
