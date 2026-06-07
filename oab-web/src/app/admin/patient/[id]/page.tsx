"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  ClinicianReviewForm,
  PostClinicQuestionnaireForm,
  PreClinicQuestionnaireForm,
} from "@/components/admin/AssessmentForms";
import { ClinicianPdfButton } from "@/components/admin/ClinicianPdfButton";
import { Icon } from "@/components/admin/icons";
import { useAdminData } from "@/components/admin/useAdminData";
import { Badge, EmptyState, LoadingState, PageHeader, Panel } from "@/components/admin/ui";
import {
  assessmentChannel,
  assessmentHasPdf,
  assessmentIsCompleted,
  assessmentMessageCount,
  assessmentPdfUrl,
  assessmentRecommendation,
  assessmentStoragePath,
  formatDate,
  formatDurationMinutes,
  subscribeAssessmentSubcollection,
} from "@/lib/admin-data";
import type {
  AssessmentClinicianReview,
  PostClinicQuestionnaire,
  PreClinicQuestionnaire,
} from "@/types/admin";

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
        {label}
      </dt>
      <dd className="mt-2 text-sm leading-6 text-slate-300">{children}</dd>
    </div>
  );
}

export default function PatientDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const requestedSection = searchParams.get("section");
  const section =
    requestedSection === "pre-clinic" ||
    requestedSection === "post-clinic" ||
    requestedSection === "clinician-review"
      ? requestedSection
      : "overview";
  const { assessments, loading } = useAdminData();
  const assessment = assessments.find((item) => item.assessmentId === params.id);
  const [preClinic, setPreClinic] = useState<PreClinicQuestionnaire | null>(null);
  const [postClinic, setPostClinic] = useState<PostClinicQuestionnaire | null>(null);
  const [review, setReview] = useState<AssessmentClinicianReview | null>(null);

  useEffect(() => {
    if (!assessment) return;
    const unsubPre = subscribeAssessmentSubcollection<PreClinicQuestionnaire>(
      assessment.assessmentId,
      "preClinicQuestionnaire",
      setPreClinic,
    );
    const unsubPost = subscribeAssessmentSubcollection<PostClinicQuestionnaire>(
      assessment.assessmentId,
      "postClinicQuestionnaire",
      setPostClinic,
    );
    const unsubReview = subscribeAssessmentSubcollection<AssessmentClinicianReview>(
      assessment.assessmentId,
      "clinicianReview",
      setReview,
    );
    return () => {
      unsubPre();
      unsubPost();
      unsubReview();
    };
  }, [assessment]);

  if (loading) return <LoadingState />;
  if (!assessment) {
    return (
      <Panel>
        <EmptyState
          title="Assessment not found"
          description="The record may be outside your hospital access or may not exist."
          icon="patients"
        />
      </Panel>
    );
  }

  return (
    <div className="space-y-7">
      <Link
        href="/admin/patients"
        className="inline-flex min-h-11 items-center gap-2 rounded-xl text-xs text-slate-500 transition hover:text-cyan-200"
      >
        <Icon name="chevron" className="size-4 rotate-180" />
        Back to patients
      </Link>

      <PageHeader
        eyebrow={assessment.assessmentId}
        title={assessment.firstName || "Anonymous patient"}
        description={`Permanent assessment record · ${assessment.hospitalId}`}
        action={
          <Badge tone={assessment.reviewStatus === "reviewed" ? "success" : "warning"}>
            {assessment.reviewStatus}
          </Badge>
        }
      />

      <nav
        aria-label="Assessment sections"
        className="flex gap-2 overflow-x-auto rounded-2xl border border-white/[0.07] bg-[#07101f]/70 p-2"
      >
        {[
          ["overview", "Assessment overview"],
          ["pre-clinic", "Pre-clinic questionnaire"],
          ["clinician-review", "Clinician review"],
          ["post-clinic", "Post-clinic questionnaire"],
        ].map(([key, label]) => (
          <Link
            key={key}
            href={
              key === "overview"
                ? `/admin/patient/${assessment.assessmentId}`
                : `/admin/patient/${assessment.assessmentId}?section=${key}`
            }
            className={`inline-flex min-h-11 shrink-0 items-center rounded-xl px-4 text-xs font-medium transition ${
              section === key
                ? "bg-cyan-200 text-[#031018]"
                : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {section === "overview" ? (
        <>
          <section className="grid gap-5 xl:grid-cols-2">
        <Panel title="Assessment">
          <dl className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
            <Detail label="Date">{formatDate(assessment.createdAt, true)}</Detail>
            <Detail label="Channel">{assessmentChannel(assessment)}</Detail>
            <Detail label="Completion status">
              {assessmentIsCompleted(assessment) ? "Completed" : "In progress"}
            </Detail>
            <Detail label="Conversation duration">
              {formatDurationMinutes(assessment.conversationDurationMinutes)}
            </Detail>
            <Detail label="Message count">{assessmentMessageCount(assessment)}</Detail>
            <Detail label="Patient">
              {[assessment.firstName, assessment.age, assessment.sex]
                .filter((value) => value !== undefined && value !== null && value !== "")
                .join(" · ") || "Not recorded"}
            </Detail>
          </dl>
        </Panel>

        <Panel title="AI Recommendation">
          <div className="p-5 sm:p-6">
            <p className="font-[var(--font-display)] text-3xl font-semibold text-[#f8f1d5]">
              {assessmentRecommendation(assessment) || "Not recorded"}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Prompt version {assessment.promptVersion || "Not recorded"}
            </p>
            <p className="mt-5 text-sm leading-7 text-slate-400">
              {assessment.recommendationRationale || "No rationale has been stored."}
            </p>
          </div>
        </Panel>
          </section>

          <Panel
            title="PDF Information"
            description={`Retained until: ${formatDate(
              assessment.reportRetentionUntil || assessment.reportExpiryDate,
            )}`}
          >
        <div className="p-5 sm:p-6">
          {assessmentHasPdf(assessment) ? (
            <div className="space-y-4">
              <ClinicianPdfButton
                storagePath={assessmentStoragePath(assessment)}
                fallbackUrl={assessmentPdfUrl(assessment)}
              />
              <dl className="grid gap-4 text-xs sm:grid-cols-2">
                <Detail label="Generated">
                  {formatDate(
                    assessment.pdfCreatedAt || assessment.reportCreatedAt,
                    true,
                  )}
                </Detail>
                <Detail label="Patient link expires">
                  {formatDate(assessment.pdfDownloadUrlExpiresAt, true)}
                </Detail>
              </dl>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No report has been generated.</p>
          )}
        </div>
          </Panel>

          <section className="grid gap-5 xl:grid-cols-3">
        <Panel title="Symptom Summary" className="xl:col-span-1">
          <p className="p-5 text-sm leading-7 text-slate-400 sm:p-6">
            {assessment.symptomSummary || "Not recorded"}
          </p>
        </Panel>
        <Panel title="Previous Treatments" className="xl:col-span-1">
          <p className="p-5 text-sm leading-7 text-slate-400 sm:p-6">
            {assessment.previousTreatments || "Not recorded"}
          </p>
        </Panel>
        <Panel title="Social Factors" className="xl:col-span-1">
          <p className="p-5 text-sm leading-7 text-slate-400 sm:p-6">
            {assessment.socialFactors || "Not recorded"}
          </p>
        </Panel>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <Panel title="Questionnaire Responses">
              <div className="p-5 text-sm leading-7 text-slate-400 sm:p-6">
                {preClinic || postClinic
                  ? "Questionnaire responses are available in the assessment tabs above."
                  : "No questionnaire responses have been recorded yet."}
              </div>
            </Panel>
            <Panel title="Clinician Review">
              <div className="p-5 text-sm leading-7 text-slate-400 sm:p-6">
                {review
                  ? "A clinician review is available in the Clinician review tab."
                  : "This assessment has not yet been reviewed by a clinician."}
              </div>
            </Panel>
          </section>
        </>
      ) : null}

      {section === "pre-clinic" ? (
        <PreClinicQuestionnaireForm assessment={assessment} initialValue={preClinic} />
      ) : null}
      {section === "clinician-review" ? (
        <ClinicianReviewForm assessment={assessment} initialValue={review} />
      ) : null}
      {section === "post-clinic" ? (
        <PostClinicQuestionnaireForm assessment={assessment} initialValue={postClinic} />
      ) : null}
    </div>
  );
}
