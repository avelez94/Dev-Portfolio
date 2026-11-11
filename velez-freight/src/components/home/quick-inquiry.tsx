"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight } from "lucide-react";
import { Input, NativeSelect } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { copy, shipmentTypes } from "@/config/site";
import { contactSchema, emailField, shipmentTypeField } from "@/lib/validation";
import { usePreviewHref, useSubmitters } from "@/components/preview/preview-context";
import { Field, FormAlert, Honeypot, SubmitLabel } from "@/components/forms/fields";
import { useEnvelope } from "@/components/forms/use-envelope";

function Heading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="lg:w-64 lg:shrink-0 lg:border-r lg:border-navy/20 lg:pr-8">
      <p className="eyebrow !text-[0.66rem] !text-navy">{eyebrow}</p>
      <h2 className="mt-2 text-[1.85rem] font-bold leading-[1.08] text-navy">{title}</h2>
      <svg aria-hidden="true" viewBox="0 0 120 10" className="mt-2 w-28"><path d="M2 7 C 40 1, 80 1, 118 4" stroke="#E1252F" strokeWidth="3.5" fill="none" strokeLinecap="round" /></svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Operational: collect route basics, then continue into the detailed multi step inquiry.
// Nothing is stored at this step; the detailed form performs the validated submission.
// ---------------------------------------------------------------------------
const quickQuote = z.object({
  pickup: z.string().trim().min(2, "Enter a pickup city, state or ZIP.").max(300),
  delivery: z.string().trim().min(2, "Enter a delivery city, state or ZIP.").max(300),
  type: shipmentTypeField,
  weight: z.string().trim().regex(/^\d{0,6}$/, "Use whole pounds.").optional(),
  date: z.string().optional(),
});

