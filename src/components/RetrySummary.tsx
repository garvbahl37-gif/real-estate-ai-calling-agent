"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RotateCw } from "lucide-react";
import { cn } from "@/lib/cn";
import { summaryFailed } from "@/lib/lead-fields";
import type { CallSummary } from "@/lib/types";
import { btn } from "@/components/ui";

/**
 * Asks for the summary again — the same endpoint the call page uses when a
 * call ends, with `force` so it replaces the failed attempt. For when the
 * summariser was down at hang-up (a Gemini overload is usually over in
 * minutes); the transcript it works from was saved either way.
 */
export function RetrySummary({
  callId,
  className,
  onSummary,
}: {
  callId: string;
  className?: string;
  /** Hand the new summary to a client page; without it the server page re-renders. */
  onSummary?: (summary: CallSummary) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const retry = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/calls/${callId}/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (summaryFailed(data.summary)) {
        setError("Still unavailable — try again in a few minutes.");
      } else if (data.summary && onSummary) {
        onSummary(data.summary);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <button onClick={retry} disabled={busy} className={btn("primary", "sm")}>
        <RotateCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} aria-hidden />
        {busy ? "Summarising…" : "Try the summary again"}
      </button>
      {error ? (
        <span className="text-rose text-[12.5px]" role="status">
          {error}
        </span>
      ) : null}
    </div>
  );
}
