import { SiteHeader } from "@/components/SiteHeader";
import { cn } from "@/lib/cn";

/**
 * What a CRM page shows the instant it is clicked, while the server reads the
 * calls table. A cold Neon branch can take seconds to answer; without this the
 * click appears to do nothing for that long.
 */
export function PageSkeleton({ current, variant }: { current: string; variant: "crm" | "detail" | "ops" }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[1440px] flex-col gap-3 p-2 sm:p-3 lg:p-4" aria-busy="true">
      <SiteHeader current={current} />
      <p className="sr-only" role="status">
        Loading…
      </p>

      {variant === "crm" ? (
        <div className="bg-canvas rounded-card p-2.5 sm:p-4">
          <div className="grid gap-3 xl:grid-cols-[480px_minmax(0,1fr)]">
            <div className="bg-frost rounded-panel space-y-3 p-4 sm:p-6">
              <Block className="h-10 w-40" />
              <Block className="h-4 w-56" />
              <div className="flex gap-1.5 pt-4">
                {[56, 56, 64, 60].map((w, i) => (
                  <Block key={i} className="h-9 rounded-full" style={{ width: w }} />
                ))}
              </div>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="rounded-[20px] bg-white p-4">
                  <div className="flex items-center gap-3">
                    <Block className="h-11 w-11 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Block className="h-3.5 w-2/5" />
                      <Block className="h-3 w-1/3" />
                    </div>
                  </div>
                  <Block className="mt-4 h-[5px] w-full" />
                </div>
              ))}
            </div>
            <div className="space-y-6 p-1 sm:p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="bg-cobalt/85 h-[230px] rounded-[26px]" />
                <div className="bg-mid/80 h-[230px] rounded-[26px]" />
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <Block className="h-[280px] rounded-[22px]" />
                <Block className="h-[420px] rounded-[22px]" />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {variant === "detail" ? (
        <>
          <div className="bg-canvas rounded-card flex items-center gap-6 px-5 py-8 sm:px-8">
            <Block className="h-16 w-16 rounded-full" />
            <div className="flex-1 space-y-3">
              <Block className="h-8 w-64" />
              <Block className="h-3.5 w-80 max-w-full" />
            </div>
          </div>
          <div className="bg-canvas rounded-card space-y-3 px-5 py-8 sm:px-8">
            <Block className="h-7 w-3/5" />
            <Block className="h-4 w-full" />
            <Block className="h-4 w-4/5" />
            <div className="bg-cobalt/80 mt-4 h-20 rounded-[20px]" />
          </div>
        </>
      ) : null}

      {variant === "ops" ? (
        <>
          <Block className="rounded-card h-[220px]" />
          {[0, 1].map((i) => (
            <div key={i} className="bg-canvas rounded-card space-y-6 px-5 py-8 sm:px-8">
              <Block className="h-8 w-72 max-w-full" />
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[0, 1, 2, 3].map((j) => (
                  <Block key={j} className="h-[104px] rounded-[20px]" />
                ))}
              </div>
            </div>
          ))}
        </>
      ) : null}
    </div>
  );
}

function Block({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn("skeleton rounded-[10px]", className)} style={style} aria-hidden />;
}
