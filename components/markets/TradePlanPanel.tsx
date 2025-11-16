"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { fetchTradePlan, type TradePlan } from "@/lib/api/tradeplan";

export function TradePlanPanel({ symbol }: { symbol: string }) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ok"; plan: TradePlan | null }
  >({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    fetchTradePlan(symbol, 8, controller.signal)
      .then((plan) => setState({ status: "ok", plan }))
      .catch((e) => setState({ status: "error", message: String(e?.message || e) }));
    return () => controller.abort();
  }, [symbol]);

  if (state.status === "loading") {
    return (
      <Card title="Trade Plan">
        <div className="h-20 animate-pulse rounded-md bg-black/5 dark:bg-white/10" />
      </Card>
    );
  }
  if (state.status === "error") {
    return (
      <Card title="Trade Plan">
        <div className="text-sm text-red-600 dark:text-red-400">Failed to load: {state.message}</div>
      </Card>
    );
  }

  const plan = state.plan;
  if (!plan || plan.side === "none") {
    return (
      <Card title="Trade Plan">
        <div className="text-sm text-black/60 dark:text-white/60">
          No actionable trade plan. Current signal is {plan?.signal.action ?? "hold"}.
        </div>
      </Card>
    );
  }

  const isLong = plan.side === "long";
  const boxColor = isLong
    ? "bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-700 dark:text-emerald-50"
    : "bg-red-50 border-red-200 text-red-900 dark:bg-red-950/40 dark:border-red-700 dark:text-red-50";

  return (
    <Card title="Trade Plan">
      <div className={`rounded-md border px-4 py-3 text-sm ${boxColor}`}>
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <span className="text-xs uppercase tracking-wide opacity-75">Direction</span>
          <span className="font-semibold">{plan.side}</span>
          <span className="text-xs text-black/60 dark:text-white/60">
            Valid for next {plan.validCandles} candles
          </span>
        </div>
        <div className="grid gap-2 md:grid-cols-4">
          <div>
            <div className="text-xs opacity-70">Entry</div>
            <div className="font-medium">{plan.entry.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs opacity-70">Take Profit</div>
            <div className="font-medium">{plan.tp.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs opacity-70">Stop Loss</div>
            <div className="font-medium">{plan.sl.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs opacity-70">Risk / Reward</div>
            <div className="font-medium">{plan.rr.toFixed(2)} R</div>
          </div>
        </div>
      </div>
    </Card>
  );
}


