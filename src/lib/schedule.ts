const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/** "2 November 2026" for a YYYY-MM-DD date, read as a calendar day (no time zone shift). */
export function dayLabel(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return `${day} ${months[month - 1]} ${year}`;
}

/** "19 Februari – 16 Maret 2027", dropping the repeated year (and month) when both ends share it. */
export function rangeLabel(start: string, end?: string) {
  if (!end || end === start) return dayLabel(start);
  const [startYear, startMonth, startDay] = start.split("-").map(Number);
  const [endYear, endMonth] = end.split("-").map(Number);
  if (startYear !== endYear) return `${dayLabel(start)} – ${dayLabel(end)}`;
  if (startMonth !== endMonth) return `${startDay} ${months[startMonth - 1]} – ${dayLabel(end)}`;
  return `${startDay}–${dayLabel(end)}`;
}

/** 00:00 WIB on a YYYY-MM-DD day. */
export function startOfDay(date: string) {
  return Date.parse(`${date}T00:00:00+07:00`);
}

/** A sign-up window opens at 00:00 WIB on its first day and closes at the end of its last day, WIB. */
export function windowState(now: number, window: { opensAt: string; closesAt: string }) {
  if (now < startOfDay(window.opensAt)) return "upcoming" as const;
  if (now <= Date.parse(`${window.closesAt}T23:59:59+07:00`)) return "open" as const;
  return "closed" as const;
}
