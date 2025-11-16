"use client";
import { Card } from "@/components/ui/Card";
import { TVChart } from "@/components/charts/TVChart";

export function MarketsChart({ symbol = "BTC/USDT" }: { symbol?: string }) {
  return (
    <div className="space-y-6">
      <Card title={`${symbol} — 5m`}>
        <TVChart symbol={symbol} timeframe="5m" />
      </Card>
      <Card title={`${symbol} — 15m`}>
        <TVChart symbol={symbol} timeframe="15m" />
      </Card>
    </div>
  );
}


