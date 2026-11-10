/**
 * Fondo decorativo "aurora": manchas de color difuminadas detrás de todo.
 *
 * - `fixed inset-0 -z-10`: ocupa la ventana y queda DETRÁS del contenido.
 * - `pointer-events-none`: no intercepta clics.
 * - `aria-hidden`: es pura decoración, los lectores de pantalla la ignoran.
 *
 * RENDIMIENTO (lección aprendida midiendo): la primera versión eran círculos
 * con `filter: blur(120px)` ANIMADOS. Precioso, pero el navegador tenía que
 * recalcular ese desenfoque gigante en cada fotograma y se comía la CPU: la
 * síntesis de voz pasó de ~15 s a más de 150 s. Ahora son degradados radiales
 * ESTÁTICOS (utilidad `bg-aurora` en globals.css): mismo aspecto, coste casi cero.
 */
export function Aurora() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      <div className="bg-aurora absolute inset-0" />
      {/* Retícula muy tenue que da textura y sensación de profundidad. */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.03)_1px,transparent_1px)] mask-[radial-gradient(ellipse_at_top,black_30%,transparent_75%)] bg-size-[48px_48px]" />
    </div>
  );
}
