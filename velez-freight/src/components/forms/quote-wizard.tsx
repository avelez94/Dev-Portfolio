"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, Plus, Trash2 } from "lucide-react";
import { quoteSchema, type QuoteInput } from "@/lib/validation";
import { shipmentTypes } from "@/config/site";
import { submitQuote } from "@/app/actions/public";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field, FormAlert, Honeypot, PrivacyCheckbox, SubmitLabel } from "./fields";
import { useEnvelope } from "./use-envelope";
import { cn } from "@/lib/utils";

const steps = ["Shipment route", "Freight details", "Contact information", "Review and submit"] as const;
const stepFields: (keyof QuoteInput)[][] = [["route"], ["freight"], ["contact"], ["privacyAck"]];

type Prefill = { pickup?: string; delivery?: string; type?: string; weight?: string; date?: string };

export function QuoteWizard({ prefill }: { prefill: Prefill }) {
  const [step, setStep] = useState(0);
  const { envelope, honeypot, refresh } = useEnvelope();
  const [pending, start] = useTransition();
  const [done, setDone] = useState<{ reference: string; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const validType = shipmentTypes.some((s) => s.value === prefill.type) ? prefill.type : "";

  const form = useForm<QuoteInput>({
    resolver: zodResolver(quoteSchema),
    mode: "onTouched",
    defaultValues: {
      route: { pickupAddress: prefill.pickup ?? "", deliveryAddress: prefill.delivery ?? "", pickupDate: prefill.date ?? "", deliveryDeadline: "", stops: [] },
      freight: { description: "", commodity: "", weightLbs: (prefill.weight ?? "") as unknown as number, dimensions: "", pieceCount: "" as unknown as number, pieceType: "pallets", equipment: validType ?? "", specialHandling: "", loadingRequirements: "" },
      contact: { companyName: "", contactName: "", email: "", phone: "", notes: "" },
    },
  });
  const { register, trigger, getValues, handleSubmit, setError: setFieldError, formState: { errors } } = form;
  const stops = useFieldArray({ control: form.control, name: "route.stops" });

  // Move focus to the step heading so screen reader and keyboard users land in the right place.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    headingRef.current?.focus();
  }, [step, done]);

  async function next() {
    const ok = await trigger(stepFields[step]);
    if (ok) setStep((s) => Math.min(s + 1, steps.length - 1));
  }

  const onSubmit = handleSubmit(
    (values) => {
      setError(null);
      start(async () => {
        const res = await submitQuote(values, envelope());
        if (res.ok) setDone({ reference: res.reference, message: res.message });
        else {
          Object.entries(res.fieldErrors ?? {}).forEach(([k, m]) => setFieldError(k as "route", { message: m }));
          setError(res.error);
          if (res.code === "spam") refresh();
        }
      });
    },
    () => setError("Some details need attention. Use Back to review the highlighted steps."),
  );

  if (done) {
    return (
      <div className="space-y-4">
        <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-bold outline-none">Request received</h2>
        <FormAlert tone="success">
          <p className="font-semibold text-navy">Reference {done.reference}</p>
          <p className="mt-1">{done.message}</p>
        </FormAlert>
      </div>
    );
  }

  const v = getValues();
  const e = errors;
  const typeLabel = (val?: string) => shipmentTypes.find((s) => s.value === val)?.label ?? "";

  return (
    <form onSubmit={onSubmit} noValidate aria-label="Freight inquiry">
      {/* Progress indicator */}
      <ol className="mb-8 grid grid-cols-4 gap-2" aria-label="Progress">
        {steps.map((label, i) => (
          <li key={label} aria-current={i === step ? "step" : undefined}>
            <div className={cn("h-1.5 rounded-full transition-colors duration-300", i <= step ? "bg-brand-red" : "bg-line")} />
            <p className={cn("mt-2 hidden text-xs font-semibold sm:block", i === step ? "text-navy" : "text-slate-muted")}>
              {i < step && <Check aria-hidden="true" className="mr-1 inline size-3.5 text-brand-red" />}
              {label}
            </p>
          </li>
        ))}
      </ol>
      <p className="eyebrow">Step {step + 1} of {steps.length}</p>
      <h2 ref={headingRef} tabIndex={-1} className="mt-2 text-2xl font-bold outline-none">{steps[step]}</h2>

      <div className="mt-6">
        {step === 0 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="q-pickup" label="Pickup location" required error={e.route?.pickupAddress?.message} hint="Street address, or city, state and ZIP" className="sm:col-span-2">
              <Input autoComplete="off" {...register("route.pickupAddress")} />
            </Field>
            <Field id="q-delivery" label="Delivery location" required error={e.route?.deliveryAddress?.message} className="sm:col-span-2">
              <Input autoComplete="off" {...register("route.deliveryAddress")} />
            </Field>
            <Field id="q-date" label="Requested pickup date" required error={e.route?.pickupDate?.message}>
              <Input type="date" {...register("route.pickupDate")} />
            </Field>
            <Field id="q-deadline" label="Required delivery date" error={e.route?.deliveryDeadline?.message}>
              <Input type="date" {...register("route.deliveryDeadline")} />
            </Field>
            <fieldset className="sm:col-span-2">
              <legend className="text-sm font-semibold text-navy">Additional stops <span className="font-normal text-slate-muted">(optional)</span></legend>
              <ul className="mt-2 space-y-2">
                {stops.fields.map((f, i) => (
                  <li key={f.id} className="flex gap-2">
                    <label className="sr-only" htmlFor={`q-stop-${i}`}>Stop {i + 1}</label>
                    <Input id={`q-stop-${i}`} placeholder={`Stop ${i + 1} location`} {...register(`route.stops.${i}.location` as const)} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => stops.remove(i)} aria-label={`Remove stop ${i + 1}`}><Trash2 /></Button>
                  </li>
                ))}
              </ul>
              {stops.fields.length < 5 && (
                <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => stops.append({ location: "" })}><Plus /> Add a stop</Button>
              )}
            </fieldset>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="q-description" label="Freight description" required error={e.freight?.description?.message} hint="What the shipment is and how it is packaged" className="sm:col-span-2">
              <Textarea rows={3} {...register("freight.description")} />
            </Field>
            <Field id="q-commodity" label="Commodity" required error={e.freight?.commodity?.message} hint="e.g. auto parts, packaged food, building materials" className="sm:col-span-2">
              <Input {...register("freight.commodity")} />
            </Field>
            <Field id="q-weight" label="Total weight (lbs)" required error={e.freight?.weightLbs?.message}>
              <Input inputMode="numeric" {...register("freight.weightLbs")} />
            </Field>
            <Field id="q-equipment" label="Equipment requirements" required error={e.freight?.equipment?.message}>
              <NativeSelect {...register("freight.equipment")}>
                <option value="" disabled>Select one</option>
                {shipmentTypes.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </NativeSelect>
            </Field>
            <Field id="q-count" label="Number of pallets or pieces" error={e.freight?.pieceCount?.message as string | undefined}>
              <Input inputMode="numeric" {...register("freight.pieceCount")} />
            </Field>
            <Field id="q-piece-type" label="Unit type">
              <NativeSelect {...register("freight.pieceType")}>
                <option value="pallets">Pallets</option>
                <option value="pieces">Pieces</option>
                <option value="crates">Crates</option>
                <option value="other">Other</option>
              </NativeSelect>
            </Field>
            <Field id="q-dimensions" label="Dimensions" error={e.freight?.dimensions?.message} hint={'e.g. 48" x 40" x 60" per pallet'} className="sm:col-span-2">
              <Input {...register("freight.dimensions")} />
            </Field>
            <Field id="q-handling" label="Special instructions" error={e.freight?.specialHandling?.message} hint="Temperature, fragile, stackability, hazmat class if applicable" className="sm:col-span-2">
              <Textarea rows={3} {...register("freight.specialHandling")} />
            </Field>
            <Field id="q-loading" label="Loading and unloading requirements" error={e.freight?.loadingRequirements?.message} hint="Dock or liftgate, appointment times, forklift availability" className="sm:col-span-2">
              <Textarea rows={3} {...register("freight.loadingRequirements")} />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="q-company" label="Company name" required error={e.contact?.companyName?.message}>
              <Input autoComplete="organization" {...register("contact.companyName")} />
            </Field>
            <Field id="q-contact" label="Contact name" required error={e.contact?.contactName?.message}>
              <Input autoComplete="name" {...register("contact.contactName")} />
            </Field>
            <Field id="q-email" label="Business email" required error={e.contact?.email?.message}>
              <Input type="email" autoComplete="email" {...register("contact.email")} />
            </Field>
            <Field id="q-phone" label="Phone number" required error={e.contact?.phone?.message}>
              <Input type="tel" autoComplete="tel" {...register("contact.phone")} />
            </Field>
            <Field id="q-notes" label="Additional notes" error={e.contact?.notes?.message} className="sm:col-span-2">
              <Textarea rows={4} {...register("contact.notes")} />
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <dl className="grid gap-x-8 gap-y-4 rounded-lg border border-line bg-white p-5 text-sm sm:grid-cols-2">
              {[
                ["Pickup", `${v.route.pickupAddress} on ${v.route.pickupDate}`],
                ["Delivery", v.route.deliveryAddress],
                ["Required delivery date", v.route.deliveryDeadline || "None given"],
                ["Additional stops", (v.route.stops ?? []).map((s) => s.location).filter(Boolean).join("; ") || "None"],
                ["Freight description", v.freight.description],
                ["Commodity", v.freight.commodity],
                ["Weight", `${v.freight.weightLbs} lbs`],
                ["Equipment", typeLabel(v.freight.equipment)],
                ["Units", v.freight.pieceCount ? `${v.freight.pieceCount} ${v.freight.pieceType}` : "Not given"],
                ["Company", v.contact.companyName],
                ["Contact", `${v.contact.contactName}, ${v.contact.email}, ${v.contact.phone}`],
              ].map(([k, val]) => (
                <div key={k}><dt className="font-semibold text-navy">{k}</dt><dd className="mt-0.5 break-words text-charcoal">{val}</dd></div>
              ))}
            </dl>
            <p className="rounded-md bg-ivory-200 p-4 text-sm leading-relaxed">
              Your request will be reviewed by our team. <strong>Submitting an inquiry does not confirm transportation availability, pricing, or booking.</strong>
            </p>
            <PrivacyCheckbox id="q-privacy" error={e.privacyAck?.message} register={register("privacyAck")} />
          </div>
        )}
      </div>

      <Honeypot inputRef={honeypot} />
      {error && <div className="mt-6"><FormAlert tone="error">{error}</FormAlert></div>}

      <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-between">
        {step > 0 ? (
          <Button type="button" variant="ghost" onClick={() => setStep((s) => s - 1)}><ArrowLeft aria-hidden="true" /> Back</Button>
        ) : <span />}
        {step < steps.length - 1 ? (
          <Button type="button" onClick={next}>Continue <ArrowRight aria-hidden="true" /></Button>
        ) : (
          <Button type="submit" disabled={pending}>
            <SubmitLabel pending={pending} idle={<>Submit Freight Inquiry <ArrowRight aria-hidden="true" /></>} />
          </Button>
        )}
      </div>
    </form>
  );
}
