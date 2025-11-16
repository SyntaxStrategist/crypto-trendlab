export type BacktestStats = {
  trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  pl_pct: number;
  profit_factor: number | null;
  max_drawdown_pct: number;
};

export type BacktestTrade = {
  side: "long" | "short";
  entry_ts: number;
  exit_ts: number;
  entry: number;
  exit: number;
  pl_pct: number;
};

export type BacktestResponse = {
  exchange: "coinbase";
  symbol: string;
  stats: BacktestStats;
  trades: BacktestTrade[];
  meta: { generated_at: string; count_5m: number; count_15m: number };
};

function getBackendBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!url) throw new Error("NEXT_PUBLIC_BACKEND_URL not set");
  return url.replace(/\/+$/, "");
}

export async function fetchBacktest(symbol: string, limit = 1500, signal?: AbortSignal): Promise<BacktestResponse> {
  const base = getBackendBaseUrl();
  const url = new URL(`${base}/api/v1/backtesting`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("limit", String(limit));
  const res = await fetch(url.toString(), { signal, cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Backtest failed: ${res.status} ${text}`);
  }
  return res.json();
}


