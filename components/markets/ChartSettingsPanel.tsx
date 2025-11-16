"use client";
import { Card } from "@/components/ui/Card";
import { useChartSettings } from "@/components/charts/useChartSettings";

type ToggleProps = {
  label: string;
  checked: boolean;
  onChange: () => void;
};

function Toggle({ label, checked, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors ${
        checked
          ? "border-black/80 bg-black text-white dark:border-white/80 dark:bg-white dark:text-black"
          : "border-black/20 bg-transparent text-black/70 hover:border-black/40 dark:border-white/20 dark:text-white/70 dark:hover:border-white/40"
      }`}
    >
      <span
        className={`inline-flex h-3 w-3 items-center justify-center rounded-full text-[8px] ${
          checked ? "bg-emerald-500" : "bg-zinc-400"
        }`}
      />
      {label}
    </button>
  );
}

export function ChartSettingsPanel() {
  const [settings, update] = useChartSettings();

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="mr-2 font-medium text-black/70 dark:text-white/70">Chart Overlays:</span>
        <Toggle
          label="EMAs"
          checked={settings.emas}
          onChange={() => update({ emas: !settings.emas })}
        />
        <Toggle
          label="BOS"
          checked={settings.bos}
          onChange={() => update({ bos: !settings.bos })}
        />
        <Toggle
          label="Ignition"
          checked={settings.ignition}
          onChange={() => update({ ignition: !settings.ignition })}
        />
        <Toggle
          label="Climax"
          checked={settings.climax}
          onChange={() => update({ climax: !settings.climax })}
        />
        <Toggle
          label="Buy/Sell"
          checked={settings.signals}
          onChange={() => update({ signals: !settings.signals })}
        />
      </div>
    </Card>
  );
}


