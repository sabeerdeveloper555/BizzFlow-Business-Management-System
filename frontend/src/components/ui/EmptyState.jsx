/* Polished empty state for list / card bodies: contextual icon, title,
   supporting description and an optional action. */
export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {Icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
      )}
      <p className="mt-3 font-medium text-zinc-700">{title}</p>
      {description && <p className="mt-1 text-sm text-zinc-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
