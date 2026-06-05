"use client";

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  type DocumentData,
  type QuerySnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase";
import type {
  AnalyticsSnapshot,
  ClinicalReview,
  ClinicianAccount,
  Concordance,
  Conversation,
  FirestoreDate,
  FollowUpSurvey,
  FunnelDatum,
  PatientReport,
  RecommendationDatum,
  TrendDatum,
} from "@/types/admin";

const RECOMMENDATION_COLORS: Record<string, string> = {
  PTNS: "#55d8e6",
  Botox: "#8da2fb",
  SNM: "#c7a6ff",
  Conservative: "#7dd3a8",
  Surgery: "#e8bc78",
  Medication: "#f08aa8",
  Other: "#8190a8",
};

const FUNNEL_STAGES = [
  ["Chat Started", "chat_started"],
  ["Symptom Assessment Completed", "symptom_assessment"],
  ["Impact Assessment Completed", "impact_assessment"],
  ["Treatment History Completed", "treatment_history"],
  ["Recommendation Reached", "recommendation"],
  ["PDF Generated", "pdf_generated"],
] as const;

function mapSnapshot<T extends { id: string }>(snapshot: QuerySnapshot<DocumentData>): T[] {
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T);
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

export function formatDuration(seconds = 0): string {
  if (!seconds || seconds < 1) return "0m";
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.round(seconds % 60);
  if (minutes < 1) return `${remaining}s`;
  return remaining ? `${minutes}m ${remaining}s` : `${minutes}m`;
}

export function getPatientName(conversation: Conversation): string {
  return (
    conversation.patientName ||
    conversation.patient?.name ||
    conversation.patientInitials ||
    conversation.patient?.initials ||
    "Anonymous patient"
  );
}

export function getPatientAge(conversation: Conversation): number | null {
  if (typeof conversation.age === "number") return conversation.age;
  if (typeof conversation.patient?.age === "number") return conversation.patient.age;
  const dob = toDate(conversation.dateOfBirth || conversation.patient?.dateOfBirth);
  if (!dob) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const month = now.getMonth() - dob.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age;
}

export function getAiRecommendation(conversation: Conversation): string {
  return conversation.aiRecommendation || conversation.recommendation?.type || "Not recorded";
}

export function normalizeRecommendation(value?: string): string {
  const normalized = (value || "").toLowerCase();
  if (normalized.includes("ptns") || normalized.includes("tibial")) return "PTNS";
  if (normalized.includes("botox") || normalized.includes("botulinum")) return "Botox";
  if (normalized.includes("snm") || normalized.includes("sacral")) return "SNM";
  if (
    normalized.includes("conservative") ||
    normalized.includes("bladder training") ||
    normalized.includes("lifestyle")
  ) {
    return "Conservative";
  }
  if (
    normalized.includes("turp") ||
    normalized.includes("holep") ||
    normalized.includes("surgery") ||
    normalized.includes("surgical")
  ) {
    return "Surgery";
  }
  if (normalized.includes("medication") || normalized.includes("medicine")) return "Medication";
  return value?.trim() || "Other";
}

export function calculateConcordance(aiRecommendation?: string, clinicianRecommendation?: string): Concordance {
  if (!aiRecommendation || !clinicianRecommendation) return "Not reviewed";
  const ai = normalizeRecommendation(aiRecommendation);
  const clinician = normalizeRecommendation(clinicianRecommendation);
  if (ai === clinician) return "Match";

  const conservative = new Set(["Conservative", "Medication"]);
  const procedures = new Set(["PTNS", "Botox", "SNM"]);
  if (
    (conservative.has(ai) && conservative.has(clinician)) ||
    (procedures.has(ai) && procedures.has(clinician))
  ) {
    return "Partial Match";
  }
  return "Different";
}

async function findClinicianAccount(email: string): Promise<ClinicianAccount | null> {
  const db = getClientDb();
  const normalized = email.trim().toLowerCase();
  const snapshot = await getDoc(doc(db, "clinician_accounts", normalized));
  if (!snapshot.exists()) return null;
  const account = { id: snapshot.id, ...snapshot.data() } as ClinicianAccount;
  if (account.email.trim().toLowerCase() !== normalized) return null;
  return account.active === false ? null : account;
}

