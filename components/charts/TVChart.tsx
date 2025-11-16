"use client";
import { useEffect, useMemo, useRef } from "react";
import { createChart, ColorType, type IChartApi, type Time } from "lightweight-charts";
import { fetchOHLCV } from "@/lib/api/ohlcv";
import { fetchVolume } from "@/lib/api/volume";
import { fetchTrend } from "@/lib/api/trend";
import { fetchSignal } from "@/lib/api/signal";
import { computeEMA, mapCandlesForChart } from "@/lib/chart/indicators";

type Props = {
  symbol: string;
  timeframe?: "5m" | "15m";
  className?: string;
};

export function TVChart({ symbol, timeframe = "5m", className }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "var(--color-foreground)" },
      grid: { vertLines: { color: "rgba(0,0,0,.1)" }, horzLines: { color: "rgba(0,0,0,.1)" } },
      rightPriceScale: { borderColor: "rgba(0,0,0,.1)" },
      timeScale: { borderColor: "rgba(0,0,0,.1)", timeVisible: true, secondsVisible: false },
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

        // EMAs
        const closes = candles.map(c => c.close);
        const e20 = computeEMA(closes, 20).map((v, i) => ({ time: candles[i].time as Time, value: v }));
        const e50 = computeEMA(closes, 50).map((v, i) => ({ time: candles[i].time as Time, value: v }));
        const e200 = computeEMA(closes, 200).map((v, i) => ({ time: candles[i].time as Time, value: v }));
        ema20.setData(e20.filter(p => !Number.isNaN(p.value)));
        ema50.setData(e50.filter(p => !Number.isNaN(p.value)));
        ema200.setData(e200.filter(p => !Number.isNaN(p.value)));

        // Markers: ignition & climax
        const markers: any[] = [];
        const vol = volume.signals.filter(s => s.timeframe === timeframe);
        for (const s of vol) {
          if (s.type === "ignition" || s.type === "climax") {
            markers.push({
            time: Math.floor(s.ts / 1000) as unknown as Time,
              position: s.type === "ignition" ? "aboveBar" : "belowBar",
              shape: s.type === "ignition" ? "arrowUp" : "arrowDown",
              color: s.type === "ignition" ? "#22c55e" : "#f59e0b",
              text: s.type,
            });
          }
        }
        // BOS markers (trend endpoint signals)
        const bos = trend.signals.filter(s => s.timeframe === timeframe && (s.type === "bos_up" || s.type === "bos_down"));
        for (const s of bos) {
          markers.push({
            time: Math.floor((trend.summary.last_ts_5m || trend.summary.last_ts_15m) / 1000) as unknown as Time,
            position: "inBar",
            shape: "circle",
            color: "#8b5cf6",
            text: s.type,
          });
        }
        candleSeries.setMarkers(markers);

        // Live signal arrow at last candle
        if (signal && signal.action && signal.action !== "hold") {
          const last = candles[candles.length - 1];
          const isBuy = signal.action === "buy";
          candleSeries.setMarkers([
            ...(markers || []),
            {
              time: last.time,
              position: isBuy ? "belowBar" : "aboveBar",
              shape: isBuy ? "arrowUp" : "arrowDown",
              color: isBuy ? "#22c55e" : "#ef4444",
              text: `${signal.action} (${signal.fusion_grade})`,
            },
          ]);
        }
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
  }, [symbol, timeframe]);

  return <div ref={containerRef} className={className ?? "w-full h-[360px]"} />;
}


