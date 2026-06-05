"use client";

import { useAdminData } from "@/components/admin/useAdminData";
import { Badge, EmptyState, LoadingState, PageHeader, Panel } from "@/components/admin/ui";

export default function OutcomesPage() {
  const { analytics, loading } = useAdminData();
  if (loading) return <LoadingState />;

  const reviewedCount = analytics.concordance.reduce((total, item) => total + item.count, 0);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Clinical outcomes"
        title="Recommendation concordance"
        description="A live comparison of AI recommendations and final clinician decisions."
        action={<p className="text-xs text-slate-500">{reviewedCount} reviewed records</p>}
      />
      <Panel
        title="AI and Clinician Recommendations"
        description="Counts are grouped by the normalised treatment pathway"
      >
        {!analytics.concordance.length ? (
          <EmptyState
            title="No completed clinical reviews"
            description="Concordance results will appear after a clinician recommendation is saved."
            icon="activity"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-b border-white/[0.07] text-[10px] uppercase tracking-[0.14em] text-slate-600">
                  <th className="px-6 py-3 font-semibold">AI Recommendation</th>
                  <th className="px-6 py-3 font-semibold">Clinician Recommendation</th>
                  <th className="px-6 py-3 font-semibold">Concordance</th>
                  <th className="px-6 py-3 text-right font-semibold">Count</th>
                </tr>
              </thead>
              <tbody>
                {analytics.concordance.map((row) => (
                  <tr
                    key={`${row.aiRecommendation}-${row.clinicianRecommendation}-${row.concordance}`}
                    className="border-b border-white/[0.05] text-sm"
                  >
                    <td className="px-6 py-4 text-slate-200">{row.aiRecommendation}</td>
                    <td className="px-6 py-4 text-slate-300">{row.clinicianRecommendation}</td>
                    <td className="px-6 py-4">
                      <Badge
                        tone={
                          row.concordance ? "success" : "danger"
                        }
                      >
                        {row.concordance ? "Concordant" : "Discordant"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right text-lg font-semibold text-slate-100">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
