import { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

/* Standardised confirmation dialog for destructive / sensitive actions
   (delete, cancel, deactivate). Runs an async action, surfaces the backend
   message verbatim on failure, and shows a loading state while working. */
export default function ConfirmModal({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  action,
  onCancel,
  onDone,
}) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape" && !working) onCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onCancel, working]);

  const handleConfirm = async () => {
    setWorking(true);
    setError(null);
    try {
      await action();
      onDone();
    } catch (err) {
      setError(err.message || "The request could not be completed.");
      setWorking(false);
    }
  };

  const confirmCls =
    tone === "warning"
      ? "bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-600"
      : "bg-red-600 hover:bg-red-700 focus-visible:ring-red-600";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !working) onCancel();
      }}
    >
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6">
        <h2 id="confirm-modal-title" className="text-base font-semibold text-zinc-900">
          {title}
        </h2>
        <div className="mt-2 text-sm text-zinc-600">{message}</div>
        {error && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={working}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={working}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 ${confirmCls}`}
          >
            {working && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {working ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
