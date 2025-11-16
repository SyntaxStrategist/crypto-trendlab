"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { fetchLearning, type LearningResponse } from "@/lib/api/learning";

export function LearningPanel({ symbol }: { symbol: string }) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ok"; data: LearningResponse }
  >({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    fetchLearning(symbol, 1200, controller.signal)
      .then((data) => setState({ status: "ok", data }))
      .catch((e) => setState({ status: "error", message: String(e?.message || e) }));
    return () => controller.abort();
  }, [symbol]);

  if (state.status === "loading") {
    return (
      <Card title="Learning">
        <div className="h-24 animate-pulse rounded-md bg-black/5 dark:bg-white/10" />
      </Card>
    );
  }
  if (state.status === "error") {
    return (
      <Card title="Learning">
        <div className="text-sm text-red-600 dark:text-red-400">Failed to load: {state.message}</div>
      </Card>
    );
  }

  const { updated_weights, feature_ranking, formula_preview, meta } = state.data;
  const entries = Object.entries(updated_weights);

  return (
    <Card title="Learning">
      <div className="space-y-4 text-sm">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="mb-2 text-xs font-semibold text-black/70 dark:text-white/70">Optimized weights</div>
            <ul className="space-y-1">
              {entries.map(([k, v]) => (
                <li key={k} className="flex items-center justify-between">
                  <span className="text-black/70 dark:text-white/70">{k}</span>
                  <span className="rounded border border-black/10 px-2 py-0.5 dark:border-white/10">{v}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="mb-2 text-xs font-semibold text-black/70 dark:text-white/70">Feature effectiveness</div>
            <ul className="space-y-1">
              {feature_ranking.slice(0, 8).map((r) => (
                <li key={r.feature} className="flex items-center justify-between">
                  <span>{r.feature}</span>
                  <span className="text-black/60 dark:text-white/60">
                    eff {r.effectiveness} · n={r.hits}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="text-xs text-black/60 dark:text-white/60">
          Preview: {formula_preview}
        </div>
        <div className="text-xs text-black/50 dark:text-white/50">
          Samples: {meta.samples} · Horizon: {meta.horizon_bars} bars · Updated: {new Date(meta.generated_at).toLocaleString()}
        </div>
      </div>
    </Card>
  );
}


