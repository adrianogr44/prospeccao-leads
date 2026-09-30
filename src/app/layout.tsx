import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Sidebar } from "@/components/sidebar";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
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

// Aplica o tema antes da primeira pintura, para não piscar.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        <a
          href="#conteudo"
          className="sr-only rounded-md bg-accent px-3 py-2 text-canvas focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50"
        >
          Ir para o conteúdo
        </a>
        <div className="md:flex">
          <Sidebar />
          <main id="conteudo" className="min-w-0 flex-1 px-4 py-5 md:px-8 md:py-7">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
