export type TrendSummary = {
  trend: "uptrend" | "downtrend" | "sideways" | "unknown";
  trend_5m: string;
  trend_15m: string;
  last_ts_5m: number;
  last_ts_15m: number;
};

export type TrendSignal = {
  type: "ema_cross_up" | "ema_cross_down" | "bos_up" | "bos_down";
  a?: number;
  b?: number;
  timeframe: "5m" | "15m";
};

export type TrendResponse = {
  exchange: "coinbase";
  symbol: string;
  summary: TrendSummary;
  signals: TrendSignal[];
  meta: { generated_at: string; count_5m: number; count_15m: number };
};

function getBackendBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!url) throw new Error("NEXT_PUBLIC_BACKEND_URL not set");
  return url.replace(/\/+$/, "");
}

export async function fetchTrend(symbol: string, limit = 200, signal?: AbortSignal): Promise<TrendResponse> {
  const base = getBackendBaseUrl();
  const url = new URL(`${base}/api/v1/trend`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("limit", String(limit));
  const res = await fetch(url.toString(), { signal, cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Trend failed: ${res.status} ${text}`);
  }
  return res.json();
}


