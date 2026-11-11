import { Suspense } from "react";
import { BookReader, ReaderSkeleton } from "@/features/reader/components/BookReader";

/**
 * Ruta dinámica `/libro/[id]`: la carpeta `[id]` captura esa parte de la URL.
 *
 * Con Cache Components (next.config.ts), los `params` sin `generateStaticParams`
 * son datos que solo se conocen al recibir la petición. Next exige leerlos
 * dentro de <Suspense>: así puede enviar al instante el "esqueleto" estático y
 * completar el resto después. Los libros viven en el navegador (IndexedDB), así
 * que el servidor solo pasa el id y el componente cliente hace el resto.
 */
export default function BookPage({ params }: PageProps<"/libro/[id]">) {
  return (
    // Ancho máximo amplio para que quepan el texto y las miniaturas del PDF;
    // cada parte del lector limita luego su propio ancho.
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-10">
      <Suspense fallback={<ReaderSkeleton />}>
        {/* `key={id}`: al pasar de un libro a otro, React crea el lector desde
            cero en vez de reutilizarlo con el estado (página, frase) del anterior. */}
        {params.then(({ id }) => (
          <BookReader key={id} id={id} />
        ))}
      </Suspense>
    </main>
  );
}
