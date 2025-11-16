"use client";
import { useEffect, useState } from "react";
import { fetchHealth } from "@/lib/api/health";

export type HealthState =
  | { status: "loading" }
  | { status: "ok" }
  | { status: "error"; message: string };

export function useHealthStatus(): HealthState {
  const [state, setState] = useState<HealthState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    fetchHealth(controller.signal)
      .then(() => setState({ status: "ok" }))
      .catch((err) => setState({ status: "error", message: String(err?.message || err) }));
    return () => controller.abort();
  }, []);

  return state;
}


