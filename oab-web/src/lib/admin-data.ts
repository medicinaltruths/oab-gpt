"use client";

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QuerySnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase";
import type {
  AnalyticsSnapshot,
  AssessmentClinicianReview,
  ClinicianAccount,
  DataSourceAuditRow,
  FirestoreDate,
  FunnelDatum,
  PatientAssessment,
  PostClinicQuestionnaire,
  PreClinicQuestionnaire,
  RecommendationDatum,
  TrendDatum,
} from "@/types/admin";

const RECOMMENDATION_COLORS: Record<string, string> = {
  PTNS: "#55d8e6",
  Botox: "#8da2fb",
  SNM: "#c7a6ff",
  Medication: "#f08aa8",
  Conservative: "#7dd3a8",
  Other: "#8190a8",
};

function mapSnapshot<T extends { id?: string }>(snapshot: QuerySnapshot<DocumentData>): T[] {
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T);
}

function writableFields<T extends { id?: string }>(value: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([key, item]) => key !== "id" && item !== undefined),
  );
}

export function toDate(value: FirestoreDate): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && "toDate" in value) return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDate(value: FirestoreDate, includeTime = false): string {
  const date = toDate(value);
  if (!date) return "Not recorded";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

export function formatDurationMinutes(minutes = 0): string {
  if (!minutes) return "0m";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = Math.round(minutes % 60);
  return `${hours}h ${remainder}m`;
}

export function normalizeRecommendation(value?: string): string {
  const normalized = (value || "").toLowerCase();
  if (normalized.includes("ptns") || normalized.includes("tibial")) return "PTNS";
  if (normalized.includes("botox") || normalized.includes("botulinum")) return "Botox";
  if (normalized.includes("snm") || normalized.includes("sacral")) return "SNM";
  if (normalized.includes("medication") || normalized.includes("medicine")) return "Medication";
  if (
    normalized.includes("conservative") ||
    normalized.includes("bladder training") ||
    normalized.includes("lifestyle")
  ) {
    return "Conservative";
  }
  return value?.trim() || "Other";
}

async function findClinicianAccount(email: string): Promise<ClinicianAccount | null> {
  const normalized = email.trim().toLowerCase();
  const snapshot = await getDoc(doc(getClientDb(), "clinician_accounts", normalized));
  if (!snapshot.exists()) return null;
  const account = { id: snapshot.id, ...snapshot.data() } as ClinicianAccount;
  if (account.email.trim().toLowerCase() !== normalized) return null;
  return account.active === false ? null : account;
}

export async function verifyClinicianEmail(email: string): Promise<ClinicianAccount | null> {
  return findClinicianAccount(email);
}

function hospitalIdsForAccount(account: ClinicianAccount): string[] {
  const configured = [
    account.hospitalId,
    ...(account.hospitalIds || []),
  ].filter(Boolean) as string[];
  return [...new Set(configured.length ? configured : ["esth"])];
}

export function subscribeAssessments(
  account: ClinicianAccount,
  callback: (records: PatientAssessment[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const hospitals = hospitalIdsForAccount(account);
  const base = collection(getClientDb(), "patient_assessments");
  const assessmentQuery =
    account.role === "super_admin"
      ? base
      : hospitals.length === 1
        ? query(base, where("hospitalId", "==", hospitals[0]))
        : hospitals.length > 1
          ? query(base, where("hospitalId", "in", hospitals.slice(0, 10)))
          : query(base, where("hospitalId", "==", "__no_hospital_access__"));
  return onSnapshot(
    assessmentQuery,
    (snapshot) => callback(mapSnapshot<PatientAssessment>(snapshot)),
    onError,
  );
}

export function subscribeAssessmentSubcollection<T extends { id?: string }>(
  assessmentId: string,
  subcollection: "preClinicQuestionnaire" | "postClinicQuestionnaire" | "clinicianReview",
  callback: (record: T | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(getClientDb(), "patient_assessments", assessmentId, subcollection, "latest"),
    (snapshot) =>
      callback(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as T) : null),
    onError,
  );
}

export async function savePreClinicQuestionnaire(
  assessment: PatientAssessment,
  questionnaire: PreClinicQuestionnaire,
): Promise<void> {
  await setDoc(
    doc(
      getClientDb(),
      "patient_assessments",
      assessment.assessmentId,
      "preClinicQuestionnaire",
      "latest",
    ),
    {
      ...writableFields(questionnaire),
      assessmentId: assessment.assessmentId,
      hospitalId: assessment.hospitalId,
      questionnaireDate: questionnaire.questionnaireDate || serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function savePostClinicQuestionnaire(
  assessment: PatientAssessment,
  questionnaire: PostClinicQuestionnaire,
): Promise<void> {
  await setDoc(
    doc(
      getClientDb(),
      "patient_assessments",
      assessment.assessmentId,
      "postClinicQuestionnaire",
      "latest",
    ),
    {
      ...writableFields(questionnaire),
      assessmentId: assessment.assessmentId,
      hospitalId: assessment.hospitalId,
      questionnaireDate: questionnaire.questionnaireDate || serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function saveAssessmentClinicianReview(
  assessment: PatientAssessment,
  review: AssessmentClinicianReview,
  clinician: ClinicianAccount,
): Promise<void> {
  const reviewRef = doc(
    getClientDb(),
    "patient_assessments",
    assessment.assessmentId,
    "clinicianReview",
    "latest",
  );
  await setDoc(
    reviewRef,
    {
      ...writableFields(review),
      assessmentId: assessment.assessmentId,
      hospitalId: assessment.hospitalId,
      aiTreatment: assessment.recommendedTreatment || "",
      concordance:
        normalizeRecommendation(review.clinicianTreatment) ===
        normalizeRecommendation(assessment.recommendedTreatment),
      reviewedBy: clinician.displayName || clinician.email,
      reviewedByEmail: clinician.email,
      reviewDate: review.reviewDate || serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  await updateDoc(doc(getClientDb(), "patient_assessments", assessment.assessmentId), {
    reviewStatus: "reviewed",
    updatedAt: serverTimestamp(),
  });
}

function average(values: Array<number | undefined>): number {
  const valid = values.filter((value): value is number => typeof value === "number");
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
}

function isSameDay(left: Date | null, right: Date): boolean {
  return Boolean(
    left &&
      left.getFullYear() === right.getFullYear() &&
      left.getMonth() === right.getMonth() &&
      left.getDate() === right.getDate(),
  );
}

function buildRecommendationDistribution(assessments: PatientAssessment[]): RecommendationDatum[] {
  return ["PTNS", "Botox", "SNM", "Medication", "Conservative"].map((label) => ({
    label,
    value: assessments.filter(
      (assessment) => normalizeRecommendation(assessment.recommendedTreatment) === label,
    ).length,
    color: RECOMMENDATION_COLORS[label],
  }));
}

function buildFunnel(assessments: PatientAssessment[]): FunnelDatum[] {
  return [
    { label: "Started", value: assessments.filter((item) => item.conversationStarted).length },
    { label: "Completed", value: assessments.filter((item) => item.conversationCompleted).length },
    { label: "Generated PDF", value: assessments.filter((item) => item.reportGenerated).length },
  ];
}

function buildWeeklyTrend(assessments: PatientAssessment[]): TrendDatum[] {
  const formatter = new Intl.DateTimeFormat("en-GB", { weekday: "short" });
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - (6 - index));
    return {
      label: formatter.format(day),
      value: assessments.filter((item) => isSameDay(toDate(item.createdAt), day)).length,
    };
  });
}

function buildConcordance(
  assessments: PatientAssessment[],
  reviews: AssessmentClinicianReview[],
): AnalyticsSnapshot["concordance"] {
  const assessmentMap = new Map(assessments.map((item) => [item.assessmentId, item]));
  const groups = new Map<string, AnalyticsSnapshot["concordance"][number]>();
  reviews.forEach((review) => {
    const assessment = review.assessmentId ? assessmentMap.get(review.assessmentId) : undefined;
    const ai = normalizeRecommendation(review.aiTreatment || assessment?.recommendedTreatment);
    const clinician = normalizeRecommendation(review.clinicianTreatment);
    if (!review.clinicianTreatment) return;
    const concordance = ai === clinician;
    const key = `${ai}|${clinician}|${concordance}`;
    const existing = groups.get(key);
    groups.set(key, {
      aiRecommendation: ai,
      clinicianRecommendation: clinician,
      concordance,
      count: (existing?.count || 0) + 1,
    });
  });
  return [...groups.values()].sort((left, right) => right.count - left.count);
}

export function buildAnalytics(
  assessments: PatientAssessment[],
  questionnaires: PreClinicQuestionnaire[] = [],
  reviews: AssessmentClinicianReview[] = [],
): AnalyticsSnapshot {
  const started = assessments.filter((item) => item.conversationStarted);
  const completed = assessments.filter((item) => item.conversationCompleted);
  const reports = assessments.filter((item) => item.reportGenerated);
  const funnel = buildFunnel(assessments);
  return {
    metrics: {
      conversationsStarted: started.length,
      conversationsCompleted: completed.length,
      completionRate: started.length ? (completed.length / started.length) * 100 : 0,
      reportsGenerated: reports.length,
      averageDurationMinutes: average(assessments.map((item) => item.conversationDurationMinutes)),
      averagePreparednessScore: average(questionnaires.map((item) => item.preparedness)),
      averageUnderstandingScore: average(questionnaires.map((item) => item.understanding)),
      averageSatisfactionScore: average(
        questionnaires.map((item) => item.recommendationSatisfaction),
      ),
    },
    recommendationDistribution: buildRecommendationDistribution(assessments),
    funnel,
    weeklyTrend: buildWeeklyTrend(assessments),
    pdfGenerationRate: completed.length ? (reports.length / completed.length) * 100 : 0,
    averageMessages: average(assessments.map((item) => item.messageCount)),
    dropOff: [
      { label: "Started but not completed", value: Math.max(0, started.length - completed.length) },
      { label: "Completed without PDF", value: Math.max(0, completed.length - reports.length) },
    ],
    concordance: buildConcordance(assessments, reviews),
    pendingReviews: assessments.filter((item) => item.reviewStatus !== "reviewed").length,
    reviewedAssessments: assessments.filter((item) => item.reviewStatus === "reviewed").length,
  };
}

export function subscribeAuditCollection(
  collectionName: string,
  account: ClinicianAccount,
  callback: (row: Pick<DataSourceAuditRow, "documentCount" | "lastUpdated">) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const hospitals = hospitalIdsForAccount(account);
  const base = collection(getClientDb(), collectionName);
  const auditQuery =
    account.role === "super_admin"
      ? base
      : hospitals.length === 1
        ? query(base, where("hospitalId", "==", hospitals[0]))
        : hospitals.length > 1
          ? query(base, where("hospitalId", "in", hospitals.slice(0, 10)))
          : query(base, where("hospitalId", "==", "__no_hospital_access__"));
  return onSnapshot(
    auditQuery,
    (snapshot) => {
      const dates = snapshot.docs
        .map((item) => toDate(item.get("updatedAt") || item.get("createdAt")))
        .filter((date): date is Date => Boolean(date));
      callback({
        documentCount: snapshot.size,
        lastUpdated: dates.sort((left, right) => right.getTime() - left.getTime())[0],
      });
    },
    onError,
  );
}
