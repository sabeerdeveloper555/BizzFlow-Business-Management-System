import { AlertCircle } from "lucide-react";

/* Inline alert banner for form-level / API errors. Red for danger, amber for
   warning, neutral for information. Text always present. */
const VARIANTS = {
  danger: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-zinc-200 bg-zinc-50 text-zinc-700",
};

const ICONS = {
  danger: "text-red-500",
  warning: "text-amber-500",
  info: "text-zinc-400",
};

export default function Alert({ variant = "danger", children }) {
  if (!children) return null;
  return (
    <div
      role="alert"
      className={`flex items-start gap-2.5 rounded-md border p-3.5 text-sm ${VARIANTS[variant] ?? VARIANTS.danger}`}
    >
      <AlertCircle className={`mt-0.5 h-4 w-4 shrink-0 ${ICONS[variant] ?? ICONS.danger}`} aria-hidden="true" />
      <span className="leading-snug">{children}</span>
    </div>
  );
}
