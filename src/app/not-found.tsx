import Link from "next/link";
import { ArrowRight, PhoneCall } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Card, PriyaAvatar, btn } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[1440px] flex-col gap-3 p-2 sm:p-3 lg:p-4">
      <SiteHeader />
      <Card className="flex-1 p-2.5 sm:p-4">
        <div className="wash flex min-h-[460px] flex-col items-center justify-center rounded-[22px] px-6 py-16 text-center">
          <PriyaAvatar size={56} />
          <p className="text-cobalt mt-6 font-mono text-[13px] font-semibold">404</p>
          <h1 className="text-ink mt-2 text-[30px] leading-tight font-medium tracking-[-0.03em] sm:text-[40px]">
            Nothing here — not even a lead.
          </h1>
          <p className="text-ink-2 mt-3 max-w-[46ch] text-[14.5px] leading-relaxed">
            The page or the call you were looking for doesn&rsquo;t exist. It may have been a link to a lead that was
            never recorded.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/leads" className={btn("outline")}>
              All leads <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link href="/call" className={btn("primary")}>
              <PhoneCall className="h-4 w-4" aria-hidden /> Talk to Priya
            </Link>
          </div>
        </div>
      </Card>
      <SiteFooter />
    </div>
  );
}
