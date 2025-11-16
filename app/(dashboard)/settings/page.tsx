import { Card } from "@/components/ui/Card";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>
      <Card title="Preferences">
        <div className="space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <span>Theme</span>
            <span className="rounded-md border border-black/10 px-2 py-1 text-xs dark:border-white/10">
              System
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Currency</span>
            <span className="rounded-md border border-black/10 px-2 py-1 text-xs dark:border-white/10">
              USD
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}


