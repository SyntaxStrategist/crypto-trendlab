import { Card } from "@/components/ui/Card";
import { ChartPlaceholder } from "@/components/ui/ChartPlaceholder";
import { TablePlaceholder } from "@/components/ui/TablePlaceholder";

export default function DashboardPage() {
  return (
    <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-3">
      <div className="md:col-span-2">
        <Card title="Overview">
          <ChartPlaceholder />
        </Card>
      </div>
      <div className="md:col-span-1 space-y-6">
        <Card title="Top Movers">
          <ul className="space-y-2 text-sm">
            <li>BTC +2.3%</li>
            <li>ETH +1.1%</li>
            <li>SOL -0.8%</li>
          </ul>
        </Card>
        <Card title="News">
          <ul className="list-inside list-disc text-sm text-black/80 dark:text-white/80">
            <li>Placeholder news item one</li>
            <li>Placeholder news item two</li>
            <li>Placeholder news item three</li>
          </ul>
        </Card>
      </div>
      <div className="md:col-span-3">
        <Card title="Market Snapshot">
          <TablePlaceholder />
        </Card>
      </div>
    </div>
  );
}


