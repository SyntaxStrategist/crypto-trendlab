export type LearningResponse = {
  exchange: "coinbase";
  symbol: string;
  updated_weights: Record<string, number>;
  feature_ranking: Array<{ feature: string; effectiveness: number; hits: number }>;
  formula_preview: string;
  meta: { generated_at: string; horizon_bars: number; samples: number };
};

function getBackendBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!url) throw new Error("NEXT_PUBLIC_BACKEND_URL not set");
  return url.replace(/\/+$/, "");
}

export async function fetchLearning(symbol: string, limit = 1200, signal?: AbortSignal): Promise<LearningResponse> {
  const base = getBackendBaseUrl();
  const url = new URL(`${base}/api/v1/learning`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("limit", String(limit));
  const res = await fetch(url.toString(), { signal, cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Learning failed: ${res.status} ${text}`);
  }
  return res.json();
}


