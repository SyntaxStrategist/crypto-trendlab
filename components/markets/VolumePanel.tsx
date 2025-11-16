"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { fetchVolume, type VolumeSignal } from "@/lib/api/volume";

export function VolumePanel({ symbol }: { symbol: string }) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ok"; signals: VolumeSignal[] }
  >({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    fetchVolume(symbol, 200, controller.signal)
      .then((res) => setState({ status: "ok", signals: res.signals }))
      .catch((e) => setState({ status: "error", message: String(e?.message || e) }));
    return () => controller.abort();
  }, [symbol]);

  if (state.status === "loading") {
    return (
      <Card title="Volume">
        <div className="h-24 animate-pulse rounded-md bg-black/5 dark:bg-white/10" />
      </Card>
    );
  }
  if (state.status === "error") {
    return (
      <Card title="Volume">
        <div className="text-sm text-red-600 dark:text-red-400">Failed to load: {state.message}</div>
      </Card>
    );
  }

  const recent = state.signals.slice(-8).reverse();
  return (
    <Card title="Volume">
      {recent.length === 0 ? (
        <div className="text-sm text-black/60 dark:text-white/60">No recent volume signals</div>
      ) : (
        <ul className="space-y-2 text-sm">
          {recent.map((s, i) => {
            const ts = new Date(s.ts).toLocaleString();
            const tag =
              s.type === "climax" || s.type === "ignition"
                ? [
                    <span key="tf" className="rounded bg-black/5 px-2 py-0.5 dark:bg-white/10">
                      {s.timeframe}
                    </span>,
                    <span key="dir" className="text-black/50 dark:text-white/50">
                      {s.dir}
                    </span>,
                    s.type === "climax" && s.rv ? (
                      <span key="rv" className="text-black/50 dark:text-white/50">
                        rv {s.rv.toFixed(1)}
                      </span>
                    ) : null,
                  ]
                : [
                    <span key="tf" className="rounded bg-black/5 px-2 py-0.5 dark:bg-white/10">
                      {s.timeframe}
                    </span>,
                    <span key="meta" className="text-black/50 dark:text-white/50">
                      n={("count" in s && s.count) || 0}, score={("score" in s && s.score) || 0}
                    </span>,
                  ];
            return (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <span className="rounded border border-black/10 px-2 py-0.5 dark:border-white/10">{s.type}</span>
                <span>{ts}</span>
                {tag}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}


