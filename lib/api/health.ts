export type HealthResponse = { status: "ok" } | Record<string, unknown>;

export function getBackendBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!url) {
    return "";
  }
  return url.replace(/\/+$/, "");
}

export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_BACKEND_URL not set");
  }
  const res = await fetch(`${baseUrl}/health`, { signal, cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Health check failed: ${res.status}`);
  }
  return res.json();
}


