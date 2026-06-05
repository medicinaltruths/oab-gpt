"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import { useAdminData } from "@/components/admin/useAdminData";
import { Badge, LoadingState, PageHeader, Panel } from "@/components/admin/ui";
import { formatDate, subscribeAuditCollection, toDate } from "@/lib/admin-data";
import type { DataSourceAuditRow } from "@/types/admin";

const dependencies: Record<string, string[]> = {
  patient_assessments: [
    "All overview KPIs",
    "Recommendation distribution",
    "Completion funnel",
    "Drop-off analysis",
    "Patient search",
    "Pending and reviewed counts",
  ],
  clinician_accounts: ["Clinician authentication", "Hospital access scope"],
  whatsappContacts: ["WhatsApp source monitoring", "WhatsApp patient linkage"],
  whatsappInboundQueue: ["WhatsApp ingestion health", "Queued message audit"],
};

export default function DataSourcesPage() {
  const { clinician } = useAdminAuth();
  const { assessments, loading } = useAdminData();
  const [external, setExternal] = useState<Record<string, Partial<DataSourceAuditRow>>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const collections = ["clinician_accounts", "whatsappContacts", "whatsappInboundQueue"];
    const unsubscribes = collections.map((collectionName) =>
      subscribeAuditCollection(
        collectionName,
        clinician,
        (value) =>
          setExternal((current) => ({
            ...current,
            [collectionName]: value,
          })),
        (error) =>
          setErrors((current) => ({
            ...current,
            [collectionName]: error.message,
          })),
      ),
    );
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [clinician]);

  const rows = useMemo<DataSourceAuditRow[]>(() => {
    const assessmentDates = assessments
      .map((item) => toDate(item.updatedAt || item.createdAt))
      .filter((date): date is Date => Boolean(date))
      .sort((left, right) => right.getTime() - left.getTime());
    return [
      {
        collectionName: "patient_assessments",
        documentCount: assessments.length,
        lastUpdated: assessmentDates[0],
        widgets: dependencies.patient_assessments,
      },
      ...["clinician_accounts", "whatsappContacts", "whatsappInboundQueue"].map(
        (collectionName) => ({
          collectionName,
          documentCount: external[collectionName]?.documentCount || 0,
          lastUpdated: external[collectionName]?.lastUpdated,
          widgets: dependencies[collectionName],
        }),
      ),
    ];
  }, [assessments, external]);

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Data source audit"
        title="Firestore collections"
        description="Use this page to identify missing records and understand which dashboard widgets depend on each collection."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        {rows.map((row) => {
          const error = errors[row.collectionName];
          return (
            <Panel
              key={row.collectionName}
              title={row.collectionName}
              action={
                <Badge tone={error ? "danger" : row.documentCount ? "success" : "warning"}>
                  {error ? "Read error" : `${row.documentCount} documents`}
                </Badge>
              }
            >
              <div className="space-y-5 p-5 sm:p-6">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                    Last updated
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    {formatDate(row.lastUpdated, true)}
                  </p>
                </div>
                {error ? (
                  <p className="rounded-xl border border-rose-400/15 bg-rose-400/[0.06] px-4 py-3 text-xs leading-5 text-rose-200">
                    {error}
                  </p>
                ) : row.documentCount === 0 ? (
                  <p className="rounded-xl border border-amber-400/15 bg-amber-400/[0.06] px-4 py-3 text-xs leading-5 text-amber-100">
                    This collection is empty. Dependent dashboard widgets will display zero or an empty state.
                  </p>
                ) : null}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                    Dependent widgets and workflows
                  </p>
                  <ul className="mt-3 space-y-2">
                    {row.widgets.map((widget) => (
                      <li key={widget} className="flex gap-2 text-xs text-slate-400">
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-cyan-300/60" />
                        {widget}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
