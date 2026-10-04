export function getTodayString(): string {
  const now = new Date();
  return formatDateString(now);
}

export function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatDisplayDate(dateStr: string): string {
  const date = parseDateString(dateStr);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

export function getDayOfWeek(dateStr: string): number {
  return parseDateString(dateStr).getDay(); // 0 = Sunday, 1 = Monday, etc.
}

export function getPastDaysList(count = 7): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(formatDateString(d));
  }
  return days;
}

export function addDays(dateStr: string, days: number): string {
  const d = parseDateString(dateStr);
  d.setDate(d.getDate() + days);
  return formatDateString(d);
}
