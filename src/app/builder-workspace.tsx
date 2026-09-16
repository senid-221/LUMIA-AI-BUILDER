"use client";
import { useEffect, useMemo, useState } from "react";

type User = { id: string; email: string; name: string | null };
type Project = { id: string; name: string; status: string; _count?: { files: number } };
type FileItem = { id: string; path: string; content: string; language: string | null };

function language(p: string) {
  const x = p.split(".").pop()?.toLowerCase();
  return x === "tsx" || x === "ts" ? "typescript" : x === "jsx" || x === "js" ? "javascript" : x === "css" ? "css" : x === "json" ? "json" : "text";
}

export default function BuilderWorkspace() {
  const [p, setP] = useState("");
  const [s, setS] = useState("Ready");
  const [r, setR] = useState<any>(null);
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
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
  const grouped = useMemo(() => files.map((f) => f.path), [files]);

  useEffect(() => {
    fetch("/api/auth/me").then((x) => x.json()).then(async (me) => {
      setUser(me.user || null);
      if (me.user) {
        const x = await fetch("/api/projects").then((v) => v.json());
        setProjects(x.projects || []);
      }
    }).catch(() => setS("Unable to check session."));
  }, []);

  async function openProject(id: string) {
    if (!id) return;
    setSelected(id); setS("Loading files…");
    const x = await fetch(`/api/projects/${id}/files`); const d = await x.json();
    if (!x.ok) throw Error(d.error || "Unable to load files");
    setFiles(d.files || []); setActive(null); setCode(""); setDeployed(false); setS("Ready");
  }
  function selectFile(path: string) { const f = files.find((x) => x.path === path) || null; setActive(f); setCode(f?.content || ""); }
  async function save() {
    if (!selected || !active) return;
    setSaving(true); setS("Saving…");
    try {
      const x = await fetch(`/api/projects/${selected}/files`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: active.path, content: code, language: language(active.path) }) });
      const d = await x.json(); if (!x.ok) throw Error(d.error || "Save failed");
      setFiles((v) => v.map((f) => f.path === active.path ? { ...f, content: code } : f)); setActive((v) => v ? { ...v, content: code } : v); setS("Saved");
    } catch (e) { setS(e instanceof Error ? e.message : "Save failed"); } finally { setSaving(false); }
  }
  async function aiFix() {
    if (!active) return; setFixing(true); setS("AI Fix running…");
    try {
      const x = await fetch("/api/builder/debug", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: selected, files: [{ path: active.path, content: code }], stderr: "User requested an AI fix for this file." }) });
      const d = await x.json(); if (!x.ok || !d.ok) throw Error(d.error || "AI Fix failed");
      const replacement = d.replacements?.find((f: any) => f.path === active.path);
      if (replacement) { setCode(replacement.content); setS("AI fix generated — review and Save"); } else setS("AI returned no replacement for this file");
    } catch (e) { setS(e instanceof Error ? e.message : "AI Fix failed"); } finally { setFixing(false); }
  }
  async function build() {
    if (!p.trim()) return; setS("Building with NVIDIA…");
    try {
      const x = await fetch("/api/builder/build", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: p, projectId: selected || undefined }) });
      const d = await x.json(); if (!x.ok || !d.ok) throw Error(d.error || "Build failed");
      setR(d); setSelected(d.projectId); await openProject(d.projectId); setS(d.result?.status === "PASSED" ? `Build passed after ${d.retries} debug retry(s)` : d.result?.status || "Done");
      const list = await fetch("/api/projects").then((v) => v.json()); setProjects(list.projects || []);
    } catch (e) { setS(e instanceof Error ? e.message : "Build failed"); }
  }
  async function syncGitHub() {
    if (!selected || !repo || !token) { setS("Enter repository and GitHub token"); return; }
    setSyncing(true); setS("Syncing to GitHub…");
    try {
      const current = active ? files.map((f) => f.path === active.path ? { ...f, content: code } : f) : files;
      const x = await fetch("/api/github/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: selected, repository: repo, branch, token, message: `Update ${projects.find((x) => x.id === selected)?.name || "project"} from Lumia AI`, files: current.map((f) => ({ path: f.path, content: f.content })) }) });
      const d = await x.json(); if (!x.ok || !d.ok) throw Error(d.error || "GitHub sync failed"); setToken(""); setS(`GitHub synced: ${d.repository}@${d.branch}`);
    } catch (e) { setS(e instanceof Error ? e.message : "GitHub sync failed"); } finally { setSyncing(false); }
  }
  async function deploy() {
    if (!selected) return; setDeploying(true); setS("Triggering Vercel deployment…");
    try { const x = await fetch(`/api/projects/${selected}/deploy`, { method: "POST" }); const d = await x.json(); if (!x.ok || !d.ok) throw Error(d.error || "Deployment failed"); setDeployed(true); setS("Deployment queued on Vercel"); }
    catch (e) { setS(e instanceof Error ? e.message : "Deployment failed"); } finally { setDeploying(false); }
  }
  async function signout() { await fetch("/api/auth/signout", { method: "POST" }); location.href = "/"; }

  if (!user) return <div className="workspace-loading">Loading Lumia Builder…<style jsx>{`.workspace-loading{min-height:100vh;display:grid;place-items:center;background:#f7f8fc;color:#334155;font:600 14px Inter,system-ui}`}</style></div>;

  return <main className="workspace"><style jsx global>{`
    *{box-sizing:border-box}.workspace{min-height:100vh;background:#f7f8fc;color:#0f172a;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}.topbar{position:sticky;top:0;z-index:30;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:13px 18px;background:rgba(255,255,255,.96);backdrop-filter:blur(12px);border-bottom:1px solid #e5e7eb}.brand{display:flex;align-items:center;gap:10px}.brand-icon{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;background:linear-gradient(135deg,#7c3aed,#2563eb);color:#fff;font-weight:900;letter-spacing:-2px}.brand strong{display:block;font-size:14px}.brand small{display:block;color:#94a3b8;font-size:11px;margin-top:2px}.account{display:flex;align-items:center;gap:9px;min-width:0}.account span{max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#475569;font-size:12px}.ghost{border:1px solid #dbe1ea;background:#fff;color:#334155}.primary{border:0;background:linear-gradient(100deg,#7c3aed,#2563eb);color:#fff}.danger{border:1px solid #fecaca;background:#fff;color:#b91c1c}.workspace-grid{display:grid;grid-template-columns:250px minmax(0,1fr);gap:16px;padding:16px;max-width:1400px;margin:auto}.sidebar,.card{background:#fff;border:1px solid #e5e7eb;border-radius:16px;box-shadow:0 5px 20px rgba(15,23,42,.04)}.sidebar{padding:14px;min-height:calc(100vh - 102px)}.section-label{font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#94a3b8;margin:4px 0 9px}.select{width:100%;height:42px;border:1px solid #dbe1ea;border-radius:10px;background:#fff;padding:0 11px;color:#1e293b}.file-list{margin-top:12px}.file-empty{padding:12px 4px;color:#94a3b8;font-size:13px}.file-item{width:100%;display:block;text-align:left;border:0;background:transparent;border-radius:9px;padding:9px 10px;margin-bottom:4px;color:#475569;cursor:pointer;font-size:13px}.file-item.active{background:#f1edff;color:#5b21b6;font-weight:700}.main{min-width:0;display:grid;gap:16px}.hero-card{padding:16px}.hero-title{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.hero-card h1{margin:0;font-size:21px;letter-spacing:-.4px}.hero-card p{margin:5px 0 0;color:#64748b;font-size:13px}.prompt{width:100%;min-height:100px;margin-top:14px;border:1px solid #dbe1ea;border-radius:12px;padding:12px;resize:vertical;outline:0;background:#fbfcfe;color:#0f172a;font:14px/1.5 inherit}.prompt:focus,.field:focus{border-color:#8b5cf6;box-shadow:0 0 0 4px rgba(139,92,246,.1)}.actions{display:flex;flex-wrap:wrap;gap:9px;align-items:center;margin-top:10px}.btn{height:40px;border-radius:10px;padding:0 14px;font-weight:750;cursor:pointer}.btn:disabled{opacity:.55;cursor:not-allowed}.status{font-size:12px;color:#64748b}.file-card{overflow:hidden}.file-head{padding:11px 14px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;gap:10px}.file-head strong{font-size:13px}.muted{color:#94a3b8;font-size:11px}.editor{background:#0b1220}.editor-toolbar{display:flex;justify-content:flex-end;gap:8px;padding:8px;border-bottom:1px solid #1e293b}.editor textarea{display:block;width:100%;min-height:440px;border:0;outline:0;resize:vertical;background:#0b1220;color:#e2e8f0;padding:14px;font:13px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace}.bottom-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.card-inner{padding:14px}.card-title{font-weight:800;font-size:14px;margin-bottom:11px}.field{width:100%;height:40px;border:1px solid #dbe1ea;border-radius:10px;padding:0 10px;margin-top:8px;outline:0;background:#fff;color:#0f172a}.inline{display:grid;grid-template-columns:1fr 120px;gap:8px}.note{margin-top:9px;color:#94a3b8;font-size:11px;line-height:1.45}.deploy-state{margin-top:10px;padding:9px 10px;border-radius:9px;background:#f8fafc;color:#64748b;font-size:12px}.deploy-state.done{background:#ecfdf5;color:#047857}.result{padding:14px}.result h3{margin:0 0 9px;font-size:14px}.result pre{white-space:pre-wrap;overflow:auto;background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:10px;font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}@media(max-width:920px){.workspace-grid{grid-template-columns:1fr}.sidebar{min-height:auto}.bottom-grid{grid-template-columns:1fr}.inline{grid-template-columns:1fr}.account span{max-width:130px}}@media(max-width:560px){.topbar{padding:11px 12px}.brand small{display:none}.workspace-grid{padding:10px;gap:10px}.sidebar,.card{border-radius:13px}.hero-card h1{font-size:18px}.actions{display:grid;grid-template-columns:1fr}.actions .btn{width:100%}.account .ghost{padding:0 9px}.editor textarea{min-height:360px;font-size:12px}}
  `}</style>
    <header className="topbar"><div className="brand"><div className="brand-icon">LA</div><div><strong>Lumia AI Builder</strong><small>AI IDE · Production</small></div></div><div className="account"><span>{user.email}</span><button className="btn ghost" onClick={signout}>Sign out</button></div></header>
    <div className="workspace-grid">
      <aside className="sidebar"><div className="section-label">Projects</div><select className="select" value={selected} onChange={(e) => openProject(e.target.value).catch((x) => setS(x.message))}><option value="">Select project</option>{projects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select><div className="section-label" style={{marginTop:18}}>Files</div><div className="file-list">{grouped.length===0?<div className="file-empty">No generated files yet.</div>:grouped.map((path)=><button className={`file-item ${active?.path===path?"active":""}`} key={path} onClick={()=>selectFile(path)}>{path}</button>)}</div></aside>
      <section className="main">
        <div className="card hero-card"><div className="hero-title"><div><h1>Build with Lumia AI</h1><p>Describe what you want to build. Lumia plans, generates, tests, and debugs the project.</p></div></div><textarea className="prompt" value={p} onChange={(e)=>setP(e.target.value)} placeholder="Describe the app Lumia should build…"/><div className="actions"><button className="btn primary" onClick={build} disabled={!p.trim()}>Build with Lumia</button><span className="status">{s}</span></div></div>
        <div className="card file-card"><div className="file-head">{active?<><div><strong>{active.path}</strong><span className="muted" style={{marginLeft:8}}>{active.language||language(active.path)}</span></div><div className="actions" style={{marginTop:0}}><button className="btn ghost" onClick={save} disabled={!active||saving}>{saving?"Saving…":"Save"}</button><button className="btn ghost" onClick={aiFix} disabled={!active||fixing}>{fixing?"Fixing…":"AI Fix"}</button></div></>:<span className="muted">No file selected</span>}</div>{active?<div className="editor"><textarea value={code} onChange={(e)=>setCode(e.target.value)} spellCheck={false}/></div>:<div style={{padding:38,textAlign:"center",color:"94a3b8",fontSize:13}}>Select a generated file to edit it.</div>}</div>
        <div className="bottom-grid"><div className="card card-inner"><div className="card-title">GitHub Sync</div><input className="field" value={repo} onChange={(e)=>setRepo(e.target.value)} placeholder="owner/repository"/><div className="inline"><input className="field" value={branch} onChange={(e)=>setBranch(e.target.value)} placeholder="main"/><input className="field" value={token} onChange={(e)=>setToken(e.target.value)} placeholder="GitHub token" type="password"/></div><div className="actions"><button className="btn primary" onClick={syncGitHub} disabled={syncing}>{syncing?"Syncing…":"Sync to GitHub"}</button></div><div className="note">Token is used only for this sync request and is cleared after success.</div></div><div className="card card-inner"><div className="card-title">Vercel Deployment</div><button className="btn primary" onClick={deploy} disabled={!selected||deploying}>{deploying?"Deploying…":"Deploy to Vercel"}</button><div className={`deploy-state ${deployed?"done":""}`}>{deployed?"Deployment request sent to Vercel.":selected?"Ready to deploy selected project.":"Select a project to enable deployment."}</div></div></div>
        {r&&<div className="card result"><h3>Latest build result</h3><pre>{JSON.stringify(r,null,2)}</pre></div>}
      </section>
    </div>
  </main>;
}
