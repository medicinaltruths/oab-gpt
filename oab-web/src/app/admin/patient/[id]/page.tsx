"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  ClinicianReviewForm,
  PostClinicQuestionnaireForm,
  PreClinicQuestionnaireForm,
} from "@/components/admin/AssessmentForms";
import { Icon } from "@/components/admin/icons";
import { useAdminData } from "@/components/admin/useAdminData";
import { Badge, EmptyState, LoadingState, PageHeader, Panel } from "@/components/admin/ui";
import {
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

      <section className="grid gap-5 xl:grid-cols-2">
        <Panel title="Assessment">
          <dl className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
            <Detail label="Date">{formatDate(assessment.createdAt, true)}</Detail>
            <Detail label="Source">{assessment.source}</Detail>
            <Detail label="Completion status">
              {assessment.conversationCompleted ? "Completed" : "In progress"}
            </Detail>
            <Detail label="Conversation duration">
              {formatDurationMinutes(assessment.conversationDurationMinutes)}
            </Detail>
            <Detail label="Message count">{assessment.messageCount || 0}</Detail>
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
              {assessment.recommendedTreatment || "Not recorded"}
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

      <Panel title="PDF Report" description={`Retention expiry: ${formatDate(assessment.reportExpiryDate)}`}>
        <div className="p-5 sm:p-6">
          {assessment.pdfUrl ? (
            <a
              href={assessment.pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-200 px-5 text-sm font-semibold text-[#031018] transition hover:bg-cyan-100"
            >
              <Icon name="document" className="size-4" />
              Open PDF
            </a>
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

      <PreClinicQuestionnaireForm assessment={assessment} initialValue={preClinic} />
      <ClinicianReviewForm assessment={assessment} initialValue={review} />
      <PostClinicQuestionnaireForm assessment={assessment} initialValue={postClinic} />
    </div>
  );
}
