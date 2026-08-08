import Link from "next/link";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/call", label: "Live call" },
  { href: "/leads", label: "Leads" },
  { href: "/projects", label: "Projects" },
  { href: "/ops", label: "Operations" },
  { href: "/how-it-works", label: "How it works" },
];

export function SiteHeader({ current }: { current?: string }) {
  return (
    <header className="border-b border-rule bg-paper/85 sticky top-0 z-40 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-8 px-5 sm:px-8">
        <Link href="/" className="group flex min-h-11 items-center gap-2.5">
          <span className="font-display text-ink text-[19px] leading-none">आरंभ</span>
          <span className="text-ink-2 group-hover:text-aqua text-[13px] font-medium tracking-tight transition-colors">
            Aarambh Realty
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-1 sm:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-11 items-center rounded-sm px-3 text-[13px] font-medium transition-colors",
                current === item.href ? "text-ink bg-paper-2" : "text-ink-3 hover:text-ink hover:bg-paper-2",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Redundant on the call page itself, where the primary action is already the hero. */}
        {current !== "/call" ? (
          <Link
            href="/call"
            className="bg-ink text-paper hover:bg-aqua ml-auto flex min-h-11 items-center rounded-sm px-3.5 text-[13px] font-semibold transition-colors sm:ml-0"
          >
            Start a call
          </Link>
        ) : null}
      </div>
    </header>
  );
}
