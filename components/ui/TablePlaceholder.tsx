export function TablePlaceholder() {
  return (
    <div className="w-full overflow-hidden rounded-md border border-black/10 dark:border-white/10">
      <div className="grid grid-cols-5 bg-black/5 p-3 text-xs font-semibold dark:bg-white/10">
        <div>Asset</div>
        <div>Price</div>
        <div>24h %</div>
        <div>Market Cap</div>
        <div>Volume</div>
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-5 border-t border-black/10 p-3 text-sm dark:border-white/10"
        >
          <div className="text-black/70 dark:text-white/70">BTC</div>
          <div>$66,000</div>
          <div className="text-emerald-600 dark:text-emerald-400">+2.3%</div>
          <div>$1.2T</div>
          <div>$18B</div>
        </div>
      ))}
    </div>
  );
}


