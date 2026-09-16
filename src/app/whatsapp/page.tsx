"use client";
import { useEffect, useState } from "react";

export default function WhatsAppAgentPage() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [configured, setConfigured] = useState(false);
  const [instructions, setInstructions] = useState("You are Lumia's helpful WhatsApp AI assistant. Answer clearly and concisely.");
  const [welcome, setWelcome] = useState("Hello! How can I help you today?");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("Loading configuration…");

  useEffect(() => {
    fetch("/api/whatsapp/config").then(r => r.json()).then(d => {
      if (d.webhookUrl) setWebhookUrl(d.webhookUrl);
      setConfigured(Boolean(d.configured));
      setStatus(d.configured ? "WhatsApp credentials are configured on the server." : "Add WhatsApp credentials to the server environment first.");
    }).catch(() => setStatus("Unable to load WhatsApp configuration."));
  }, []);

  async function save() {
    setSaving(true);
    setStatus("Saving agent settings…");
    const r = await fetch("/api/whatsapp/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instructions, welcome }) });
    const d = await r.json().catch(() => ({}));
    setStatus(r.ok ? "Agent settings saved." : (d.error || "Settings could not be saved."));
    setSaving(false);
  }

  return <main style={{ maxWidth: 900, margin: "0 auto", padding: 28, fontFamily: "Arial", background: "#f6f7f9", minHeight: "100vh" }}>
    <a href="/builder">← Back to Builder</a>
    <h1>WhatsApp AI Agent</h1>
    <p>Configure the behavior of your Lumia WhatsApp agent. Secrets stay server-side.</p>
    <section style={{ background: "white", padding: 20, borderRadius: 10, border: "1px solid #ddd", marginTop: 18 }}>
      <h3>Connection</h3>
      <p><strong>Status:</strong> {configured ? "Configured" : "Not configured"}</p>
      <label>Webhook URL</label>
      <input readOnly value={webhookUrl} style={{ width: "100%", padding: 11, marginTop: 6, boxSizing: "border-box" }} />
      <small>Use this URL in your Meta WhatsApp webhook configuration.</small>
    </section>
    <section style={{ background: "white", padding: 20, borderRadius: 10, border: "1px solid #ddd", marginTop: 14 }}>
      <h3>Agent behavior</h3>
      <label>System instructions</label>
      <textarea value={instructions} onChange={e => setInstructions(e.target.value)} style={{ width: "100%", minHeight: 150, padding: 11, marginTop: 6, boxSizing: "border-box" }} />
      <label style={{ display: "block", marginTop: 14 }}>Welcome message</label>
      <textarea value={welcome} onChange={e => setWelcome(e.target.value)} style={{ width: "100%", minHeight: 80, padding: 11, marginTop: 6, boxSizing: "border-box" }} />
      <button onClick={save} disabled={saving} style={{ marginTop: 14, padding: "11px 18px" }}>{saving ? "Saving…" : "Save Agent"}</button>
      <p>{status}</p>
    </section>
    <section style={{ background: "white", padding: 20, borderRadius: 10, border: "1px solid #ddd", marginTop: 14 }}>
      <h3>Server environment</h3>
      <pre style={{ background: "#111827", color: "white", padding: 14, overflowX: "auto" }}>{`WHATSAPP_ACCESS_TOKEN=***\nWHATSAPP_PHONE_NUMBER_ID=***\nWHATSAPP_VERIFY_TOKEN=***\nNVIDIA_API_KEY=***`}</pre>
      <small>Do not paste these secrets into the browser, GitHub repository, screenshots, or chat.</small>
    </section>
  </main>;
}
