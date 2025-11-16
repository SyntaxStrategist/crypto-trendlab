import { fetchSignal, type SignalResponse } from "@/lib/api/signal";
import { fetchOHLCV } from "@/lib/api/ohlcv";

export type TradePlanSide = "long" | "short" | "none";

export type TradePlan = {
  side: TradePlanSide;
  entry: number;
  tp: number;
  sl: number;
  rr: number;
  validCandles: number;
  lastClose: number;
  signal: SignalResponse;
};

export async function fetchTradePlan(
  symbol: string,
  validCandles = 8,
  signalAbort?: AbortSignal
): Promise<TradePlan | null> {
  const [signal, ohlcv] = await Promise.all([
    fetchSignal(symbol, 600, signalAbort),
    fetchOHLCV(symbol, 200, signalAbort),
  ]);

  if (signal.action === "hold") return null;

  const candles5 = ohlcv.timeframes["5m"];
  if (!candles5 || candles5.length === 0) return null;
  const last = candles5[candles5.length - 1];
  const entry = last.c;

  let side: TradePlanSide;
  let tp: number;
  let sl: number;

  if (signal.action === "buy") {
    side = "long";
    tp = entry * 1.02;
    sl = entry * 0.99;
  } else if (signal.action === "sell") {
    side = "short";
    tp = entry * 0.98;
    sl = entry * 1.01;
  } else {
    side = "none";
    tp = entry;
    sl = entry;
  }

  let rr = 0;
  if (side === "long") {
    rr = (tp - entry) / (entry - sl || 1e-8);
  } else if (side === "short") {
    rr = (entry - tp) / (sl - entry || 1e-8);
  }

  return {
    side,
    entry,
    tp,
    sl,
    rr,
    validCandles: validCandles,
    lastClose: entry,
    signal,
  };
}


