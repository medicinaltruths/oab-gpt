"use client";

import { BarChart, DonutChart, FunnelChart, LineChart } from "@/components/admin/charts";
import { useAdminData } from "@/components/admin/useAdminData";
import { KpiCard, LoadingState, PageHeader, Panel } from "@/components/admin/ui";
import { formatDurationMinutes } from "@/lib/admin-data";

export default function AnalyticsPage() {
  const { analytics, assessments, loading } = useAdminData();
  if (loading) return <LoadingState />;

  const completed = analytics.funnel[0]?.value
    ? (analytics.funnel.at(-1)?.value || 0) / analytics.funnel[0].value
    : 0;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Service performance"
        title="Detailed analytics"
        description="Live operational and clinical decision-support measures calculated from Firestore records."
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Completion Rate"
          value={`${analytics.metrics.completionRate.toFixed(1)}%`}
          icon="check"
          accent="green"
        />
        <KpiCard
          label="PDF Generation Rate"
          value={`${analytics.pdfGenerationRate.toFixed(1)}%`}
          icon="document"
          accent="gold"
        />
        <KpiCard
          label="Average Conversation Length"
          value={formatDurationMinutes(analytics.metrics.averageDurationMinutes)}
          icon="clock"
        />
        <KpiCard
          label="Average Messages per Conversation"
          value={analytics.averageMessages.toFixed(1)}
          icon="activity"
          accent="violet"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Panel title="Recommendation Distribution" description={`${assessments.length} total assessments`}>
          <DonutChart data={analytics.recommendationDistribution} />
        </Panel>
        <Panel title="Completion Funnel" description={`${(completed * 100).toFixed(1)}% reached PDF generation`}>
          <FunnelChart data={analytics.funnel} />
        </Panel>
        <Panel title="Drop-off Analysis" description="Number leaving between each assessment stage">
          <BarChart data={analytics.dropOff} color="#e6b86f" />
        </Panel>
        <Panel title="AI vs Clinician Concordance" description="Reviewed records grouped by concordance category">
          <BarChart
            data={[
              {
                label: "Concordant",
                value: analytics.concordance
                  .filter((item) => item.concordance)
                  .reduce((sum, item) => sum + item.count, 0),
              },
              {
                label: "Discordant",
                value: analytics.concordance
                  .filter((item) => !item.concordance)
                  .reduce((sum, item) => sum + item.count, 0),
              },
            ]}
            color="#86dcb0"
          />
        </Panel>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <KpiCard
          label="Pending Reviews"
          value={analytics.pendingReviews}
          icon="clock"
          accent="gold"
        />
        <KpiCard
          label="Reviewed Assessments"
          value={analytics.reviewedAssessments}
          icon="check"
          accent="green"
        />
      </section>

      <Panel title="Weekly Assessment Volume" description="New assessments started in the last seven days">
        <LineChart data={analytics.weeklyTrend} />
      </Panel>
    </div>
  );
}
