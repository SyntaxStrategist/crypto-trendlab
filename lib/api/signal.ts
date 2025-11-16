export type SignalResponse = {
  exchange: "coinbase";
  symbol: string;
  action: "buy" | "sell" | "hold";
  confidence: number;
  fusion_grade: "A+" | "A" | "B" | "C" | "none";
  fusion_score: number;
  direction: "long" | "short" | "none";
  reasoning: string;
  weights: Record<string, number>;
  meta: { generated_at: string; count_5m: number; count_15m: number };
};

function getBackendBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!url) throw new Error("NEXT_PUBLIC_BACKEND_URL not set");
  return url.replace(/\/+$/, "");
}

export async function fetchSignal(symbol: string, limit = 600, signal?: AbortSignal): Promise<SignalResponse> {
  const base = getBackendBaseUrl();
  const url = new URL(`${base}/api/v1/signals`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("limit", String(limit));
  const res = await fetch(url.toString(), { signal, cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Signal failed: ${res.status} ${text}`);
  }
  return res.json();
}


