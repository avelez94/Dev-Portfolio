import * as React from "react";
import { cn } from "@/lib/utils";

const tones = {
  neutral: "bg-ivory-200 text-navy",
  red: "bg-brand-red/10 text-brand-red-dark",
  navy: "bg-navy text-white",
  green: "bg-success-soft text-success",
  amber: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
} as const;

export function Badge({ tone = "neutral", className, ...props }: React.ComponentProps<"span"> & { tone?: keyof typeof tones }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)} {...props} />;
}
