"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/admin/icons";
import { useAdminData } from "@/components/admin/useAdminData";
import { Badge, EmptyState, fieldClass, LoadingState, PageHeader, Panel } from "@/components/admin/ui";
import {
  calculateConcordance,
  formatDate,
  getAiRecommendation,
  getPatientAge,
  getPatientName,
  normalizeRecommendation,
  toDate,
} from "@/lib/admin-data";

function statusTone(status?: string) {
  if (status === "completed") return "success" as const;
  if (status === "abandoned") return "danger" as const;
  if (status === "in_progress") return "info" as const;
  return "warning" as const;
}

export default function PatientsPage() {
  const { conversations, loading } = useAdminData();
  const [search, setSearch] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filtered = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    return [...conversations]
      .filter((conversation) => {
        const aiRecommendation = normalizeRecommendation(getAiRecommendation(conversation));
        const clinicianRecommendation = conversation.clinicalReview?.finalRecommendation || "";
        const date = toDate(conversation.startedAt || conversation.createdAt);
        if (
          searchTerm &&
          !`${getPatientName(conversation)} ${conversation.id} ${aiRecommendation} ${clinicianRecommendation}`
            .toLowerCase()
            .includes(searchTerm)
        ) {
          return false;
        }
        if (recommendation && aiRecommendation !== recommendation) return false;
        if (status && conversation.status !== status) return false;
        if (dateFrom && (!date || date < new Date(`${dateFrom}T00:00:00`))) return false;
        if (dateTo && (!date || date > new Date(`${dateTo}T23:59:59`))) return false;
        return true;
      })
      .sort(
        (left, right) =>
          (toDate(right.startedAt || right.createdAt)?.getTime() || 0) -
          (toDate(left.startedAt || left.createdAt)?.getTime() || 0),
      );
  }, [conversations, dateFrom, dateTo, recommendation, search, status]);

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Patient records"
        title="Conversations and reviews"
        description="Search assessment records, inspect recommendations, and continue clinician reviews."
        action={
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-200">{filtered.length}</span> records
          </div>
        }
      />

      <Panel>
        <div className="grid gap-3 border-b border-white/[0.07] p-4 sm:p-5 lg:grid-cols-[minmax(230px,1.5fr)_repeat(4,minmax(140px,1fr))]">
          <label className="relative">
            <span className="sr-only">Search patients</span>
            <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-600" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search patient or recommendation"
              className={`${fieldClass} pl-10`}
            />
          </label>
          <select
            aria-label="Recommendation type"
            value={recommendation}
            onChange={(event) => setRecommendation(event.target.value)}
            className={fieldClass}
          >
            <option value="">All recommendations</option>
            {["PTNS", "Botox", "SNM", "Conservative", "Surgery", "Medication", "Other"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select
            aria-label="Completion status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className={fieldClass}
          >
            <option value="">All statuses</option>
            <option value="started">Started</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="abandoned">Abandoned</option>
          </select>
          <input
            aria-label="Date from"
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className={fieldClass}
          />
          <input
            aria-label="Date to"
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className={fieldClass}
          />
        </div>

        {!filtered.length ? (
          <EmptyState
            title="No patient records match"
            description="Adjust the filters or wait for new conversations to arrive."
            icon="patients"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] border-collapse text-left">
              <thead>
                <tr className="border-b border-white/[0.07] text-[10px] uppercase tracking-[0.14em] text-slate-600">
                  {[
                    "Patient Name",
                    "Age",
                    "Date",
                    "Status",
                    "AI Recommendation",
                    "Doctor Recommendation",
                    "Concordance",
                    "",
                  ].map((heading) => (
                    <th key={heading} className="px-5 py-3 font-semibold">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((conversation) => {
                  const aiRecommendation = getAiRecommendation(conversation);
                  const doctorRecommendation = conversation.clinicalReview?.finalRecommendation;
                  const concordance =
                    conversation.clinicalReview?.concordance ||
                    calculateConcordance(aiRecommendation, doctorRecommendation);
                  return (
                    <tr
                      key={conversation.id}
                      className="border-b border-white/[0.05] text-xs transition hover:bg-white/[0.025]"
                    >
                      <td className="px-5 py-4">
                        <Link
                          href={`/admin/patient/${conversation.id}`}
                          className="font-medium text-slate-100 hover:text-cyan-200"
                        >
                          {getPatientName(conversation)}
                        </Link>
                        <p className="mt-1 max-w-[11rem] truncate text-[10px] text-slate-600">{conversation.id}</p>
                      </td>
                      <td className="px-5 py-4 text-slate-400">{getPatientAge(conversation) ?? "—"}</td>
                      <td className="px-5 py-4 text-slate-400">
                        {formatDate(conversation.startedAt || conversation.createdAt)}
                      </td>
                      <td className="px-5 py-4">
                        <Badge tone={statusTone(conversation.status)}>
                          {(conversation.status || "started").replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-slate-300">{aiRecommendation}</td>
                      <td className="px-5 py-4 text-slate-400">{doctorRecommendation || "Not reviewed"}</td>
                      <td className="px-5 py-4">
                        <Badge
                          tone={
                            concordance === "Match"
                              ? "success"
                              : concordance === "Partial Match"
                                ? "warning"
                                : concordance === "Different"
                                  ? "danger"
                                  : "neutral"
                          }
                        >
                          {concordance}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/admin/patient/${conversation.id}`}
                          aria-label={`Open ${getPatientName(conversation)}`}
                          className="inline-grid size-10 place-items-center rounded-xl text-slate-500 transition hover:bg-cyan-300/[0.08] hover:text-cyan-200"
                        >
                          <Icon name="chevron" className="size-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
