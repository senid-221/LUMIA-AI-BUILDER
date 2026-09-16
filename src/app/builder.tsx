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
  const [s, setS] = useState("Ready");
  const [r, setR] = useState<any>(null);
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [showAuth, setShowAuth] = useState(false);
  const [authStep, setAuthStep] = useState<"choices" | "form">("choices");
  const [showPassword, setShowPassword] = useState(false);
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
  const [view, setView] = useState<"editor" | "preview">("preview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [building, setBuilding] = useState(false);

  async function load() {
    try {
      const me = await fetch("/api/auth/me").then((x) => x.json());
      setUser(me.user);
      if (me.user) {
        const data = await fetch("/api/projects").then((x) => x.json());
        setProjects(data.projects || []);
        if (!building) setS("Ready");
      } else setS("");
    } catch { setS("Unable to load session"); }
  }

  useEffect(() => { load(); }, []);

  async function refreshBuildStatus(projectId: string) {
    const x = await fetch(`/api/builder/status?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
    const d = await x.json();
    if (!x.ok || !d.ok) throw Error(d.error || "Unable to read build status");
    return d.project;
  }

  useEffect(() => {
    if (!building || !selected) return;
    let stopped = false;
    const poll = async () => {
      try {
        const project = await refreshBuildStatus(selected);
        if (stopped) return;
        const status = project?.status;
        const count = project?._count?.files || 0;
        if (status === "PLANNING" || status === "BUILDING") {
          setS(count ? `Building with Lumia AI… ${count} files` : "Building with Lumia AI…");
          return;
        }
        if (status === "READY") {
          setBuilding(false);
          setS(`Build ready · ${count} files`);
          setR({ projectId: selected, status, project });
          await openProject(selected, false);
          await load();
          return;
        }
        if (status === "FAILED") {
          setBuilding(false);
          const desc = String(project?.description || "");
          const error = desc.includes("\n\nBuild error: ") ? desc.split("\n\nBuild error: ").slice(1).join("\n\nBuild error: ") : "Build failed.";
          setS(error);
          await load();
        }
      } catch (e) {
        if (!stopped) setS(e instanceof Error ? e.message : "Unable to read build status");
      }
    };
    poll();
    const timer = window.setInterval(poll, 2000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [building, selected]);

  async function auth() {
    setS(mode === "signin" ? "Signing in…" : "Creating account…");
    const url = mode === "signin" ? "/api/auth/signin" : "/api/auth/signup";
    const body = mode === "signin" ? { email, password } : { email, password, name };
    const x = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await x.json(); if (!x.ok) throw Error(d.error || "Authentication failed");
    setUser(d.user); setEmail(""); setPassword(""); setName(""); setShowAuth(false); setS("Ready");
    const list = await fetch("/api/projects").then((v) => v.json()); setProjects(list.projects || []);
  }

  async function openProject(id: string, showStatus = true) {
    if (!id) { setSelected(""); setFiles([]); setActive(null); setCode(""); return; }
    setSelected(id); if (showStatus) setS("Loading project…");
    const x = await fetch(`/api/projects/${id}/files`); const d = await x.json();
    if (!x.ok) throw Error(d.error || "Unable to load files");
    setFiles(d.files || []); setActive(null); setCode(""); if (showStatus) setS("Ready"); setView("preview"); setSidebarOpen(false);
  }

  function selectFile(path: string) { const f = files.find((x) => x.path === path) || null; setActive(f); setCode(f?.content || ""); setView("editor"); setSidebarOpen(false); }

  async function save() {
    if (!selected || !active) return; setSaving(true); setS("Saving…");
    try {
      const x = await fetch(`/api/projects/${selected}/files`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: active.path, content: code, language: language(active.path) }) });
      const d = await x.json(); if (!x.ok) throw Error(d.error || "Save failed");
      setFiles((v) => v.map((f) => f.path === active.path ? { ...f, content: code } : f)); setActive((v) => v ? { ...v, content: code } : v); setS("Saved");
    } catch (e) { setS(e instanceof Error ? e.message : "Save failed"); } finally { setSaving(false); }
  }

  async function aiFix() {
    if (!active) return; setFixing(true); setS("AI is fixing the file…");
    try {
      const x = await fetch("/api/builder/debug", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: selected, files: [{ path: active.path, content: code }], stderr: "User requested an AI fix for this file." }) });
      const d = await x.json(); if (!x.ok || !d.ok) throw Error(d.error || "AI Fix failed");
      const replacement = d.replacements?.find((f: any) => f.path === active.path);
      if (replacement) { setCode(replacement.content); setS("AI fix generated — review and Save"); } else setS("No replacement returned");
    } catch (e) { setS(e instanceof Error ? e.message : "AI Fix failed"); } finally { setFixing(false); }
  }

  async function build() {
    if (!p.trim() || building) return;
    setBuilding(true); setS("Starting Lumia AI build…");
    try {
      const x = await fetch("/api/builder/build", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: p, projectId: selected || undefined }) });
      const d = await x.json(); if (!x.ok || !d.ok) throw Error(d.error || "Unable to start build");
      setR(d); setSelected(d.projectId); setS("Build started · Lumia AI is working…");
    } catch (e) { setBuilding(false); setS(e instanceof Error ? e.message : "Build failed"); }
  }

  async function syncGitHub() {
    if (!selected || !repo || !token) { setS("Enter repository and GitHub token"); return; }
    setSyncing(true); setS("Syncing to GitHub…");
    try {
      const current = active ? files.map((f) => f.path === active.path ? { ...f, content: code } : f) : files;
      const x = await fetch("/api/github/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: selected, repository: repo, branch, token, message: `Update ${projects.find((x) => x.id === selected)?.name || "project"} from Lumia AI`, files: current.map((f) => ({ path: f.path, content: f.content })) }) });
      const d = await x.json(); if (!x.ok || !d.ok) throw Error(d.error || "GitHub sync failed"); setToken(""); setS(`GitHub synced · ${d.branch}`);
    } catch (e) { setS(e instanceof Error ? e.message : "GitHub sync failed"); } finally { setSyncing(false); }
  }

  async function deploy() {
    if (!selected) return; setDeploying(true); setS("Deploying to Vercel…");
    try { const x = await fetch(`/api/projects/${selected}/deploy`, { method: "POST" }); const d = await x.json(); if (!x.ok || !d.ok) throw Error(d.error || "Deployment failed"); setS("Deployment queued on Vercel"); }
    catch (e) { setS(e instanceof Error ? e.message : "Deployment failed"); } finally { setDeploying(false); }
  }
  async function signout() { await fetch("/api/auth/signout", { method: "POST" }); setUser(null); setProjects([]); setFiles([]); setActive(null); setSelected(""); setS(""); }
  const grouped = useMemo(() => files.map((f) => f.path), [files]);

  if (!user) return <main className="landing"><div className="landing-inner"><div className="mark">LA</div><h1 className="brand">LUMIA BUILDER</h1><p className="copy">Describe what you want to build and Lumia AI turns it into a project.</p><button className="login" onClick={() => {setShowAuth(v=>!v);setAuthStep("choices");setS("")}}>Get Started</button>{showAuth&&authStep==='choices'&&<div className="choices"><button className="choice primary" onClick={()=>{setMode('signup');setAuthStep('form')}}>Create an account</button><button className="choice" onClick={()=>{setMode('signin');setAuthStep('form')}}>Sign in</button></div>}{showAuth&&authStep==='form'&&<div className="auth"><h2>{mode==='signin'?'Sign in':'Create an account'}</h2><p>{mode==='signin'?'Enter your details to continue.':'Create your Lumia Builder account.'}</p>{mode==='signup'&&<input value={name} onChange={e=>setName(e.target.value)} placeholder="Name"/>}<input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" type="email"/><div className="password"><input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password (8+ characters)" type={showPassword?'text':'password'}/><button className="show" type="button" onClick={()=>setShowPassword(v=>!v)}>{showPassword?'Hide':'Show'}</button></div><button className="submit" onClick={()=>auth().catch(e=>setS(e.message))}>{mode==='signin'?'Sign in':'Create account'}</button><button className="back" onClick={()=>{setAuthStep('choices');setS('')}}>Back</button>{s&&<p className="err">{s}</p>}</div>}<div className="foot">LUMIA AI BUILDER</div></div><style>{`*{box-sizing:border-box}.landing{min-height:100vh;background:linear-gradient(180deg,#fafaff,#fff);color:#111827;font-family:Inter,system-ui,sans-serif;display:grid;place-items:center;padding:24px}.landing-inner{width:min(100%,410px);text-align:center}.mark{width:78px;height:78px;margin:0 auto 18px;border-radius:24px;display:grid;place-items:center;background:linear-gradient(135deg,#7c3aed,#2563eb);color:#fff;font-weight:900;font-size:27px;box-shadow:0 18px 42px rgba(79,70,229,.22)}.brand{font-size:30px;font-weight:900;letter-spacing:-1px;margin:0 0 9px}.copy{margin:0 auto 28px;color:#64748b;font-size:14px;line-height:1.55;max-width:340px}.login{width:100%;height:52px;border:0;border-radius:15px;background:linear-gradient(100deg,#7c3aed,#2563eb);color:#fff;font-weight:800;font-size:15px}.choices{display:grid;gap:10px;margin-top:12px}.choice{height:49px;border-radius:14px;border:1px solid #ddd6fe;background:#fff;color:#5b21b6;font-weight:750}.choice.primary{background:linear-gradient(100deg,#7c3aed,#2563eb);color:#fff;border:0}.auth{margin-top:14px;padding:20px;background:#fff;border:1px solid #e7e9ef;border-radius:20px;box-shadow:0 18px 55px rgba(15,23,42,.09);text-align:left}.auth input{width:100%;height:48px;border:1px solid #dfe3eb;border-radius:12px;padding:0 12px;margin-bottom:10px;font-size:14px;outline:none}.auth h2{margin:0 0 5px}.auth p{color:#64748b;font-size:13px;margin:0 0 14px}.password{position:relative}.password input{padding-right:60px}.show{position:absolute;right:5px;top:5px;height:38px;border:0;background:none;color:#6d28d9;font-weight:700}.submit{width:100%;height:46px;border:0;border-radius:12px;background:#111827;color:#fff;font-weight:800}.back{width:100%;height:42px;border:0;border-radius:12px;background:#f8fafc;color:#64748b;margin-top:8px}.err{color:#dc2626!important;text-align:center}.foot{margin-top:28px;color:#9aa3b5;font-size:11px}`}</style></main>;

  return <main className="app"><style>{`*{box-sizing:border-box}.app{min-height:100vh;background:#f6f7fb;color:#111827;font-family:Inter,system-ui,sans-serif}.top{height:68px;background:rgba(255,255,255,.96);border-bottom:1px solid #e8eaf0;display:flex;align-items:center;justify-content:space-between;padding:0 20px;position:sticky;top:0;z-index:50;backdrop-filter:blur(12px)}.brandline{display:flex;align-items:center;gap:10px}.mini{width:36px;height:36px;border-radius:11px;background:linear-gradient(135deg,#7c3aed,#2563eb);display:grid;place-items:center;color:#fff;font-weight:900;font-size:12px}.btitle{font-weight:850;font-size:15px}.bsub{font-size:11px;color:#94a3b8;margin-left:6px}.userline{display:flex;align-items:center;gap:8px;color:#667085;font-size:12px}.signout{border:1px solid #e1e5eb;background:#fff;border-radius:10px;padding:8px 11px;color:#374151}.toggle{display:none;border:1px solid #e1e5eb;background:#fff;border-radius:10px;width:40px;height:40px}.shell{max-width:1480px;margin:auto;padding:18px;display:grid;grid-template-columns:245px minmax(0,1fr);gap:18px}.side{background:#fff;border:1px solid #e7e9ef;border-radius:18px;padding:14px;height:calc(100vh - 104px);position:sticky;top:86px;overflow:auto;box-shadow:0 10px 30px rgba(15,23,42,.04)}.label{font-size:11px;font-weight:800;color:#8b93a6;text-transform:uppercase;letter-spacing:.08em;margin:5px 0 9px}.select{width:100%;height:43px;border:1px solid #dfe3eb;border-radius:11px;background:#fff;padding:0 10px}.files{margin-top:10px}.file{display:block;width:100%;padding:9px 10px;border:0;border-radius:10px;background:transparent;text-align:left;color:#475569;margin-bottom:3px}.file.active{background:#f1edff;color:#5b21b6;font-weight:750}.empty{color:#9aa3b5;font-size:12px;line-height:1.5;padding:10px 4px}.main{min-width:0}.hero{background:#fff;border:1px solid #e7e9ef;border-radius:18px;padding:22px;box-shadow:0 10px 30px rgba(15,23,42,.04)}.hero h1{font-size:26px;letter-spacing:-.8px;margin:0 0 7px}.hero p{margin:0;color:#667085;font-size:13px}.prompt{display:flex;gap:10px;margin-top:18px}.prompt textarea{flex:1;min-height:105px;resize:vertical;border:1px solid #dfe3eb;border-radius:14px;padding:14px;font:inherit;outline:none}.build{align-self:stretch;min-width:132px;border:0;border-radius:14px;background:linear-gradient(100deg,#7c3aed,#2563eb);color:#fff;font-weight:850}.build:disabled{opacity:.55}.status{margin-top:11px;color:#667085;font-size:12px;min-height:18px}.workspace{margin-top:18px;background:#fff;border:1px solid #e7e9ef;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,.04)}.bar{height:52px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #edf0f4;padding:0 14px}.tabs{display:flex;gap:4px}.tab{border:0;background:#f8fafc;border-radius:9px;padding:8px 11px;color:#64748b}.tab.on{background:#eee8ff;color:#5b21b6;font-weight:750}.actions{display:flex;gap:7px}.act{border:1px solid #e1e5eb;background:#fff;border-radius:9px;padding:8px 10px;font-size:12px;color:#374151}.act:disabled{opacity:.5}.editor{display:grid;grid-template-columns:220px 1fr;min-height:430px}.tree{border-right:1px solid #edf0f4;padding:10px;overflow:auto}.pane{min-width:0}.code{width:100%;height:430px;border:0;resize:none;padding:16px;font:13px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;outline:none;background:#0b1020;color:#e5e7eb}.preview{padding:18px;min-height:430px}.previewbox{min-height:390px;border:1px dashed #cfd5df;border-radius:14px;background:#fafbfe;padding:18px;white-space:pre-wrap;color:#475569;font-size:13px}.meta{padding:14px;border-top:1px solid #edf0f4;color:#667085;font-size:12px}@media(max-width:860px){.shell{grid-template-columns:1fr;padding:12px}.side{display:none;position:fixed;left:12px;right:12px;top:80px;height:calc(100vh - 92px);z-index:40}.side.open{display:block}.toggle{display:block}.editor{grid-template-columns:1fr}.tree{display:none}.prompt{flex-direction:column}.build{min-height:48px}.bsub{display:none}.top{padding:0 12px}.workspace{margin-top:12px}}`}</style><header className="top"><div className="brandline"><button className="toggle" onClick={()=>setSidebarOpen(v=>!v)}>☰</button><div className="mini">LA</div><div><span className="btitle">Lumia AI Builder</span><span className="bsub">Autonomous software builder</span></div></div><div className="userline"><span>{user.name||user.email}</span><button className="signout" onClick={signout}>Sign out</button></div></header><section className="shell"><aside className={`side ${sidebarOpen?'open':''}`}><div className="label">Projects</div><select className="select" value={selected} onChange={e=>openProject(e.target.value)}><option value="">New project</option>{projects.map(x=><option key={x.id} value={x.id}>{x.name} · {x.status}</option>)}</select><div className="label" style={{marginTop:18}}>Files</div><div className="files">{grouped.length?grouped.map(path=><button key={path} className={`file ${active?.path===path?'active':''}`} onClick={()=>selectFile(path)}>{path}</button>):<div className="empty">Generated project files will appear here after the build finishes.</div>}</div></aside><div className="main"><section className="hero"><h1>Build with Lumia AI</h1><p>Describe the software you want. Lumia creates the project, generates code, tests it, and stores the result.</p><div className="prompt"><textarea value={p} onChange={e=>setP(e.target.value)} placeholder="e.g. Build a modern landing page for a SaaS product with pricing, login and responsive design."/><button className="build" onClick={build} disabled={building}>{building?'Building…':'Build'}</button></div><div className="status">{s}</div></section><section className="workspace"><div className="bar"><div className="tabs"><button className={`tab ${view==='preview'?'on':''}`} onClick={()=>setView('preview')}>Preview</button><button className={`tab ${view==='editor'?'on':''}`} onClick={()=>setView('editor')}>Code</button></div><div className="actions"><button className="act" onClick={save} disabled={!active||saving}>Save</button><button className="act" onClick={aiFix} disabled={!active||fixing}>AI Fix</button><button className="act" onClick={deploy} disabled={!selected||deploying}>Deploy</button></div></div>{view==='editor'?<div className="editor"><div className="tree">{files.map(f=><button key={f.id} className={`file ${active?.id===f.id?'active':''}`} onClick={()=>selectFile(f.path)}>{f.path}</button>)}</div><div className="pane"><textarea className="code" value={code} onChange={e=>setCode(e.target.value)} placeholder="Select a generated file."/></div></div>:<div className="preview"><div className="previewbox">{files.length?`Project generated successfully.\n\n${files.map(f=>f.path).join("\n")}`:building?"Lumia AI is building your project…":"Your generated project preview will appear here."}</div></div>}<div className="meta">{r?.projectId?`Project: ${r.projectId}`:selected?`Project: ${selected}`:"No project selected"}</div></section></div></section></main>;
}
