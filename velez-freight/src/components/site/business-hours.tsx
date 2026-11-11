import { DAYS, type BusinessHours } from "@/config/credentials";

const fmt = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 || 12;
  return m ? `${hour}:${String(m).padStart(2, "0")} ${suffix}` : `${hour} ${suffix}`;
};

const zoneLabel = (tz: string) => ({ "America/New_York": "Eastern Time", "America/Chicago": "Central Time", "America/Denver": "Mountain Time", "America/Los_Angeles": "Pacific Time" })[tz] ?? tz;

/** Business hours as the owner entered them. Days without hours are left out. */
export function BusinessHoursList({ hours, timezone, afterHours }: { hours: BusinessHours; timezone: string; afterHours: string | null }) {
  const rows = DAYS.flatMap((d) => {
    const h = hours[d.key];
    if (!h) return [];
    return [{ day: d.label, text: "closed" in h ? "Closed" : `${fmt(h.open)} to ${fmt(h.close)}` }];
  });
  if (!rows.length) return null;
  return (
    <div data-business-hours className="mt-6 border-t border-white/15 pt-5">
      <h3 className="text-base font-bold text-white">Business hours</h3>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
        {rows.map((r) => (
          <div key={r.day} className="contents">
            <dt className="text-white/75">{r.day}</dt>
            <dd>{r.text}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-white/70">{zoneLabel(timezone)}{afterHours ? `. ${afterHours}.` : ""}</p>
    </div>
  );
}
