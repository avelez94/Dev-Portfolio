"use client";

import * as React from "react";
import { Accordion as A } from "radix-ui";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export const Accordion = A.Root;

export function AccordionItem({ className, ...props }: React.ComponentProps<typeof A.Item>) {
  return <A.Item className={cn("rounded-lg border border-line bg-white shadow-[var(--shadow-card)]", className)} {...props} />;
}

export function AccordionTrigger({ className, children, ...props }: React.ComponentProps<typeof A.Trigger>) {
  return (
    <A.Header className="flex">
      <A.Trigger
        className={cn(
          "group flex flex-1 items-center justify-between gap-4 rounded-lg px-5 py-4 text-left font-sans text-[0.97rem] font-semibold text-navy transition-colors hover:text-brand-red-dark",
          className,
        )}
        {...props}
      >
        {children}
        <Plus aria-hidden="true" className="size-5 shrink-0 text-brand-red transition-transform duration-300 group-data-[state=open]:rotate-45" />
      </A.Trigger>
    </A.Header>
  );
}

export function AccordionContent({ className, children, ...props }: React.ComponentProps<typeof A.Content>) {
  return (
    <A.Content
      className="overflow-hidden text-[0.95rem] leading-relaxed text-charcoal data-[state=closed]:animate-[acc-up_0.25s_ease-out] data-[state=open]:animate-[acc-down_0.3s_ease-out]"
      {...props}
    >
      <div className={cn("px-5 pb-5", className)}>{children}</div>
    </A.Content>
  );
}
