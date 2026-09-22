export default function PlaceholderPage({ title }) {
  return (
    <section>
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
        BizFlow
      </p>
      <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
      <p className="mt-3 text-slate-600">
        This workspace is ready for the next implementation phase.
      </p>
    </section>
  );
}
