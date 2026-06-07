"use client";

export function DownloadCard({
  title,
  buttonText,
  url,
}: {
  title: string;
  buttonText: string;
  url: string;
}) {
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-[#b9c8dd] bg-[linear-gradient(145deg,#f8fbff_0%,#e7eef8_100%)] shadow-[0_10px_28px_rgba(4,18,45,0.12)]">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#02052e] text-white shadow-sm">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M7 3.75h7l3 3V20.25H7z" />
            <path d="M14 3.75v3h3M9.5 12h5M9.5 15h5" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#02052e]">{title}</p>
          <p className="mt-0.5 text-xs text-slate-600">The link expires in 48 hours.</p>
        </div>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-h-11 w-full items-center justify-center gap-2 border-t border-[#c7d3e3] bg-[#02052e] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0b1d55] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-inset"
      >
        {buttonText}
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 4v11m0 0 4-4m-4 4-4-4M5 19.5h14" />
        </svg>
      </a>
    </div>
  );
}
