"use client";

import { useState } from "react";

const tabs = [
  { key: "ptns", label: "PTNS", content: `Weekly x12 then monthly. Non‑surgical neuromodulation via tibial nerve. Typical session ~30 min. Side effects uncommon (local ankle discomfort).` },
  { key: "botox", label: "Botox", content: `Bladder wall injections in hospital; repeat every 6–12 months. Fast, strong effect for many; UTI and temporary self‑catheterisation risk in a minority.` },
  { key: "snm", label: "SNM", content: `Implanted pacemaker‑like device modulates sacral nerve. Trial lead first; if effective, permanent implant (10–15 yrs device life).` },
  { key: "lifestyle", label: "Lifestyle", content: `Bladder training, pelvic floor, fluid/caffeine timing, weight management, smoking cessation; often used alongside other options.` },
];

export default function InfoTabs() {
  const [active, setActive] = useState(tabs[0].key);

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-6">
      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`px-4 py-2 rounded-xl border ${
              active === t.key
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4 text-slate-700 leading-relaxed">
        {tabs.find((t) => t.key === active)?.content}
      </div>
    </section>
  );
}