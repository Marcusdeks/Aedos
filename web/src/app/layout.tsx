import type { Metadata } from "next";
import { Geist, Geist_Mono, Literata } from "next/font/google";
import { Aurora } from "@/components/Aurora";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

// next/font descarga las fuentes en el BUILD y las sirve desde nuestro propio
// dominio: sin peticiones a Google en cada visita (más rápido y más privado).
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Serif pensada para leer en pantalla: la usamos solo para el texto de los libros.
const literata = Literata({ variable: "--font-literata", subsets: ["latin"] });

// Metadatos para SEO y para la vista previa al compartir el enlace.
export const metadata: Metadata = {
  title: "Aedos · Escucha tus libros con voz natural",
  description: "Sube un PDF o pega un texto y escúchalo con voces neuronales que funcionan en tu navegador.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} ${literata.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Aurora />
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
