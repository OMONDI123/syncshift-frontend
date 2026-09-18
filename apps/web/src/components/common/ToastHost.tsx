import { useUiStore } from "@/store/uiStore";
import { XIcon } from "@/components/icons/Icon";

const toneStyles = {
  success: "bg-signal-green text-white",
  error: "bg-signal-red text-white",
  info: "bg-navy-950 text-white",
};

export function ToastHost() {
  const toasts = useUiStore((s) => s.toasts);
  const dismissToast = useUiStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto flex items-center gap-3 rounded-card px-4 py-3 text-sm font-medium shadow-lg ${toneStyles[t.tone]}`}
        >
          {t.message}
          <button
            onClick={() => dismissToast(t.id)}
            aria-label="Dismiss"
            className="text-white/70 hover:text-white"
          >
            <XIcon size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