export async function verifyClinicianEmail(email: string): Promise<ClinicianAccount | null> {
  return findClinicianAccount(email);
}

function filterForAccount<T extends { hospitalId?: string }>(
  records: T[],
  account?: ClinicianAccount | null,
): T[] {
  if (!account || account.role === "super_admin") return records;
  const allowed = new Set([account.hospitalId, ...(account.hospitalIds || [])].filter(Boolean));
  if (!allowed.size) return records;
  return records.filter((record) => !record.hospitalId || allowed.has(record.hospitalId));
}

export function subscribeConversations(
  account: ClinicianAccount,
  callback: (records: Conversation[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getClientDb(), "conversations"),
    (snapshot) => callback(filterForAccount(mapSnapshot<Conversation>(snapshot), account)),
    onError,
  );
}

export function subscribeConversation(
  id: string,
  callback: (record: Conversation | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(getClientDb(), "conversations", id),
    (snapshot) => callback(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Conversation) : null),
    onError,
  );
}

export function subscribeReports(
  account: ClinicianAccount,
  callback: (records: PatientReport[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getClientDb(), "patient_reports"),
    (snapshot) => callback(filterForAccount(mapSnapshot<PatientReport>(snapshot), account)),
    onError,
  );
}

export function subscribeSurveys(
  account: ClinicianAccount,
  callback: (records: FollowUpSurvey[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getClientDb(), "follow_up_surveys"),
    (snapshot) => callback(filterForAccount(mapSnapshot<FollowUpSurvey>(snapshot), account)),
    onError,
  );
}

export async function saveClinicalReview(
  conversationId: string,
  review: ClinicalReview,
  clinician: ClinicianAccount,
  aiRecommendation: string,
): Promise<void> {
  await updateDoc(doc(getClientDb(), "conversations", conversationId), {
    clinicalReview: {
      ...review,
      concordance: calculateConcordance(aiRecommendation, review.finalRecommendation),
      reviewedBy: clinician.displayName || clinician.email,
      reviewedByEmail: clinician.email,
      reviewedAt: review.reviewedAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    updatedAt: serverTimestamp(),
  });
}

function average(values: Array<number | undefined>): number {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return valid.length ? valid.reduce((total, value) => total + value, 0) / valid.length : 0;
}

function isSameDay(left: Date | null, right: Date): boolean {
  return Boolean(
    left &&
      left.getFullYear() === right.getFullYear() &&
      left.getMonth() === right.getMonth() &&
      left.getDate() === right.getDate(),
  );
}

function hasStage(conversation: Conversation, stage: string): boolean {
  const stages = conversation.completedStages || [];
  if (stage === "chat_started") return Boolean(conversation.startedAt || conversation.createdAt);
  if (stage === "recommendation") return Boolean(getAiRecommendation(conversation) !== "Not recorded");
  if (stage === "pdf_generated") return Boolean(
    conversation.reportGenerated || conversation.reportUrl || conversation.pdfUrl,
  );
  if (conversation.status === "completed") return true;
  return stages.some((item) => item.toLowerCase().replace(/\s+/g, "_").includes(stage));
}

function buildRecommendationDistribution(conversations: Conversation[]): RecommendationDatum[] {
  const labels = ["PTNS", "Botox", "SNM", "Conservative", "Surgery"];
  return labels.map((label) => ({
    label,
    value: conversations.filter((item) => normalizeRecommendation(getAiRecommendation(item)) === label).length,
    color: RECOMMENDATION_COLORS[label],
  }));
}

function buildFunnel(conversations: Conversation[]): FunnelDatum[] {
  return FUNNEL_STAGES.map(([label, stage]) => ({
    label,
    value: conversations.filter((item) => hasStage(item, stage)).length,
  }));
}

function buildWeeklyTrend(conversations: Conversation[]): TrendDatum[] {
  const formatter = new Intl.DateTimeFormat("en-GB", { weekday: "short" });
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - (6 - index));
    return {
      label: formatter.format(day),
      value: conversations.filter((item) => isSameDay(toDate(item.startedAt || item.createdAt), day)).length,
    };
  });
}

