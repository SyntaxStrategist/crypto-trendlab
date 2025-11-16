import { Card } from "@/components/ui/Card";
import { TablePlaceholder } from "@/components/ui/TablePlaceholder";
import { MarketsChart } from "@/components/markets/MarketsChart";
import { TrendPanel } from "@/components/markets/TrendPanel";
import { VolumePanel } from "@/components/markets/VolumePanel";
import { FusionPanel } from "@/components/markets/FusionPanel";
import { BacktestPanel } from "@/components/markets/BacktestPanel";
import { LearningPanel } from "@/components/markets/LearningPanel";
import { SignalPanel } from "@/components/markets/SignalPanel";
import { TradePlanPanel } from "@/components/markets/TradePlanPanel";
import { ChartSettingsPanel } from "@/components/markets/ChartSettingsPanel";

export default function MarketsPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <h1 className="text-xl font-semibold">Markets</h1>
      <SignalPanel symbol="BTC/USDT" />
      <TradePlanPanel symbol="BTC/USDT" />
      <ChartSettingsPanel />
      <MarketsChart symbol="BTC/USDT" />
      <TrendPanel symbol="BTC/USDT" />
      <VolumePanel symbol="BTC/USDT" />
      <FusionPanel symbol="BTC/USDT" />
      <BacktestPanel symbol="BTC/USDT" />
      <LearningPanel symbol="BTC/USDT" />
      <Card>
        <TablePlaceholder />
      </Card>
    </div>
  );
}


