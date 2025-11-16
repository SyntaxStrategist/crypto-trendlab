export type ForwardTestRun = {
  id: number;
  symbol: string;
  start_time: string;
  end_time: string | null;
  is_active: boolean;
  summary: string | null;
};

export type ForwardTestTrade = {
  id: number;
  direction: "long" | "short";
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  exit_price?: number | null;
  exit_reason?: string | null;
  r_multiple?: number | null;
  profit_loss?: number | null;
  drawdown?: number | null;
  candle_time: string;
};

export type ForwardTestStatus = {
  run: ForwardTestRun;
  open_trades: ForwardTestTrade[];
  recent_trades: ForwardTestTrade[];
};

export type ForwardTestTradesResponse = {
  trades: ForwardTestTrade[];
};

function getBackendBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!url) throw new Error("NEXT_PUBLIC_BACKEND_URL not set");
  return url.replace(/\/+$/, "");
}

export async function startForwardTest(symbol: string): Promise<ForwardTestRun> {
  const base = getBackendBaseUrl();
  const res = await fetch(`${base}/api/v1/forward-test/start?symbol=${encodeURIComponent(symbol)}`, {
    method: "POST",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Start forward test failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function fetchForwardTestStatus(testRunId: number): Promise<ForwardTestStatus> {
  const base = getBackendBaseUrl();
  const res = await fetch(`${base}/api/v1/forward-test/status?test_run_id=${testRunId}`, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Forward test status failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function fetchForwardTestTrades(testRunId: number, signal?: AbortSignal): Promise<ForwardTestTradesResponse> {
  const base = getBackendBaseUrl();
  const res = await fetch(`${base}/api/v1/forward-test/trades?test_run_id=${testRunId}`, {
    cache: "no-store",
    signal,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Forward test trades failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function downloadForwardTestCsv(testRunId: number): Promise<Blob> {
  const base = getBackendBaseUrl();
  const res = await fetch(`${base}/api/v1/forward-test/export?test_run_id=${testRunId}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Forward test export failed: ${res.status} ${text}`);
  }
  return res.blob();
}


