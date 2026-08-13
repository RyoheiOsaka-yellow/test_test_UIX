/**
 * Canonical JSON serialization — object keys sorted recursively so the same
 * logical value always yields the same string. Used to build stable input
 * hashes for derived results (hashing itself is done by the caller, e.g. with
 * node:crypto, to keep this package browser-safe).
 */
export function canonicalStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value !== null && typeof value === 'object') {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(src).sort()) {
      out[key] = sortValue(src[key]);
    }
    return out;
  }
  return value;
}
