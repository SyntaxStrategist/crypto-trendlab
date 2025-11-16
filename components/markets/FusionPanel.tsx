"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { fetchFusion, type FusionResponse } from "@/lib/api/fusion";

export function FusionPanel({ symbol }: { symbol: string }) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ok"; data: FusionResponse }
  >({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    fetchFusion(symbol, 200, controller.signal)
      .then((data) => setState({ status: "ok", data }))
      .catch((e) => setState({ status: "error", message: String(e?.message || e) }));
    return () => controller.abort();
  }, [symbol]);

  if (state.status === "loading") {
    return (
      <Card title="Fusion">
        <div className="h-24 animate-pulse rounded-md bg-black/5 dark:bg-white/10" />
      </Card>
    );
  }
  if (state.status === "error") {
    return (
      <Card title="Fusion">
        <div className="text-sm text-red-600 dark:text-red-400">Failed to load: {state.message}</div>
      </Card>
    );
  }

  const { fusion, summary } = state.data;
  const color =
    fusion.direction === "long"
      ? "text-emerald-600 dark:text-emerald-400"
      : fusion.direction === "short"
      ? "text-red-600 dark:text-red-400"
      : "text-amber-600 dark:text-amber-400";

  return (
    <Card title="Fusion">
      <div className="flex flex-col gap-3 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded bg-black/5 px-2 py-0.5 dark:bg-white/10">Grade: {fusion.grade}</span>
          <span className={color}>Direction: {fusion.direction}</span>
          <span>Score: {fusion.score}</span>
          <span>Confidence: {fusion.confidence}%</span>
        </div>
        <div className="text-black/70 dark:text-white/70">
          {fusion.reasoning || "No reasoning available."}
        </div>
        <div className="text-xs text-black/50 dark:text-white/50">
          Trend summary — 5m: {summary.trend_5m}, 15m: {summary.trend_15m}
        </div>
      </div>
    </Card>
  );
}


