"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import { Icon } from "@/components/admin/icons";
import { Badge, fieldClass, FieldLabel, Panel } from "@/components/admin/ui";
import { deriveConcordance, saveClinicalReview } from "@/lib/admin-data";
import type { ClinicalReview, Concordance, InvestigationFindings } from "@/types/admin";

const diagnoses = [
  "Overactive Bladder (OAB)",
  "OAB + Bladder Outlet Obstruction",
  "Detrusor Overactivity",
  "Mixed Urinary Incontinence",
  "Stress Urinary Incontinence",
  "Neurogenic Bladder",
  "Other",
];

const urodynamicsOptions = [
  "Not performed",
  "Normal",
  "Detrusor Overactivity",
  "Bladder Outlet Obstruction",
  "Reduced Compliance",
  "Underactive Bladder",
  "Mixed Findings",
];

const recommendations = [
  "Conservative Management",
  "Bladder Training",
  "Medication",
  "PTNS",
  "Botox",
  "Sacral Neuromodulation",
  "TURP",
  "HoLEP",
  "Other",
];

const discordanceReasons = [
  "Additional investigation findings",
  "Urodynamic findings",
  "Flow rate findings",
  "Prostate enlargement",
  "Neurological diagnosis",
  "Patient preference",
  "Clinical contraindication",
  "Other",
];

function toNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function concordanceTone(concordance: Concordance) {
  if (concordance === "Match") return "success" as const;
  if (concordance === "Partial Match") return "warning" as const;
  if (concordance === "Different") return "danger" as const;
  return "neutral" as const;
}

