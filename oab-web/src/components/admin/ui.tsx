import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/admin/icons";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/70">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-[var(--font-display)] text-3xl font-semibold tracking-tight text-[#f8f1d5] sm:text-4xl">
          {title}
        </h1>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-white/[0.08] bg-[#07101f]/85 shadow-[0_20px_50px_rgba(0,0,0,0.2)] ${className}`}
    >
      {title || action ? (
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] px-5 py-4 sm:px-6">
          <div>
            {title ? <h2 className="text-sm font-semibold text-slate-100">{title}</h2> : null}
            {description ? <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function KpiCard({
  label,
  value,
  detail,
  icon,
  accent = "cyan",
}: {
  label: string;
  value: string | number;
  detail?: string;
  icon: IconName;
  accent?: "cyan" | "violet" | "gold" | "green";
}) {
  const accents = {
    cyan: "border-cyan-300/15 bg-cyan-300/10 text-cyan-200",
    violet: "border-violet-300/15 bg-violet-300/10 text-violet-200",
    gold: "border-amber-300/15 bg-amber-300/10 text-amber-200",
    green: "border-emerald-300/15 bg-emerald-300/10 text-emerald-200",
  };
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#07101f]/90 p-5 transition-colors duration-200 hover:border-white/[0.14]">
      <div className="pointer-events-none absolute -right-8 -top-10 size-28 rounded-full bg-cyan-300/[0.04] blur-2xl transition group-hover:bg-cyan-300/[0.08]" />
      <div className="flex items-start justify-between gap-3">
        <p className="max-w-[13rem] text-xs font-medium leading-5 text-slate-400">{label}</p>
        <span className={`grid size-9 shrink-0 place-items-center rounded-xl border ${accents[accent]}`}>
          <Icon name={icon} className="size-4" />
        </span>
      </div>
      <p className="mt-5 text-3xl font-semibold tracking-[-0.04em] text-slate-50">{value}</p>
      <p className="mt-1 min-h-5 text-[11px] text-slate-500">{detail || "Live Firestore data"}</p>
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const tones = {
    neutral: "border-slate-500/20 bg-slate-400/10 text-slate-300",
    success: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
    warning: "border-amber-400/20 bg-amber-400/10 text-amber-200",
    danger: "border-rose-400/20 bg-rose-400/10 text-rose-200",
    info: "border-cyan-400/20 bg-cyan-400/10 text-cyan-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function EmptyState({
  title = "No data available yet",
  description = "This view will update automatically when records are added to Firestore.",
  icon = "analytics",
}: {
  title?: string;
  description?: string;
  icon?: IconName;
}) {
  return (
    <div className="grid min-h-52 place-items-center px-6 py-10 text-center">
      <div>
        <span className="mx-auto grid size-11 place-items-center rounded-xl border border-cyan-300/10 bg-cyan-300/[0.06] text-cyan-200">
          <Icon name={icon} className="size-5" />
        </span>
        <p className="mt-4 text-sm font-medium text-slate-200">{title}</p>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">{description}</p>
      </div>
    </div>
  );
}

export function LoadingState({ label = "Loading clinical data" }: { label?: string }) {
  return (
    <div className="grid min-h-[45vh] place-items-center">
      <div className="text-center">
        <span className="mx-auto block size-8 animate-spin rounded-full border-2 border-cyan-200/20 border-t-cyan-200" />
        <p className="mt-4 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{label}</p>
      </div>
    </div>
  );
}

export const fieldClass =
  "min-h-11 w-full rounded-xl border border-white/10 bg-[#050c18] px-3.5 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-60";

export function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-xs font-medium text-slate-300">
      {children}
    </label>
  );
}
