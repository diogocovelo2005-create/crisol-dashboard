"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { query, fmt, fmtDate, fmtTime, daysBetween, groupByDay, MISSED_DISPOSITIONS } from "@/lib/supabase";

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[--card-hover] border border-[--border] rounded-lg px-3 py-2 font-mono text-xs">
      <div className="text-[--text-dim] mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }} className="flex justify-between gap-4">
          <span>{p.name}</span><span className="font-bold">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

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

function ChartCard({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[--card] border border-[--border] rounded-xl p-6 ${className}`}>
      <h3 className="text-[11px] font-mono uppercase tracking-[0.15em] text-[--text-dim] mb-5 font-medium">{title}</h3>
      {children}
    </div>
  );
}

function CustomerRow({ c }: { c: Record<string, unknown> }) {
  const ultima_visita = c.ultima_visita_calendar as string | undefined;
  const diasInativo = ultima_visita ? daysBetween(ultima_visita, new Date().toISOString()) : null;
  const status = diasInativo === null ? "novo" : diasInativo > 30 ? "inativo" : "ativo";
  const statusColor = status === "ativo" ? "text-green-500 bg-green-500/10" : status === "inativo" ? "text-red-500 bg-red-500/10" : "text-blue-500 bg-blue-500/10";
  return (
    <div className="grid grid-cols-[1fr_140px_100px_80px] gap-3 items-center px-4 py-3 border-b border-[--border] text-sm">
      <div>
        <div className="font-semibold">{(c.nome as string) || "Sem nome"}</div>
        <div className="text-[--text-dim] text-[11px] font-mono">{(c.telefone as string)}</div>
      </div>
      <div className="text-[--text-dim] font-mono text-[11px]">{ultima_visita ? fmtDate(ultima_visita) : "sem visita"}</div>
      <div className="font-mono text-[11px] text-[--text-dim]">{(c.ciclo_mediano_dias as number) ? `${c.ciclo_mediano_dias}d ciclo` : "—"}</div>
      <div className={`text-[10px] font-semibold uppercase tracking-wider ${statusColor} px-2 py-0.5 rounded-md text-center`}>{status}</div>
    </div>
  );
}

function ConversationRow({ conv, messages }: { conv: Record<string, unknown>; messages: Array<Record<string, unknown>> }) {
  const lastMsg = messages.filter((m) => m.conversation_id === conv.id).sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime())[0];
  return (
    <div className="px-4 py-3 border-b border-[--border] text-sm">
      <div className="flex justify-between mb-1">
        <span className="font-semibold">{(conv.customer_nome as string) || "Desconhecido"}</span>
        <span className="text-[--text-dim] text-[10px] font-mono">{lastMsg ? `${fmtDate(lastMsg.created_at as string)} ${fmtTime(lastMsg.created_at as string)}` : ""}</span>
      </div>
      {lastMsg && (
        <div className="text-[--text-dim] text-xs truncate">
          {(lastMsg.direcao as string) === "outbound" ? "🤖 " : "👤 "}
          {((lastMsg.conteudo as string) || "")?.slice(0, 100)}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [barbershops, setBarbershops] = useState<Array<Record<string, unknown>>>([]);
  const [selectedShop, setSelectedShop] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Array<Record<string, unknown>>>([]);
  const [messages, setMessages] = useState<Array<Record<string, unknown>>>([]);
  const [calls, setCalls] = useState<Array<Record<string, unknown>>>([]);
  const [conversations, setConversations] = useState<Array<Record<string, unknown>>>([]);
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
      const filteredMsgs = shopId ? msgs.filter((m) => (m.conversations as Record<string, unknown>)?.barbershop_id === shopId) : msgs;
      setMessages(filteredMsgs);
      const filteredCalls = shopId
        ? cls.filter((c) => { const shop = shops.find((s) => s.id === shopId); return shop && c.called_number === (shop as Record<string, unknown>).zadarma_did; })
        : cls;
      setCalls(filteredCalls);
      const filteredConvs = shopId ? convs.filter((c) => c.barbershop_id === shopId) : convs;
      setConversations(filteredConvs.map((c) => ({ ...c, customer_nome: ((c.customers as Record<string, unknown>) || {}).nome })));
      setLastRefresh(new Date());
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(selectedShop); }, [selectedShop, fetchData]);

  useEffect(() => {
    const interval = setInterval(() => fetchData(selectedShop), 30000);
    return () => clearInterval(interval);
  }, [selectedShop, fetchData]);

  const today = new Date().toISOString().slice(0, 10);
  const msgsToday = messages.filter((m) => (m.created_at as string)?.startsWith(today));
  const msgsTodayIn = msgsToday.filter((m) => m.direcao === "inbound").length;
  const msgsTodayOut = msgsToday.filter((m) => m.direcao === "outbound").length;
  const callsToday = calls.filter((c) => (c.created_at as string)?.startsWith(today));
  const missedToday = callsToday.filter((c) => MISSED_DISPOSITIONS.includes(c.disposition as string));
  const answeredToday = callsToday.filter((c) => !MISSED_DISPOSITIONS.includes(c.disposition as string));
  const missedRate = calls.length > 0 ? Math.round(calls.filter((c) => MISSED_DISPOSITIONS.includes(c.disposition as string)).length / calls.length * 100) : 0;

  const msgDays = groupByDay(messages, "created_at", 14).map((d) => ({
    ...d, inbound: ((d._items as Array<Record<string, unknown>>) || []).filter((m) => m.direcao === "inbound").length || 0,
    outbound: ((d._items as Array<Record<string, unknown>>) || []).filter((m) => m.direcao === "outbound").length || 0,
  }));
  const callDays = groupByDay(calls, "created_at", 14).map((d) => ({
    ...d, perdidas: ((d._items as Array<Record<string, unknown>>) || []).filter((c) => MISSED_DISPOSITIONS.includes(c.disposition as string)).length || 0,
    atendidas: ((d._items as Array<Record<string, unknown>>) || []).filter((c) => !MISSED_DISPOSITIONS.includes(c.disposition as string)).length || 0,
  }));

  const activeCustomers = customers.filter((c) => c.ultima_visita_calendar && daysBetween(c.ultima_visita_calendar as string, new Date().toISOString()) <= 30);
  const inactiveCustomers = customers.filter((c) => c.ultima_visita_calendar && daysBetween(c.ultima_visita_calendar as string, new Date().toISOString()) > 30);
  const newCustomers = customers.filter((c) => !c.ultima_visita_calendar);
  const reactivationsSent = customers.filter((c) => c.reativacao_enviada_em).length;

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
              {barbershops.map((s) => <option key={s.id as string} value={s.id as string}>{s.nome as string}</option>)}
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
                  {conversations.slice(0, 8).map((c) => <ConversationRow key={c.id as string} conv={c} messages={messages} />)}
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
              {customers.map((c) => <CustomerRow key={c.id as string} c={c} />)}
              {customers.length === 0 && <div className="text-[--text-dim] text-center py-10">Sem clientes</div>}
            </div>
          </div>
        )}

        {tab === "conversations" && (
          <div className="bg-[--card] border border-[--border] rounded-xl overflow-hidden">
            <div className="max-h-[600px] overflow-y-auto">
              {conversations.map((c) => <ConversationRow key={c.id as string} conv={c} messages={messages} />)}
              {conversations.length === 0 && <div className="text-[--text-dim] text-center py-10">Sem conversas</div>}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
