import { forwardRef } from "react";
import { Loader2 } from "lucide-react";

/* Canonical button system. Neutral primary, subtle secondary, red danger,
   soft-red destructive and minimal ghost. No blue / indigo / purple. */
const VARIANTS = {
  primary:
    "bg-zinc-900 text-white hover:bg-zinc-800 focus-visible:ring-zinc-900 focus-visible:ring-offset-2",
  secondary:
    "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 focus-visible:ring-zinc-900 focus-visible:ring-offset-0",
  danger:
    "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600 focus-visible:ring-offset-2",
  dangerSoft:
    "border border-zinc-300 bg-white text-red-600 hover:bg-red-50 focus-visible:ring-red-600 focus-visible:ring-offset-0",
  ghost:
    "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-zinc-900 focus-visible:ring-offset-0",
};

const SIZES = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
  lg: "px-4 py-2.5 text-sm gap-2",
};

const Button = forwardRef(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    icon: Icon,
    fullWidth = false,
    className = "",
    children,
    disabled,
    type = "button",
    ...rest
  },
  ref,
) {
  const classes = [
    "inline-flex items-center justify-center rounded-md font-semibold transition-colors",
    "focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60",
    VARIANTS[variant] ?? VARIANTS.primary,
    SIZES[size] ?? SIZES.md,
    fullWidth ? "w-full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={classes}
      {...rest}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        Icon && <Icon className="h-4 w-4" aria-hidden="true" />
      )}
      {children}
    </button>
  );
});

export default Button;
