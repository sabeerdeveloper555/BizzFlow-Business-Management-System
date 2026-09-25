import { forwardRef } from "react";
import { AlertCircle } from "lucide-react";

/* Shared form control styling so every input / select / textarea across the
   app looks and behaves identically (height, border, focus, error, disabled). */
export function controlCls(hasError, extra = "") {
  return [
    "block w-full rounded-md border px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400",
    "transition-colors focus:outline-none focus:ring-2",
    "disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500",
    hasError
      ? "border-red-300 focus:border-red-500 focus:ring-red-500"
      : "border-zinc-300 focus:border-zinc-900 focus:ring-zinc-900",
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

export const Input = forwardRef(function Input({ invalid = false, className = "", ...rest }, ref) {
  return <input ref={ref} aria-invalid={invalid || undefined} className={controlCls(invalid, className)} {...rest} />;
});

export const Textarea = forwardRef(function Textarea({ invalid = false, className = "", ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={controlCls(invalid, `resize-none ${className}`)}
      {...rest}
    />
  );
});

export const Select = forwardRef(function Select({ invalid = false, className = "", children, ...rest }, ref) {
  return (
    <select ref={ref} aria-invalid={invalid || undefined} className={controlCls(invalid, className)} {...rest}>
      {children}
    </select>
  );
});

/* Label + required marker + hint + inline error, wrapping any control. */
export function Field({ id, label, error, required, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-zinc-800">
        {label}
        {required && (
          <span className="ml-0.5 text-red-500" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-zinc-500">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
