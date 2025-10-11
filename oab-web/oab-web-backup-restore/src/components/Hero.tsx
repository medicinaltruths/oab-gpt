export default function Hero() {
  return (
    <section className="px-6 md:px-10 py-10 md:py-14 bg-white/70 backdrop-blur border-b border-slate-200">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl md:text-5xl tracking-tight">
            <span className="font-[var(--font-display)] font-light">OAB</span>{" "}
            <span className="font-[var(--font-display)] font-semibold">Answers</span>
        </h1>
        <p className="mt-4 text-lg md:text-xl text-slate-600 leading-relaxed">
          A supportive, clinician‑reviewed decision aid to help you understand
          options for overactive bladder and prepare for conversations with your doctor.
        </p>
      </div>
    </section>
  );
}