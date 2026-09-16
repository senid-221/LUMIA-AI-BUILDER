"use client";
import { useEffect, useState } from "react";
import Builder from "./builder";

type User = { id: string; email: string; name: string | null };

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.35 12.23c0-.79-.07-1.55-.2-2.27H12v4.3h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.42Z" />
      <path fill="#34A853" d="M12 21.99c2.63 0 4.83-.87 6.44-2.34l-3.14-2.45c-.87.58-1.98.92-3.3.92-2.54 0-4.69-1.72-5.46-4.03H3.3v2.53A9.73 9.73 0 0 0 12 21.99Z" />
      <path fill="#FBBC05" d="M6.54 14.09A5.85 5.85 0 0 1 6.24 12c0-.73.13-1.44.3-2.09V7.38H3.3A9.98 9.98 0 0 0 2.25 12c0 1.67.4 3.24 1.05 4.62l3.24-2.53Z" />
      <path fill="#EA4335" d="M12 5.88c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.82 2.91 14.63 2 12 2a9.73 9.73 0 0 0-8.7 5.38l3.24 2.53C7.31 7.6 9.46 5.88 12 5.88Z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 .5a12 12 0 0 0-3.79 23.38c.6.11.82-.26.82-.58v-2.23c-3.34.73-4.04-1.42-4.04-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.74.08-.74 1.2.08 1.83 1.23 1.83 1.23 1.08 1.86 2.83 1.32 3.52 1.01.11-.78.42-1.32.76-1.62-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.38 1.23-3.22-.12-.3-.53-1.53.12-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.29-1.23 3.29-1.23.65 1.65.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.62-2.81 5.64-5.49 5.94.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.82.58A12 12 0 0 0 12 .5Z" />
    </svg>
  );
}

export default function OAuthGate() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setError(params.get("authError") || "");
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUser(d.user || null))
      .catch(() => setError("Unable to check your session."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="oauth-page">
        <div className="oauth-card">
          <div className="oauth-logo">LA</div>
          <h1>LUMIA BUILDER</h1>
          <p>Checking your session…</p>
        </div>
      </main>
    );
  }

  if (user) return <Builder />;

  return (
    <main className="oauth-page">
      <div className="oauth-card">
        <div className="oauth-logo">LA</div>
        <h1>LUMIA BUILDER</h1>
        <p className="oauth-subtitle">Sign in to continue building with Lumia AI.</p>
        <div className="oauth-actions">
          <a className="oauth-button" href="/api/auth/oauth/google">
            <GoogleIcon />
            <span>Continue with Google</span>
          </a>
          <a className="oauth-button" href="/api/auth/oauth/github">
            <GitHubIcon />
            <span>Continue with GitHub</span>
          </a>
        </div>
        {error && <p className="oauth-error">{error}</p>}
        <p className="oauth-note">Secure sign-in with your existing Google or GitHub account.</p>
      </div>
      <style jsx global>{`
        .oauth-page{min-height:100vh;background:#fff;color:#111827;display:flex;align-items:center;justify-content:center;padding:24px;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
        .oauth-card{width:min(100%,410px);text-align:center}
        .oauth-logo{width:76px;height:76px;margin:0 auto 20px;border-radius:22px;display:grid;place-items:center;background:linear-gradient(135deg,#7c3aed,#2563eb);color:#fff;font-size:29px;font-weight:900;letter-spacing:-3px;box-shadow:0 15px 35px rgba(79,70,229,.2)}
        .oauth-card h1{margin:0;font-size:30px;letter-spacing:-1.1px;font-weight:850}
        .oauth-subtitle{margin:10px 0 28px;color:#64748b;font-size:14px}
        .oauth-actions{display:grid;gap:12px}
        .oauth-button{height:52px;border-radius:14px;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:11px;font-size:15px;font-weight:750;transition:.18s;background:#fff;color:#111827;border:1px solid #d1d5db;box-sizing:border-box}
        .oauth-button:hover{transform:translateY(-1px);box-shadow:0 9px 22px rgba(15,23,42,.1);border-color:#c4c9d0}
        .oauth-button svg{flex:0 0 auto}
        .oauth-button span{display:inline-flex;align-items:center}
        .oauth-error{margin:14px 0 0;color:#dc2626;font-size:12px}
        .oauth-note{margin:28px 0 0;color:#94a3b8;font-size:11px;line-height:1.5}
      `}</style>
    </main>
  );
}
