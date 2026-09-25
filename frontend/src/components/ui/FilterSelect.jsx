/* Toolbar filter / sort select with consistent styling and an accessible
   label. Used for status, category, customer and sort controls. */
export default function FilterSelect({ label, value, onChange, className = "w-full lg:w-auto", children }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className={`rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 ${className}`}
    >
      {children}
    </select>
  );
}
