"use client";

import type { FunnelDatum, RecommendationDatum, TrendDatum } from "@/types/admin";
import { EmptyState } from "@/components/admin/ui";

export function DonutChart({ data }: { data: RecommendationDatum[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (!total) return <EmptyState title="No recommendations recorded" />;
  let cursor = 0;
  const stops = data.map((item) => {
    const start = cursor;
    cursor += (item.value / total) * 100;
    return `${item.color} ${start}% ${cursor}%`;
  });

  return (
    <div className="grid gap-8 p-6 md:grid-cols-[minmax(180px,0.8fr)_1fr] md:items-center">
      <div
        role="img"
        aria-label={`Recommendation distribution across ${total} conversations`}
        className="relative mx-auto aspect-square w-full max-w-[220px] rounded-full"
        style={{ background: `conic-gradient(${stops.join(",")})` }}
      >
        <div className="absolute inset-[22%] grid place-items-center rounded-full border border-white/[0.07] bg-[#07101f]">
          <div className="text-center">
            <p className="text-3xl font-semibold text-slate-50">{total}</p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Total</p>
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {data.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-xs text-slate-300">{item.label}</span>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold text-slate-100">{item.value}</span>
              <span className="ml-2 text-[10px] text-slate-500">
                {Math.round((item.value / total) * 100)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FunnelChart({ data }: { data: FunnelDatum[] }) {
  const maximum = Math.max(...data.map((item) => item.value), 0);
  if (!maximum) return <EmptyState title="No funnel activity recorded" />;
  return (
    <div className="space-y-3 p-5 sm:p-6">
      {data.map((item, index) => {
        const width = Math.max(14, (item.value / maximum) * 100);
        const previous = index ? data[index - 1].value : item.value;
        const rate = previous ? Math.round((item.value / previous) * 100) : 0;
        return (
          <div key={item.label} className="grid grid-cols-[minmax(0,1fr)_3.2rem] items-center gap-3">
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <span className="truncate text-[11px] text-slate-400">{item.label}</span>
                <span className="text-[10px] text-slate-600">{index ? `${rate}%` : "100%"}</span>
              </div>
              <div className="h-7 overflow-hidden rounded-md bg-white/[0.035]">
                <div
                  className="h-full rounded-md bg-gradient-to-r from-cyan-500/55 to-cyan-200/80"
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
            <span className="pt-5 text-right text-sm font-semibold text-slate-200">{item.value}</span>
          </div>
        );
      })}
    </div>
  );
}

export function LineChart({ data }: { data: TrendDatum[] }) {
  const maximum = Math.max(...data.map((item) => item.value), 0);
  if (!maximum) return <EmptyState title="No conversations in the last seven days" />;
  const width = 640;
  const height = 220;
  const padding = 28;
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const points = data.map((item, index) => ({
    ...item,
    x: padding + (index / Math.max(1, data.length - 1)) * usableWidth,
    y: padding + usableHeight - (item.value / maximum) * usableHeight,
  }));
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${padding},${height - padding} ${line} ${width - padding},${height - padding}`;

  return (
    <div className="p-4 sm:p-6">
      <svg
        viewBox={`0 0 ${width} ${height + 34}`}
        role="img"
        aria-label="Weekly conversations trend"
        className="h-auto w-full overflow-visible"
      >
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#62dbe7" stopOpacity=".3" />
            <stop offset="100%" stopColor="#62dbe7" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((position) => (
          <line
            key={position}
            x1={padding}
            y1={padding + usableHeight * position}
            x2={width - padding}
            y2={padding + usableHeight * position}
            stroke="rgba(255,255,255,.07)"
            strokeDasharray="4 6"
          />
        ))}
        <polygon points={area} fill="url(#trend-fill)" />
        <polyline points={line} fill="none" stroke="#7de3eb" strokeWidth="3" strokeLinejoin="round" />
        {points.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="5" fill="#07101f" stroke="#9aebf0" strokeWidth="3" />
            <text x={point.x} y={height + 17} textAnchor="middle" fill="#718096" fontSize="11">
              {point.label}
            </text>
            <text x={point.x} y={point.y - 12} textAnchor="middle" fill="#d9f7f9" fontSize="11">
              {point.value}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function BarChart({
  data,
  color = "#75dce6",
  valueSuffix = "",
}: {
  data: FunnelDatum[];
  color?: string;
  valueSuffix?: string;
}) {
  const maximum = Math.max(...data.map((item) => item.value), 0);
  if (!maximum) return <EmptyState />;
  return (
    <div className="space-y-4 p-5 sm:p-6">
      {data.map((item) => (
        <div key={item.label}>
          <div className="mb-2 flex items-center justify-between gap-3 text-xs">
            <span className="truncate text-slate-400">{item.label}</span>
            <span className="font-medium text-slate-200">
              {item.value}
              {valueSuffix}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
            <div
              className="h-full rounded-full"
              style={{ width: `${(item.value / maximum) * 100}%`, backgroundColor: color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