function buildConcordance(conversations: Conversation[]): AnalyticsSnapshot["concordance"] {
  const groups = new Map<string, AnalyticsSnapshot["concordance"][number]>();
  conversations.forEach((conversation) => {
    const clinician = conversation.clinicalReview?.finalRecommendation;
    if (!clinician) return;
    const ai = normalizeRecommendation(getAiRecommendation(conversation));
    const clinicianNormalized = normalizeRecommendation(clinician);
    const concordance = calculateConcordance(ai, clinicianNormalized);
    const key = `${ai}|${clinicianNormalized}|${concordance}`;
    const existing = groups.get(key);
    groups.set(key, {
      aiRecommendation: ai,
      clinicianRecommendation: clinicianNormalized,
      concordance,
      count: (existing?.count || 0) + 1,
    });
  });
  return [...groups.values()].sort((a, b) => b.count - a.count);
}

export function buildAnalytics(
  conversations: Conversation[],
  reports: PatientReport[] = [],
  surveys: FollowUpSurvey[] = [],
): AnalyticsSnapshot {
  const today = new Date();
  const startedToday = conversations.filter((item) =>
    isSameDay(toDate(item.startedAt || item.createdAt), today),
  ).length;
  const completed = conversations.filter((item) => item.status === "completed" || item.completedAt);
  const completedToday = completed.filter((item) => isSameDay(toDate(item.completedAt), today)).length;
  const reportConversationIds = new Set(reports.map((report) => report.conversationId).filter(Boolean));
  const conversationsWithReports = conversations.filter(
    (item) => item.reportGenerated || item.reportUrl || item.pdfUrl || reportConversationIds.has(item.id),
  );
  const unlinkedConversationReports = conversationsWithReports.filter(
    (item) => !reportConversationIds.has(item.id),
  ).length;
  const reportsGenerated = reports.length + unlinkedConversationReports;
  const allPreparedness = [
    ...conversations.map((item) => item.preparednessScore),
    ...surveys.map((item) => item.preparednessScore),
  ];
  const allUnderstanding = [
    ...conversations.map((item) => item.understandingScore),
    ...surveys.map((item) => item.understandingScore),
  ];
  const allSatisfaction = [
    ...conversations.map((item) => item.satisfactionScore),
    ...surveys.map((item) => item.satisfactionScore),
  ];
  const funnel = buildFunnel(conversations);
  const dropOff = funnel.slice(0, -1).map((stage, index) => ({
    label: stage.label,
    value: Math.max(0, stage.value - funnel[index + 1].value),
  }));

  return {
    metrics: {
      conversationsStartedToday: startedToday,
      conversationsCompletedToday: completedToday,
      completionRate: conversations.length ? (completed.length / conversations.length) * 100 : 0,
      reportsGenerated,
      averageDurationSeconds: average(conversations.map((item) => item.durationSeconds)),
      averagePreparednessScore: average(allPreparedness),
      averageUnderstandingScore: average(allUnderstanding),
      averageSatisfactionScore: average(allSatisfaction),
    },
    recommendationDistribution: buildRecommendationDistribution(conversations),
    funnel,
    weeklyTrend: buildWeeklyTrend(conversations),
    pdfGenerationRate: completed.length
      ? (conversationsWithReports.length / completed.length) * 100
      : 0,
    averageMessages: average(conversations.map((item) => item.messageCount || item.transcript?.length)),
    dropOff,
    concordance: buildConcordance(conversations),
  };
}

export function deriveConcordance(
  aiRecommendation: string,
  review: Pick<ClinicalReview, "finalRecommendation">,
): Concordance {
  return calculateConcordance(aiRecommendation, review.finalRecommendation);
}
