"use client";

import {
  doc,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getClientAuth, getClientDb } from "@/lib/firebase";

const ASSESSMENT_KEY = "oab_assessment_id";
const ASSESSMENT_STARTED_KEY = "oab_assessment_started_at";
const DEFAULT_HOSPITAL_ID =
  process.env.NEXT_PUBLIC_DEFAULT_HOSPITAL_ID || "esth";

export interface AssessmentApiUpdate {
  firstName?: string;
  age?: number;
  sex?: string;
  conversationCompleted?: boolean;
  recommendedTreatment?: string;
  recommendationRationale?: string;
  symptomSummary?: string;
  previousTreatments?: string;
  socialFactors?: string;
  reportGenerated?: boolean;
  pdfUrl?: string;
  storagePath?: string;
  reportExpiryDate?: string | number;
  promptVersion?: string;
}

export function createAssessmentId(): string {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `OAB-${year}-${timestamp}${random}`;
}

export function getCurrentAssessmentId(): string | null {
  return typeof window === "undefined"
    ? null
    : localStorage.getItem(ASSESSMENT_KEY);
}

export function getDefaultHospitalId(): string {
  return DEFAULT_HOSPITAL_ID;
}

export async function ensureWebsiteAssessment(sessionId: string): Promise<string> {
  const existing = getCurrentAssessmentId();
  if (existing) return existing;

  const user = getClientAuth().currentUser;
  if (!user) throw new Error("Firebase user is required before creating an assessment.");

  const assessmentId = createAssessmentId();
  const now = Date.now();
  await setDoc(doc(getClientDb(), "patient_assessments", assessmentId), {
    assessmentId,
    ownerUid: user.uid,
    hospitalId: DEFAULT_HOSPITAL_ID,
    source: "website",
    conversationStarted: true,
    conversationCompleted: false,
    messageCount: 0,
    conversationDurationMinutes: 0,
    reportGenerated: false,
    promptVersion: "V15",
    reviewStatus: "pending",
    sessionId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  localStorage.setItem(ASSESSMENT_KEY, assessmentId);
  localStorage.setItem(ASSESSMENT_STARTED_KEY, String(now));
  return assessmentId;
}

export async function recordAssessmentExchange(
  assessmentId: string,
  update?: AssessmentApiUpdate,
): Promise<void> {
  const startedAt = Number(localStorage.getItem(ASSESSMENT_STARTED_KEY) || Date.now());
  const durationMinutes = Math.max(0, Math.round((Date.now() - startedAt) / 60000));
  const data: Record<string, unknown> = {
    messageCount: increment(2),
    conversationDurationMinutes: durationMinutes,
    updatedAt: serverTimestamp(),
  };

  if (update?.firstName) data.firstName = update.firstName;
  if (typeof update?.age === "number") data.age = update.age;
  if (update?.sex) data.sex = update.sex;
  if (update?.recommendedTreatment) data.recommendedTreatment = update.recommendedTreatment;
  if (update?.recommendationRationale) {
    data.recommendationRationale = update.recommendationRationale;
  }
  if (update?.symptomSummary) data.symptomSummary = update.symptomSummary;
  if (update?.previousTreatments) data.previousTreatments = update.previousTreatments;
  if (update?.socialFactors) data.socialFactors = update.socialFactors;
  if (update?.pdfUrl) data.pdfUrl = update.pdfUrl;
  if (update?.storagePath) data.storagePath = update.storagePath;
  if (update?.promptVersion) data.promptVersion = update.promptVersion;
  if (update?.reportExpiryDate) {
    data.reportExpiryDate = new Date(update.reportExpiryDate);
  }
  if (update?.reportGenerated) {
    data.reportGenerated = true;
    data.reportCreatedAt = serverTimestamp();
  }
  if (update?.conversationCompleted) {
    data.conversationCompleted = true;
    data.completedAt = serverTimestamp();
  }

  await updateDoc(doc(getClientDb(), "patient_assessments", assessmentId), data);
}

export function clearCurrentAssessment(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ASSESSMENT_KEY);
  localStorage.removeItem(ASSESSMENT_STARTED_KEY);
}
