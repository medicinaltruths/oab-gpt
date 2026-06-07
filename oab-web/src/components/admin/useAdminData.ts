"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import {
  buildAnalytics,
  subscribeAssessments,
  subscribeAssessmentSubcollection,
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
    let childUnsubscribes: Array<() => void> = [];

    const unsubscribeAssessments = subscribeAssessments(
      clinician,
      (records) => {
        childUnsubscribes.forEach((unsubscribe) => unsubscribe());
        childUnsubscribes = [];
        setAssessments(records);
        setError("");

        if (!records.length) {
          setPreClinicQuestionnaires([]);
          setClinicianReviews([]);
          setLoading(false);
          return;
        }

        const questionnaireMap = new Map<string, PreClinicQuestionnaire>();
        const reviewMap = new Map<string, AssessmentClinicianReview>();
        let readyChildren = 0;
        const expectedChildren = records.length * 2;
        const childReady = () => {
          readyChildren += 1;
          if (readyChildren >= expectedChildren) setLoading(false);
        };

        records.forEach((assessment) => {
          childUnsubscribes.push(
            subscribeAssessmentSubcollection<PreClinicQuestionnaire>(
              assessment.assessmentId,
              "preClinicQuestionnaire",
              (questionnaire) => {
                if (questionnaire) {
                  questionnaireMap.set(assessment.assessmentId, questionnaire);
                } else {
                  questionnaireMap.delete(assessment.assessmentId);
                }
                setPreClinicQuestionnaires([...questionnaireMap.values()]);
                childReady();
              },
              () => childReady(),
            ),
          );
          childUnsubscribes.push(
            subscribeAssessmentSubcollection<AssessmentClinicianReview>(
              assessment.assessmentId,
              "clinicianReview",
              (review) => {
                if (review) {
                  reviewMap.set(assessment.assessmentId, review);
                } else {
                  reviewMap.delete(assessment.assessmentId);
                }
                setClinicianReviews([...reviewMap.values()]);
                childReady();
              },
              () => childReady(),
            ),
          );
        });
      },
      (nextError) => {
        setError(
          `${nextError.message}. Check that the clinician account has hospitalId "esth" and that the latest Firestore rules are deployed.`,
        );
        setLoading(false);
      },
    );

    return () => {
      unsubscribeAssessments();
      childUnsubscribes.forEach((unsubscribe) => unsubscribe());
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
