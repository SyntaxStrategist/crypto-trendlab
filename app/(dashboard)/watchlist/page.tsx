import { Card } from "@/components/ui/Card";

export default function WatchlistPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <h1 className="text-xl font-semibold">Watchlist</h1>
      <Card>
        <p className="text-sm text-black/70 dark:text-white/70">
          Add your favorite assets to keep track of them here.
        </p>
      </Card>
    </div>
  );
}


