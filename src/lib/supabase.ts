export const AVG_SERVICE_PRICE = 14;
export const AVG_CONV_MINUTES = 3;
export const CONVERSION_RATE = 0.5;

export async function query<T = Record<string, unknown>>(table: string, params = ""): Promise<T[]> {
  try {
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!SUPABASE_URL || !SUPABASE_KEY) { console.warn("Supabase credentials not available"); return []; }
    const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { headers, cache: "no-store" as const, next: { revalidate: 0 } });
    if (!res.ok) { console.error(`Supabase query failed: ${res.status}`); return []; }
    return res.json() as Promise<T[]>;
  } catch (error) { console.error("Query error:", error); return []; }
}

export function fmt(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("pt-PT");
}

export function fmtEur(n: number) {
  return n.toLocaleString("pt-PT", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
}

export function fmtTime(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

export function daysBetween(d1: string, d2: string) {
  return Math.floor((new Date(d2).getTime() - new Date(d1).getTime()) / 86400000);
}

export function getDateRange(period: string): { start: Date; days: number } {
  const now = new Date();
  switch (period) {
    case "7d": return { start: new Date(now.getTime() - 7 * 86400000), days: 7 };
    case "14d": return { start: new Date(now.getTime() - 14 * 86400000), days: 14 };
    case "30d": return { start: new Date(now.getTime() - 30 * 86400000), days: 30 };
    case "this_month": {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: s, days: Math.ceil((now.getTime() - s.getTime()) / 86400000) + 1 };
    }
    case "last_month": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { start: s, days: new Date(now.getFullYear(), now.getMonth(), 0).getDate() };
    }
    default: return { start: new Date(now.getTime() - 14 * 86400000), days: 14 };
  }
}

export function groupByDay(items: Array<Record<string, unknown>>, dateField: string, days = 14, startDate?: Date) {
  const now = new Date();
  const buckets: Record<string, { day: string; _items: Array<Record<string, unknown>> }> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = startDate ? new Date(startDate.getTime() + (days - 1 - i) * 86400000) : new Date(now.getTime() - i * 86400000);
    if (d > now) continue;
    const key = d.toISOString().slice(0, 10);
    buckets[key] = { day: d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" }), _items: [] };
  }
  items.forEach(item => {
    const key = (item[dateField] as string | undefined)?.slice(0, 10);
    if (key && buckets[key]) buckets[key]._items.push(item);
  });
  return Object.values(buckets);
}

export function filterByPeriod<T extends Record<string, unknown>>(items: T[], dateField: string, period: string): T[] {
  const { start } = getDateRange(period);
  const end = period === "last_month" ? new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59) : new Date();
  return items.filter(item => {
    const d = new Date(item[dateField] as string);
    return d >= start && d <= end;
  });
}

export const MISSED_DISPOSITIONS = ["no answer", "busy", "cancel", "failed", "call failed"];

export function exportCSV(data: Array<Record<string, unknown>>, filename: string) {
  if (!data.length) return;
  const keys = Object.keys(data[0]);
  const csv = [keys.join(","), ...data.map(row => keys.map(k => `"${String(row[k] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${filename}.csv`; a.click();
  URL.revokeObjectURL(url);
}
