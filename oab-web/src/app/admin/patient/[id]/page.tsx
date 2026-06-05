"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { ClinicalReviewForm } from "@/components/admin/ClinicalReviewForm";
import { Icon } from "@/components/admin/icons";
import { useAdminData } from "@/components/admin/useAdminData";
import { Badge, EmptyState, LoadingState, PageHeader, Panel } from "@/components/admin/ui";
import {
  formatDate,
  formatDuration,
  getAiRecommendation,
  getPatientAge,
  getPatientName,
} from "@/lib/admin-data";

function displayKey(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function renderStructured(value: unknown): ReactNode {
  if (value === null || value === undefined || value === "") return <span className="text-slate-600">Not recorded</span>;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return (
      <ul className="space-y-2">
        {value.map((item, index) => (
          <li key={index} className="flex gap-2">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-cyan-300/60" />
            <span>{renderStructured(item)}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (typeof value === "object") {
    return (
      <dl className="grid gap-3 sm:grid-cols-2">
        {Object.entries(value as Record<string, unknown>).map(([key, item]) => (
          <div key={key} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <dt className="text-[10px] uppercase tracking-[0.12em] text-slate-600">{displayKey(key)}</dt>
            <dd className="mt-1.5 text-xs leading-5 text-slate-300">{renderStructured(item)}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return String(value);
}

function DetailBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">{title}</p>
      <div className="mt-2 text-sm leading-6 text-slate-300">{children}</div>
    </div>
  );
}

export default function PatientDetailPage() {
  const params = useParams<{ id: string }>();
  const { conversations, reports, surveys, loading } = useAdminData();
  if (loading) return <LoadingState />;

  const conversation = conversations.find((item) => item.id === params.id);
  if (!conversation) {
    return (
      <Panel>
        <EmptyState
          title="Patient record not found"
          description="The record may have been removed or is outside your hospital access."
          icon="patients"
        />
      </Panel>
    );
  }

  const patientReports = reports.filter(
    (item) => item.conversationId === conversation.id || (item.patientId && item.patientId === conversation.patientId),
  );
  const followUps = surveys.filter(
    (item) => item.conversationId === conversation.id || (item.patientId && item.patientId === conversation.patientId),
  );
  const reportUrl =
    conversation.reportUrl ||
    conversation.pdfUrl ||
    patientReports.find((item) => item.downloadUrl || item.url)?.downloadUrl ||
    patientReports.find((item) => item.downloadUrl || item.url)?.url;
  const aiRecommendation = getAiRecommendation(conversation);

  return (
    <div className="space-y-7">
      <Link
        href="/admin/patients"
        className="inline-flex min-h-11 items-center gap-2 rounded-xl text-xs text-slate-500 transition hover:text-cyan-200"
      >
        <Icon name="chevron" className="size-4 rotate-180" />
        Back to patient list
      </Link>
      <PageHeader
        eyebrow={`Patient record · ${conversation.id}`}
        title={getPatientName(conversation)}
        description={`Assessment started ${formatDate(conversation.startedAt || conversation.createdAt, true)}`}
        action={
          <Badge tone={conversation.status === "completed" ? "success" : "warning"}>
            {(conversation.status || "started").replace("_", " ")}
          </Badge>
        }
      />

      <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel title="Patient Demographics">
          <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
            <DetailBlock title="Name">{getPatientName(conversation)}</DetailBlock>
            <DetailBlock title="Age">{getPatientAge(conversation) ?? "Not recorded"}</DetailBlock>
            <DetailBlock title="Sex">{conversation.patient?.sex || conversation.sex || "Not recorded"}</DetailBlock>
            <DetailBlock title="Postcode">
              {conversation.patient?.postcode || conversation.postcode || "Not recorded"}
            </DetailBlock>
            <DetailBlock title="Conversation duration">
              {formatDuration(conversation.durationSeconds)}
            </DetailBlock>
            <DetailBlock title="Messages">
              {conversation.messageCount || conversation.transcript?.length || 0}
            </DetailBlock>
          </div>
        </Panel>

        <Panel title="AI Recommendation" description="Decision-support output from the patient conversation">
          <div className="p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl border border-cyan-300/15 bg-cyan-300/[0.08] text-cyan-100">
                <Icon name="sparkles" className="size-5" />
              </span>
              <p className="font-[var(--font-display)] text-2xl font-semibold text-[#f8f1d5]">
                {aiRecommendation}
              </p>
            </div>
            <p className="mt-5 text-sm leading-7 text-slate-400">
              {conversation.aiRecommendationRationale ||
                conversation.recommendation?.rationale ||
                "No recommendation rationale has been recorded."}
            </p>
            <div className="mt-6">
              {reportUrl ? (
                <a
                  href={reportUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.07] px-4 text-xs font-medium text-cyan-100 transition hover:bg-cyan-300/[0.12]"
                >
                  <Icon name="download" className="size-4" />
                  Open generated PDF
                </a>
              ) : (
                <p className="text-xs text-slate-600">No generated PDF is linked to this conversation.</p>
              )}
            </div>
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Panel title="Symptom Summary">
          <div className="p-5 text-sm leading-7 text-slate-300 sm:p-6">
            {conversation.symptomSummary || renderStructured(conversation.symptoms)}
          </div>
        </Panel>
        <Panel title="Impact Scores">
          <div className="p-5 sm:p-6">{renderStructured(conversation.impactScores)}</div>
        </Panel>
        <Panel title="Treatment History">
          <div className="p-5 text-sm leading-6 text-slate-300 sm:p-6">
            {renderStructured(conversation.treatmentHistory)}
          </div>
        </Panel>
        <Panel title="Social Factors">
          <div className="p-5 text-sm leading-6 text-slate-300 sm:p-6">
            {renderStructured(conversation.socialFactors)}
          </div>
        </Panel>
      </section>

      <Panel title="Conversation Transcript" description={`${conversation.transcript?.length || 0} messages`}>
        {!conversation.transcript?.length ? (
          <EmptyState title="No transcript available" icon="document" />
        ) : (
          <div className="max-h-[44rem] space-y-4 overflow-y-auto p-5 sm:p-6">
            {conversation.transcript.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[72%] ${
                    message.role === "user"
                      ? "rounded-br-md bg-cyan-200 text-[#041119]"
                      : "rounded-bl-md border border-white/[0.07] bg-white/[0.04] text-slate-300"
                  }`}
                >
                  <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.15em] opacity-60">
                    {message.role === "user" ? "Patient" : message.role === "assistant" ? "Felicity AI" : "System"}
                  </p>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Follow-up Survey Responses" description={`${followUps.length} submitted surveys`}>
        {!followUps.length ? (
          <EmptyState title="No follow-up survey submitted" icon="activity" />
        ) : (
          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
            {followUps.map((survey) => (
              <div key={survey.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                <p className="text-xs font-medium text-slate-200">
                  Submitted {formatDate(survey.submittedAt || survey.createdAt, true)}
                </p>
                <dl className="mt-4 grid grid-cols-3 gap-3">
                  {[
                    ["Preparedness", survey.preparednessScore],
                    ["Understanding", survey.understandingScore],
                    ["Satisfaction", survey.satisfactionScore],
                  ].map(([label, value]) => (
                    <div key={String(label)}>
                      <dt className="text-[9px] uppercase tracking-[0.12em] text-slate-600">{label}</dt>
                      <dd className="mt-1 text-lg font-semibold text-slate-100">{value ?? "—"}</dd>
                    </div>
                  ))}
                </dl>
                {survey.responses ? <div className="mt-4">{renderStructured(survey.responses)}</div> : null}
              </div>
            ))}
          </div>
        )}
      </Panel>

      <ClinicalReviewForm
        conversationId={conversation.id}
        aiRecommendation={aiRecommendation}
        initialReview={conversation.clinicalReview}
      />
    </div>
  );
}
