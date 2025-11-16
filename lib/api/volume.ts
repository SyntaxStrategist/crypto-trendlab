export type VolumeSignal =
  | { type: "climax" | "ignition"; timeframe: "5m" | "15m"; ts: number; rv?: number; dir: "up" | "down" | "flat" }
  | { type: "accumulation" | "distribution"; timeframe: "5m" | "15m"; ts: number; count: number; score: number };

export type VolumeResponse = {
  exchange: "coinbase";
  symbol: string;
  signals: VolumeSignal[];
  meta: { generated_at: string; count_5m: number; count_15m: number };
};

function getBackendBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!url) throw new Error("NEXT_PUBLIC_BACKEND_URL not set");
  return url.replace(/\/+$/, "");
}

export async function fetchVolume(symbol: string, limit = 200, signal?: AbortSignal): Promise<VolumeResponse> {
  const base = getBackendBaseUrl();
  const url = new URL(`${base}/api/v1/volume`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("limit", String(limit));
  const res = await fetch(url.toString(), { signal, cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Volume failed: ${res.status} ${text}`);
  }
  return res.json();
}


