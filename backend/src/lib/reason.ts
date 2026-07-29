/**
 * Canonical representation for the optional free-text `reason` field.
 * `""`, whitespace-only, `null`, and `undefined` are all wire encodings of
 * "no reason given" and collapse to `null`; anything else is stored trimmed.
 * Normalization never rejects — the length cap is a separate parser check
 * (spec 4.7 §4). Every writer of `reason` calls this before persisting;
 * the guarantee covers exactly those writers (spec 4.7 §2 boundary).
 */
export const normalizeReason = (value: string | null | undefined): string | null => {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};
