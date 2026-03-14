import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface AssetAiSummaryProps extends HTMLAttributes<HTMLDivElement> {
  summary: string | null;
  label?: string;
}

export function AssetAiSummary({ summary, label, className, ...props }: AssetAiSummaryProps) {
  if (!summary) return null;

  return (
    <div
      className={cn(
        "relative mt-3 overflow-hidden rounded-md border border-white/10 bg-white/[0.02] p-3 text-xs backdrop-blur-[2px] transition-all hover:bg-white/[0.04]",
        className
      )}
      {...props}
    >
      {/* Holographic Scanline Shader Effect */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="h-[200%] w-full animate-scanline bg-gradient-to-b from-transparent via-white/[0.03] to-transparent" />
      </div>

      <div className="relative z-10 space-y-1.5">
        {label && (
          <div className="flex items-center gap-1.5 font-mono font-medium tracking-tight text-muted-foreground/80 uppercase">
            <span className="flex h-1 w-1 items-center justify-center">
              <span className="absolute h-1 w-1 animate-ping rounded-full bg-white/30" />
              <span className="relative h-1 w-1 rounded-full bg-white/50" />
            </span>
            {label}
          </div>
        )}
        <p className="leading-relaxed text-muted-foreground/90 transition-all">
          {summary}
        </p>
      </div>
    </div>
  );
}
