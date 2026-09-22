import { AlertCircle, Inbox, Loader2 } from "lucide-react";

export function LoadingState({ label = "Loading..." }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2.5 py-6 text-sm text-zinc-600"
    >
      <Loader2 className="h-4 w-4 animate-spin text-zinc-800" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ message = "Nothing to show yet." }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="rounded-full bg-zinc-100 p-3 text-zinc-400">
        <Inbox className="h-5 w-5" />
      </div>
      <p className="mt-3 text-sm font-medium text-zinc-600">{message}</p>
    </div>
  );
}

export function ErrorState({ message = "Something went wrong." }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 p-3.5 text-sm text-red-800"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
      <span className="leading-snug">{message}</span>
    </div>
  );
}
