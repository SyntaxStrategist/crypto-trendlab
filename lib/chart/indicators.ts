export type PriceBar = { time: number; open: number; high: number; low: number; close: number; volume?: number };

export function computeEMA(values: number[], period: number): number[] {
	if (values.length === 0) return [];
	const k = 2 / (period + 1);
	const ema: number[] = new Array(values.length).fill(NaN);
	let sum = 0;
	for (let i = 0; i < values.length; i++) {
		const v = values[i];
		if (i < period) {
			sum += v;
			if (i === period - 1) {
				ema[i] = sum / period;
			}
		} else {
			ema[i] = v * k + ema[i - 1] * (1 - k);
		}
	}
	return ema;
}

export function mapCandlesForChart(candles: Array<{ t: number; o: number; h: number; l: number; c: number; v?: number }>): PriceBar[] {
	return candles.map(c => ({
		time: Math.floor(c.t / 1000),
		open: c.o,
		high: c.h,
		low: c.l,
		close: c.c,
		volume: c.v,
	}));
}


