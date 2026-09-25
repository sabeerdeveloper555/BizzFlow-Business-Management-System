/* Compact icon button for table row actions. Tone drives the hover treatment
   while the required `label` provides the accessible (and non-colour) meaning. */
const TONES = {
  default: "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 focus-visible:ring-zinc-900",
  danger: "text-zinc-400 hover:bg-red-50 hover:text-red-600 focus-visible:ring-red-600",
  warning: "text-zinc-400 hover:bg-amber-50 hover:text-amber-700 focus-visible:ring-amber-600",
  success: "text-zinc-400 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:ring-emerald-600",
};

export default function IconButton({ icon: Icon, label, tone = "default", className = "", ...rest }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`rounded p-1.5 transition-colors focus:outline-none focus-visible:ring-2 ${TONES[tone] ?? TONES.default} ${className}`}
      {...rest}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
