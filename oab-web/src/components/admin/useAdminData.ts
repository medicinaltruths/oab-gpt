"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import {
  buildAnalytics,
  subscribeConversations,
  subscribeReports,
  subscribeSurveys,
} from "@/lib/admin-data";
import type { Conversation, FollowUpSurvey, PatientReport } from "@/types/admin";

export function useAdminData() {
  const { clinician } = useAdminAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [reports, setReports] = useState<PatientReport[]>([]);
  const [surveys, setSurveys] = useState<FollowUpSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let conversationsReady = false;
    let reportsReady = false;
    let surveysReady = false;
    const updateLoading = () => {
      if (conversationsReady && reportsReady && surveysReady) setLoading(false);
    };
    const handleError = (nextError: Error) => {
      setError(nextError.message || "Unable to load clinical data.");
      setLoading(false);
    };
    const unsubscribeConversations = subscribeConversations(
      clinician,
      (records) => {
        setConversations(records);
        conversationsReady = true;
        updateLoading();
      },
      handleError,
    );
    const unsubscribeReports = subscribeReports(
      clinician,
      (records) => {
        setReports(records);
        reportsReady = true;
        updateLoading();
      },
      handleError,
    );
    const unsubscribeSurveys = subscribeSurveys(
      clinician,
      (records) => {
        setSurveys(records);
        surveysReady = true;
        updateLoading();
      },
      handleError,
    );
    return () => {
      unsubscribeConversations();
      unsubscribeReports();
      unsubscribeSurveys();
    };
  }, [clinician]);

  const analytics = useMemo(
    () => buildAnalytics(conversations, reports, surveys),
    [conversations, reports, surveys],
  );

  return { conversations, reports, surveys, analytics, loading, error };
}
