"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { fetchBacktest, type BacktestResponse } from "@/lib/api/backtest";

export function BacktestPanel({ symbol }: { symbol: string }) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ok"; data: BacktestResponse }
  >({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    fetchBacktest(symbol, 1500, controller.signal)
      .then((data) => setState({ status: "ok", data }))
      .catch((e) => setState({ status: "error", message: String(e?.message || e) }));
    return () => controller.abort();
  }, [symbol]);

  if (state.status === "loading") {
    return (
      <Card title="Backtest">
        <div className="h-24 animate-pulse rounded-md bg-black/5 dark:bg-white/10" />
      </Card>
    );
  }
  if (state.status === "error") {
    return (
      <Card title="Backtest">
        <div className="text-sm text-red-600 dark:text-red-400">Failed to load: {state.message}</div>
      </Card>
    );
  }

  const { stats, trades } = state.data;
  const recent = trades.slice(-8).reverse();

  return (
    <Card title="Backtest">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1 text-sm">
          <div className="text-black/60 dark:text-white/60">Win rate</div>
          <div className="text-lg font-semibold">{stats.win_rate}%</div>
        </div>
        <div className="space-y-1 text-sm">
          <div className="text-black/60 dark:text-white/60">P/L %</div>
          <div className="text-lg font-semibold">{stats.pl_pct}%</div>
        </div>
        <div className="space-y-1 text-sm">
          <div className="text-black/60 dark:text-white/60">Profit factor</div>
          <div className="text-lg font-semibold">{stats.profit_factor ?? "—"}</div>
        </div>
        <div className="space-y-1 text-sm">
          <div className="text-black/60 dark:text-white/60">Max drawdown</div>
          <div className="text-lg font-semibold">{stats.max_drawdown_pct}%</div>
        </div>
        <div className="space-y-1 text-sm">
          <div className="text-black/60 dark:text-white/60">Trades</div>
          <div className="text-lg font-semibold">{stats.trades}</div>
        </div>
        <div className="space-y-1 text-sm">
          <div className="text-black/60 dark:text-white/60">Wins / Losses</div>
          <div className="text-lg font-semibold">
            {stats.wins} / {stats.losses}
          </div>
        </div>
      </div>
      <div className="mt-4">
        <div className="mb-2 text-xs font-semibold text-black/70 dark:text-white/70">Recent trades</div>
        {recent.length === 0 ? (
          <div className="text-sm text-black/60 dark:text-white/60">No trades</div>
        ) : (
          <ul className="space-y-1 text-sm">
            {recent.map((t, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <span className="rounded border border-black/10 px-2 py-0.5 dark:border-white/10">{t.side}</span>
                <span>
                  {new Date(t.entry_ts).toLocaleString()} → {new Date(t.exit_ts).toLocaleString()}
                </span>
                <span className={t.pl_pct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                  {t.pl_pct}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}


