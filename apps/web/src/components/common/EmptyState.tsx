import type { ReactNode } from "react";

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-ink-900/15 px-6 py-12 text-center">
      <h3 className="font-heading text-base font-semibold text-ink-900">{title}</h3>
      <p className="max-w-sm text-sm text-ink-600">{body}</p>
      {action}
    </div>
  );
}
