"use client";

import { useState, useTransition } from "react";
import { Bookmark } from "lucide-react";
import { saveView } from "@/app/admin/view-actions";

export function SaveViewButton({ viewKey, filters }: { viewKey: string; filters: Record<string, string> }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" disabled={pending} onClick={() => start(async () => { const r = await saveView(viewKey, filters); setMsg(r.error ?? "Saved as your default view."); })}
        className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-navy hover:bg-ivory">
        <Bookmark aria-hidden="true" className="size-4" /> Save view
      </button>
      {msg && <span role="status" className="text-xs text-slate-muted">{msg}</span>}
    </span>
  );
}
