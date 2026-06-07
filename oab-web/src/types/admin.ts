import type { Timestamp } from "firebase/firestore";

export type FirestoreDate = Timestamp | Date | string | number | null | undefined;
export type ReviewStatus = "pending" | "reviewed";
export type QuestionnaireScore = 1 | 2 | 3 | 4 | 5;

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

export interface PatientAssessment {
  id: string;
  assessmentId: string;
  ownerUid?: string;
  hospitalId: string;
  source?: "website" | "whatsapp" | string;
  channel?: "web" | "whatsapp" | string;
  firstName?: string;
  age?: number | null;
  sex?: string;
  createdAt?: FirestoreDate;
  updatedAt?: FirestoreDate;
  completedAt?: FirestoreDate;
  conversationStarted: boolean;
  conversationCompleted: boolean;
  status?: "in_progress" | "completed" | string;
  totalMessages?: number;
  messageCount: number;
  conversationDurationMinutes: number;
  pdfGenerated?: boolean;
  reportGenerated: boolean;
  recommendation?: string;
  recommendationCategory?: string;
  alternativeRecommendations?: string[];
  recommendedTreatment?: string;
  recommendationRationale?: string;
  symptomSummary?: string;
  previousTreatments?: string;
  socialFactors?: string;
  pdfDownloadUrl?: string;
  pdfStoragePath?: string;
  pdfCreatedAt?: FirestoreDate;
  pdfDownloadUrlExpiresAt?: FirestoreDate;
  reportRetentionUntil?: FirestoreDate;
  pdfUrl?: string;
  storagePath?: string;
  reportCreatedAt?: FirestoreDate;
  reportExpiryDate?: FirestoreDate;
  promptVersion?: string;
  reviewStatus: ReviewStatus;
  clinicianRecommendation?: string | null;
  clinicianComments?: string;
  clinicianReviewed?: boolean;
  clinicianReviewedAt?: FirestoreDate;
  preClinicQuestionnaire?: Record<string, unknown> | null;
  postClinicQuestionnaire?: Record<string, unknown> | null;
  concordance?: boolean | null;
  openAiResponseId?: string;
  sessionId?: string;
}

export interface PreClinicQuestionnaire {
  id?: string;
  assessmentId?: string;
  hospitalId?: string;
  questionnaireDate?: FirestoreDate;
  understanding?: QuestionnaireScore;
  patientKnowledge?: QuestionnaireScore;
  preparedness?: QuestionnaireScore;
  decisionConfidence?: QuestionnaireScore;
  sharedDecisionMaking?: QuestionnaireScore;
  recommendationSatisfaction?: QuestionnaireScore;
  usability?: QuestionnaireScore;
  missingInformation?: string;
  chatbotSupportive?: QuestionnaireScore;
  recommendChatbot?: QuestionnaireScore;
  pdaType?: "paper" | "chatbot";
  updatedAt?: FirestoreDate;
}

export interface PostClinicQuestionnaire {
  id?: string;
  assessmentId?: string;
  hospitalId?: string;
  questionnaireDate?: FirestoreDate;
  appointmentPreparedness?: QuestionnaireScore;
  treatmentUnderstanding?: QuestionnaireScore;
  questionsAnswered?: QuestionnaireScore;
  recommendationMatchedDoctor?: "yes" | "partially" | "no";
  differenceReason?: string;
  stillHelpful?: QuestionnaireScore;
  comfortableWithPlan?: QuestionnaireScore;
  recommendToOthers?: QuestionnaireScore;
  updatedAt?: FirestoreDate;
}

export interface AssessmentClinicianReview {
  id?: string;
  assessmentId?: string;
  hospitalId?: string;
  reviewDate?: FirestoreDate;
  reviewedBy?: string;
  reviewedByEmail?: string;
  clinicianTreatment?: string;
  aiTreatment?: string;
  concordance?: boolean;
  discordanceReason?: string;
  updatedAt?: FirestoreDate;
}

export interface DashboardMetrics {
  conversationsStarted: number;
  conversationsCompleted: number;
  completionRate: number;
  reportsGenerated: number;
  averageDurationMinutes: number;
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
  channelDistribution: RecommendationDatum[];
  funnel: FunnelDatum[];
  weeklyTrend: TrendDatum[];
  pdfGenerationRate: number;
  averageMessages: number;
  dropOff: FunnelDatum[];
  concordance: Array<{
    aiRecommendation: string;
    clinicianRecommendation: string;
    concordance: boolean;
    count: number;
  }>;
  pendingReviews: number;
  reviewedAssessments: number;
}

export interface DataSourceAuditRow {
  collectionName: string;
  documentCount: number;
  lastUpdated?: FirestoreDate;
  widgets: string[];
}
