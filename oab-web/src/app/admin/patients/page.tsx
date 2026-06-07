"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/admin/icons";
import { ClinicianPdfButton } from "@/components/admin/ClinicianPdfButton";
import { useAdminData } from "@/components/admin/useAdminData";
import {
  Badge,
  EmptyState,
  fieldClass,
  LoadingState,
  PageHeader,
  Panel,
} from "@/components/admin/ui";
import {
  assessmentHasPdf,
  assessmentIsCompleted,
  assessmentPdfUrl,
  assessmentRecommendation,
  assessmentStoragePath,
  formatDate,
  normalizeRecommendation,
  toDate,
} from "@/lib/admin-data";

export default function PatientsPage() {
  const { assessments, loading } = useAdminData();
  const [search, setSearch] = useState("");
  const [age, setAge] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [reviewStatus, setReviewStatus] = useState("");
  const [date, setDate] = useState("");

  const filtered = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    return [...assessments]
      .filter((assessment) => {
        const treatment = normalizeRecommendation(assessmentRecommendation(assessment));
        const assessmentDate = toDate(assessment.createdAt);
        if (
          searchTerm &&
          !`${assessment.assessmentId} ${assessment.firstName || ""}`
            .toLowerCase()
            .includes(searchTerm)
        ) {
          return false;
        }
        if (age && assessment.age !== Number(age)) return false;
        if (recommendation && treatment !== recommendation) return false;
        if (reviewStatus && assessment.reviewStatus !== reviewStatus) return false;
        if (
          date &&
          (!assessmentDate ||
            assessmentDate.toISOString().slice(0, 10) !== date)
        ) {
          return false;
        }
        return true;
      })
      .sort(
        (left, right) =>
          (toDate(right.createdAt)?.getTime() || 0) -
          (toDate(left.createdAt)?.getTime() || 0),
      );
  }, [age, assessments, date, recommendation, reviewStatus, search]);

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Patient assessments"
        title="Patients"
        description="Search permanent Firestore assessment records and open clinical review workflows."
        action={
          <p className="text-xs text-slate-500">
            <span className="font-semibold text-slate-200">{filtered.length}</span>{" "}
            records
          </p>
        }
      />

      <Panel title="Search and filters">
        <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-[minmax(230px,1.5fr)_repeat(4,minmax(135px,1fr))]">
          <label className="relative">
            <span className="sr-only">Assessment ID or first name</span>
            <Icon
              name="search"
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-600"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Assessment ID or first name"
              className={`${fieldClass} pl-10`}
            />
          </label>
          <input
            aria-label="Patient age"
            type="number"
            min="0"
            value={age}
            onChange={(event) => setAge(event.target.value)}
            placeholder="Age"
            className={fieldClass}
          />
          <select
            aria-label="Treatment recommendation"
            value={recommendation}
            onChange={(event) => setRecommendation(event.target.value)}
            className={fieldClass}
          >
            <option value="">All treatments</option>
            {["PTNS", "Botox", "SNM", "Medication", "Conservative", "Other"].map(
              (item) => (
                <option key={item}>{item}</option>
              ),
            )}
          </select>
          <input
            aria-label="Assessment date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className={fieldClass}
          />
          <select
            aria-label="Review status"
            value={reviewStatus}
            onChange={(event) => setReviewStatus(event.target.value)}
            className={fieldClass}
          >
            <option value="">All review statuses</option>
            <option value="pending">Pending</option>
            <option value="reviewed">Reviewed</option>
          </select>
        </div>
      </Panel>

      {!filtered.length ? (
        <Panel>
          <EmptyState
            title="No assessment records match"
            description="Adjust the search filters or check Data Sources to confirm assessments are being written."
            icon="patients"
          />
        </Panel>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((assessment) => (
            <article
              key={assessment.assessmentId}
              className="rounded-2xl border border-white/[0.08] bg-[#07101f]/90 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.18)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300/60">
                    {assessment.assessmentId}
                  </p>
                  <h2 className="mt-2 truncate font-[var(--font-display)] text-2xl font-semibold text-[#f8f1d5]">
                    {assessment.firstName || "Anonymous patient"}
                  </h2>
                </div>
                <Badge tone={assessment.reviewStatus === "reviewed" ? "success" : "warning"}>
                  {assessment.reviewStatus || "pending"}
                </Badge>
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-4 border-y border-white/[0.06] py-4 text-xs">
                <div>
                  <dt className="text-slate-600">Age</dt>
                  <dd className="mt-1 font-medium text-slate-300">{assessment.age ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-600">Sex</dt>
                  <dd className="mt-1 font-medium text-slate-300">
                    {assessment.sex || "Not recorded"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-600">Date</dt>
                  <dd className="mt-1 font-medium text-slate-300">
                    {formatDate(assessment.createdAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-600">Completion</dt>
                  <dd className="mt-1 font-medium text-slate-300">
                    {assessmentIsCompleted(assessment) ? "Completed" : "In progress"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-600">PDF</dt>
                  <dd className="mt-1 font-medium text-slate-300">
                    {assessmentHasPdf(assessment) ? "Generated" : "Not generated"}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-slate-600">AI recommendation</dt>
                  <dd className="mt-1 font-medium text-cyan-100">
                    {assessmentRecommendation(assessment) || "Not yet recorded"}
                  </dd>
                </div>
              </dl>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href={`/admin/patient/${assessment.assessmentId}`}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-200 px-4 text-xs font-semibold text-[#031018] transition hover:bg-cyan-100"
                >
                  Open assessment
                  <Icon name="arrow" className="size-4" />
                </Link>
                <Link
                  href={`/admin/patient/${assessment.assessmentId}?section=pre-clinic`}
                  className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-300/[0.06] px-3 text-center text-xs font-medium text-cyan-100 transition hover:bg-cyan-300/[0.11]"
                >
                  Pre-clinic questionnaire
                </Link>
                <Link
                  href={`/admin/patient/${assessment.assessmentId}?section=post-clinic`}
                  className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-violet-300/15 bg-violet-300/[0.06] px-3 text-center text-xs font-medium text-violet-100 transition hover:bg-violet-300/[0.11]"
                >
                  Post-clinic questionnaire
                </Link>
                {assessmentHasPdf(assessment) ? (
                  <ClinicianPdfButton
                    storagePath={assessmentStoragePath(assessment)}
                    fallbackUrl={assessmentPdfUrl(assessment)}
                    className="border border-white/10 bg-transparent px-4 text-xs font-medium text-slate-300 hover:border-cyan-200/25 hover:bg-transparent hover:text-cyan-100"
                  />
                ) : null}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
