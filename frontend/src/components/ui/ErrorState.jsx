import { AlertCircle, RefreshCw } from "lucide-react";
import Button from "./Button.jsx";

/* Standardised error state for data regions. Shows a human-readable message
   and an optional retry action — never stack traces or raw objects. */
export default function ErrorState({ title = "Something went wrong", message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-500">
        <AlertCircle className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="mt-3 font-medium text-zinc-900">{title}</p>
      {message && <p className="mt-1 text-sm text-zinc-500">{message}</p>}
      {onRetry && (
        <Button variant="secondary" icon={RefreshCw} onClick={onRetry} className="mt-4">
          Retry
        </Button>
      )}
    </div>
  );
}
