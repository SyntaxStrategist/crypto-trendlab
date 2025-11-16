export function StatusBadge({ state }: { state: "loading" | "ok" | "error" }) {
  const color =
    state === "ok" ? "bg-emerald-500" : state === "error" ? "bg-red-500" : "bg-yellow-500";
  const label = state === "ok" ? "Backend: OK" : state === "error" ? "Backend: Error" : "Backend: Loading";
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-black/10 px-2 py-1 text-xs dark:border-white/10">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}


