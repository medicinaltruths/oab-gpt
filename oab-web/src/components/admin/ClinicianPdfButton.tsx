"use client";

import { useState } from "react";
import { Icon } from "@/components/admin/icons";
import { getStorageReportBlob } from "@/lib/firebase";

export function ClinicianPdfButton({
  storagePath,
  fallbackUrl,
  className = "",
}: {
  storagePath?: string;
  fallbackUrl?: string;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function openReport() {
    setError("");
    setLoading(true);
    const reportWindow = window.open("about:blank", "_blank");
    if (reportWindow) reportWindow.opener = null;
    try {
      if (storagePath) {
        const blob = await getStorageReportBlob(storagePath);
        const objectUrl = URL.createObjectURL(blob);
        if (reportWindow) reportWindow.location.href = objectUrl;
        else window.open(objectUrl, "_blank", "noopener,noreferrer");
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
        return;
      }
      if (fallbackUrl) {
        if (reportWindow) reportWindow.location.href = fallbackUrl;
        else window.open(fallbackUrl, "_blank", "noopener,noreferrer");
        return;
      }
      reportWindow?.close();
      setError("No retained report is available.");
    } catch {
      reportWindow?.close();
      if (fallbackUrl) {
        window.open(fallbackUrl, "_blank", "noopener,noreferrer");
      } else {
        setError("The report could not be opened. Check Firebase Storage permissions.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={openReport}
        disabled={loading}
        className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-cyan-200 px-5 text-sm font-semibold text-[#031018] transition hover:bg-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      >
        <Icon name="document" className="size-4" />
        {loading ? "Opening report..." : "Open PDF"}
      </button>
      {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
