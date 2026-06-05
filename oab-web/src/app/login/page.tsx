"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/admin/icons";
import { fieldClass, FieldLabel } from "@/components/admin/ui";
import { getClientAuth } from "@/lib/firebase";
import { verifyClinicianEmail } from "@/lib/admin-data";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    return onAuthStateChanged(getClientAuth(), async (user) => {
      if (user && !user.isAnonymous && user.email) {
        const account = await verifyClinicianEmail(user.email).catch(() => null);
        if (account) {
          router.replace("/admin");
          return;
        }
      }
      setChecking(false);
    });
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(getClientAuth(), email.trim(), password);
      const account = credential.user.email
        ? await verifyClinicianEmail(credential.user.email)
        : null;
      if (!account) {
        await signOut(getClientAuth());
        setError("This account is not authorised for clinician access.");
        return;
      }
      router.replace("/admin");
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "";
      setError(
        message.includes("invalid-credential")
          ? "The email address or password is incorrect."
          : "Unable to sign in. Check your details and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative grid min-h-screen overflow-hidden bg-[#02060d] px-5 py-10 text-slate-100 lg:grid-cols-2 lg:px-0 lg:py-0">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_30%,rgba(61,218,229,0.14),transparent_35%),radial-gradient(ellipse_at_80%_15%,rgba(112,118,220,0.10),transparent_32%)]"
      />
      <section className="relative z-10 hidden border-r border-white/[0.07] p-12 lg:flex lg:flex-col lg:justify-between xl:p-16">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl border border-cyan-200/15 bg-cyan-300/10 text-cyan-100">
            <Icon name="sparkles" />
          </span>
          <span>
            <span className="block font-[var(--font-display)] text-2xl font-semibold text-[#f8f1d5]">OAB-GPT</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/55">
              Clinician portal
            </span>
          </span>
        </Link>
        <div className="max-w-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/60">
            Secure clinical intelligence
          </p>
          <h1 className="mt-5 font-[var(--font-display)] text-5xl font-semibold leading-[1.08] tracking-tight text-[#f8f1d5] xl:text-6xl">
            Better visibility into every patient conversation.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-slate-400">
            Review recommendations, understand completion patterns, and record final clinical decisions in one
            protected workspace.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <Icon name="shield" className="size-5 text-cyan-200/70" />
          Access is restricted to approved clinician accounts.
        </div>
      </section>

      <section className="relative z-10 flex items-center justify-center">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-10 flex items-center gap-3 lg:hidden">
            <span className="grid size-10 place-items-center rounded-xl border border-cyan-200/15 bg-cyan-300/10 text-cyan-100">
              <Icon name="sparkles" className="size-5" />
            </span>
            <span className="font-[var(--font-display)] text-xl font-semibold text-[#f8f1d5]">OAB-GPT</span>
          </Link>
          <div className="rounded-3xl border border-white/[0.09] bg-[#07101f]/80 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-9">
            <span className="grid size-11 place-items-center rounded-xl border border-cyan-200/15 bg-cyan-300/[0.08] text-cyan-100">
              <Icon name="shield" className="size-5" />
            </span>
            <h2 className="mt-6 font-[var(--font-display)] text-3xl font-semibold text-[#f8f1d5]">
              Clinician sign in
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Use the Firebase account issued by your administrator.
            </p>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <div>
                <FieldLabel htmlFor="email">Email address</FieldLabel>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={fieldClass}
                  placeholder="clinician@hospital.org"
                />
              </div>
              <div>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={fieldClass}
                  placeholder="Enter your password"
                />
              </div>
              {error ? (
                <p role="alert" className="rounded-xl border border-rose-400/15 bg-rose-400/[0.07] px-4 py-3 text-xs text-rose-200">
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={loading || checking}
                className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-200 to-cyan-300 px-4 text-sm font-semibold text-[#031018] shadow-[0_12px_30px_rgba(74,211,222,0.16)] transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-cyan-200/50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading || checking ? "Verifying access..." : "Sign in securely"}
                {!loading && !checking ? <Icon name="arrow" className="size-4" /> : null}
              </button>
            </form>
            <p className="mt-6 text-center text-[11px] leading-5 text-slate-600">
              Self-registration is disabled. Contact your administrator if you need access.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
