// Xuất CSV (Excel mở được). Dùng UTF-8 BOM để Excel nhận tiếng Việt.

export interface CsvRow { [key: string]: string | number | null | undefined }

function csvEscape(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowsToCsv(rows: CsvRow[], headers: { key: string; label: string }[]): string {
  const head = headers.map(h => csvEscape(h.label)).join(',');
  const body = rows
    .map(r => headers.map(h => csvEscape(r[h.key])).join(','))
    .join('\n');
  return `${head}\n${body}`;
}

export function downloadCsv(filename: string, csv: string) {
  const BOM = '﻿';
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
