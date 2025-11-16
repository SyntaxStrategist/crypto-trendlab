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
  const [accountSize, setAccountSize] = useState<number>(10000);
  const [riskPercent, setRiskPercent] = useState<number>(1);

  useEffect(() => {
    const controller = new AbortController();
    fetchTradePlan(symbol, 8, controller.signal)
      .then((plan) => setState({ status: "ok", plan }))
      .catch((e) => setState({ status: "error", message: String(e?.message || e) }));
    return () => controller.abort();
  }, [symbol]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const a = window.localStorage.getItem("tradeplan_accountSize");
      const r = window.localStorage.getItem("tradeplan_riskPercent");
      if (a) {
        const v = Number(a);
        if (!Number.isNaN(v) && v > 0) setAccountSize(v);
      }
      if (r) {
        const v = Number(r);
        if (!Number.isNaN(v) && v > 0) setRiskPercent(v);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleAccountChange = (value: string) => {
    const v = Number(value);
    setAccountSize(v);
    if (typeof window !== "undefined" && !Number.isNaN(v)) {
      window.localStorage.setItem("tradeplan_accountSize", String(v));
    }
  };

  const handleRiskChange = (value: string) => {
    const v = Number(value);
    setRiskPercent(v);
    if (typeof window !== "undefined" && !Number.isNaN(v)) {
      window.localStorage.setItem("tradeplan_riskPercent", String(v));
    }
  };

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
      <div className="mb-3 flex flex-wrap items-end gap-3 text-xs">
        <div>
          <div className="mb-1 text-[11px] font-medium text-black/60 dark:text-white/60">Account Size (USD)</div>
          <input
            type="number"
            min={0}
            step="100"
            value={Number.isNaN(accountSize) ? "" : accountSize}
            onChange={(e) => handleAccountChange(e.target.value)}
            className="w-32 rounded border border-black/20 bg-transparent px-2 py-1 text-xs outline-none dark:border-white/20"
          />
        </div>
        <div>
          <div className="mb-1 text-[11px] font-medium text-black/60 dark:text-white/60">Risk per Trade (%)</div>
          <input
            type="number"
            min={0}
            max={100}
            step="0.25"
            value={Number.isNaN(riskPercent) ? "" : riskPercent}
            onChange={(e) => handleRiskChange(e.target.value)}
            className="w-24 rounded border border-black/20 bg-transparent px-2 py-1 text-xs outline-none dark:border-white/20"
          />
        </div>
      </div>
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
        <div className="mt-3 border-t border-black/10 pt-3 text-xs dark:border-white/10">
          <div className="mb-1 font-semibold">Position Sizing</div>
          {accountSize > 0 && riskPercent > 0 ? (
            (() => {
              const riskFraction = riskPercent / 100;
              const dollarRisk = accountSize * riskFraction;
              const perUnitRisk = Math.abs(plan.entry - plan.sl);
              const size = perUnitRisk > 0 ? dollarRisk / perUnitRisk : 0;
              const dollarReward = size * Math.abs(plan.tp - plan.entry);
              return (
                <div className="grid gap-2 md:grid-cols-3">
                  <div>
                    <div className="opacity-70">Position Size (units)</div>
                    <div className="font-medium">{Number.isFinite(size) ? size.toFixed(4) : "—"}</div>
                  </div>
                  <div>
                    <div className="opacity-70">Dollar Risk</div>
                    <div className="font-medium">${Number.isFinite(dollarRisk) ? dollarRisk.toFixed(2) : "—"}</div>
                  </div>
                  <div>
                    <div className="opacity-70">Dollar Reward</div>
                    <div className="font-medium">${Number.isFinite(dollarReward) ? dollarReward.toFixed(2) : "—"}</div>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="text-black/60 dark:text-white/60">
              Enter account size and risk percentage to see position sizing.
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}


