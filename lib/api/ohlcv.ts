export type Candle = { t: number; iso: string; o: number; h: number; l: number; c: number; v: number };
export type OHLCVResponse = {
  exchange: "coinbase";
  symbol: string;
  normalized_symbol?: string;
  timeframes: {
    "5m": Candle[];
    "15m": Candle[];
  };
};

function getBackendBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!url) throw new Error("NEXT_PUBLIC_BACKEND_URL not set");
  return url.replace(/\/+$/, "");
}

export async function fetchOHLCV(symbol: string, limit = 200, signal?: AbortSignal): Promise<OHLCVResponse> {
  const base = getBackendBaseUrl();
  const url = new URL(`${base}/api/v1/ohlcv`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("limit", String(limit));
  const res = await fetch(url.toString(), { signal, cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OHLCV failed: ${res.status} ${text}`);
  }
  return res.json();
}


