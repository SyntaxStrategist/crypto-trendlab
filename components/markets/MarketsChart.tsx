"use client";
import { useEffect, useMemo, useState } from "react";
import { fetchOHLCV, type Candle } from "@/lib/api/ohlcv";
import { Card } from "@/components/ui/Card";

function useOHLCV(symbol: string) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ok"; candles5: Candle[]; candles15: Candle[] }
  >({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    fetchOHLCV(symbol, 200, controller.signal)
      .then((res) => setState({ status: "ok", candles5: res.timeframes["5m"], candles15: res.timeframes["15m"] }))
      .catch((e) => setState({ status: "error", message: String(e?.message || e) }));
    return () => controller.abort();
  }, [symbol]);

  return state;
}

function LineChart({ data, className }: { data: Candle[]; className?: string }) {
  const { path, viewBox } = useMemo(() => {
    const width = 720;
    const height = 200;
    if (!data || data.length === 0) return { path: "", viewBox: `0 0 ${width} ${height}` };
    const xs = data.map((d) => d.t);
    const ys = data.map((d) => d.c);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const dx = maxX - minX || 1;
    const dy = maxY - minY || 1;
    const points = data.map((d) => {
      const x = ((d.t - minX) / dx) * (width - 20) + 10;
      const y = height - (((d.c - minY) / dy) * (height - 20) + 10);
      return [x, y] as const;
    });
    const dpath = points.map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`)).join(" ");
    return { path: dpath, viewBox: `0 0 ${width} ${height}` };
  }, [data]);

  return (
    <svg viewBox={viewBox} className={className ?? "w-full h-52"}>
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function MarketsChart({ symbol = "BTC/USDT" }: { symbol?: string }) {
  const state = useOHLCV(symbol);
  if (state.status === "loading") {
    return (
      <Card title={`OHLCV ${symbol}`}>
        <div className="h-52 animate-pulse rounded-md bg-black/5 dark:bg-white/10" />
      </Card>
    );
  }
  if (state.status === "error") {
    return (
      <Card title={`OHLCV ${symbol}`}>
        <div className="text-sm text-red-600 dark:text-red-400">Failed to load: {state.message}</div>
      </Card>
    );
  }
  return (
    <div className="space-y-6">
      <Card title={`${symbol} — 5m`}>
        <LineChart data={state.candles5} />
      </Card>
      <Card title={`${symbol} — 15m`}>
        <LineChart data={state.candles15} />
      </Card>
    </div>
  );
}


