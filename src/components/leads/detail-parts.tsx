export interface InfoItem {
  label: string;
  value: React.ReactNode;
}

/** Bo'sh bo'lmagan qatorlarni ko'rsatadigan ma'lumot bloki. */
export function InfoGrid({ title, items }: { title: string; items: InfoItem[] }) {
  const filled = items.filter(
    (i) => i.value !== null && i.value !== undefined && i.value !== "" && i.value !== "—",
  );

  return (
    <div className="card p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      {filled.length === 0 ? (
        <p className="text-sm text-slate-400">Ma&apos;lumot yo&apos;q</p>
      ) : (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {filled.map((i, idx) => (
            <div key={idx} className="flex flex-col">
              <dt className="text-xs text-slate-400">{i.label}</dt>
              <dd className="mt-0.5 text-sm text-slate-800 break-words">{i.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
