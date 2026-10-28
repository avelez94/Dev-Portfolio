import {
  ArrowUpRight as LArrowUpRight,
  CalendarCheck,
  Check as LCheck,
  HeartHandshake,
  Puzzle,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  X,
} from 'lucide-react'

type P = { className?: string }

/** Soft organic blob used behind the portrait. */
export function Blob({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 400 400" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M318 72c38 34 58 90 49 141-9 52-47 99-96 126-50 27-111 34-158 9C66 323 33 266 34 210c1-57 36-113 82-147 47-35 106-48 153-38 18 4 35 13 49 47z"
      />
    </svg>
  )
}

export function Sparkle({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M20 0c1.6 9.4 5.6 15.4 20 20-14.4 4.6-18.4 10.6-20 20-1.6-9.4-5.6-15.4-20-20 14.4-4.6 18.4-10.6 20-20z" />
    </svg>
  )
}

export function Squiggle({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 300 24" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path
        d="M3 15c22-11 41-11 60 0s38 11 58 0 39-11 59 0 39 11 59 0 39-11 58 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Ring({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <circle cx="100" cy="100" r="80" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="2 10" strokeLinecap="round" />
      <circle cx="100" cy="100" r="56" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

/** Small hand wave drawn as a hand outline. */
export function Wave({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M7 11.5V6.8a1.4 1.4 0 0 1 2.8 0v4M9.8 10.5V5.2a1.4 1.4 0 0 1 2.8 0v5.3M12.6 10.6V6a1.4 1.4 0 0 1 2.8 0v5.6M15.4 11.4V8.6a1.4 1.4 0 0 1 2.8 0v5.2c0 4.1-2.9 7.2-6.8 7.2-2.6 0-4.3-1.2-5.7-3.3L3.6 14a1.5 1.5 0 0 1 2.4-1.8L7 13.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M19.5 3.5c1 .7 1.6 1.7 1.8 2.9M3.2 5.2c.3-1.2 1-2.1 2-2.7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

const serviceIcons: Record<string, typeof Sparkles> = {
  new: Sparkles,
  redesign: RefreshCw,
  store: ShoppingBag,
  booking: CalendarCheck,
  custom: Puzzle,
  care: HeartHandshake,
}

export function ServiceIcon({ id }: { id: string }) {
  const I = serviceIcons[id] ?? Sparkles
  return <I size={26} strokeWidth={1.8} aria-hidden="true" focusable="false" />
}

export function ArrowUpRight() {
  return <LArrowUpRight size={18} strokeWidth={2.2} aria-hidden="true" focusable="false" />
}

export function Check() {
  return <LCheck size={18} strokeWidth={2.6} aria-hidden="true" focusable="false" />
}

/** Used for "not included" items. A cross rather than a minus sign. */
export function NotIncluded() {
  return <X size={18} strokeWidth={2.6} aria-hidden="true" focusable="false" />
}
