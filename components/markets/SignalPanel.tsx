"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { fetchSignal, type SignalResponse } from "@/lib/api/signal";

export function SignalPanel({ symbol }: { symbol: string }) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ok"; data: SignalResponse }
  >({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    fetchSignal(symbol, 600, controller.signal)
      .then((data) => setState({ status: "ok", data }))
      .catch((e) => setState({ status: "error", message: String(e?.message || e) }));
    return () => controller.abort();
  }, [symbol]);

  let content: React.ReactNode = null;
  if (state.status === "loading") {
    content = <div className="h-16 animate-pulse rounded-md bg-black/5 dark:bg-white/10" />;
  } else if (state.status === "error") {
    content = <div className="text-sm text-red-600 dark:text-red-400">Failed to load: {state.message}</div>;
  } else {
    const { action, confidence, fusion_grade, fusion_score, direction, reasoning } = state.data;
    const color =
      action === "buy"
        ? "text-emerald-600 dark:text-emerald-400"
        : action === "sell"
        ? "text-red-600 dark:text-red-400"
        : "text-amber-600 dark:text-amber-400";
    content = (
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-3">
          <span className={`text-base font-semibold ${color}`.trim()}>Signal: {action.toUpperCase()}</span>
          <span className="rounded bg-black/5 px-2 py-0.5 dark:bg-white/10">Confidence: {confidence}%</span>
          <span className="rounded bg-black/5 px-2 py-0.5 dark:bg-white/10">Grade: {fusion_grade}</span>
          <span className="rounded bg-black/5 px-2 py-0.5 dark:bg-white/10">Score: {fusion_score}</span>
          <span className="text-black/60 dark:text-white/60">Dir: {direction}</span>
        </div>
        <div className="w-full text-black/70 dark:text-white/70">{reasoning}</div>
      </div>
    );
  }

  return <Card title="Live Signal">{content}</Card>;
}


