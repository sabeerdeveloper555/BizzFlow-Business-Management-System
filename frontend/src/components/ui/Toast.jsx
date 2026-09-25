import { useEffect } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

/* Lightweight transient notification, auto-dismissed after a short delay.
   Success is neutral/dark; error is red. Includes an icon so meaning never
   relies on colour alone. */
export default function Toast({ message, type = "success", onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3500);
    return () => clearTimeout(timer);
  }, [onDismiss, message]);

  const isSuccess = type !== "error";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-5 right-5 z-[60] flex max-w-[calc(100vw-2.5rem)] items-center gap-2.5 rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${
        isSuccess ? "bg-zinc-900 text-white" : "border border-red-200 bg-red-50 text-red-800"
      }`}
    >
      {isSuccess ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
      ) : (
        <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      <span>{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="ml-1 opacity-60 hover:opacity-100 focus:outline-none"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