export function ClinicalReviewForm({
  conversationId,
  aiRecommendation,
  initialReview,
}: {
  conversationId: string;
  aiRecommendation: string;
  initialReview?: ClinicalReview;
}) {
  const { clinician } = useAdminAuth();
  const [review, setReview] = useState<ClinicalReview>(initialReview || {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setReview(initialReview || {});
  }, [initialReview]);

  const concordance = useMemo(
    () => deriveConcordance(aiRecommendation, review),
    [aiRecommendation, review],
  );

  function update<K extends keyof ClinicalReview>(key: K, value: ClinicalReview[K]) {
    setSaved(false);
    setReview((current) => ({ ...current, [key]: value }));
  }

  function updateInvestigation<K extends keyof InvestigationFindings>(
    key: K,
    value: InvestigationFindings[K],
  ) {
    setSaved(false);
    setReview((current) => ({
      ...current,
      investigations: { ...current.investigations, [key]: value },
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      await saveClinicalReview(
        conversationId,
        { ...review, concordance },
        clinician,
        aiRecommendation,
      );
      setReview((current) => ({ ...current, concordance }));
      setSaved(true);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to save the clinical review.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Panel
        title="Clinical Review"
        description="Record the final clinical assessment and recommendation"
        action={
          <Badge tone={concordanceTone(concordance)}>
            {concordance === "Not reviewed" ? "Awaiting recommendation" : concordance}
          </Badge>
        }
      >
        <div className="space-y-8 p-5 sm:p-6">
          <fieldset>
            <legend className="text-sm font-semibold text-slate-100">Diagnosis</legend>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <FieldLabel htmlFor="diagnosis">Primary diagnosis</FieldLabel>
                <select
                  id="diagnosis"
                  value={review.diagnosis || ""}
                  onChange={(event) => update("diagnosis", event.target.value)}
                  className={fieldClass}
                >
                  <option value="">Select diagnosis</option>
                  {diagnoses.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>
              {review.diagnosis === "Other" ? (
                <div>
                  <FieldLabel htmlFor="diagnosis-other">Other diagnosis</FieldLabel>
                  <input
                    id="diagnosis-other"
                    value={review.diagnosisOther || ""}
                    onChange={(event) => update("diagnosisOther", event.target.value)}
                    className={fieldClass}
                  />
                </div>
              ) : null}
            </div>
          </fieldset>

          <fieldset className="border-t border-white/[0.07] pt-7">
            <legend className="text-sm font-semibold text-slate-100">Investigations</legend>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="md:col-span-2 xl:col-span-1">
                <FieldLabel htmlFor="urodynamics">Urodynamics</FieldLabel>
                <select
                  id="urodynamics"
                  value={review.investigations?.urodynamics || ""}
                  onChange={(event) => updateInvestigation("urodynamics", event.target.value)}
                  className={fieldClass}
                >
                  <option value="">Select finding</option>
                  {urodynamicsOptions.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel htmlFor="qmax">Flow Rate — Qmax (ml/s)</FieldLabel>
                <input
                  id="qmax"
                  type="number"
                  min="0"
                  step="0.1"
                  value={review.investigations?.qmax ?? ""}
                  onChange={(event) => updateInvestigation("qmax", toNumber(event.target.value))}
                  className={fieldClass}
                />
              </div>
              <div>
                <FieldLabel htmlFor="voided-volume">Voided Volume (ml)</FieldLabel>
                <input
                  id="voided-volume"
                  type="number"
                  min="0"
                  value={review.investigations?.voidedVolume ?? ""}
                  onChange={(event) => updateInvestigation("voidedVolume", toNumber(event.target.value))}
                  className={fieldClass}
                />
              </div>
              <div>
                <FieldLabel htmlFor="pvr">Post Void Residual — PVR (ml)</FieldLabel>
                <input
                  id="pvr"
                  type="number"
                  min="0"
                  value={review.investigations?.pvr ?? ""}
                  onChange={(event) => updateInvestigation("pvr", toNumber(event.target.value))}
                  className={fieldClass}
                />
              </div>
              <div>
                <FieldLabel htmlFor="prostate-size">Prostate Size (cc)</FieldLabel>
                <input
                  id="prostate-size"
                  type="number"
                  min="0"
                  value={review.investigations?.prostateSize ?? ""}
                  onChange={(event) => updateInvestigation("prostateSize", toNumber(event.target.value))}
                  className={fieldClass}
                />
              </div>
              <div className="md:col-span-2 xl:col-span-3">
                <FieldLabel htmlFor="other-findings">Other Investigation Findings</FieldLabel>
                <textarea
                  id="other-findings"
                  rows={3}
                  value={review.investigations?.otherFindings || ""}
                  onChange={(event) => updateInvestigation("otherFindings", event.target.value)}
                  className={fieldClass}
                  placeholder="Record imaging, cystoscopy, urine testing, or other relevant findings."
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="border-t border-white/[0.07] pt-7">
            <legend className="text-sm font-semibold text-slate-100">Final Clinician Recommendation</legend>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <FieldLabel htmlFor="final-recommendation">Recommendation</FieldLabel>
                <select
                  id="final-recommendation"
                  required
                  value={review.finalRecommendation || ""}
                  onChange={(event) => update("finalRecommendation", event.target.value)}
                  className={fieldClass}
                >
                  <option value="">Select recommendation</option>
                  {recommendations.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>
              {review.finalRecommendation === "Other" ? (
                <div>
                  <FieldLabel htmlFor="recommendation-other">Other recommendation</FieldLabel>
                  <input
                    id="recommendation-other"
                    value={review.finalRecommendationOther || ""}
                    onChange={(event) => update("finalRecommendationOther", event.target.value)}
                    className={fieldClass}
                  />
                </div>
              ) : null}
              <div className="md:col-span-2">
                <FieldLabel htmlFor="rationale">Clinician Rationale</FieldLabel>
                <textarea
                  id="rationale"
                  rows={4}
                  required
                  value={review.rationale || ""}
                  onChange={(event) => update("rationale", event.target.value)}
                  className={fieldClass}
                  placeholder="e.g. Urodynamics demonstrated high-pressure voiding with significant bladder outlet obstruction..."
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="border-t border-white/[0.07] pt-7">
            <legend className="text-sm font-semibold text-slate-100">Recommendation Concordance</legend>
            <div className="mt-4 grid gap-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 sm:grid-cols-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-slate-600">AI recommendation</p>
                <p className="mt-2 text-sm font-medium text-cyan-100">{aiRecommendation}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-slate-600">Clinician recommendation</p>
                <p className="mt-2 text-sm font-medium text-slate-200">
                  {review.finalRecommendation || "Not selected"}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-slate-600">Calculated result</p>
                <div className="mt-2">
                  <Badge tone={concordanceTone(concordance)}>{concordance}</Badge>
                </div>
              </div>
            </div>

            {concordance === "Partial Match" || concordance === "Different" ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <FieldLabel htmlFor="discordance-reason">Reason For Discordance</FieldLabel>
                  <select
                    id="discordance-reason"
                    required
                    value={review.discordanceReason || ""}
                    onChange={(event) => update("discordanceReason", event.target.value)}
                    className={fieldClass}
                  >
                    <option value="">Select reason</option>
                    {discordanceReasons.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <FieldLabel htmlFor="discordance-notes">Discordance notes</FieldLabel>
                  <textarea
                    id="discordance-notes"
                    rows={3}
                    value={review.discordanceNotes || ""}
                    onChange={(event) => update("discordanceNotes", event.target.value)}
                    className={fieldClass}
                    placeholder="Add clinical context."
                  />
                </div>
              </div>
            ) : null}
          </fieldset>

          <fieldset className="border-t border-white/[0.07] pt-7">
            <legend className="text-sm font-semibold text-slate-100">Patient Decision and Follow-up</legend>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <FieldLabel htmlFor="accepted">Patient Accepted Recommendation</FieldLabel>
                <select
                  id="accepted"
                  value={review.patientAcceptedRecommendation || ""}
                  onChange={(event) =>
                    update(
                      "patientAcceptedRecommendation",
                      event.target.value as ClinicalReview["patientAcceptedRecommendation"],
                    )
                  }
                  className={fieldClass}
                >
                  <option value="">Not recorded</option>
                  <option>Yes</option>
                  <option>No</option>
                  <option>Unsure</option>
                </select>
              </div>
              <div>
                <FieldLabel htmlFor="outcome">Follow-up Outcome (optional)</FieldLabel>
                <select
                  id="outcome"
                  value={review.followUpOutcome || ""}
                  onChange={(event) =>
                    update("followUpOutcome", event.target.value as ClinicalReview["followUpOutcome"])
                  }
                  className={fieldClass}
                >
                  <option value="">Not recorded</option>
                  <option>Symptoms improved</option>
                  <option>Symptoms unchanged</option>
                  <option>Symptoms worse</option>
                </select>
              </div>
            </div>
          </fieldset>

          {error ? (
            <p role="alert" className="rounded-xl border border-rose-400/15 bg-rose-400/[0.07] px-4 py-3 text-xs text-rose-200">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-3 border-t border-white/[0.07] pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              {saved ? "Clinical review saved with clinician and timestamp audit fields." : "Changes are not saved automatically."}
            </p>
            <button
              type="submit"
              disabled={saving}
              className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-cyan-200 px-5 text-sm font-semibold text-[#031018] transition hover:bg-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-200/50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Icon name="check" className="size-4" />
              {saving ? "Saving review..." : "Save clinical review"}
            </button>
          </div>
        </div>
      </Panel>
    </form>
  );
}
