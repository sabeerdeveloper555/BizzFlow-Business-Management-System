/* Consistent status badge styling. Tone carries meaning, the text label is
   always present, so status is never communicated by colour alone. */
const TONES = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-red-200 bg-red-50 text-red-700",
  neutral: "border-zinc-200 bg-zinc-50 text-zinc-500",
  strong: "border-zinc-300 bg-zinc-900 text-white",
};

const DOTS = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  neutral: "bg-zinc-400",
  strong: "bg-white",
};

export default function Badge({ tone = "neutral", dot = false, children, className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium ${TONES[tone] ?? TONES.neutral} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${DOTS[tone] ?? DOTS.neutral}`} aria-hidden="true" />}
      {children}
    </span>
  );
}
