"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { getClientAuth } from "@/lib/firebase";
import { verifyClinicianEmail } from "@/lib/admin-data";
import type { ClinicianAccount } from "@/types/admin";
import { LoadingState } from "@/components/admin/ui";

interface AdminAuthContextValue {
  user: User;
  clinician: ClinicianAccount;
  logout: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [clinician, setClinician] = useState<ClinicianAccount | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(getClientAuth(), async (nextUser) => {
      if (!nextUser || nextUser.isAnonymous || !nextUser.email) {
        setLoading(false);
        router.replace("/");
        return;
      }
      try {
        const account = await verifyClinicianEmail(nextUser.email);
        if (!account) {
          await signOut(getClientAuth());
          router.replace("/");
          return;
        }
        setUser(nextUser);
        setClinician(account);
      } catch {
        await signOut(getClientAuth());
        router.replace("/");
      } finally {
        setLoading(false);
      }
    });
  }, [router]);

  const value = useMemo<AdminAuthContextValue | null>(() => {
    if (!user || !clinician) return null;
    return {
      user,
      clinician,
      logout: async () => {
        await signOut(getClientAuth());
        router.replace("/");
      },
    };
  }, [clinician, router, user]);

  if (loading || !value) {
    return (
      <main className="min-h-screen bg-[#02060d]">
        <LoadingState label="Verifying clinician access" />
      </main>
    );
  }

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const value = useContext(AdminAuthContext);
  if (!value) throw new Error("useAdminAuth must be used inside AdminAuthProvider");
  return value;
}
