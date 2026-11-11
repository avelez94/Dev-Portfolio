"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { carrierSchema, equipmentOptions, type CarrierInput } from "@/lib/validation";
import { submitCarrier } from "@/app/actions/public";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field, FormAlert, Honeypot, PrivacyCheckbox, SubmitLabel } from "./fields";
import { useEnvelope } from "./use-envelope";

export function CarrierForm() {
  const { envelope, honeypot, refresh } = useEnvelope();
  const [pending, start] = useTransition();
  const [done, setDone] = useState<{ reference: string; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  // Move focus to the error summary so keyboard and screen reader users hear what went wrong.
  useEffect(() => {
    if (error) alertRef.current?.focus();
  }, [error]);
  const { register, handleSubmit, setError: setFieldError, formState: { errors } } = useForm<CarrierInput>({
    resolver: zodResolver(carrierSchema),
    defaultValues: { equipment: [] },
  });

  const onSubmit = handleSubmit((values) => {
    setError(null);
    start(async () => {
      const res = await submitCarrier(values, envelope());
      if (res.ok) {
        setDone({ reference: res.reference, message: res.message });
      } else {
        Object.entries(res.fieldErrors ?? {}).forEach(([k, m]) => setFieldError(k as keyof CarrierInput, { message: m }));
        setError(res.error);
        if (res.code === "spam") refresh();
      }
    });
  });

  if (done) {
    return (
      <FormAlert tone="success">
        <p className="font-semibold text-navy">Inquiry received. Reference {done.reference}</p>
        <p className="mt-1">{done.message}</p>
      </FormAlert>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5" aria-label="Carrier partnership inquiry">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="cf-company" label="Company name" required error={errors.companyName?.message}>
          <Input autoComplete="organization" {...register("companyName")} />
        </Field>
        <Field id="cf-contact" label="Contact name" required error={errors.contactName?.message}>
          <Input autoComplete="name" {...register("contactName")} />
        </Field>
        <Field id="cf-email" label="Email" required error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...register("email")} />
        </Field>
        <Field id="cf-phone" label="Phone" required error={errors.phone?.message}>
          <Input type="tel" autoComplete="tel" {...register("phone")} />
        </Field>
        <Field id="cf-mc" label="MC number" error={errors.mcNumber?.message} hint="Numbers only. We verify it independently.">
          <Input inputMode="numeric" {...register("mcNumber")} />
        </Field>
        <Field id="cf-dot" label="USDOT number" error={errors.usdotNumber?.message} hint="Numbers only.">
          <Input inputMode="numeric" {...register("usdotNumber")} />
        </Field>
      </div>

      <fieldset aria-describedby={errors.equipment ? "cf-equipment-error" : undefined}>
        <legend className="mb-2 text-sm font-semibold text-navy">Equipment types <span className="text-brand-red-dark" aria-hidden="true">*</span></legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {equipmentOptions.map((e) => (
            <label key={e.value} className="flex items-center gap-2.5 rounded-md border border-line bg-white px-3 py-2.5 text-sm has-[:checked]:border-brand-red has-[:checked]:bg-brand-red/5">
              <input type="checkbox" value={e.value} className="size-4 accent-brand-red" {...register("equipment")} />
              {e.label}
            </label>
          ))}
        </div>
        {errors.equipment && <p id="cf-equipment-error" className="mt-1 text-xs font-medium text-brand-red-dark">{errors.equipment.message}</p>}
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-[1fr_10rem]">
        <Field id="cf-region" label="Operating region or preferred lanes" required error={errors.operatingRegion?.message}>
          <Input placeholder="e.g. Mid Atlantic, Interstate 95 corridor" {...register("operatingRegion")} />
        </Field>
        <Field id="cf-fleet" label="Power units" error={errors.fleetSize?.message as string | undefined}>
          <Input inputMode="numeric" {...register("fleetSize")} />
        </Field>
      </div>
      <Field id="cf-message" label="Anything else we should know" error={errors.message?.message}>
        <Textarea rows={4} {...register("message")} />
      </Field>

      <p className="flex gap-2.5 rounded-md bg-ivory-200 p-3 text-xs leading-relaxed text-charcoal">
        <LockKeyhole aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-navy" />
        Please do not include Social Security numbers, bank details, tax forms, insurance certificates, or other documents here. Those are collected later through a separate secure onboarding process.
      </p>
      <PrivacyCheckbox id="cf-privacy" error={errors.privacyAck?.message} register={register("privacyAck")} />
      <Honeypot inputRef={honeypot} />
      {error && <div ref={alertRef} tabIndex={-1}><FormAlert tone="error">{error}</FormAlert></div>}
      <Button type="submit" size="lg" disabled={pending}>
        <SubmitLabel pending={pending} idle={<>Submit a Carrier Inquiry <ArrowRight aria-hidden="true" /></>} />
      </Button>
    </form>
  );
}
