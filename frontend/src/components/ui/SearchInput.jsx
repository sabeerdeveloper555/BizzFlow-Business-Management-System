import { Search, X } from "lucide-react";

/* Standard search field with leading icon and a clear control. Used by every
   CRUD toolbar so search looks and behaves identically across pages. */
export default function SearchInput({ value, onChange, onClear, placeholder, label, className = "" }) {
  return (
    <div className={`relative ${className}`}>
      <Search
        className="pointer-events-none absolute inset-y-0 left-3 my-auto h-4 w-4 text-zinc-400"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="block w-full rounded-md border border-zinc-300 py-2 pr-9 pl-9 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
      />
      {value && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="absolute inset-y-0 right-2.5 my-auto text-zinc-400 hover:text-zinc-700 focus:outline-none"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
