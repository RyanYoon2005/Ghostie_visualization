import LZString from 'lz-string';

// We embed a compressed JSON snapshot of the loaded page state in the URL hash
// (#s=...) so a shared link can render instantly instead of re-fetching. The hash
// is never sent to the server, so it doesn't bloat logs or tracking.
//
// Format: window.location.hash === `#s=<lz-encoded-uri-component>`
// Decoded payload always includes a `snapshotDate` ISO string so the viewer can
// see when the snapshot was captured.

const HASH_PREFIX = '#s=';

export function encodeSnapshot(data) {
  const enriched = { ...data, snapshotDate: new Date().toISOString() };
  return LZString.compressToEncodedURIComponent(JSON.stringify(enriched));
}

export function decodeSnapshot(encoded) {
  if (!encoded) return null;
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function readSnapshotFromHash() {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  if (!hash || !hash.startsWith(HASH_PREFIX)) return null;
  return decodeSnapshot(hash.slice(HASH_PREFIX.length));
}

export function buildSnapshotHash(data) {
  return `${HASH_PREFIX}${encodeSnapshot(data)}`;
}

// Strip the snapshot from the URL without reloading. Used by the "View live data"
// button on public pages — drops the fragment so the next render fetches fresh data.
export function clearSnapshotHash() {
  if (typeof window === 'undefined') return;
  const url = window.location.pathname + window.location.search;
  window.history.replaceState(null, '', url);
}

// "Snapshot taken on 17 May 2026" — used in the public scorecard / compare header.
export function formatSnapshotDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'long', year: 'numeric' });
}
