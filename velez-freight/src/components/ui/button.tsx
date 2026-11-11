import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-sans font-semibold transition-all duration-200 focus-visible:outline-3 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-brand-red text-white shadow-[0_8px_20px_-10px_rgb(225_37_47/0.8)] hover:bg-brand-red-dark hover:-translate-y-px",
        outlineLight: "border-2 border-white/85 text-white hover:bg-white hover:text-navy",
        outline: "border-2 border-navy text-navy hover:bg-navy hover:text-white",
        navy: "bg-navy text-white hover:bg-navy-800",
        ghost: "text-navy hover:bg-ivory-200",
        link: "text-brand-red-dark underline-offset-4 hover:underline px-0",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-5 text-[0.95rem]",
        lg: "h-13 px-7 text-base",
        icon: "size-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
