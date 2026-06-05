"use client";

import { DonutChart, FunnelChart, LineChart } from "@/components/admin/charts";
import { useAdminData } from "@/components/admin/useAdminData";
import { KpiCard, LoadingState, PageHeader, Panel } from "@/components/admin/ui";
import { formatDuration } from "@/lib/admin-data";

export default function AdminDashboardPage() {
  const { analytics, loading, error } = useAdminData();
  const { metrics } = analytics;
  if (loading) return <LoadingState />;

  const scores = [
    metrics.averagePreparednessScore,
    metrics.averageUnderstandingScore,
    metrics.averageSatisfactionScore,
  ];
  const scoreScale = Math.max(...scores) > 5 ? 10 : 5;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Clinical intelligence"
        title="Administration overview"
        description="A live view of patient engagement, recommendations, and reported experience across OAB-GPT."
      />
      {error ? (
        <p className="rounded-xl border border-rose-400/15 bg-rose-400/[0.06] px-4 py-3 text-xs text-rose-200">
          Some live data could not be loaded: {error}
        </p>
      ) : null}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Conversations Started Today" value={metrics.conversationsStartedToday} icon="activity" />
        <KpiCard
          label="Conversations Completed Today"
          value={metrics.conversationsCompletedToday}
          icon="check"
          accent="green"
        />
        <KpiCard
          label="Completion Rate"
          value={`${metrics.completionRate.toFixed(1)}%`}
          icon="analytics"
          accent="violet"
        />
        <KpiCard label="Reports Generated" value={metrics.reportsGenerated} icon="document" accent="gold" />
        <KpiCard
          label="Average Conversation Duration"
          value={formatDuration(metrics.averageDurationSeconds)}
          icon="clock"
        />
        <KpiCard
          label="Average Preparedness Score"
          value={`${metrics.averagePreparednessScore.toFixed(1)}/${scoreScale}`}
          icon="sparkles"
          accent="green"
        />
        <KpiCard
          label="Average Understanding Score"
          value={`${metrics.averageUnderstandingScore.toFixed(1)}/${scoreScale}`}
          icon="activity"
          accent="violet"
        />
        <KpiCard
          label="Average Satisfaction Score"
          value={`${metrics.averageSatisfactionScore.toFixed(1)}/${scoreScale}`}
          icon="check"
          accent="gold"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Panel title="AI Recommendation Distribution" description="Treatment pathway selected by the AI">
          <DonutChart data={analytics.recommendationDistribution} />
        </Panel>
        <Panel title="Conversation Funnel" description="Progression through the structured assessment">
          <FunnelChart data={analytics.funnel} />
        </Panel>
      </section>

      <Panel title="Weekly Conversations Trend" description="Conversations started over the last seven days">
        <LineChart data={analytics.weeklyTrend} />
      </Panel>
    </div>
  );
}
