"use client";
import { useEffect, useState } from "react";

export type ChartSettings = {
  emas: boolean;
  bos: boolean;
  ignition: boolean;
  climax: boolean;
  signals: boolean;
};

const STORAGE_KEY = "chart_settings";

const defaultSettings: ChartSettings = {
  emas: true,
  bos: true,
  ignition: true,
  climax: true,
  signals: true,
};

export function useChartSettings(): [ChartSettings, (partial: Partial<ChartSettings>) => void] {
  const [settings, setSettings] = useState<ChartSettings>(defaultSettings);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<ChartSettings>;
      setSettings({ ...defaultSettings, ...parsed });
    } catch {
      // ignore parse errors
    }
  }, []);

  const update = (partial: Partial<ChartSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
  };

  return [settings, update];
}


