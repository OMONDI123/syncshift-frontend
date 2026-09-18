import { useEffect, type ReactNode } from "react";
import { XIcon } from "@/components/icons/Icon";

export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy-950/40 px-4 py-8 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-lg rounded-card bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-ink-900/10 px-5 py-4">
          <h2 className="font-heading text-lg font-semibold text-ink-900">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-ink-400 hover:bg-paper-100 hover:text-ink-900"
          >
            <XIcon size={16} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-ink-900/10 px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}
