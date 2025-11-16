"use client";
import { useEffect, useRef } from "react";
import { createChart, ColorType, type IChartApi, type Time } from "lightweight-charts";
import { fetchOHLCV } from "@/lib/api/ohlcv";
import { fetchVolume } from "@/lib/api/volume";
import { fetchTrend } from "@/lib/api/trend";
import { fetchSignal } from "@/lib/api/signal";
import { computeEMA, mapCandlesForChart } from "@/lib/chart/indicators";
import { useChartSettings } from "@/components/charts/useChartSettings";

type Props = {
  symbol: string;
  timeframe?: "5m" | "15m";
  className?: string;
};

export function TVChart({ symbol, timeframe = "5m", className }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [settings] = useChartSettings();

  useEffect(() => {
    if (!containerRef.current) return;
    const prefersDark =
      typeof window !== "undefined" &&
      (window.matchMedia?.("(prefers-color-scheme: dark)").matches ||
        document.documentElement.classList.contains("dark"));
    const styles = getComputedStyle(document.documentElement);
    const fgVar = styles.getPropertyValue("--color-foreground")?.trim();
    const textColor = fgVar && /^#|rgb|hsl/.test(fgVar) ? fgVar : prefersDark ? "#ededed" : "#171717";
    const gridColor = prefersDark ? "rgba(255,255,255,.15)" : "rgba(0,0,0,.15)";
    const borderColor = prefersDark ? "rgba(255,255,255,.15)" : "rgba(0,0,0,.15)";

    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor },
      grid: { vertLines: { color: gridColor }, horzLines: { color: gridColor } },
      rightPriceScale: { borderColor },
      timeScale: { borderColor, timeVisible: true, secondsVisible: false },
      crosshair: { mode: 1 },
      height: 360,
    });
    chartRef.current = chart;
    const candleSeries = chart.addCandlestickSeries();
    const ema20 = chart.addLineSeries({ color: "#22c55e", lineWidth: 2 });
    const ema50 = chart.addLineSeries({ color: "#3b82f6", lineWidth: 2 });
    const ema200 = chart.addLineSeries({ color: "#ef4444", lineWidth: 2 });

    let disposed = false;

    async function loadAll() {
      try {
        const [ohlcv, trend, volume, signal] = await Promise.all([
          fetchOHLCV(symbol, 500),
          fetchTrend(symbol, 500),
          fetchVolume(symbol, 500),
          fetchSignal(symbol, 600).catch(() => null),
        ]);
        if (disposed) return;
        const candles = mapCandlesForChart(ohlcv.timeframes[timeframe]).map(c => ({
          time: c.time as unknown as Time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));
        candleSeries.setData(candles as any);

        // EMAs (optional)
        const closes = candles.map(c => c.close);
        const e20 = computeEMA(closes, 20).map((v, i) => ({ time: candles[i].time as Time, value: v }));
        const e50 = computeEMA(closes, 50).map((v, i) => ({ time: candles[i].time as Time, value: v }));
        const e200 = computeEMA(closes, 200).map((v, i) => ({ time: candles[i].time as Time, value: v }));
        if (settings.emas) {
          ema20.setData(e20.filter(p => !Number.isNaN(p.value)));
          ema50.setData(e50.filter(p => !Number.isNaN(p.value)));
          ema200.setData(e200.filter(p => !Number.isNaN(p.value)));
        } else {
          ema20.setData([]);
          ema50.setData([]);
          ema200.setData([]);
        }

        // Markers
        const markers: any[] = [];
        const vol = volume.signals.filter(s => s.timeframe === timeframe);
        if (settings.ignition || settings.climax) {
          for (const s of vol) {
            const isIgnition = s.type === "ignition";
            const isClimax = s.type === "climax";
            if ((isIgnition && settings.ignition) || (isClimax && settings.climax)) {
              markers.push({
                time: Math.floor(s.ts / 1000) as unknown as Time,
                position: isIgnition ? "aboveBar" : "belowBar",
                shape: isIgnition ? "arrowUp" : "arrowDown",
                color: isIgnition ? "#22c55e" : "#f59e0b",
                text: s.type,
              });
            }
          }
        }
        // BOS markers (trend endpoint signals)
        if (settings.bos) {
          const bos = trend.signals.filter(
            s => s.timeframe === timeframe && (s.type === "bos_up" || s.type === "bos_down")
          );
          for (const s of bos) {
            markers.push({
              time: Math.floor((trend.summary.last_ts_5m || trend.summary.last_ts_15m) / 1000) as unknown as Time,
              position: "inBar",
              shape: "circle",
              color: "#8b5cf6",
              text: s.type,
            });
          }
        }

        // Live signal arrow at last candle
        if (settings.signals && signal && signal.action && signal.action !== "hold") {
          const last = candles[candles.length - 1];
          const isBuy = signal.action === "buy";
          markers.push({
            time: last.time,
            position: isBuy ? "belowBar" : "aboveBar",
            shape: isBuy ? "arrowUp" : "arrowDown",
            color: isBuy ? "#22c55e" : "#ef4444",
            text: `${signal.action} (${signal.fusion_grade})`,
          });
        }
        candleSeries.setMarkers(markers);
        chart.timeScale().fitContent();
      } catch (e) {
        // ignore
      }
    }

    loadAll();
    const iv = setInterval(async () => {
      if (disposed) return;
      await loadAll();
    }, 3000);

    const resize = () => {
      if (!containerRef.current || !chartRef.current) return;
      const width = containerRef.current.clientWidth;
      chartRef.current.applyOptions({ width });
      chartRef.current.timeScale().fitContent();
    };
    resize();
    window.addEventListener("resize", resize);

    return () => {
      disposed = true;
      window.removeEventListener("resize", resize);
      clearInterval(iv);
      chart.remove();
      chartRef.current = null;
    };
  }, [symbol, timeframe, settings]);

  return <div ref={containerRef} className={className ?? "w-full h-[360px]"} />;
}


