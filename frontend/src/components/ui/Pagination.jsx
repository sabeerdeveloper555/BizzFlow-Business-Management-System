import { ChevronLeft, ChevronRight } from "lucide-react";

/* Standard pagination footer. Shows the current range and total, plus
   previous / next controls that disable at the ends. */
export default function Pagination({ page, pageSize, total, totalPages, itemLabel = "items", onPageChange }) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-zinc-100 px-5 py-3.5 sm:flex-row">
      <p className="text-xs text-zinc-500">
        Showing{" "}
        <span className="font-medium text-zinc-700">
          {from}–{to}
        </span>{" "}
        of <span className="font-medium text-zinc-700">{total.toLocaleString()}</span> {itemLabel}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 focus:outline-none focus:ring-2 focus:ring-zinc-900"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[5rem] text-center text-xs text-zinc-600">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
          className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 focus:outline-none focus:ring-2 focus:ring-zinc-900"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
