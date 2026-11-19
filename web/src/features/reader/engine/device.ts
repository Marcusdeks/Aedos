/**
 * ¿Dónde ejecutar un modelo de Transformers.js? WebGPU usa la tarjeta gráfica
 * y es mucho más rápido; si el navegador no lo ofrece, WebAssembly en la CPU.
 * `requestAdapter()` puede devolver null aunque exista `navigator.gpu` (GPU
 * en lista negra, drivers...), por eso no basta con comprobar que existe.
 *
 * Lo comparten los Workers de Supertonic y Kokoro.
 */
export async function pickDevice(): Promise<"webgpu" | "wasm"> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  return (await gpu?.requestAdapter().catch(() => null)) ? "webgpu" : "wasm";
}
