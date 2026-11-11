"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import { contactSchema, type ContactInput } from "@/lib/validation";
import { shipmentTypes } from "@/config/site";
import { submitContact } from "@/app/actions/public";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field, FormAlert, Honeypot, PrivacyCheckbox, SubmitLabel } from "./fields";
import { useEnvelope } from "./use-envelope";

const topics = [
  { value: "general", label: "General inquiry" },
  { value: "shipper", label: "Shipper inquiry" },
  { value: "carrier", label: "Carrier partnership" },
] as const;

export function ContactForm({ defaultType = "general", sourcePage = "/contact", operational }: { defaultType?: "general" | "shipper" | "carrier"; sourcePage?: string; operational: boolean }) {
  const { envelope, honeypot, refresh } = useEnvelope();
  const [pending, start] = useTransition();
  const [done, setDone] = useState<{ reference: string; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  // Move focus to the error summary so keyboard and screen reader users hear what went wrong.
  useEffect(() => {
    if (error) alertRef.current?.focus();
  }, [error]);
  const { register, handleSubmit, control, setError: setFieldError, formState: { errors } } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: { inquiryType: defaultType },
  });
  const type = useWatch({ control, name: "inquiryType" });

  const onSubmit = handleSubmit((values) => {
    setError(null);
    start(async () => {
      const res = await submitContact(values, envelope(), sourcePage);
      if (res.ok) setDone({ reference: res.reference, message: res.message });
      else {
        Object.entries(res.fieldErrors ?? {}).forEach(([k, m]) => setFieldError(k as keyof ContactInput, { message: m }));
        setError(res.error);
        if (res.code === "spam") refresh();
      }
    });
  });

  if (done) {
    return (
      <FormAlert tone="success">
        <p className="font-semibold text-navy">Message received. Reference {done.reference}</p>
        <p className="mt-1">{done.message}</p>
      </FormAlert>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5" aria-label="Contact form">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="ct-name" label="Name" required error={errors.name?.message}>
          <Input autoComplete="name" {...register("name")} />
        </Field>
        <Field id="ct-company" label="Company" error={errors.company?.message}>
          <Input autoComplete="organization" {...register("company")} />
        </Field>
        <Field id="ct-email" label="Business email" required error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...register("email")} />
        </Field>
        <Field id="ct-phone" label="Phone number" error={errors.phone?.message}>
          <Input type="tel" autoComplete="tel" {...register("phone")} />
        </Field>
        <Field id="ct-inquiry-type" label="Inquiry type" required error={errors.inquiryType?.message} className={type === "shipper" ? undefined : "sm:col-span-2"}>
          <NativeSelect {...register("inquiryType")}>
            {topics.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </NativeSelect>
        </Field>
        {type === "shipper" && (
          <Field id="ct-type" label="Typical freight" error={errors.shipmentType?.message}>
            <NativeSelect defaultValue="" {...register("shipmentType")}>
              <option value="">Select one</option>
              {shipmentTypes.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </NativeSelect>
          </Field>
        )}
      </div>
      {type === "shipper" && !operational && (
        <p className="rounded-md bg-ivory-200 p-3 text-sm">We are not arranging transportation or providing quotes yet. Tell us about your business and future needs, and we will follow up personally.</p>
      )}
      {type === "carrier" && (
        <p className="rounded-md bg-ivory-200 p-3 text-sm">
          Want to share your equipment, lanes, and authority details? The{" "}
          <Link href="/carriers#carrier-inquiry" className="font-semibold text-brand-red-dark underline">carrier partnership inquiry</Link> records them for our review.
        </p>
      )}
      <Field id="ct-message" label="Message" required error={errors.message?.message}>
        <Textarea rows={5} {...register("message")} />
      </Field>
      <PrivacyCheckbox id="ct-privacy" error={errors.privacyAck?.message} register={register("privacyAck")} />
      <Honeypot inputRef={honeypot} />
      {error && <div ref={alertRef} tabIndex={-1}><FormAlert tone="error">{error}</FormAlert></div>}
      <Button type="submit" size="lg" disabled={pending}>
        <SubmitLabel pending={pending} idle={<>Send Your Message <ArrowRight aria-hidden="true" /></>} />
      </Button>
    </form>
  );
}
