"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/cx";
import { CalendarIcon, DashboardIcon, SearchIcon, SettingsIcon } from "./icons";
import { ThemeToggle } from "./theme-toggle";

const links = [
  { href: "/", label: "Dashboard", Icon: DashboardIcon },
  { href: "/pesquisas", label: "Pesquisas", Icon: SearchIcon },
  { href: "/agendamentos", label: "Agendamentos", Icon: CalendarIcon },
  { href: "/configuracoes", label: "Configurações", Icon: SettingsIcon },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="border-b border-line bg-surface md:sticky md:top-0 md:h-dvh md:w-56 md:shrink-0 md:border-r md:border-b-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 md:h-full md:flex-col md:items-stretch md:gap-3 md:px-3 md:py-4">
        <p className="px-2 text-sm font-semibold tracking-tight md:pb-2">Prospecção de Leads</p>
        <nav aria-label="Principal" className="order-last w-full md:order-none md:flex-1">
          <ul className="flex gap-1 md:flex-col">
            {links.map(({ href, label, Icon }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 font-medium transition-colors",
                      active
                        ? "bg-canvas text-accent ring-1 ring-line"
                        : "text-muted hover:bg-canvas hover:text-fg",
                    )}
                  >
                    <Icon />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <ThemeToggle className="ml-auto md:ml-0 md:w-full md:justify-start" />
      </div>
    </aside>
  );
}
