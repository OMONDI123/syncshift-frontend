import type { AssignmentCheck } from "@/types";
import { CheckIcon, AlertTriangleIcon, XIcon } from "@/components/icons/Icon";

export function ConstraintExplainer({
  check,
  onPickSuggestion,
}: {
  check: AssignmentCheck;
  onPickSuggestion?: (userId: string) => void;
}) {
  if (check.violations.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-card bg-signal-greenBg px-3 py-2 text-sm font-medium text-signal-green">
        <CheckIcon size={15} /> No scheduling conflicts.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {check.violations.map((v, i) => (
        <div
          key={i}
          className={`flex items-start gap-2 rounded-card px-3 py-2 text-sm ${
            v.severity === "block" ? "bg-signal-redBg text-signal-red" : "bg-signal-amberBg text-signal-amber"
          }`}
        >
          <span className="mt-0.5 shrink-0">
            {v.severity === "block" ? <XIcon size={15} /> : <AlertTriangleIcon size={15} />}
          </span>
          <span>{v.message}</span>
        </div>
      ))}

      {check.suggestions.length > 0 && (
        <div className="rounded-card border border-ink-900/10 bg-paper-50 p-3">
          <p className="mb-2 text-sm font-semibold text-ink-900">Try instead</p>
          <ul className="space-y-1.5">
            {check.suggestions.map((s) => (
              <li key={s.userId}>
                <button
                  onClick={() => onPickSuggestion?.(s.userId)}
                  className="text-sm font-medium text-navy-800 underline-offset-2 hover:underline"
                >
                  {s.reason}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
