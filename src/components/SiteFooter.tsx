import Link from "next/link";
import { Wordmark } from "@/components/ui";

export function SiteFooter() {
  return (
    <footer className="bg-canvas rounded-card">
      <div className="text-ink-3 flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-6 text-[12.5px] sm:px-8">
        <span className="text-[15px]">
          <Wordmark />
        </span>
        <span>A fictional developer, invented for this demo.</span>
        <div className="ml-auto flex flex-wrap items-center gap-x-5">
          <Link href="/how-it-works" className="hover:text-ink inline-flex min-h-9 items-center transition-colors">
            Architecture &amp; stack
          </Link>
          <a href="/api/health" className="hover:text-ink inline-flex min-h-9 items-center transition-colors">
            System health
          </a>
          <span className="inline-flex min-h-9 items-center">Photography: Unsplash</span>
        </div>
      </div>
    </footer>
  );
}
