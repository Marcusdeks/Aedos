import { Reader } from "@/features/reader/components/Reader";

// Server Component: se renderiza en el servidor y envía HTML ya hecho.
// Solo <Reader /> (marcado con "use client") se hidrata en el navegador, así
// que el JavaScript que descarga el usuario es el mínimo imprescindible.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Aedos</h1>
        <p className="text-zinc-500">Escucha cualquier texto con voces naturales, gratis y sin servidores.</p>
      </header>
      <Reader />
    </main>
  );
}
