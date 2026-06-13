// Month range helper. Avoids the invalid `${year}-${month}-31` end date that
// crashed Postgres for 30-day months and February.
export function monthRange(month: number | string, year: number | string): { start: string; end: string } {
  const m = String(month).padStart(2, '0');
  const start = `${year}-${m}-01`;
  // Last calendar day of the month. Use getDate() (not toISOString, which is UTC
  // and shifts a day early in positive-offset timezones like IST).
  const lastDay = new Date(Number(year), Number(month), 0).getDate();
  const end = `${year}-${m}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}
