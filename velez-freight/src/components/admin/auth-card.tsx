import { Logo } from "@/components/site/logo";

export function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-navy px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl bg-ivory p-8 shadow-[var(--shadow-float)]">
        <Logo layout="stacked" className="mx-auto w-44" />
        <h1 className="mt-6 text-center text-2xl font-bold">{title}</h1>
        <p className="mb-6 mt-1 text-center text-xs text-slate-muted">Private dashboard. Access is by invitation only.</p>
        {children}
      </div>
    </main>
  );
}
