"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import {
  buildAnalytics,
  subscribeAssessments,
  subscribeClinicianReviews,
  subscribePreClinicQuestionnaires,
} from "@/lib/admin-data";
import type {
  AssessmentClinicianReview,
  PatientAssessment,
  PreClinicQuestionnaire,
} from "@/types/admin";

export function useAdminData() {
  const { clinician } = useAdminAuth();
  const [assessments, setAssessments] = useState<PatientAssessment[]>([]);
  const [preClinicQuestionnaires, setPreClinicQuestionnaires] = useState<
    PreClinicQuestionnaire[]
  >([]);
  const [clinicianReviews, setClinicianReviews] = useState<
    AssessmentClinicianReview[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let assessmentsReady = false;
    let questionnairesReady = false;
    let reviewsReady = false;
    const updateLoading = () => {
      if (assessmentsReady && questionnairesReady && reviewsReady) setLoading(false);
    };
    const handleError = (nextError: Error) => {
      setError(nextError.message || "Unable to load assessment data.");
      setLoading(false);
    };
    const unsubscribeAssessments = subscribeAssessments(
      clinician,
      (records) => {
        setAssessments(records);
        assessmentsReady = true;
        updateLoading();
      },
      handleError,
    );
    const unsubscribeQuestionnaires = subscribePreClinicQuestionnaires(
      clinician,
      (records) => {
        setPreClinicQuestionnaires(records);
        questionnairesReady = true;
        updateLoading();
      },
      handleError,
    );
    const unsubscribeReviews = subscribeClinicianReviews(
      clinician,
      (records) => {
        setClinicianReviews(records);
        reviewsReady = true;
        updateLoading();
      },
      handleError,
    );
    return () => {
      unsubscribeAssessments();
      unsubscribeQuestionnaires();
      unsubscribeReviews();
    };
  }, [clinician]);

  const analytics = useMemo(
    () => buildAnalytics(assessments, preClinicQuestionnaires, clinicianReviews),
    [assessments, clinicianReviews, preClinicQuestionnaires],
  );

  return {
    assessments,
    preClinicQuestionnaires,
    clinicianReviews,
    analytics,
    loading,
    error,
  };
}
