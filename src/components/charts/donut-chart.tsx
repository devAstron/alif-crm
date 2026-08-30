export interface DonutSegment {
  name: string;
  count: number;
  color: string;
}

/** Yengil SVG donut chart + legenda. */
export function DonutChart({ data, title }: { data: DonutSegment[]; title?: string }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const r = 56;
  const cx = 70;
  const cy = 70;
  const strokeW = 22;
  const C = 2 * Math.PI * r;

  // Segment uzunliklari va boshlanish offsetlari (mutatsiyasiz)
  const lens = data.map((d) => (total > 0 ? (d.count / total) * C : 0));
  const offsets = lens.map((_, i) => lens.slice(0, i).reduce((a, b) => a + b, 0));

  return (
    <div className="card p-5">
      {title && <h3 className="mb-4 text-sm font-semibold text-slate-900">{title}</h3>}
      {total === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">Ma&apos;lumot yo&apos;q</p>
      ) : (
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
          <svg width={140} height={140} viewBox="0 0 140 140" className="shrink-0">
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={strokeW} />
            {data.map((d, i) => (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={d.color}
                strokeWidth={strokeW}
                strokeDasharray={`${lens[i]} ${C - lens[i]}`}
                strokeDashoffset={-offsets[i]}
                transform={`rotate(-90 ${cx} ${cy})`}
              />
            ))}
            <text x={cx} y={cy - 2} textAnchor="middle" className="fill-slate-900" style={{ fontSize: 22, fontWeight: 700 }}>
              {total}
            </text>
            <text x={cx} y={cy + 16} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 10 }}>
              jami
            </text>
          </svg>

          <ul className="flex-1 space-y-1.5">
            {data.map((d, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
                <span className="flex-1 truncate text-slate-600">{d.name}</span>
                <span className="font-medium text-slate-900">{d.count}</span>
                <span className="w-10 text-right text-xs text-slate-400">
                  {Math.round((d.count / total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
