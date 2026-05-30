"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { query, fmt, fmtDate, fmtTime, daysBetween, groupByDay, MISSED_DISPOSITIONS } from "@/lib/supabase";

/* ── Tooltip ── */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[--card-hover] border border-[--border] rounded-lg px-3 py-2 font-mono text-xs">
      <div className="text-[--text-dim] mb-1">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color }} className="flex justify-between gap-4">
          <span>{p.name}</span><span className="font-bold">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ── KPI Card ── */
function KpiCard({ label, value, sub, color, icon }: { label: string; value: string; sub?: string; color: string; icon: string }) {
  return (
    <div className="bg-[--card] border border-[--border] rounded-xl p-5 flex-1 min-w-[160px] hover:border-[--accent] hover:bg-[--card-hover] transition-all group">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{icon}</span>
        <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-[--text-dim]">{label}</span>
      </div>
      <div className="text-3xl font-bold font-mono leading-none" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-[--text-dim] mt-2 font-mono">{sub}</div>}
    </div>
  );
}

/* ── Chart Card ── */
function ChartCard({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[--card] border border-[--border] rounded-xl p-6 ${className}`}>
      <h3 className="text-[11px] font-mono uppercase tracking-[0.15em] text-[--text-dim] mb-5 font-medium">{title}</h3>
      {children}
    </div>
  );
}

/* ── Customer Row ── */
function CustomerRow({ c }: { c: any }) {
  const diasInativo = c.ultima_visita_calendar ? daysBetween(c.ultima_visita_calendar, new Date().toISOString()) : null;
  const status = diasInativo === null ? "novo" : diasInativo > 30 ? "inativo" : "ativo";
  const statusColor = status === "ativo" ? "text-green-500 bg-green-500/10" : status === "inativo" ? "text-red-500 bg-red-500/10" : "text-blue-500 bg-blue-500/10";
  return (
    <div className="grid grid-cols-[1fr_140px_100px_80px] gap-3 items-center px-4 py-3 border-b border-[--border] text-sm">
      <div>
        <div className="font-semibold">{c.nome || "Sem nome"}</div>
        <div className="text-[--text-dim] text-[11px] font-mono">{c.telefone}</div>
      </div>
      <div className="text-[--text-dim] font-mono text-[11px]">{c.ultima_visita_calendar ? fmtDate(c.ultima_visita_calendar) : "sem visita"}</div>
      <div className="font-mono text-[11px] text-[--text-dim]">{c.ciclo_mediano_dias ? `${c.ciclo_mediano_dias}d ciclo` : "—"}</div>
      <div className={`text-[10px] font-semibold uppercase tracking-wider ${statusColor} px-2 py-0.5 rounded-md text-center`}>{status}</div>
    </div>
  );
}

/* ── Conversation Row ── */
function ConversationRow({ conv, messages }: { conv: any; messages: any[] }) {
  const lastMsg = messages.filter((m: any) => m.conversation_id === conv.id).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  return (
    <div className="px-4 py-3 border-b border-[--border] text-sm">
      <div className="flex justify-between mb-1">
        <span className="font-semibold">{conv.customer_nome || "Desconhecido"}</span>
        <span className="text-[--text-dim] text-[10px] font-mono">{lastMsg ? `${fmtDate(lastMsg.created_at)} ${fmtTime(lastMsg.created_at)}` : ""}</span>
      </div>
      {lastMsg && (
        <div className="text-[--text-dim] text-xs truncate">
          {lastMsg.direcao === "outbound" ? "🤖 " : "👤 "}
          {lastMsg.conteudo?.slice(0, 100)}
        </div>
      )}
    </div>
  );
}

/* ── Main Dashboard ── */
export default function Dashboard() {
  const [barbershops, setBarbershops] = useState<any[]>([]);
  const [selectedShop, setSelectedShop] = useState<string | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [calls, setCalls] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [tab, setTab] = useState("overview");

  const fetchData = useCallback(async (shopId: string | null) => {
    setLoading(true);
    try {
      const shopFilter = shopId ? `barbershop_id=eq.${shopId}&` : "";
      const [shops, custs, msgs, cls, convs] = await Promise.all([
        query("barbershops", "select=*"),
        query("customers", `${shopFilter}select=*&order=created_at.desc`),
        query("messages", "select=*,conversations!inner(customer_id,barbershop_id)&order=created_at.desc&limit=500"),
        query("calls", "select=*&order=created_at.desc&limit=500"),
        query("conversations", "select=*,customers(nome)&order=ultima_mensagem_em.desc.nullslast&limit=50"),
      ]);
      setBarbershops(shops);
      setCustomers(custs);
      const filteredMsgs = shopId ? msgs.filter((m: any) => m.conversations?.barbershop_id === shopId) : msgs;
      setMessages(filteredMsgs);
      const filteredCalls = shopId
        ? cls.filter((c: any) => { const shop = shops.find((s: any) => s.id === shopId); return shop && c.called_number === shop.zadarma_did; })
        : cls;
      setCalls(filteredCalls);
      const filteredConvs = shopId ? convs.filter((c: any) => c.barbershop_id === shopId) : convs;
      setConversations(filteredConvs.map((c: any) => ({ ...c, customer_nome: c.customers?.nome })));
      setLastRefresh(new Date());
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(selectedShop); }, [selectedShop, fetchData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => fetchData(selectedShop), 30000);
    return () => clearInterval(interval);
  }, [selectedShop, fetchData]);

  const today = new Date().toISOString().slice(0, 10);
  const msgsToday = messages.filter((m: any) => m.created_at?.startsWith(today));
  const msgsTodayIn = msgsToday.filter((m: any) => m.direcao === "inbound").length;
  const msgsTodayOut = msgsToday.filter((m: any) => m.direcao === "outbound").length;
  const callsToday = calls.filter((c: any) => c.created_at?.startsWith(today));
  const missedToday = callsToday.filter((c: any) => MISSED_DISPOSITIONS.includes(c.disposition));
  const answeredToday = callsToday.filter((c: any) => !MISSED_DISPOSITIONS.includes(c.disposition));
  const missedRate = calls.length > 0 ? Math.round(calls.filter((c: any) => MISSED_DISPOSITIONS.includes(c.disposition)).length / calls.length * 100) : 0;

  const msgDays = groupByDay(messages, "created_at", 14).map((d: any) => ({
    ...d, inbound: d._items?.filter((m: any) => m.direcao === "inbound").length || 0,
    outbound: d._items?.filter((m: any) => m.direcao === "outbound").length || 0,
  }));
  const callDays = groupByDay(calls, "created_at", 14).map((d: any) => ({
    ...d, perdidas: d._items?.filter((c: any) => MISSED_DISPOSITIONS.includes(c.disposition)).length || 0,
    atendidas: d._items?.filter((c: any) => !MISSED_DISPOSITIONS.includes(c.disposition)).length || 0,
  }));

  const activeCustomers = customers.filter((c: any) => c.ultima_visita_calendar && daysBetween(c.ultima_visita_calendar, new Date().toISOString()) <= 30);
  const inactiveCustomers = customers.filter((c: any) => c.ultima_visita_calendar && daysBetween(c.ultima_visita_calendar, new Date().toISOString()) > 30);
  const newCustomers = customers.filter((c: any) => !c.ultima_visita_calendar);
  const reactivationsSent = customers.filter((c: any) => c.reativacao_enviada_em).length;

  const pieData = [
    { name: "Ativos", value: activeCustomers.length, color: "#22c55e" },
    { name: "Inativos", value: inactiveCustomers.length, color: "#ef4444" },
    { name: "Novos", value: newCustomers.length, color: "#3b82f6" },
  ].filter(d => d.value > 0);

  const tabs = [
    { id: "overview", label: "Visão Geral", icon: "📊" },
    { id: "customers", label: "Clientes", icon: "👥" },
    { id: "conversations", label: "Conversas", icon: "💬" },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-[--border] px-6 py-4 flex items-center justify-between sticky top-0 bg-[--bg]/90 backdrop-blur-xl z-10">
        <div className="flex items-center gap-4">
          <span className="text-2xl">✂️</span>
          <h1 className="text-lg font-[--font-outfit] font-bold tracking-tight">
            Crisol <span className="text-[--accent]">Dashboard</span>
          </h1>
          {barbershops.length > 1 && (
            <select value={selectedShop || ""} onChange={e => setSelectedShop(e.target.value || null)}
              className="bg-[--card] text-[--text] border border-[--border] rounded-lg px-3 py-1.5 text-sm font-mono cursor-pointer outline-none">
              <option value="">Todas as barbearias</option>
              {barbershops.map((s: any) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${loading ? "bg-amber-500 animate-pulse" : "bg-green-500"}`} />
            <span className="text-[10px] text-[--text-dim] font-mono">
              {lastRefresh ? `${fmtTime(lastRefresh.toISOString())} · auto 30s` : "…"}
            </span>
          </div>
          <button onClick={() => fetchData(selectedShop)} disabled={loading}
            className="bg-[--accent] text-black border-none rounded-lg px-4 py-2 text-xs font-bold font-mono uppercase tracking-wider cursor-pointer disabled:opacity-50 hover:brightness-110 transition-all">
            {loading ? "…" : "↻ Refresh"}
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-[--border] px-6">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`border-b-2 px-5 py-3 text-sm font-mono font-medium transition-all cursor-pointer bg-transparent ${tab === t.id ? "border-[--accent] text-[--text]" : "border-transparent text-[--text-dim] hover:text-[--text]"}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <main className="p-6 max-w-[1400px] mx-auto">
        {tab === "overview" && (
          <>
            <div className="flex gap-4 mb-6 flex-wrap">
              <KpiCard icon="👥" label="Clientes" value={fmt(customers.length)} sub={`${activeCustomers.length} ativos · ${inactiveCustomers.length} inativos`} color="var(--blue)" />
              <KpiCard icon="💬" label="Msgs hoje" value={fmt(msgsTodayIn + msgsTodayOut)} sub={`${msgsTodayIn} in · ${msgsTodayOut} out`} color="var(--green)" />
              <KpiCard icon="📞" label="Chamadas hoje" value={fmt(callsToday.length)} sub={`${missedToday.length} perdidas · ${answeredToday.length} atendidas`} color="var(--purple)" />
              <KpiCard icon="🚨" label="Taxa perdidas" value={`${missedRate}%`} sub={`${calls.length} chamadas total`} color={missedRate > 50 ? "var(--red)" : "var(--accent)"} />
              <KpiCard icon="🔄" label="Reativações" value={fmt(reactivationsSent)} sub="mensagens enviadas" color="var(--accent)" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <ChartCard title="Mensagens · últimos 14 dias">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={msgDays} barGap={2}>
                    <XAxis dataKey="day" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="inbound" name="Inbound" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="outbound" name="Outbound" fill="#22c55e" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Chamadas · últimos 14 dias">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={callDays} barGap={2}>
                    <XAxis dataKey="day" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="atendidas" name="Atendidas" fill="#22c55e" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="perdidas" name="Perdidas" fill="#ef4444" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4">
              <ChartCard title="Segmentação clientes">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" stroke="none">
                      {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie><Tooltip content={<ChartTooltip />} /></PieChart>
                  </ResponsiveContainer>
                ) : <div className="text-[--text-dim] text-center py-10">Sem dados</div>}
                <div className="flex justify-center gap-4 mt-2">
                  {pieData.map((d, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[11px] text-[--text-dim]">
                      <div className="w-2 h-2 rounded-full" style={{ background: d.color }} /> {d.name} ({d.value})
                    </div>
                  ))}
                </div>
              </ChartCard>
              <ChartCard title="Últimas conversas">
                <div className="max-h-[260px] overflow-y-auto">
                  {conversations.slice(0, 8).map((c: any) => <ConversationRow key={c.id} conv={c} messages={messages} />)}
                  {conversations.length === 0 && <div className="text-[--text-dim] text-center py-10">Sem conversas</div>}
                </div>
              </ChartCard>
            </div>
          </>
        )}

        {tab === "customers" && (
          <div className="bg-[--card] border border-[--border] rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_140px_100px_80px] gap-3 px-4 py-3 border-b border-[--border] text-[10px] uppercase tracking-[0.15em] text-[--text-dim] font-mono font-semibold">
              <div>Nome</div><div>Última visita</div><div>Ciclo</div><div>Estado</div>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {customers.map((c: any) => <CustomerRow key={c.id} c={c} />)}
              {customers.length === 0 && <div className="text-[--text-dim] text-center py-10">Sem clientes</div>}
            </div>
          </div>
        )}

        {tab === "conversations" && (
          <div className="bg-[--card] border border-[--border] rounded-xl overflow-hidden">
            <div className="max-h-[600px] overflow-y-auto">
              {conversations.map((c: any) => <ConversationRow key={c.id} conv={c} messages={messages} />)}
              {conversations.length === 0 && <div className="text-[--text-dim] text-center py-10">Sem conversas</div>}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
