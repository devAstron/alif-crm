export function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "brand" | "green" | "amber" | "red" | "slate";
}) {
  const accentClass = {
    brand: "text-brand-700",
    green: "text-green-600",
    amber: "text-amber-600",
    red: "text-red-600",
    slate: "text-slate-900",
  }[accent ?? "slate"];

  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${accentClass}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}
