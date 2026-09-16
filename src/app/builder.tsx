"use client";
import { useEffect, useMemo, useState } from "react";

type User = { id: string; email: string; name: string | null };
type Project = { id: string; name: string; status: string; _count?: { files: number } };
type FileItem = { id: string; path: string; content: string; language: string | null };

function language(p: string) {
  const x = p.split(".").pop()?.toLowerCase();
  return x === "tsx" || x === "ts" ? "typescript" : x === "jsx" || x === "js" ? "javascript" : x === "css" ? "css" : x === "json" ? "json" : "text";
}

export default function Builder() {
  const [p, setP] = useState("");
  const [s, setS] = useState("Checking session…");
  const [r, setR] = useState<any>(null);
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [selected, setSelected] = useState("");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [active, setActive] = useState<FileItem | null>(null);
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [token, setToken] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployed, setDeployed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  async function load() {
    const me = await fetch("/api/auth/me").then((x) => x.json());
    setUser(me.user);
    if (me.user) {
      const x = await fetch("/api/projects").then((v) => v.json());
      setProjects(x.projects || []);
      setS("Ready");
    } else setS("Sign in to start building");
  }

  useEffect(() => { load(); }, []);

  async function auth() {
    setS(mode === "signin" ? "Signing in…" : "Creating account…");
    const url = mode === "signin" ? "/api/auth/signin" : "/api/auth/signup";
    const body = mode === "signin" ? { email, password } : { email, password, name };
    const x = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await x.json();
    if (!x.ok) throw Error(d.error || "Authentication failed");
    setUser(d.user); setS("Ready"); setEmail(""); setPassword("");
    const list = await fetch("/api/projects").then((v) => v.json());
    setProjects(list.projects || []);
  }

  async function openProject(id: string) {
    if (!id) return;
    setSelected(id); setS("Loading files…");
    const x = await fetch(`/api/projects/${id}/files`); const d = await x.json();
    if (!x.ok) throw Error(d.error || "Unable to load files");
    setFiles(d.files || []); setActive(null); setCode(""); setDeployed(false); setS("Ready");
  }

  function selectFile(path: string) { const f = files.find((x) => x.path === path) || null; setActive(f); setCode(f?.content || ""); }

  async function save() {
    if (!selected || !active) return; setSaving(true);
    try {
      const x = await fetch(`/api/projects/${selected}/files`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: active.path, content: code, language: language(active.path) }) });
      const d = await x.json(); if (!x.ok) throw Error(d.error || "Save failed");
      setFiles((v) => v.map((f) => f.path === active.path ? { ...f, content: code } : f));
      setActive((v) => v ? v.path === active.path ? { ...v, content: code } : v : null); setS("Saved");
    } catch (e) { setS(e instanceof Error ? e.message : "Save failed"); } finally { setSaving(false); }
  }

  async function aiFix() {
    if (!active) return; setFixing(true);
    try {
      const x = await fetch("/api/builder/debug", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: selected, files: [{ path: active.path, content: code }], stderr: "User requested an AI fix for this file." }) });
      const d = await x.json(); if (!x.ok || !d.ok) throw Error(d.error || "AI Fix failed");
      const replacement = d.replacements?.find((f: any) => f.path === active.path);
      if (replacement) { setCode(replacement.content); setS("AI fix generated — review and Save"); } else setS("AI returned no replacement for this file");
    } catch (e) { setS(e instanceof Error ? e.message : "AI Fix failed"); } finally { setFixing(false); }
  }

  async function build() {
    setS("Building with NVIDIA…");
    try {
      const x = await fetch("/api/builder/build", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: p, projectId: selected || undefined }) });
      const d = await x.json(); if (!x.ok || !d.ok) throw Error(d.error || "Build failed");
      setR(d); setSelected(d.projectId); await openProject(d.projectId); setS(d.result?.status === "PASSED" ? `Build passed after ${d.retries} debug retry(s)` : d.result?.status || "Done");
      const list = await fetch("/api/projects").then((v) => v.json()); setProjects(list.projects || []);
    } catch (e) { setS(e instanceof Error ? e.message : "Failed"); }
  }

  async function syncGitHub() {
    if (!selected || !repo || !token) { setS("Enter repository and GitHub token"); return; }
    setSyncing(true); setS("Syncing to GitHub…");
    try {
      const current = active ? files.map((f) => f.path === active.path ? { ...f, content: code } : f) : files;
      const x = await fetch("/api/github/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: selected, repository: repo, branch, token, message: `Update ${projects.find((x) => x.id === selected)?.name || "project"} from Lumia AI`, files: current.map((f) => ({ path: f.path, content: f.content })) }) });
      const d = await x.json(); if (!x.ok || !d.ok) throw Error(d.error || "GitHub sync failed");
      setToken(""); setS(`GitHub synced: ${d.repository}@${d.branch}`);
    } catch (e) { setS(e instanceof Error ? e.message : "GitHub sync failed"); } finally { setSyncing(false); }
  }

  async function deploy() {
    if (!selected) return; setDeploying(true); setS("Triggering Vercel production deployment…");
    try {
      const x = await fetch(`/api/projects/${selected}/deploy`, { method: "POST" }); const d = await x.json();
      if (!x.ok || !d.ok) throw Error(d.error || "Deployment failed"); setDeployed(true); setS("Deployment queued on Vercel");
    } catch (e) { setS(e instanceof Error ? e.message : "Deployment failed"); } finally { setDeploying(false); }
  }

  async function signout() { await fetch("/api/auth/signout", { method: "POST" }); setUser(null); setProjects([]); setFiles([]); setActive(null); setS("Sign in to start building"); }
  const grouped = useMemo(() => files.map((f) => f.path), [files]);

  if (!user) return (
    <main className="auth-page">
      <style>{`
        *{box-sizing:border-box}
        .auth-page{min-height:100vh;background:#fff;color:#15213a;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:flex;align-items:center;justify-content:center;padding:28px 18px;position:relative;overflow:hidden}
        .auth-page:before,.auth-page:after{content:"";position:absolute;border-radius:999px;filter:blur(1px);pointer-events:none}
        .auth-page:before{width:330px;height:330px;left:-170px;top:-80px;background:linear-gradient(135deg,rgba(124,58,237,.12),rgba(37,99,235,.08))}
        .auth-page:after{width:300px;height:300px;right:-160px;bottom:-80px;background:linear-gradient(135deg,rgba(37,99,235,.1),rgba(168,85,247,.12))}
        .auth-shell{width:min(100%,510px);position:relative;z-index:1}
        .brand{text-align:center;margin-bottom:22px}
        .logo{width:64px;height:64px;margin:0 auto 12px;border-radius:20px;background:linear-gradient(135deg,#7c3aed,#2563eb);color:white;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:26px;box-shadow:0 12px 30px rgba(99,67,237,.25);letter-spacing:-2px}
        .brand h1{margin:0;font-size:clamp(28px,7vw,42px);letter-spacing:-1.8px;font-weight:850;color:#111827}.brand h1 span{background:linear-gradient(90deg,#2563eb,#7c3aed);-webkit-background-clip:text;background-clip:text;color:transparent}.brand p{margin:8px 0 0;color:#64748b;font-size:14px}
        .auth-card{background:rgba(255,255,255,.96);border:1px solid #e7eaf2;border-radius:24px;padding:26px;box-shadow:0 22px 60px rgba(30,41,59,.1)}
        .auth-card h2{margin:0;font-size:28px;letter-spacing:-.8px}.auth-card .sub{margin:6px 0 22px;color:#64748b;font-size:15px}
        .field{position:relative;margin-bottom:12px}.field input{width:100%;height:52px;border:1px solid #dce2ec;border-radius:14px;padding:0 15px;background:#fff;color:#172033;font-size:15px;outline:none;transition:.2s;border-color:#dce2ec}.field input:focus{border-color:#7c3aed;box-shadow:0 0 0 4px rgba(124,58,237,.1)}
        .password-toggle{position:absolute;right:8px;top:7px;height:38px;border:0;border-radius:10px;background:transparent;color:#64748b;padding:0 10px;cursor:pointer}.password-toggle:hover{background:#f1f5f9;color:#4f46e5}
        .options{display:flex;align-items:center;justify-content:space-between;margin:7px 1px 17px;font-size:13px;color:#64748b}.remember{display:flex;align-items:center;gap:8px;cursor:pointer}.remember input{accent-color:#6d28d9;width:16px;height:16px}.forgot{border:0;background:none;color:#6d28d9;font-weight:650;cursor:pointer;padding:4px}.forgot:hover{text-decoration:underline}
        .gradient-btn,.outline-btn{width:100%;height:48px;border-radius:13px;font-size:15px;font-weight:750;cursor:pointer;transition:transform .18s,box-shadow .18s,filter .18s}.gradient-btn{border:0;color:#fff;background:linear-gradient(100deg,#7c3aed,#2563eb);box-shadow:0 10px 24px rgba(99,102,241,.25)}.gradient-btn:hover{transform:translateY(-2px);filter:brightness(1.05);box-shadow:0 14px 30px rgba(99,102,241,.32)}.gradient-btn:active,.outline-btn:active{transform:translateY(0)}.gradient-btn:disabled{opacity:.65;cursor:not-allowed;transform:none}
        .divider{display:flex;align-items:center;gap:12px;color:#94a3b8;font-size:12px;margin:19px 0}.divider:before,.divider:after{content:"";height:1px;background:#e5e7eb;flex:1}
        .outline-btn{background:#fff;border:1px solid #d9c9ff;color:#6d28d9}.outline-btn:hover{background:linear-gradient(90deg,#faf5ff,#eff6ff);border-color:#a78bfa;transform:translateY(-2px);box-shadow:0 9px 22px rgba(124,58,237,.12)}
        .status{text-align:center;min-height:20px;margin:13px 0 0;color:#64748b;font-size:12px}.status.error{color:#dc2626}.new-user{text-align:center;margin:18px 0 0;color:#64748b;font-size:13px}.new-user button{border:0;background:none;color:#6d28d9;font-weight:750;cursor:pointer}.new-user button:hover{text-decoration:underline}
        .features{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:18px}.feature{text-align:center;padding:12px 5px}.feature-icon{width:40px;height:40px;border-radius:14px;margin:0 auto 7px;display:flex;align-items:center;justify-content:center;font-size:18px;background:#f5f3ff;color:#7c3aed}.feature:nth-child(2) .feature-icon{background:#eff6ff;color:#2563eb}.feature:nth-child(3) .feature-icon{background:#ecfdf5;color:#059669}.feature strong{display:block;font-size:12px}.feature small{display:block;color:#94a3b8;font-size:10px;margin-top:3px}
        .footer{text-align:center;color:#94a3b8;font-size:11px;margin-top:13px}
        @media(max-width:480px){.auth-page{padding:18px 14px}.brand{margin-bottom:16px}.logo{width:54px;height:54px;border-radius:17px;font-size:22px}.brand h1{font-size:29px}.auth-card{padding:21px 17px;border-radius:20px}.auth-card h2{font-size:25px}.features{gap:2px}.feature small{font-size:9px}}
      `}</style>
      <div className="auth-shell">
        <div className="brand"><div className="logo">LA</div><h1>LUMIA AI <span>BUILDER</span></h1><p>Build Ideas. With AI. For a Better Tomorrow.</p></div>
        <section className="auth-card">
          <h2>{mode === "signin" ? "Welcome back 👋" : "Create your account"}</h2>
          <p className="sub">{mode === "signin" ? "Sign in to your workspace" : "Start building smarter with Lumia AI"}</p>
          {mode === "signup" && <div className="field"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoComplete="name" /></div>}
          <div className="field"><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" type="email" autoComplete="email" /></div>
          <div className="field"><input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (8+ characters)" type={showPassword ? "text" : "password"} autoComplete={mode === "signin" ? "current-password" : "new-password"} /><button type="button" className="password-toggle" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button></div>
          {mode === "signin" && <div className="options"><label className="remember"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me</label><button className="forgot" type="button">Forgot password?</button></div>}
          <button className="gradient-btn" onClick={() => auth().catch((e) => setS(e.message))}>{mode === "signin" ? "Sign in" : "Create account"}</button>
          <div className="divider">OR</div>
          <button className="outline-btn" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>{mode === "signin" ? "Create an account" : "I already have an account"}</button>
          <p className={`status ${s.toLowerCase().includes("failed") || s.toLowerCase().includes("error") ? "error" : ""}`}>{s}</p>
          <p className="new-user">{mode === "signin" ? <>New to <strong>LUMIA AI BUILDER</strong>? Start building today!</> : <>Already have an account? <button onClick={() => setMode("signin")}>Sign in</button></>}</p>
        </section>
        <div className="features"><div className="feature"><div className="feature-icon">✦</div><strong>AI Powered</strong><small>Smart app building</small></div><div className="feature"><div className="feature-icon">◇</div><strong>Secure</strong><small>Your data protected</small></div><div className="feature"><div className="feature-icon">◎</div><strong>For Everyone</strong><small>Build without limits</small></div></div>
        <div className="footer">© 2025 LUMIA AI BUILDER. All rights reserved.</div>
      </div>
    </main>
  );

  return <main style={{ fontFamily: "Arial", minHeight: "100vh", background: "#f6f7f9" }}><header style={{ padding: "14px 20px", background: "#111827", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><strong>LUMIA AI BUILDER</strong><small style={{ marginLeft: 12, opacity: .7 }}>AI IDE · V8</small></div><div>{user.email}<button onClick={signout} style={{ marginLeft: 12 }}>Sign out</button></div></header><section style={{ padding: 16, display: "grid", gridTemplateColumns: "240px 1fr", gap: 12 }}><aside style={{ background: "white", border: "1px solid #ddd", borderRadius: 8, padding: 12, minHeight: 620 }}><h3>Projects</h3><select value={selected} onChange={(e) => openProject(e.target.value).catch((x) => setS(x.message))} style={{ width: "100%", padding: 8 }}><option value="">Select project</option>{projects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select><h3>Files</h3>{grouped.map((path) => <button key={path} onClick={() => selectFile(path)} style={{ display: "block", width: "100%", textAlign: "left", padding: 8, marginBottom: 3, border: 0, background: active?.path === path ? "#e5e7eb" : "transparent", cursor: "pointer" }}>{path}</button>)}</aside><section style={{ display: "grid", gridTemplateRows: "auto auto 1fr", gap: 12 }}><div style={{ background: "white", padding: 12, border: "1px solid #ddd", borderRadius: 8 }}><textarea value={p} onChange={(e) => setP(e.target.value)} placeholder="Describe the app Lumia should build…" style={{ width: "100%", minHeight: 90, padding: 10, boxSizing: "border-box" }} /><button onClick={build} disabled={!p.trim()} style={{ marginTop: 8, padding: 10 }}>Build with Lumia</button><span style={{ marginLeft: 12 }}>{s}</span></div><div style={{ background: "white", padding: 10, border: "1px solid #ddd", borderRadius: 8 }}><div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><strong>{active?.path || "No file selected"}</strong>{active && <><button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button><button onClick={aiFix} disabled={fixing}>{fixing ? "AI fixing…" : "AI Fix"}</button><button onClick={deploy} disabled={deploying || !selected}>{deploying ? "Deploying…" : deployed ? "Deployed ✓" : "Deploy to Vercel"}</button><a href={`/preview?url=${encodeURIComponent("http://localhost:3001")}`} target="_blank" style={{ marginLeft: "auto" }}>Live Preview</a></>}</div>{selected && <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #eee", display: "grid", gridTemplateColumns: "1.2fr .7fr 1.5fr auto", gap: 7 }}><input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="owner/repository" /><input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="branch" /><input value={token} onChange={(e) => setToken(e.target.value)} type="password" autoComplete="off" placeholder="GitHub token (not stored)" /><button onClick={syncGitHub} disabled={syncing}>{syncing ? "Syncing…" : "Sync GitHub"}</button></div>}</div><textarea value={code} onChange={(e) => setCode(e.target.value)} disabled={!active} spellCheck={false} style={{ width: "100%", minHeight: 480, resize: "vertical", padding: 16, boxSizing: "border-box", fontFamily: "monospace", fontSize: 14, border: "1px solid #ddd", borderRadius: 8, background: "#111827", color: "white" }} placeholder="Select a generated file to edit it…" /></section></section>{r && <details style={{ margin: "0 16px 16px" }}><summary>Build details</summary><pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(r, null, 2)}</pre></details>}</main>;
}
