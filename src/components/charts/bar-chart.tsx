export interface BarPoint {
  label: string;
  leads: number;
  sales: number;
}

/** Yengil CSS bar chart: kunlik leadlar (brand) va sotuvlar (yashil). */
export function BarChart({ data, title }: { data: BarPoint[]; title?: string }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.leads, d.sales)));

  return (
    <div className="card p-5">
      {title && <h3 className="mb-1 text-sm font-semibold text-slate-900">{title}</h3>}
      <div className="mb-4 flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand-500" /> Leadlar</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-green-500" /> Sotuvlar</span>
      </div>

      {data.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">Ma&apos;lumot yo&apos;q</p>
      ) : (
        <div className="scroll-thin overflow-x-auto">
          <div className="flex min-w-full items-end gap-2" style={{ height: 160 }}>
            {data.map((d, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1" style={{ minWidth: 28 }}>
                <div className="flex h-full w-full items-end justify-center gap-0.5">
                  <div
                    className="w-2.5 rounded-t bg-brand-500 transition-all"
                    style={{ height: `${(d.leads / max) * 100}%` }}
                    title={`${d.leads} lead`}
                  />
                  <div
                    className="w-2.5 rounded-t bg-green-500 transition-all"
                    style={{ height: `${(d.sales / max) * 100}%` }}
                    title={`${d.sales} sotuv`}
                  />
                </div>
                <span className="whitespace-nowrap text-[10px] text-slate-400">{d.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
