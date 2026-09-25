import { useEffect } from "react";
import { X } from "lucide-react";

/* Standardised modal: neutral backdrop, responsive bottom-sheet on mobile that
   becomes a centred dialog on larger screens, clean header with close control,
   scrollable body and an optional sticky footer. Closes on Escape and backdrop
   click unless `locked` (e.g. while a request is in flight). */
const SIZES = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-xl",
  "2xl": "sm:max-w-2xl",
};

export default function Modal({
  title,
  titleId,
  onClose,
  size = "lg",
  footer,
  locked = false,
  children,
}) {
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape" && !locked) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, locked]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget && !locked) onClose();
      }}
    >
      <div
        className={`flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-xl border border-zinc-200 bg-white sm:rounded-xl ${SIZES[size] ?? SIZES.lg}`}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <h2 id={titleId} className="text-base font-semibold text-zinc-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={locked}
            aria-label="Close dialog"
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:opacity-60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-zinc-100 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
