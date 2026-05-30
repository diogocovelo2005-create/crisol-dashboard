"use client";

export default function Dashboard() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ? "✅ Carregado" : "❌ Não encontrado";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "✅ Carregado" : "❌ Não encontrado";

  return (
    <div style={{ padding: "40px", fontFamily: "system-ui", maxWidth: "600px", margin: "0 auto" }}>
      <h1>✂️ Crisol Dashboard</h1>
      <p>Status das variáveis de ambiente:</p>
      <ul>
        <li>NEXT_PUBLIC_SUPABASE_URL: <strong>{url}</strong></li>
        <li>NEXT_PUBLIC_SUPABASE_ANON_KEY: <strong>{key}</strong></li>
      </ul>
      <hr />
      <p style={{ fontSize: "12px", color: "#666" }}>
        Se ambas mostrem ✅, o problema está no código. Se mostrem ❌, as variáveis não estão no Vercel.
      </p>
    </div>
  );
}