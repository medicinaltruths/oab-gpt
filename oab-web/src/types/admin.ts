import type { Timestamp } from "firebase/firestore";

export type FirestoreDate = Timestamp | Date | string | number | null | undefined;

export type RecommendationType =
  | "PTNS"
  | "Botox"
  | "SNM"
  | "Conservative"
  | "Surgery"
  | "Medication"
  | "Other";

export type Concordance = "Match" | "Partial Match" | "Different" | "Not reviewed";

export interface ClinicianAccount {
  id: string;
  email: string;
  displayName?: string;
  role?: "clinician" | "admin" | "super_admin";
  hospitalId?: string;
  hospitalIds?: string[];
  hospitalName?: string;
  active?: boolean;
}

export interface InvestigationFindings {
  urodynamics?: string;
  qmax?: number | null;
  voidedVolume?: number | null;
  pvr?: number | null;
  prostateSize?: number | null;
  otherFindings?: string;
}

export interface ClinicalReview {
  diagnosis?: string;
  diagnosisOther?: string;
  investigations?: InvestigationFindings;
  finalRecommendation?: string;
  finalRecommendationOther?: string;
  rationale?: string;
  concordance?: Concordance;
  discordanceReason?: string;
  discordanceNotes?: string;
  patientAcceptedRecommendation?: "Yes" | "No" | "Unsure" | "";
  followUpOutcome?: "Symptoms improved" | "Symptoms unchanged" | "Symptoms worse" | "";
  reviewedBy?: string;
  reviewedByEmail?: string;
  reviewedAt?: FirestoreDate;
  updatedAt?: FirestoreDate;
}

export interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: FirestoreDate;
}

export interface Conversation {
  id: string;
  hospitalId?: string;
  patientId?: string;
  patientName?: string;
  patientInitials?: string;
  age?: number | null;
  dateOfBirth?: FirestoreDate;
  sex?: string;
  postcode?: string;
  createdAt?: FirestoreDate;
  startedAt?: FirestoreDate;
  updatedAt?: FirestoreDate;
  completedAt?: FirestoreDate;
  status?: "started" | "in_progress" | "completed" | "abandoned" | string;
  currentStage?: string;
  completedStages?: string[];
  durationSeconds?: number;
  messageCount?: number;
  patient?: {
    name?: string;
    initials?: string;
    age?: number;
    dateOfBirth?: FirestoreDate;
    sex?: string;
    postcode?: string;
  };
  demographics?: Record<string, unknown>;
  symptomSummary?: string;
  symptoms?: Record<string, unknown>;
  impactScores?: Record<string, number | string | null>;
  treatmentHistory?: unknown;
  socialFactors?: unknown;
  aiRecommendation?: string;
  aiRecommendationRationale?: string;
  recommendation?: {
    type?: string;
    rationale?: string;
  };
  reportGenerated?: boolean;
  reportUrl?: string;
  pdfUrl?: string;
  transcript?: ConversationMessage[];
  preparednessScore?: number;
  understandingScore?: number;
  satisfactionScore?: number;
  clinicalReview?: ClinicalReview;
}

export interface PatientReport {
  id: string;
  conversationId?: string;
  patientId?: string;
  hospitalId?: string;
  url?: string;
  downloadUrl?: string;
  storagePath?: string;
  createdAt?: FirestoreDate;
}

export interface FollowUpSurvey {
  id: string;
  conversationId?: string;
  patientId?: string;
  hospitalId?: string;
  preparednessScore?: number;
  understandingScore?: number;
  satisfactionScore?: number;
  responses?: Record<string, unknown>;
  createdAt?: FirestoreDate;
  submittedAt?: FirestoreDate;
}

export interface DashboardMetrics {
  conversationsStartedToday: number;
  conversationsCompletedToday: number;
  completionRate: number;
  reportsGenerated: number;
  averageDurationSeconds: number;
  averagePreparednessScore: number;
  averageUnderstandingScore: number;
  averageSatisfactionScore: number;
}

export interface RecommendationDatum {
  label: string;
  value: number;
  color: string;
}

export interface FunnelDatum {
  label: string;
  value: number;
}

export interface TrendDatum {
  label: string;
  value: number;
}

export interface AnalyticsSnapshot {
  metrics: DashboardMetrics;
  recommendationDistribution: RecommendationDatum[];
  funnel: FunnelDatum[];
  weeklyTrend: TrendDatum[];
  pdfGenerationRate: number;
  averageMessages: number;
  dropOff: FunnelDatum[];
  concordance: Array<{
    aiRecommendation: string;
    clinicianRecommendation: string;
    concordance: Concordance;
    count: number;
  }>;
}
