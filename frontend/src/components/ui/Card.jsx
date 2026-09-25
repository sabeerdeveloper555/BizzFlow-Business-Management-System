/* Generic surface card. `padded` for content cards; the data-table container
   uses the border/white shell without inner padding. */
export default function Card({ padded = true, className = "", children }) {
  return (
    <div
      className={`rounded-lg border border-zinc-200 bg-white ${padded ? "p-5" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
