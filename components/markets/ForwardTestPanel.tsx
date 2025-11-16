"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import {
  startForwardTest,
  fetchForwardTestStatus,
  downloadForwardTestCsv,
  type ForwardTestStatus,
} from "@/lib/api/forwardTest";

type Props = {
  symbol: string;
};

export function ForwardTestPanel({ symbol }: Props) {
  const [status, setStatus] = useState<ForwardTestStatus | null>(null);
  const [testRunId, setTestRunId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("forward_test_run_id") : null;
    if (stored) {
      const id = Number(stored);
      if (!Number.isNaN(id)) {
        setTestRunId(id);
      }
    }

    const poll = async () => {
      if (!testRunId) return;
      try {
        const s = await fetchForwardTestStatus(testRunId);
        if (!cancelled) {
          setStatus(s);
          if (!s.run.is_active) {
            // clear stored id when finished
            if (typeof window !== "undefined") {
              window.localStorage.removeItem("forward_test_run_id");
            }
          }
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(String(e?.message || e));
        }
      }
    };

    poll();
    const iv = setInterval(poll, 30000); // 30s poll while viewing
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [testRunId]);

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      const run = await startForwardTest(symbol);
      setTestRunId(run.id);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("forward_test_run_id", String(run.id));
      }
      const s = await fetchForwardTestStatus(run.id);
      setStatus(s);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!testRunId) return;
    try {
      const blob = await downloadForwardTestCsv(testRunId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `forward_test_${testRunId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(String(e?.message || e));
    }
  };

  const run = status?.run ?? null;

  return (
    <Card title="Forward Test Results">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm mb-3">
        <div className="space-y-1">
          <div className="font-medium">
            {run ? `Run #${run.id} — ${run.symbol}` : "No active run"}
          </div>
          {run && (
            <div className="text-xs text-black/60 dark:text-white/60">
              {run.is_active ? "Active" : "Finished"} · Started{" "}
              {new Date(run.start_time).toLocaleString()} · Ends{" "}
              {run.end_time ? new Date(run.end_time).toLocaleString() : "—"}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleStart}
            disabled={loading || (run?.is_active ?? false)}
            className="rounded-md border border-black/10 bg-black px-3 py-1 text-xs font-medium text-white hover:bg-black/80 disabled:opacity-60 dark:border-white/20 dark:bg-white dark:text-black dark:hover:bg-white/80"
          >
            {run?.is_active ? "Run Active" : "Start 5 Day Forward Test"}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={!testRunId}
            className="rounded-md border border-black/10 px-3 py-1 text-xs hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
          >
            Download CSV
          </button>
        </div>
      </div>
      {error && <div className="mb-3 text-xs text-red-600 dark:text-red-400">{error}</div>}
      {run && status && (
        <>
          {run.summary && (
            <div className="mb-3 text-xs text-black/70 dark:text-white/70">
              Summary: {run.summary}
            </div>
          )}
          <div className="mb-3 grid gap-3 md:grid-cols-3 text-sm">
            <div>
              <div className="text-xs text-black/60 dark:text-white/60">Open Trades</div>
              <div className="text-lg font-semibold">{status.open_trades.length}</div>
            </div>
            <div>
              <div className="text-xs text-black/60 dark:text-white/60">Recent Trades</div>
              <div className="text-lg font-semibold">{status.recent_trades.length}</div>
            </div>
            <div>
              <div className="text-xs text-black/60 dark:text-white/60">Status</div>
              <div className="text-lg font-semibold">
                {run.is_active ? "Running" : "Completed"}
              </div>
            </div>
          </div>
          <div className="mb-3">
            <div className="mb-1 text-xs font-semibold text-black/70 dark:text-white/70">
              Open positions
            </div>
            {status.open_trades.length === 0 ? (
              <div className="text-xs text-black/60 dark:text-white/60">No open trades</div>
            ) : (
              <ul className="space-y-1 text-xs">
                {status.open_trades.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-2">
                    <span className="rounded border border-black/10 px-2 py-0.5 dark:border-white/10">
                      {t.direction}
                    </span>
                    <span>Entry {t.entry_price.toFixed(2)}</span>
                    <span>SL {t.stop_loss.toFixed(2)}</span>
                    <span>TP {t.take_profit.toFixed(2)}</span>
                    <span className="text-black/50 dark:text-white/50">
                      {new Date(t.candle_time).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold text-black/70 dark:text-white/70">
              Recent trades
            </div>
            {status.recent_trades.length === 0 ? (
              <div className="text-xs text-black/60 dark:text-white/60">No closed trades yet</div>
            ) : (
              <ul className="space-y-1 text-xs">
                {status.recent_trades.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-2">
                    <span className="rounded border border-black/10 px-2 py-0.5 dark:border-white/10">
                      {t.direction}
                    </span>
                    <span>
                      {new Date(t.candle_time).toLocaleString()} →{" "}
                      {t.exit_price != null ? t.exit_price.toFixed(2) : "open"}
                    </span>
                    {t.profit_loss != null && (
                      <span
                        className={
                          t.profit_loss >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400"
                        }
                      >
                        {t.profit_loss.toFixed(2)}%
                      </span>
                    )}
                    {t.r_multiple != null && (
                      <span className="text-black/60 dark:text-white/60">
                        {t.r_multiple.toFixed(2)}R
                      </span>
                    )}
                    {t.exit_reason && (
                      <span className="text-black/50 dark:text-white/50">{t.exit_reason}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </Card>
  );
}


