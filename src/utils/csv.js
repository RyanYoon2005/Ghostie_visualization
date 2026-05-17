// Small CSV helper used by Standard and Premium Analysis pages.
// We build a single CSV with section headers ("# Section name") and blank-row
// separators so it opens cleanly in Excel/Numbers/Sheets while still being
// human-readable in a text editor.

const escape = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  // Always quote — handles commas, quotes, and newlines uniformly.
  return `"${s.replace(/"/g, '""')}"`;
};

export const row = (cells) => cells.map(escape).join(',');

// Build a flat CSV string from an array of sections.
// Each section: { title: string, headers?: string[], rows: any[][] }
// Rows can be a single array (one-row table) or array-of-arrays.
export function buildCsv(sections) {
  const lines = [];
  sections.forEach((s, i) => {
    if (i > 0) lines.push('');
    if (s.title) lines.push(`# ${s.title}`);
    if (s.headers?.length) lines.push(row(s.headers));
    s.rows?.forEach((r) => {
      if (Array.isArray(r)) lines.push(row(r));
      else lines.push(row([r]));
    });
  });
  return lines.join('\n');
}

export function downloadCsv(filename, content) {
  // Prepend BOM so Excel opens UTF-8 files correctly.
  const blob = new Blob(['﻿', content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const safeFilename = (s) =>
  String(s ?? '')
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'export';
