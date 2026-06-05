"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import { Icon } from "@/components/admin/icons";
import { Badge, fieldClass, FieldLabel, Panel } from "@/components/admin/ui";
import {
  normalizeRecommendation,
  saveAssessmentClinicianReview,
  savePostClinicQuestionnaire,
  savePreClinicQuestionnaire,
} from "@/lib/admin-data";
import type {
  AssessmentClinicianReview,
  PatientAssessment,
  PostClinicQuestionnaire,
  PreClinicQuestionnaire,
  QuestionnaireScore,
} from "@/types/admin";

const treatments = [
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

function ScoreField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value?: QuestionnaireScore;
  onChange: (value: QuestionnaireScore | undefined) => void;
}) {
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <select
        id={id}
        value={value || ""}
        onChange={(event) =>
          onChange(
            event.target.value
              ? (Number(event.target.value) as QuestionnaireScore)
              : undefined,
          )
        }
        className={fieldClass}
      >
        <option value="">Not recorded</option>
        {[1, 2, 3, 4, 5].map((score) => (
          <option key={score} value={score}>
            {score}
          </option>
        ))}
      </select>
    </div>
  );
}

function FormFooter({
  saving,
  saved,
  error,
  label,
}: {
  saving: boolean;
  saved: boolean;
  error: string;
  label: string;
}) {
  return (
    <>
      {error ? (
        <p className="rounded-xl border border-rose-400/15 bg-rose-400/[0.07] px-4 py-3 text-xs text-rose-200">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col-reverse gap-3 border-t border-white/[0.07] pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">
          {saved ? "Saved to Firestore with a server timestamp." : "Changes are not saved automatically."}
        </p>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-cyan-200 px-5 text-sm font-semibold text-[#031018] transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Icon name="check" className="size-4" />
          {saving ? "Saving..." : label}
        </button>
      </div>
    </>
  );
}

function QuestionnaireForm({
  title,
  description,
  children,
  onSubmit,
  saving,
  saved,
  error,
  label,
}: {
  title: string;
  description: string;
  children: ReactNode;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
  saved: boolean;
  error: string;
  label: string;
}) {
  return (
    <form onSubmit={onSubmit}>
      <Panel title={title} description={description}>
        <div className="space-y-6 p-5 sm:p-6">
          {children}
          <FormFooter
            saving={saving}
            saved={saved}
            error={error}
            label={label}
          />
        </div>
      </Panel>
    </form>
  );
}

export function PreClinicQuestionnaireForm({
  assessment,
  initialValue,
}: {
  assessment: PatientAssessment;
  initialValue?: PreClinicQuestionnaire | null;
}) {
  const [value, setValue] = useState<PreClinicQuestionnaire>(initialValue || {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => setValue(initialValue || {}), [initialValue]);

  function score(key: keyof PreClinicQuestionnaire, next?: QuestionnaireScore) {
    setSaved(false);
    setValue((current) => ({ ...current, [key]: next }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await savePreClinicQuestionnaire(assessment, value);
      setSaved(true);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to save questionnaire.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <QuestionnaireForm
      title="Pre-Clinic Questionnaire"
      description="Patient experience measures collected before the clinical appointment"
      onSubmit={submit}
      saving={saving}
      saved={saved}
      error={error}
      label="Save pre-clinic responses"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ScoreField id="understanding" label="Understanding" value={value.understanding} onChange={(next) => score("understanding", next)} />
        <ScoreField id="patientKnowledge" label="Patient Knowledge" value={value.patientKnowledge} onChange={(next) => score("patientKnowledge", next)} />
        <ScoreField id="preparedness" label="Preparedness" value={value.preparedness} onChange={(next) => score("preparedness", next)} />
        <ScoreField id="decisionConfidence" label="Decision Confidence" value={value.decisionConfidence} onChange={(next) => score("decisionConfidence", next)} />
        <ScoreField id="sharedDecisionMaking" label="Shared Decision Making" value={value.sharedDecisionMaking} onChange={(next) => score("sharedDecisionMaking", next)} />
        <ScoreField id="recommendationSatisfaction" label="Recommendation Satisfaction" value={value.recommendationSatisfaction} onChange={(next) => score("recommendationSatisfaction", next)} />
        <ScoreField id="usability" label="Usability" value={value.usability} onChange={(next) => score("usability", next)} />
        <ScoreField id="chatbotSupportive" label="Chatbot Supportive" value={value.chatbotSupportive} onChange={(next) => score("chatbotSupportive", next)} />
        <ScoreField id="recommendChatbot" label="Recommend Chatbot" value={value.recommendChatbot} onChange={(next) => score("recommendChatbot", next)} />
        <div>
          <FieldLabel htmlFor="pdaType">PDA Type</FieldLabel>
          <select
            id="pdaType"
            value={value.pdaType || ""}
            onChange={(event) => {
              setSaved(false);
              setValue((current) => ({
                ...current,
                pdaType: event.target.value
                  ? (event.target.value as PreClinicQuestionnaire["pdaType"])
                  : undefined,
              }));
            }}
            className={fieldClass}
          >
            <option value="">Not recorded</option>
            <option value="paper">Paper</option>
            <option value="chatbot">Chatbot</option>
          </select>
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <FieldLabel htmlFor="missingInformation">Missing Information</FieldLabel>
          <textarea
            id="missingInformation"
            rows={3}
            value={value.missingInformation || ""}
            onChange={(event) => {
              setSaved(false);
              setValue((current) => ({ ...current, missingInformation: event.target.value }));
            }}
            className={fieldClass}
          />
        </div>
      </div>
    </QuestionnaireForm>
  );
}

export function ClinicianReviewForm({
  assessment,
  initialValue,
}: {
  assessment: PatientAssessment;
  initialValue?: AssessmentClinicianReview | null;
}) {
  const { clinician } = useAdminAuth();
  const [value, setValue] = useState<AssessmentClinicianReview>(initialValue || {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => setValue(initialValue || {}), [initialValue]);
  const concordant =
    Boolean(value.clinicianTreatment) &&
    normalizeRecommendation(value.clinicianTreatment) ===
      normalizeRecommendation(assessment.recommendedTreatment);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await saveAssessmentClinicianReview(assessment, value, clinician);
      setSaved(true);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to save review.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <QuestionnaireForm
      title="Clinician Review"
      description="Compare the AI recommendation with the final clinical decision"
      onSubmit={submit}
      saving={saving}
      saved={saved}
      error={error}
      label="Save clinician review"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <FieldLabel>AI Treatment</FieldLabel>
          <div className="min-h-11 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.05] px-3.5 py-3 text-sm text-cyan-100">
            {assessment.recommendedTreatment || "Not recorded"}
          </div>
        </div>
        <div>
          <FieldLabel htmlFor="clinicianTreatment">Clinician Treatment</FieldLabel>
          <select
            id="clinicianTreatment"
            required
            value={value.clinicianTreatment || ""}
            onChange={(event) => {
              setSaved(false);
              setValue((current) => ({ ...current, clinicianTreatment: event.target.value }));
            }}
            className={fieldClass}
          >
            <option value="">Select treatment</option>
            {treatments.map((treatment) => (
              <option key={treatment}>{treatment}</option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>Concordance</FieldLabel>
          <div className="min-h-11 pt-2">
            <Badge tone={value.clinicianTreatment ? (concordant ? "success" : "danger") : "neutral"}>
              {value.clinicianTreatment
                ? concordant
                  ? "Concordant"
                  : "Discordant"
                : "Awaiting review"}
            </Badge>
          </div>
        </div>
        <div>
          <FieldLabel htmlFor="discordanceReason">Discordance Reason</FieldLabel>
          <textarea
            id="discordanceReason"
            rows={3}
            required={Boolean(value.clinicianTreatment && !concordant)}
            value={value.discordanceReason || ""}
            onChange={(event) => {
              setSaved(false);
              setValue((current) => ({ ...current, discordanceReason: event.target.value }));
            }}
            className={fieldClass}
            placeholder="e.g. Bladder outflow obstruction on urodynamics"
          />
        </div>
      </div>
    </QuestionnaireForm>
  );
}

export function PostClinicQuestionnaireForm({
  assessment,
  initialValue,
}: {
  assessment: PatientAssessment;
  initialValue?: PostClinicQuestionnaire | null;
}) {
  const [value, setValue] = useState<PostClinicQuestionnaire>(initialValue || {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => setValue(initialValue || {}), [initialValue]);

  function score(key: keyof PostClinicQuestionnaire, next?: QuestionnaireScore) {
    setSaved(false);
    setValue((current) => ({ ...current, [key]: next }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await savePostClinicQuestionnaire(assessment, value);
      setSaved(true);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to save questionnaire.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <QuestionnaireForm
      title="Post-Clinic Questionnaire"
      description="Patient experience measures collected after the clinical appointment"
      onSubmit={submit}
      saving={saving}
      saved={saved}
      error={error}
      label="Save post-clinic responses"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ScoreField id="appointmentPreparedness" label="Appointment Preparedness" value={value.appointmentPreparedness} onChange={(next) => score("appointmentPreparedness", next)} />
        <ScoreField id="treatmentUnderstanding" label="Treatment Understanding" value={value.treatmentUnderstanding} onChange={(next) => score("treatmentUnderstanding", next)} />
        <ScoreField id="questionsAnswered" label="Questions Answered" value={value.questionsAnswered} onChange={(next) => score("questionsAnswered", next)} />
        <ScoreField id="stillHelpful" label="Still Helpful" value={value.stillHelpful} onChange={(next) => score("stillHelpful", next)} />
        <ScoreField id="comfortableWithPlan" label="Comfortable With Plan" value={value.comfortableWithPlan} onChange={(next) => score("comfortableWithPlan", next)} />
        <ScoreField id="recommendToOthers" label="Recommend To Others" value={value.recommendToOthers} onChange={(next) => score("recommendToOthers", next)} />
        <div>
          <FieldLabel htmlFor="recommendationMatchedDoctor">
            Recommendation Matched Doctor
          </FieldLabel>
          <select
            id="recommendationMatchedDoctor"
            value={value.recommendationMatchedDoctor || ""}
            onChange={(event) => {
              setSaved(false);
              setValue((current) => ({
                ...current,
                recommendationMatchedDoctor:
                  event.target.value
                    ? (event.target.value as PostClinicQuestionnaire["recommendationMatchedDoctor"])
                    : undefined,
              }));
            }}
            className={fieldClass}
          >
            <option value="">Not recorded</option>
            <option value="yes">Yes</option>
            <option value="partially">Partially</option>
            <option value="no">No</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <FieldLabel htmlFor="differenceReason">Difference Reason</FieldLabel>
          <textarea
            id="differenceReason"
            rows={3}
            value={value.differenceReason || ""}
            onChange={(event) => {
              setSaved(false);
              setValue((current) => ({ ...current, differenceReason: event.target.value }));
            }}
            className={fieldClass}
          />
        </div>
      </div>
    </QuestionnaireForm>
  );
}