function OperationalQuick() {
  const router = useRouter();
  const previewHref = usePreviewHref();
  const { register, handleSubmit, formState: { errors } } = useForm<z.input<typeof quickQuote>>({ resolver: zodResolver(quickQuote) });
  const onSubmit = handleSubmit((v) => {
    const q = new URLSearchParams({ pickup: v.pickup, delivery: v.delivery, type: v.type });
    if (v.weight) q.set("weight", v.weight);
    if (v.date) q.set("date", v.date);
    router.push(previewHref(`/request-quote?${q.toString()}`));
  });
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6 lg:flex-row lg:items-center lg:gap-8" aria-label="Quick freight inquiry">
      <Heading eyebrow="Get a quick quote" title={copy.quick.title} />
      <div className="flex-1 space-y-4">
      <p className="text-sm text-charcoal">{copy.quick.body}</p>
      <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-6">
        <Field id="qq-pickup" label="Pickup location" required error={errors.pickup?.message} className="lg:col-span-3">
          <Input placeholder="City, State or ZIP" autoComplete="off" {...register("pickup")} />
        </Field>
        <Field id="qq-delivery" label="Delivery location" required error={errors.delivery?.message} className="lg:col-span-3">
          <Input placeholder="City, State or ZIP" autoComplete="off" {...register("delivery")} />
        </Field>
        <Field id="qq-type" label="Shipment type" required error={errors.type?.message} className="lg:col-span-2">
          <NativeSelect defaultValue="" {...register("type")}>
            <option value="" disabled>Select shipment type</option>
            {shipmentTypes.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </NativeSelect>
        </Field>
        <Field id="qq-weight" label="Est. weight (lbs)" showOptional={false} error={errors.weight?.message} className="lg:col-span-2">
          <Input inputMode="numeric" placeholder="e.g. 10000" {...register("weight")} />
        </Field>
        <Field id="qq-date" label="Desired pickup date" showOptional={false} className="lg:col-span-2">
          <Input type="date" {...register("date")} />
        </Field>
      </div>
      </div>
      <Button type="submit" size="lg" className="lg:self-center">
        Request a Quote <ArrowRight aria-hidden="true" />
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Prelaunch: no freight orders. Offer a launch notification instead.
// ---------------------------------------------------------------------------
const launchForm = z.object({
  name: z.string().trim().min(1, "Your name is required.").max(120),
  email: emailField,
  company: z.string().trim().max(160).optional(),
  shipmentType: z.union([z.literal(""), shipmentTypeField]).optional(),
  privacyAck: z.literal(true, { error: "Please confirm the privacy notice." }),
});

function PrelaunchQuick({ body }: { body: string }) {
  const { envelope, honeypot, refresh } = useEnvelope();
  const submit = useSubmitters();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const { register, handleSubmit, setError, reset, formState: { errors } } = useForm<z.input<typeof launchForm>>({ resolver: zodResolver(launchForm) });

  const onSubmit = handleSubmit((v) => {
    start(async () => {
      const payload: z.input<typeof contactSchema> = { inquiryType: "launch_notification", name: v.name, email: v.email, company: v.company, shipmentType: v.shipmentType, privacyAck: true };
      const res = await submit.contact(payload, envelope(), "/");
      if (res.ok) {
        setResult({ ok: true, text: `${res.message} Reference: ${res.reference}` });
        reset();
      } else {
        Object.entries(res.fieldErrors ?? {}).forEach(([k, m]) => setError(k as "name", { message: m }));
        setResult({ ok: false, text: res.error });
        if (res.code === "spam") refresh();
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6 lg:flex-row lg:items-center lg:gap-8" aria-label="Launch notification sign up">
      <Heading eyebrow={copy.stayConnected.eyebrow} title={copy.stayConnected.title} />
      <div className="flex-1 space-y-4">
        <p className="text-sm leading-relaxed text-charcoal">{body}</p>
        <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field id="ln-name" label="Name" required error={errors.name?.message}>
            <Input autoComplete="name" {...register("name")} />
          </Field>
          <Field id="ln-email" label="Business email" required error={errors.email?.message}>
            <Input type="email" autoComplete="email" {...register("email")} />
          </Field>
          <Field id="ln-company" label="Company" showOptional={false} error={errors.company?.message}>
            <Input autoComplete="organization" {...register("company")} />
          </Field>
          <Field id="ln-type" label="Typical freight" showOptional={false} error={errors.shipmentType?.message}>
            <NativeSelect defaultValue="" {...register("shipmentType")}>
              <option value="">Select one</option>
              {shipmentTypes.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </NativeSelect>
          </Field>
        </div>
        <label className="flex items-start gap-2.5 text-xs text-charcoal">
          <input type="checkbox" className="mt-0.5 size-4 accent-brand-red" aria-invalid={errors.privacyAck ? true : undefined} aria-describedby={errors.privacyAck ? "ln-privacy-error" : undefined} {...register("privacyAck")} />
          <span>Yes, you may contact me about the launch. I’ve read the <a href="/privacy" className="font-semibold text-brand-red-dark underline">privacy notice</a>.</span>
        </label>
        {errors.privacyAck && <p id="ln-privacy-error" className="text-xs font-medium text-brand-red-dark">{errors.privacyAck.message}</p>}
        <Honeypot inputRef={honeypot} />
        {result && <FormAlert tone={result.ok ? "success" : "error"}>{result.text}</FormAlert>}
      </div>
      <Button type="submit" size="lg" disabled={pending} className="lg:self-center">
        <SubmitLabel pending={pending} idle={<>Keep Me Posted <ArrowRight aria-hidden="true" /></>} />
      </Button>
    </form>
  );
}

export function QuickInquiry({ operational, stayConnectedBody = copy.stayConnected.body }: { operational: boolean; stayConnectedBody?: string }) {
  return (
    <section id="quick-inquiry" aria-label="Quick inquiry" className="relative z-10 -mt-20 sm:-mt-24">
      <div className="container-site">
        <div data-reveal className="rounded-2xl border border-white/60 bg-ivory p-6 shadow-[var(--shadow-float)] sm:p-8">
          {operational ? <OperationalQuick /> : <PrelaunchQuick body={stayConnectedBody} />}
        </div>
      </div>
    </section>
  );
}

