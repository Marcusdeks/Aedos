import { Equalizer } from "@/components/Equalizer";
import { Library } from "@/features/library/components/Library";

const FEATURES = ["Sin límite de páginas", "Guarda por dónde vas", "Funciona sin conexión", "Gratis y privado"];

// Server Component: se renderiza en el servidor y envía HTML ya hecho.
// Solo <Library /> (marcado con "use client") se hidrata en el navegador, así
// que el JavaScript que descarga el usuario es el mínimo imprescindible.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-14 px-4 pt-6 pb-24 sm:pt-12">
      <section className="animate-fade-up flex flex-col items-center gap-6 text-center">
        <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-stone-300 backdrop-blur">
          <Equalizer className="h-3.5" />
          Voces neuronales que se ejecutan en tu navegador
        </span>

        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          Escucha tus libros con una{" "}
          <span className="from-brand-1 via-brand-2 to-brand-3 bg-linear-to-r bg-clip-text text-transparent">
            voz natural
          </span>
        </h1>

        <p className="max-w-xl text-lg text-pretty text-stone-400">
          Sube un PDF o pega un texto. Aedos lo lee en voz alta frase a frase y recuerda la página por la que vas. Nada
          sale de tu dispositivo.
        </p>

        <ul className="flex flex-wrap justify-center gap-2">
          {FEATURES.map((feature) => (
            <li key={feature} className="rounded-full bg-white/5 px-3 py-1 text-sm text-stone-300 ring-1 ring-white/10">
              {feature}
            </li>
          ))}
        </ul>
      </section>

      <Library />
    </main>
  );
}
