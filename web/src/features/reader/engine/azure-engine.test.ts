import { describe, expect, it } from "vitest";
import { buildSsml } from "./azure-engine";

describe("buildSsml", () => {
  it("envuelve el texto en SSML con la voz pedida", () => {
    expect(buildSsml("Hola.", "es-ES-ElviraNeural")).toBe(
      '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="es-ES">' +
        '<voice name="es-ES-ElviraNeural">Hola.</voice></speak>',
    );
  });

  it("escapa el texto: un libro no puede colar etiquetas en la petición", () => {
    const ssml = buildSsml('Tom & Jerry <voice name="otra">"hola"</voice>', "es-ES-ElviraNeural");
    expect(ssml).toContain("Tom &amp; Jerry &lt;voice name=&quot;otra&quot;&gt;&quot;hola&quot;&lt;/voice&gt;");
    expect(ssml.match(/<voice /g)).toHaveLength(1);
  });
});
