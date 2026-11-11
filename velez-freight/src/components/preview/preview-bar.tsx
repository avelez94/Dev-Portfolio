import Link from "next/link";
import { Eye } from "lucide-react";

/** Always visible label so the preview can never be mistaken for the live website. */
export function PreviewBar() {
  return (
    <div role="region" aria-label="Launch preview" className="fixed inset-x-0 bottom-0 z-[60] border-t-4 border-brand-red bg-navy text-white shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.5)]">
      <div className="container-site flex flex-col gap-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2.5">
          <Eye aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-red" />
          <span>
            <strong className="font-bold">Launch preview, simulation only.</strong>{" "}
            <span className="text-white/85">Submissions are never saved or sent.</span>{" "}
            <span className="hidden text-white/85 sm:inline">This is how the website will look once operations are enabled. Visitors still see the current public site.</span>
          </span>
        </p>
        <div className="flex shrink-0 gap-2">
          <a href="/" target="_blank" rel="noopener" className="rounded-md border border-white/30 px-3 py-1.5 font-semibold hover:bg-white/10">View public site</a>
          <Link href="/admin/settings" className="rounded-md bg-brand-red px-3 py-1.5 font-semibold hover:bg-brand-red-dark">Exit preview</Link>
        </div>
      </div>
    </div>
  );
}
