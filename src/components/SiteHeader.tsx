import Link from "next/link";
import { Menu, PhoneCall } from "lucide-react";
import { cn } from "@/lib/cn";
import { Wordmark, btn } from "@/components/ui";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/call", label: "Live call" },
  { href: "/leads", label: "Leads" },
  { href: "/projects", label: "Projects" },
  { href: "/ops", label: "Operations" },
  { href: "/how-it-works", label: "How it works" },
];

/**
 * `bare` drops the card background so the landing page can seat the header
 * inside its hero card, the way the Get Talky reference does. Every other page
 * gets it as a card of its own.
 */
export function SiteHeader({ current, bare = false }: { current?: string; bare?: boolean }) {
  return (
    <header className={cn("relative z-40", !bare && "bg-canvas rounded-card")}>
      {/* Three columns, not flex with mx-auto: the nav is centred on the bar
          itself, so it stays put when the right-hand button is hidden (as it is
          on /call) instead of re-centring into the space left over. */}
      <div className="grid h-[68px] grid-cols-[1fr_auto] items-center gap-6 px-5 sm:px-8 lg:grid-cols-[1fr_auto_1fr]">
        <Link
          href="/"
          className="flex min-h-11 items-center justify-self-start text-[17px] sm:text-[19px]"
          aria-label="Aarambh Realty — home"
        >
          <Wordmark />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {NAV.map((item) => {
            const on = current === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "relative flex min-h-11 items-center px-3.5 text-[13.5px] transition-colors",
                  on ? "text-ink font-semibold" : "text-ink-2 hover:text-ink",
                )}
              >
                {/* Every link is as wide as its bold self, so the active one
                    getting heavier does not nudge its neighbours. */}
                <span className="grid">
                  <span className="invisible col-start-1 row-start-1 font-semibold" aria-hidden>
                    {item.label}
                  </span>
                  <span className="col-start-1 row-start-1">{item.label}</span>
                </span>
                {on ? <span className="bg-ink/70 absolute inset-x-3.5 bottom-0.5 h-[2px] rounded-full" /> : null}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 justify-self-end">
          {/* Redundant on the call page itself, where the primary action is already the hero. */}
          {current !== "/call" ? (
            <Link href="/call" className={cn(btn("soft", "sm"), "max-[400px]:px-3")} aria-label="Talk to Priya">
              <PhoneCall className="h-3.5 w-3.5" aria-hidden />
              <span className="max-[400px]:sr-only">Talk to Priya</span>
            </Link>
          ) : null}

          {/* No-JS menu for small screens: a <details> holds its own open state. */}
          <details className="group relative lg:hidden">
            <summary
              className="bg-ice text-ink flex h-10 w-10 cursor-pointer items-center justify-center rounded-full"
              aria-label="Open the menu"
            >
              <Menu className="h-4 w-4" aria-hidden />
            </summary>
            <nav
              className="bg-canvas shadow-float border-line absolute top-12 right-0 w-56 rounded-2xl border p-2"
              aria-label="Main"
            >
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={current === item.href ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center rounded-xl px-3 text-[14px]",
                    current === item.href ? "bg-ice text-ink font-semibold" : "text-ink-2 hover:bg-frost",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
