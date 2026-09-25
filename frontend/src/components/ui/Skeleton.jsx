import { Loader2 } from "lucide-react";

/* Reusable skeleton primitive for loading states — keeps layout stable while
   content resolves instead of swapping in a giant spinner or fake data. */
export default function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-md bg-zinc-200/70 ${className}`} aria-hidden="true" />;
}

/* Centred inline spinner used to fill the body of a data card while loading,
   so the card keeps its footprint and the layout does not jump. */
export function LoadingState({ label = "Loading…", className = "py-16" }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center justify-center gap-2.5 text-sm text-zinc-500 ${className}`}
    >
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

/* A simple multi-row skeleton used by the CRUD tables while loading. */
export function TableSkeleton({ rows = 5, className = "h-5 w-full" }) {
  return (
    <div className="space-y-3 p-5" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={className} />
      ))}
    </div>
  );
}
