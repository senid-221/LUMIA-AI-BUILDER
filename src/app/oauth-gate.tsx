"use client";
import { useEffect, useState } from "react";
import Builder from "./builder";

type User = { id: string; email: string; name: string | null };

export default function OAuthGate() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setError(params.get("authError") || "");
    fetch("/api/auth/me").then(r => r.json()).then(d => setUser(d.user || null)).catch(() => setError("Unable to check your session.")).finally(() => setLoading(false));
  }, []);
  if (loading) return <main className="oauth-page"><div className="oauth-card"><div className="oauth-logo">LA</div><h1>LUMIA BUILDER</h1><p>Checking your session…</p></div></main>;
  if (user) return <Builder />;
  return <main className="oauth-page"><div className="oauth-card"><div className="oauth-logo">LA</div><h1>LUMIA BUILDER</h1><p className="oauth-subtitle">Sign in to continue building with Lumia AI.</p><div className="oauth-actions"><a className="oauth-button google" href="/api/auth/oauth/google"><span>G</span>Continue with Google</a><a className="oauth-button github" href="/api/auth/oauth/github"><span>●</span>Continue with GitHub</a></div>{error && <p className="oauth-error">{error}</p>}<p className="oauth-note">Secure sign-in with your existing Google or GitHub account.</p></div><style jsx global>{`.oauth-page{min-height:100vh;background:#fff;color:#111827;display:flex;align-items:center;justify-content:center;padding:24px;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}.oauth-card{width:min(100%,410px);text-align:center}.oauth-logo{width:76px;height:76px;margin:0 auto 20px;border-radius:22px;display:grid;place-items:center;background:linear-gradient(135deg,#7c3aed,#2563eb);color:#fff;font-size:29px;font-weight:900;letter-spacing:-3px;box-shadow:0 15px 35px rgba(79,70,229,.2)}.oauth-card h1{margin:0;font-size:30px;letter-spacing:-1.1px;font-weight:850}.oauth-subtitle{margin:10px 0 28px;color:#64748b;font-size:14px}.oauth-actions{display:grid;gap:12px}.oauth-button{height:52px;border-radius:14px;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:11px;font-size:15px;font-weight:750;transition:.18s}.oauth-button:hover{transform:translateY(-1px);box-shadow:0 9px 22px rgba(15,23,42,.1)}.oauth-button.google{background:#fff;color:#111827;border:1px solid #d1d5db}.oauth-button.github{background:#111827;color:#fff;border:1px solid #111827}.oauth-button span{width:22px;font-weight:900;font-size:17px}.oauth-error{margin:14px 0 0;color:#dc2626;font-size:12px}.oauth-note{margin:28px 0 0;color:#94a3b8;font-size:11px;line-height:1.5}`}</style></main>;
}
