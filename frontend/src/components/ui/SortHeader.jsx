import { ChevronDown, ChevronUp } from "lucide-react";

/* Sortable table header cell. Renders a <th> whose button toggles sort on the
   given column; the chevron indicates direction, so sorting state is visible
   without relying on colour. */
function SortIcon({ active, dir }) {
  if (!active) return <ChevronUp className="h-3 w-3 text-zinc-300" aria-hidden="true" />;
  return dir === "asc" ? (
    <ChevronUp className="h-3 w-3 text-zinc-700" aria-hidden="true" />
  ) : (
    <ChevronDown className="h-3 w-3 text-zinc-700" aria-hidden="true" />
  );
}

export default function SortHeader({ label, field, sortBy, sortOrder, onSort, numeric = false }) {
  const active = sortBy === field;
  return (
    <th scope="col" className={`px-5 py-3 ${numeric ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-800 focus:outline-none ${
          numeric ? "flex-row-reverse" : ""
        }`}
      >
        {label}
        <SortIcon active={active} dir={sortOrder} />
      </button>
    </th>
  );
}
