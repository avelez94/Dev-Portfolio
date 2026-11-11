import type { Metadata } from "next";
import { CircleCheck, MailX } from "lucide-react";
import { readUnsubscribeToken } from "@/lib/email/unsubscribe-token";
import { unsubscribe } from "@/app/actions/unsubscribe";
import { brand } from "@/config/brand";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const mask = (email: string) => email.replace(/^(.{1,2})[^@]*@/, (_m, a) => `${a}•••@`);

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ t?: string; done?: string; error?: string }> }) {
  const sp = await searchParams;
  const email = readUnsubscribeToken(sp.t);
  return (
    <section className="py-20">
      <div className="container-site max-w-xl">
        <div className="rounded-[var(--radius-card)] border border-line bg-white p-8 shadow-[var(--shadow-card)]">
          {!email ? (
            <>
              <MailX aria-hidden="true" className="size-9 text-brand-red" />
              <h1 className="mt-4 text-3xl font-bold">This link is not valid</h1>
              <p className="mt-3 leading-relaxed text-charcoal">Please use the unsubscribe link from the most recent email you received, or reply to that email and ask us to stop. We will honor it.</p>
            </>
          ) : sp.done ? (
            <>
              <CircleCheck aria-hidden="true" className="size-9 text-brand-red" />
              <h1 className="mt-4 text-3xl font-bold">You are unsubscribed</h1>
              <p className="mt-3 leading-relaxed text-charcoal">{mask(email)} will not receive further marketing emails from {brand.name}. If this was a mistake, just reply to any of our emails.</p>
            </>
          ) : (
            <>
              <MailX aria-hidden="true" className="size-9 text-brand-red" />
              <h1 className="mt-4 text-3xl font-bold">Unsubscribe from {brand.name} emails</h1>
              <p className="mt-3 leading-relaxed text-charcoal">Stop marketing emails to <strong>{mask(email)}</strong>? You will not hear from us by email again unless you contact us first.</p>
              {sp.error && <p role="alert" className="mt-4 rounded-md bg-danger-soft p-3 text-sm">Something went wrong. Please try again, or reply to the email and ask us to stop.</p>}
              <form action={unsubscribe} className="mt-6">
                <input type="hidden" name="t" value={sp.t} />
                <Button type="submit" size="lg">Unsubscribe</Button>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
