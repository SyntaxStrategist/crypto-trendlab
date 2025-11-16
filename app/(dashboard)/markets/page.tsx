import { Card } from "@/components/ui/Card";
import { TablePlaceholder } from "@/components/ui/TablePlaceholder";

export default function MarketsPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <h1 className="text-xl font-semibold">Markets</h1>
      <Card>
        <TablePlaceholder />
      </Card>
    </div>
  );
}


