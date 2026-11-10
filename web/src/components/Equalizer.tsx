/** Alturas máximas de cada barra (en % del contenedor): la variedad lo hace parecer orgánico. */
const BARS = [55, 100, 70, 90, 45];

/**
 * Ecualizador animado hecho solo con CSS (sin JavaScript ni canvas).
 * Cada barra escala en vertical desde abajo (`origin-bottom`), con un retraso
 * distinto para que no suban todas a la vez.
 *
 * @param active Si es false, las barras se quedan quietas (por ejemplo, en pausa).
 */
export function Equalizer({ active = true, className = "" }: { active?: boolean; className?: string }) {
  return (
    <span aria-hidden className={`inline-flex items-end gap-[3px] ${className}`}>
      {BARS.map((height, i) => (
        <span
          key={i}
          style={{ height: `${height}%`, animationDelay: `${i * -0.18}s` }}
          className={`from-brand-2 to-brand-1 w-[3px] origin-bottom rounded-full bg-linear-to-t ${
            active ? "animate-equalizer" : "scale-y-30"
          }`}
        />
      ))}
    </span>
  );
}
