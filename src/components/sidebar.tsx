"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/cx";
import { CalendarIcon, DashboardIcon, RadarIcon, SearchIcon, SettingsIcon } from "./icons";
import { ThemeToggle } from "./theme-toggle";

const links = [
  { href: "/", label: "Dashboard", Icon: DashboardIcon },
  { href: "/pesquisas", label: "Pesquisas", Icon: SearchIcon },
  { href: "/agendamentos", label: "Agendamentos", Icon: CalendarIcon },
  { href: "/configuracoes", label: "Configurações", Icon: SettingsIcon },
] as const;

function useActive() {
  const pathname = usePathname();
  return (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
}

/**
 * Casca: trilho de 88 px (≥ 768) com a marca, as quatro seções e o tema no rodapé;
 * no celular, barra superior de 48 (marca + tema) e barra inferior de 56 com as abas.
 */
export function Sidebar() {
  const isActive = useActive();

  return (
    <>
      {/* Trilho (tablet e desktop) */}
      <aside className="sticky top-0 hidden h-dvh w-[88px] shrink-0 flex-col items-center border-r border-line bg-canvas py-3 md:flex">
        <Link
          href="/"
          aria-label="Prospecção de Leads, início"
          title="Prospecção de Leads"
          className="mb-4 inline-flex size-14 items-center justify-center rounded-card transicao hover:bg-hover"
        >
          <RadarIcon className="size-7" />
        </Link>
        <nav aria-label="Principal" className="flex-1">
          <ul className="flex flex-col gap-1">
            {links.map(({ href, label, Icon }) => {
              const active = isActive(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "flex w-[72px] flex-col items-center gap-1 rounded-control py-2 transicao",
                      active ? "bg-selected text-fg" : "text-muted hover:bg-hover hover:text-fg",
                    )}
                  >
                    <Icon className="size-5" />
                    <span className={cx("font-display text-legenda", active ? "font-semibold" : "font-medium")}>
                      {label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <ThemeToggle />
      </aside>

      {/* Barra superior (celular) */}
      <header className="flex h-12 items-center justify-between border-b border-line bg-canvas px-4 md:hidden">
        <Link href="/" className="inline-flex items-center gap-2.5 rounded-control">
          <RadarIcon className="size-6" />
          <span className="font-display text-h2 font-semibold">Prospecção de Leads</span>
        </Link>
        <ThemeToggle variant="icon" className="-mr-2" />
      </header>

      {/* Abas inferiores (celular) */}
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-30 h-14 border-t border-line bg-canvas pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="grid h-full grid-cols-4">
          {links.map(({ href, label, Icon }) => {
            const active = isActive(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "flex h-full flex-col items-center justify-center gap-0.5 transicao",
                    active ? "text-fg" : "text-subtle hover:text-fg",
                  )}
                >
                  <Icon className="size-5" />
                  <span className={cx("font-display text-legenda", active ? "font-semibold" : "font-medium")}>
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
