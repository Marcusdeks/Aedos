import Link from "next/link";

const REPO_URL = "https://github.com/Marcusdeks/Aedos";

/** Cabecera común a todas las páginas: logo (enlace a la biblioteca) y enlace al código. */
export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5">
      <Link href="/" className="group flex items-center gap-3" aria-label="Aedos, ir a la biblioteca">
        <span className="from-brand-1 via-brand-2 to-brand-3 shadow-brand-2/30 grid size-10 place-items-center rounded-xl bg-linear-to-br shadow-lg transition group-hover:scale-105 group-hover:rotate-3">
          <LogoMark />
        </span>
        <span className="text-xl font-semibold tracking-tight">Aedos</span>
      </Link>

      <a
        href={REPO_URL}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-stone-300 backdrop-blur transition hover:border-white/20 hover:bg-white/10 hover:text-white"
      >
        <GitHubIcon />
        <span className="hidden sm:inline">Código</span>
      </a>
    </header>
  );
}

/** El logo: una onda de voz (barras de distinta altura) en blanco sobre el degradado. */
const LogoMark = () => (
  <svg viewBox="0 0 24 24" className="size-5" fill="white" aria-hidden>
    <rect x="3" y="9" width="2.5" height="6" rx="1.25" />
    <rect x="7.5" y="5" width="2.5" height="14" rx="1.25" />
    <rect x="12" y="2" width="2.5" height="20" rx="1.25" />
    <rect x="16.5" y="7" width="2.5" height="10" rx="1.25" />
  </svg>
);

const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
    <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.56 9.56 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
  </svg>
);
