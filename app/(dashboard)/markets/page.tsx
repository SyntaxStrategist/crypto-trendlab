import { Card } from "@/components/ui/Card";
import { TablePlaceholder } from "@/components/ui/TablePlaceholder";
import { MarketsChart } from "@/components/markets/MarketsChart";
import { TrendPanel } from "@/components/markets/TrendPanel";

export default function MarketsPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <h1 className="text-xl font-semibold">Markets</h1>
      <MarketsChart symbol="BTC/USDT" />
      <TrendPanel symbol="BTC/USDT" />
      <Card>
        <TablePlaceholder />
      </Card>
    </div>
  );
}


