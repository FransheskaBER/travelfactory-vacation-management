/**
 * The one date-display layer (rules/frontend.md): every rendered date goes
 * through here — inline toLocaleDateString is lint-banned. Fixed en-US
 * locale keeps output deterministic across machines; UTC matches the
 * wire's date-only semantics (A2/A5) — a local timezone would shift
 * "2026-08-21" to Aug 20 west of Greenwich.
 */
const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
});

const MONTH_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

/** "2026-08-21" → "Aug 21, 2026". Accepts any ISO date/date-time string. */
export const formatDate = (isoDate: string): string =>
  DATE_FORMAT.format(new Date(isoDate));

/** "2026-08-21" → "August 2026" — the team view's month headers. */
export const formatMonth = (isoDate: string): string =>
  MONTH_FORMAT.format(new Date(isoDate));
