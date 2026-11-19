import { loadAzureCredentials, type AzureCredentials } from "../lib/azure-credentials";
import type { AzureVoiceModel } from "../lib/engine";

/**
 * Motor de voces de Azure AI Speech (nube de Microsoft) con la clave del usuario.
 *
 * El navegador llama DIRECTAMENTE a Microsoft (Azure permite peticiones desde
 * cualquier web: CORS abierto). Nuestro servidor no interviene, así que nunca
 * ve la clave ni el texto.
 *
 * Para enviar la clave lo menos posible se usa un TOKEN: la clave se cambia
 * por un pase temporal (10 minutos) y las frases se piden con ese pase. Si el
 * token se filtrara, caduca solo; la clave solo viaja una vez cada 9 minutos.
 */
export class AzureTtsEngine {
  #token: { value: string; expires: number; for: AzureCredentials } | null = null;

  async synthesize(text: string, voice: AzureVoiceModel): Promise<Blob> {
    const credentials = loadAzureCredentials();
    if (!credentials) throw new Error("Falta tu clave de Azure: pulsa «Configurar Azure».");

    const res = await request(
      `https://${credentials.region}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        Authorization: `Bearer ${await this.#getToken(credentials)}`,
        "Content-Type": "application/ssml+xml",
        // MP3 a 24 kHz: calidad de sobra para voz y 5-10 veces menos que un WAV.
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      },
      buildSsml(text, voice.voiceName),
    );
    if (res.status === 401) this.#token = null; // token caducado o revocado: el siguiente intento pide otro
    if (!res.ok) throw new Error(describeError(res.status));
    return res.blob();
  }

  async #getToken(credentials: AzureCredentials): Promise<string> {
    const token = this.#token;
    // Mismo token solo si sigue vigente Y es de la misma clave (el usuario pudo cambiarla).
    if (
      token &&
      token.expires > Date.now() &&
      token.for.key === credentials.key &&
      token.for.region === credentials.region
    ) {
      return token.value;
    }
    const res = await request(`https://${credentials.region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
      "Ocp-Apim-Subscription-Key": credentials.key,
    });
    if (!res.ok) throw new Error(describeError(res.status));
    // Dura 10 minutos; lo renovamos al llegar a 9 para no usarlo justo cuando caduca.
    this.#token = { value: await res.text(), expires: Date.now() + 9 * 60_000, for: credentials };
    return this.#token.value;
  }
}

/** POST sin cookies ni "referrer": a Microsoft solo le llega lo imprescindible. */
async function request(url: string, headers: Record<string, string>, body?: string): Promise<Response> {
  try {
    return await fetch(url, {
      method: "POST",
      headers,
      body,
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
    });
  } catch {
    throw new Error("No se pudo conectar con Azure. Revisa tu conexión y la región.");
  }
}

/**
 * SSML (Speech Synthesis Markup Language): el formato XML que entiende Azure.
 *
 * El texto del libro se ESCAPA: si un libro contuviera `<voice name="...">` o
 * un `&`, sin escapar rompería el XML o colaría instrucciones en la petición
 * (es la misma idea que la inyección SQL, pero en XML).
 */
export function buildSsml(text: string, voiceName: string): string {
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="es-ES">` +
    `<voice name="${escapeXml(voiceName)}">${escapeXml(text)}</voice></speak>`
  );
}

const XML_ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
const escapeXml = (value: string) => value.replace(/[&<>"']/g, (char) => XML_ENTITIES[char]);

/** Traduce los códigos HTTP de Azure a algo que el usuario pueda resolver. */
function describeError(status: number): string {
  if (status === 401 || status === 403) return "Azure rechazó la clave: revisa la clave y la región.";
  if (status === 429) return "Azure: demasiadas peticiones o límite gratuito del mes agotado.";
  if (status === 400) return "Azure no reconoce esa voz en tu región.";
  return `Azure respondió con un error (${status}).`;
}
