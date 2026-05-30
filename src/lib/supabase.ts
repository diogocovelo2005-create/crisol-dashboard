export async function query<T = any>(table: string, params = ""): Promise<T[]> {
  try {
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.warn("Supabase credentials not available");
      return [];
    }

    const headers = {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { 
      headers, 
      cache: "no-store" as const,
      next: { revalidate: 0 }
    });
    
    if (!res.ok) {
      console.error(`Supabase query failed: ${res.status}`);
      return [];
    }
    
    return res.json() as Promise<T[]>;
  } catch (error) {
    console.error("Query error:", error);
    return [];
  }
}

export function fmt(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("pt-PT");
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

export function groupByDay(items: Array<Record<string, unknown>>, dateField: string, days = 14) {
  const now = new Date();
  const buckets: Record<string, { day: string; _items: Array<Record<string, unknown>> }> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    buckets[key] = { day: d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" }), _items: [] };
  }
  items.forEach(item => {
    const key = (item[dateField] as string | undefined)?.slice(0, 10);
    if (key && buckets[key]) buckets[key]._items.push(item);
  });
  return Object.values(buckets);
}

export const MISSED_DISPOSITIONS = ["no answer", "busy", "cancel", "failed", "call failed"];
