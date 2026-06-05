"use client";

import { useEffect, useState, type FormEvent } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Icon } from "@/components/admin/icons";
import { fieldClass, FieldLabel } from "@/components/admin/ui";
import { verifyClinicianEmail } from "@/lib/admin-data";
import { getClientAuth } from "@/lib/firebase";

export function ClinicianLoginModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading) onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [loading, onClose, open]);

  useEffect(() => {
    if (open) setError("");
  }, [open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const credential = await signInWithEmailAndPassword(
        getClientAuth(),
        email.trim(),
        password,
      );
      const account = credential.user.email
        ? await verifyClinicianEmail(credential.user.email)
        : null;

      if (!account) {
        await signOut(getClientAuth());
        setError("This account is not authorised for clinician access.");
        return;
      }

      router.push("/admin");
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

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 px-4 py-8 backdrop-blur-md"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="clinician-login-title"
        aria-describedby="clinician-login-description"
        className="relative w-full max-w-md rounded-3xl border border-white/[0.12] bg-[#07101f]/95 p-6 text-left shadow-[0_30px_100px_rgba(0,0,0,0.65)] sm:p-8"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          aria-label="Close clinician login"
          className="absolute right-4 top-4 grid size-11 cursor-pointer place-items-center rounded-xl text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-200/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name="x" className="size-5" />
        </button>

        <span className="grid size-11 place-items-center rounded-xl border border-cyan-200/15 bg-cyan-300/[0.08] text-cyan-100">
          <Icon name="shield" className="size-5" />
        </span>
        <h2
          id="clinician-login-title"
          className="mt-6 font-[var(--font-display)] text-3xl font-semibold text-[#f8f1d5]"
        >
          Clinician login
        </h2>
        <p
          id="clinician-login-description"
          className="mt-2 text-sm leading-6 text-slate-400"
        >
          Sign in using the account issued by your administrator.
        </p>

        <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
          <div>
            <FieldLabel htmlFor="clinician-email">Email address</FieldLabel>
            <input
              id="clinician-email"
              type="email"
              autoComplete="email"
              autoFocus
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={fieldClass}
              placeholder="clinician@hospital.org"
            />
          </div>
          <div>
            <FieldLabel htmlFor="clinician-password">Password</FieldLabel>
            <input
              id="clinician-password"
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
            <p
              role="alert"
              className="rounded-xl border border-rose-400/15 bg-rose-400/[0.07] px-4 py-3 text-xs text-rose-200"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-200 to-cyan-300 px-4 text-sm font-semibold text-[#031018] shadow-[0_12px_30px_rgba(74,211,222,0.16)] transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-cyan-200/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Verifying access..." : "Sign in securely"}
            {!loading ? <Icon name="arrow" className="size-4" /> : null}
          </button>
        </form>

        <p className="mt-5 text-center text-[11px] leading-5 text-slate-600">
          Clinician accounts are created by the OAB-GPT administrator. Self-registration is
          disabled.
        </p>
      </section>
    </div>,
    document.body,
  );
}
