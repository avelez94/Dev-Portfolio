import Link from "next/link";
import { Info } from "lucide-react";

/** Honest operating status. Shown on every public page until operations are verified and enabled. */
export function StatusBar({ operational, message }: { operational: boolean; message: string | null }) {
  if (operational) return null;
  return (
    <div className="bg-navy text-white">
      <p className="container-site flex items-start gap-2 py-2 text-[0.8rem] leading-snug sm:items-center sm:justify-center sm:text-center">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-red sm:mt-0" />
        <span>
          {message ??
            "Velez Freight Group is preparing to launch. Our broker registration is in progress, and we are not yet arranging transportation or accepting freight orders."}{" "}
          <Link href="/our-story#status" className="font-semibold underline decoration-brand-red underline-offset-2 hover:text-white">
            Learn more
          </Link>
        </span>
      </p>
    </div>
  );
}
