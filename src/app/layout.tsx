import type { Metadata, Viewport } from "next";
import { Barlow_Semi_Condensed, Schibsted_Grotesk } from "next/font/google";
import { Sidebar } from "@/components/sidebar";
import "./globals.css";

// Títulos e números: condensada de placa de sinalização. Texto: grotesca de jornal.
const display = Barlow_Semi_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--f-display",
  display: "swap",
});
const texto = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--f-texto",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Prospecção de Leads",
    template: "%s · Prospecção de Leads",
  },
  description: "Encontre empresas que precisam de um site e organize seus contatos.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#0d1116" };

// Aplica o tema antes da primeira pintura: escuro é o padrão no primeiro acesso; grava só "light" ou "dark".
const themeScript = `(function(){var r=document.documentElement;var t='dark';try{if(localStorage.getItem('theme')==='light')t='light';}catch(e){}r.classList.remove('light','dark');r.classList.add(t);})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${texto.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        <a
          href="#conteudo"
          className="sr-only rounded-control bg-primary px-3 py-2 font-semibold text-primary-fg focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50"
        >
          Ir para o conteúdo
        </a>
        <div className="md:flex">
          <Sidebar />
          <main id="conteudo" className="min-w-0 flex-1 px-4 pt-4 pb-[72px] sm:px-6 sm:pt-6 md:pb-6">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
