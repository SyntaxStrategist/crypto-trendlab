"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { fetchTrend, type TrendResponse } from "@/lib/api/trend";

export function TrendPanel({ symbol }: { symbol: string }) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ok"; data: TrendResponse }
  >({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    fetchTrend(symbol, 200, controller.signal)
      .then((data) => setState({ status: "ok", data }))
      .catch((e) => setState({ status: "error", message: String(e?.message || e) }));
    return () => controller.abort();
  }, [symbol]);

  if (state.status === "loading") {
    return (
      <Card title="Trend">
        <div className="h-24 animate-pulse rounded-md bg-black/5 dark:bg-white/10" />
      </Card>
    );
  }
  if (state.status === "error") {
    return (
      <Card title="Trend">
        <div className="text-sm text-red-600 dark:text-red-400">Failed to load: {state.message}</div>
      </Card>
    );
  }
  const { summary, signals } = state.data;
  const color =
    summary.trend === "uptrend"
      ? "text-emerald-600 dark:text-emerald-400"
      : summary.trend === "downtrend"
      ? "text-red-600 dark:text-red-400"
      : "text-amber-600 dark:text-amber-400";
  return (
    <Card title="Trend">
      <div className="space-y-3">
        <div className="text-sm">
          <span className="mr-2 text-black/60 dark:text-white/60">Direction:</span>
          <span className={color}>{summary.trend}</span>
          <span className="ml-3 text-xs text-black/50 dark:text-white/50">
            (5m: {summary.trend_5m}, 15m: {summary.trend_15m})
          </span>
        </div>
        <div className="space-y-2">
          <div className="text-xs font-semibold text-black/70 dark:text-white/70">Latest signals</div>
          {signals.length === 0 ? (
            <div className="text-xs text-black/50 dark:text-white/50">No recent signals</div>
          ) : (
            <ul className="text-xs">
              {signals.slice(-6).reverse().map((s, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="rounded bg-black/5 px-2 py-0.5 dark:bg-white/10">{s.timeframe}</span>
                  <span>{s.type}</span>
                  {"a" in s && s.a ? <span className="text-black/50 dark:text-white/50">(ema{s.a} vs ema{s.b})</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}


