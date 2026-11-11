"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { LoaderCircle, Search, X } from "lucide-react";
import { globalSearch, type SearchHit } from "@/app/admin/search-action";

const EVENT = "vfg-open-search";
export const openSearch = () => window.dispatchEvent(new Event(EVENT));

/** Command palette: Ctrl+K or "/" opens it; arrow keys move; Enter opens the record. */
export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  const show = useCallback(() => {
    returnFocus.current = document.activeElement as HTMLElement;
    setOpen(true);
  }, []);
  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setHits([]);
    returnFocus.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /input|textarea|select/i.test((e.target as HTMLElement)?.tagName ?? "") || (e.target as HTMLElement)?.isContentEditable;
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) { e.preventDefault(); show(); }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(EVENT, show);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener(EVENT, show); };
  }, [show]);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) return;
    const t = setTimeout(() => start(async () => { setHits(await globalSearch(term)); setActive(0); }), 200);
    return () => clearTimeout(t);
  }, [q, open]);

  if (!open) return null;
  const go = (h: SearchHit) => { close(); router.push(h.href); };
  const visible = q.trim().length >= 2 ? hits : [];

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-navy/50 px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Search records" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-[var(--shadow-float)]">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search aria-hidden="true" className="size-5 text-slate-muted" />
          <label htmlFor="global-search" className="sr-only">Search shippers, carriers, inquiries, quotes, shipments and invoices</label>
          <input
            ref={inputRef}
            id="global-search"
            role="combobox"
            aria-expanded={visible.length > 0}
            aria-controls="global-search-results"
            aria-activedescendant={visible[active] ? `hit-${active}` : undefined}
            autoComplete="off"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, visible.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              if (e.key === "Enter" && visible[active]) go(visible[active]);
            }}
            placeholder="Search by company, person, email, MC, USDOT or reference"
            className="h-14 flex-1 bg-transparent text-[0.95rem] outline-none"
          />
          {pending && <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-slate-muted" />}
          <button type="button" onClick={close} aria-label="Close search" className="rounded p-1 text-slate-muted hover:bg-ivory"><X className="size-4" /></button>
        </div>
        <ul id="global-search-results" role="listbox" aria-label="Results" className="max-h-[60vh] overflow-y-auto p-2">
          {visible.map((h, i) => (
            <li key={`${h.kind}-${h.href}`} id={`hit-${i}`} role="option" aria-selected={i === active}>
              <button type="button" onMouseEnter={() => setActive(i)} onClick={() => go(h)} className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm ${i === active ? "bg-ivory" : ""}`}>
                <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-muted">{h.kind}</span>
                <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-navy">{h.title}</span>{h.subtitle && <span className="block truncate text-xs text-slate-muted">{h.subtitle}</span>}</span>
              </button>
            </li>
          ))}
          {q.trim().length >= 2 && !pending && visible.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-muted">No matching records you can access.</li>}
          {q.trim().length < 2 && <li className="px-3 py-6 text-center text-sm text-slate-muted">Type at least two characters. Tip: press Ctrl K or / anywhere to search.</li>}
        </ul>
      </div>
    </div>
  );
}
