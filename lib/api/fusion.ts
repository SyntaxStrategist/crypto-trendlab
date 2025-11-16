export type Fusion = {
  score: number;
  grade: "A+" | "A" | "B" | "C" | "none";
  direction: "long" | "short" | "none";
  confidence: number; // 0-100
  reasoning: string;
};

export type FusionResponse = {
  exchange: "coinbase";
  symbol: string;
  fusion: Fusion;
  summary: { trend: string; trend_5m: string; trend_15m: string };
  meta: { generated_at: string; count_5m: number; count_15m: number };
};

function getBackendBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!url) throw new Error("NEXT_PUBLIC_BACKEND_URL not set");
  return url.replace(/\/+$/, "");
}

export async function fetchFusion(symbol: string, limit = 200, signal?: AbortSignal): Promise<FusionResponse> {
  const base = getBackendBaseUrl();
  const url = new URL(`${base}/api/v1/fusion`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("limit", String(limit));
  const res = await fetch(url.toString(), { signal, cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Fusion failed: ${res.status} ${text}`);
  }
  return res.json();
}


