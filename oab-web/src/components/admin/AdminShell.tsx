"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/admin/icons";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";

const navigation: Array<{ href: string; label: string; icon: IconName; exact?: boolean }> = [
  { href: "/admin", label: "Overview", icon: "home", exact: true },
  { href: "/admin/patients", label: "Patients", icon: "patients" },
  { href: "/admin/analytics", label: "Analytics", icon: "analytics" },
  { href: "/admin/outcomes", label: "Outcomes", icon: "activity" },
  { href: "/admin/data-sources", label: "Data Sources", icon: "document" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { clinician, logout } = useAdminAuth();
  const [open, setOpen] = useState(false);
  const displayName = clinician.displayName || clinician.email.split("@")[0];

  return (
    <div className="min-h-screen bg-[#02060d] text-slate-100">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 h-[34rem] bg-[radial-gradient(ellipse_at_20%_0%,rgba(59,205,216,0.10),transparent_48%),radial-gradient(ellipse_at_82%_0%,rgba(102,119,217,0.08),transparent_44%)]"
      />
      {open ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[17rem] flex-col border-r border-white/[0.07] bg-[#040a14]/95 px-4 py-5 backdrop-blur-xl transition-transform duration-200 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-2">
          <Link href="/admin" className="flex items-center gap-3" onClick={() => setOpen(false)}>
            <span className="grid size-10 place-items-center rounded-xl border border-cyan-200/15 bg-cyan-300/10 text-cyan-100 shadow-[0_0_30px_rgba(75,216,226,0.08)]">
              <Icon name="sparkles" className="size-5" />
            </span>
            <span>
              <span className="block font-[var(--font-display)] text-xl font-semibold tracking-wide text-[#f8f1d5]">
                OAB-GPT
              </span>
              <span className="block text-[9px] font-semibold uppercase tracking-[0.22em] text-cyan-200/55">
                Clinician portal
              </span>
            </span>
          </Link>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-xl text-slate-400 hover:bg-white/5 lg:hidden"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          >
            <Icon name="x" />
          </button>
        </div>

        <nav className="mt-10 space-y-1" aria-label="Administration">
          <p className="mb-3 px-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-600">
            Clinical workspace
          </p>
          {navigation.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm transition ${
                  active
                    ? "bg-cyan-300/[0.09] text-cyan-100 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.08)]"
                    : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
                }`}
              >
                <Icon name={item.icon} className="size-[18px]" />
                {item.label}
                {active ? <span className="ml-auto size-1.5 rounded-full bg-cyan-200" /> : null}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto">
          <div className="mb-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-cyan-300/20 to-indigo-400/15 text-cyan-100">
                <Icon name="user" className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium capitalize text-slate-200">{displayName}</p>
                <p className="truncate text-[10px] text-slate-500">
                  {clinician.hospitalName || "Clinical team"}
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm text-slate-500 transition hover:bg-rose-400/[0.06] hover:text-rose-200"
          >
            <Icon name="logout" className="size-[18px]" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="relative lg:pl-[17rem]">
        <header className="sticky top-0 z-30 flex h-16 items-center border-b border-white/[0.06] bg-[#02060d]/85 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <button
            type="button"
            className="grid size-11 place-items-center rounded-xl border border-white/[0.07] text-slate-300 lg:hidden"
            aria-label="Open navigation"
            onClick={() => setOpen(true)}
          >
            <Icon name="menu" />
          </button>
          <div className="ml-auto flex items-center gap-2 text-[11px] text-slate-500">
            <span className="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.7)]" />
            Live data
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1600px] px-4 py-7 sm:px-6 sm:py-9 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
