import { ReactNode } from "react";

export function Card({
  title,
  children,
  footer,
}: {
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-black/10 bg-white/60 p-4 backdrop-blur dark:border-white/10 dark:bg-black/40">
      {title ? <h3 className="mb-3 text-sm font-semibold">{title}</h3> : null}
      <div>{children}</div>
      {footer ? <div className="mt-3 text-xs text-black/60 dark:text-white/60">{footer}</div> : null}
    </section>
  );
}


