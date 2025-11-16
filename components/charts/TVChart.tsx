"use client";
import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, type IChartApi, type Time } from "lightweight-charts";
import { fetchOHLCV } from "@/lib/api/ohlcv";
import { fetchVolume } from "@/lib/api/volume";
import { fetchTrend } from "@/lib/api/trend";
import { fetchSignal } from "@/lib/api/signal";
import { computeEMA, mapCandlesForChart } from "@/lib/chart/indicators";
import { useChartSettings } from "@/components/charts/useChartSettings";
import { fetchForwardTestTrades, type ForwardTestTradesResponse } from "@/lib/api/forwardTest";

type Props = {
  symbol: string;
  timeframe?: "5m" | "15m";
  className?: string;
};

export function TVChart({ symbol, timeframe = "5m", className }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ReturnType<IChartApi["addCandlestickSeries"]> | null>(null);
  const ema20Ref = useRef<ReturnType<IChartApi["addLineSeries"]> | null>(null);
  const ema50Ref = useRef<ReturnType<IChartApi["addLineSeries"]> | null>(null);
  const ema200Ref = useRef<ReturnType<IChartApi["addLineSeries"]> | null>(null);
  const dataRef = useRef<{
    candles: any[];
    trend: any;
    volume: any;
    signal: any;
  } | null>(null);
  const [settings] = useChartSettings();
  const [effectiveSymbol, setEffectiveSymbol] = useState<string>(symbol);
  const [dataVersion, setDataVersion] = useState(0); // Trigger overlay updates when data loads

  // Initialize chart (runs once)
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
    candleSeriesRef.current = chart.addCandlestickSeries();
    ema20Ref.current = chart.addLineSeries({ color: "#22c55e", lineWidth: 2 });
    ema50Ref.current = chart.addLineSeries({ color: "#3b82f6", lineWidth: 2 });
    ema200Ref.current = chart.addLineSeries({ color: "#ef4444", lineWidth: 2 });

    const resize = () => {
      if (!containerRef.current || !chartRef.current) return;
      const width = containerRef.current.clientWidth;
      chartRef.current.applyOptions({ width });
      chartRef.current.timeScale().fitContent();
    };
    resize();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      if (chartRef.current) {
        chartRef.current.remove();
      }
      chartRef.current = null;
      candleSeriesRef.current = null;
      ema20Ref.current = null;
      ema50Ref.current = null;
      ema200Ref.current = null;
    };
  }, []);

  // Update overlays when settings change (runs immediately)
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current || !dataRef.current) return;

    const { candles, trend, volume, signal } = dataRef.current;
    const candleSeries = candleSeriesRef.current;
    const ema20 = ema20Ref.current;
    const ema50 = ema50Ref.current;
    const ema200 = ema200Ref.current;

    if (!ema20 || !ema50 || !ema200) return;

    // Update EMAs
    const closes = candles.map((c: any) => c.close);
    const e20 = computeEMA(closes, 20).map((v, i) => ({ time: candles[i].time as Time, value: v }));
    const e50 = computeEMA(closes, 50).map((v, i) => ({ time: candles[i].time as Time, value: v }));
    const e200 = computeEMA(closes, 200).map((v, i) => ({ time: candles[i].time as Time, value: v }));
    if (settings.emas) {
      ema20.setData(e20.filter((p) => !Number.isNaN(p.value)));
      ema50.setData(e50.filter((p) => !Number.isNaN(p.value)));
      ema200.setData(e200.filter((p) => !Number.isNaN(p.value)));
    } else {
      ema20.setData([]);
      ema50.setData([]);
      ema200.setData([]);
    }

    // Update markers
    const markers: any[] = [];
    const vol = volume.signals.filter((s: any) => s.timeframe === timeframe);
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
    // BOS markers
    if (settings.bos) {
      const bos = trend.signals.filter(
        (s: any) => s.timeframe === timeframe && (s.type === "bos_up" || s.type === "bos_down")
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
    // Live signal arrow
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
    // Forward test trade overlays (always show if available)
    try {
      if (typeof window !== "undefined") {
        const stored = window.localStorage.getItem("forward_test_run_id");
        const runId = stored ? Number(stored) : NaN;
        if (!Number.isNaN(runId)) {
          fetchForwardTestTrades(runId)
            .then((tradesRes: ForwardTestTradesResponse) => {
              if (!chartRef.current || !candleSeriesRef.current) return;
              const ftMarkers = [...markers];
              for (const t of tradesRes.trades) {
                const entryTime = Math.floor(new Date(t.candle_time).getTime() / 1000) as unknown as Time;
                ftMarkers.push({
                  time: entryTime,
                  position: t.direction === "long" ? "belowBar" : "aboveBar",
                  shape: t.direction === "long" ? "arrowUp" : "arrowDown",
                  color: t.direction === "long" ? "#22c55e" : "#ef4444",
                  text: `FT ${t.direction}`,
                });
                if (t.exit_price != null) {
                  const exitTime = entryTime;
                  const win = (t.profit_loss ?? 0) >= 0;
                  ftMarkers.push({
                    time: exitTime,
                    position: win ? "aboveBar" : "belowBar",
                    shape: win ? "circle" : "circle",
                    color: win ? "#22c55e" : "#ef4444",
                    text: t.exit_reason || "exit",
                  });
                }
              }
              candleSeriesRef.current.setMarkers(ftMarkers);
            })
            .catch(() => {
              // ignore forward-test overlay errors
              if (candleSeriesRef.current) {
                candleSeriesRef.current.setMarkers(markers);
              }
            });
        } else {
          candleSeries.setMarkers(markers);
        }
      } else {
        candleSeries.setMarkers(markers);
      }
    } catch {
      candleSeries.setMarkers(markers);
    }
  }, [settings, timeframe, dataVersion]);

  // Load and update data (runs on symbol/timeframe change and periodically)
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current) return;

    let disposed = false;

    async function loadAll() {
      try {
        const [ohlcv, trend, volume, signal] = await Promise.all([
          fetchOHLCV(effectiveSymbol, 500),
          fetchTrend(effectiveSymbol, 500),
          fetchVolume(effectiveSymbol, 500),
          fetchSignal(effectiveSymbol, 600).catch(() => null),
        ]);
        if (disposed) return;

        if (ohlcv.normalized_symbol && ohlcv.normalized_symbol !== effectiveSymbol) {
          setEffectiveSymbol(ohlcv.normalized_symbol);
        }
        const candles = mapCandlesForChart(ohlcv.timeframes[timeframe]).map(c => ({
          time: c.time as unknown as Time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));
        
        // Store data for overlay updates
        dataRef.current = { candles, trend, volume, signal };
        
        // Update candle data
        if (candleSeriesRef.current) {
          candleSeriesRef.current.setData(candles as any);
        }
        
        // Trigger overlay update by incrementing dataVersion
        setDataVersion((v) => v + 1);
        
        if (chartRef.current) {
          chartRef.current.timeScale().fitContent();
        }
      } catch (e) {
        // ignore
      }
    }

    loadAll();
    const iv = setInterval(async () => {
      if (disposed) return;
      await loadAll();
    }, 3000);

    return () => {
      disposed = true;
      clearInterval(iv);
    };
  }, [effectiveSymbol, timeframe]);

  return <div ref={containerRef} className={className ?? "w-full h-[360px]"} />;
}


