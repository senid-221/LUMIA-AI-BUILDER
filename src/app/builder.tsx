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

  async function load() {
    try {
      const me = await fetch("/api/auth/me").then((x) => x.json());
      setUser(me.user);
      if (me.user) {
        const data = await fetch("/api/projects").then((x) => x.json());
        setProjects(data.projects || []);
        setS("Ready");
      } else {
        setS("");
      }
    } catch {
      setS("Unable to load session");
    }
  }

  useEffect(() => { load(); }, []);

  async function auth() {
    setS(mode === "signin" ? "Signing in…" : "Creating account…");
    const url = mode === "signin" ? "/api/auth/signin" : "/api/auth/signup";
    const body = mode === "signin" ? { email, password } : { email, password, name };
    const x = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await x.json();
    if (!x.ok) throw Error(d.error || "Authentication failed");
    setUser(d.user); setEmail(""); setPassword(""); setName(""); setShowAuth(false); setS("Ready");
    const list = await fetch("/api/projects").then((v) => v.json());
    setProjects(list.projects || []);
  }

  async function openProject(id: string) {
    if (!id) { setSelected(""); setFiles([]); setActive(null); setCode(""); return; }
    setSelected(id); setS("Loading project…");
    const x = await fetch(`/api/projects/${id}/files`); const d = await x.json();
    if (!x.ok) throw Error(d.error || "Unable to load files");
    setFiles(d.files || []); setActive(null); setCode(""); setS("Ready"); setView("preview"); setSidebarOpen(false);
  }

  function selectFile(path: string) {
    const f = files.find((x) => x.path === path) || null;
    setActive(f); setCode(f?.content || ""); setView("editor"); setSidebarOpen(false);
  }

  async function save() {
    if (!selected || !active) return;
    setSaving(true); setS("Saving…");
    try {
      const x = await fetch(`/api/projects/${selected}/files`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: active.path, content: code, language: language(active.path) }) });
      const d = await x.json(); if (!x.ok) throw Error(d.error || "Save failed");
      setFiles((v) => v.map((f) => f.path === active.path ? { ...f, content: code } : f));
      setActive((v) => v ? { ...v, content: code } : v); setS("Saved");
    } catch (e) { setS(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  async function aiFix() {
    if (!active) return;
    setFixing(true); setS("AI is fixing the file…");
    try {
      const x = await fetch("/api/builder/debug", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: selected, files: [{ path: active.path, content: code }], stderr: "User requested an AI fix for this file." }) });
      const d = await x.json(); if (!x.ok || !d.ok) throw Error(d.error || "AI Fix failed");
      const replacement = d.replacements?.find((f: any) => f.path === active.path);
      if (replacement) { setCode(replacement.content); setS("AI fix generated — review and Save"); } else setS("No replacement returned");
    } catch (e) { setS(e instanceof Error ? e.message : "AI Fix failed"); }
    finally { setFixing(false); }
  }

  async function build() {
    if (!p.trim()) { setS("Describe what you want to build first."); return; }
    setS("Building with Lumia AI…");
    try {
      const x = await fetch("/api/builder/build", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: p, projectId: selected || undefined }) });
      const d = await x.json(); if (!x.ok || !d.ok) throw Error(d.error || "Build failed");
      setR(d); setSelected(d.projectId); await openProject(d.projectId); setView("preview");
      setS(d.result?.status === "PASSED" ? `Build passed · ${d.retries || 0} fix retries` : d.result?.status || "Build complete");
      const list = await fetch("/api/projects").then((v) => v.json()); setProjects(list.projects || []);
    } catch (e) { setS(e instanceof Error ? e.message : "Build failed"); }
  }

  async function syncGitHub() {
    if (!selected || !repo || !token) { setS("Enter repository and GitHub token"); return; }
    setSyncing(true); setS("Syncing to GitHub…");
    try {
      const current = active ? files.map((f) => f.path === active.path ? { ...f, content: code } : f) : files;
      const x = await fetch("/api/github/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: selected, repository: repo, branch, token, message: `Update ${projects.find((x) => x.id === selected)?.name || "project"} from Lumia AI`, files: current.map((f) => ({ path: f.path, content: f.content })) }) });
      const d = await x.json(); if (!x.ok || !d.ok) throw Error(d.error || "GitHub sync failed"); setToken(""); setS(`GitHub synced · ${d.branch}`);
    } catch (e) { setS(e instanceof Error ? e.message : "GitHub sync failed"); }
    finally { setSyncing(false); }
  }

  async function deploy() {
    if (!selected) return;
    setDeploying(true); setS("Deploying to Vercel…");
    try {
      const x = await fetch(`/api/projects/${selected}/deploy`, { method: "POST" });
      const d = await x.json(); if (!x.ok || !d.ok) throw Error(d.error || "Deployment failed"); setS("Deployment queued on Vercel");
    } catch (e) { setS(e instanceof Error ? e.message : "Deployment failed"); }
    finally { setDeploying(false); }
  }

  async function signout() {
    await fetch("/api/auth/signout", { method: "POST" });
    setUser(null); setProjects([]); setFiles([]); setActive(null); setSelected(""); setS("");
  }

  const grouped = useMemo(() => files.map((f) => f.path), [files]);

  if (!user) return (
    <main className="landing"><style>{`
      *{box-sizing:border-box}.landing{min-height:100vh;background:linear-gradient(180deg,#fafaff,#fff);color:#111827;font-family:Inter,system-ui,sans-serif;display:grid;place-items:center;padding:24px}.landing-inner{width:min(100%,410px);text-align:center}.mark{width:78px;height:78px;margin:0 auto 18px;border-radius:24px;display:grid;place-items:center;background:linear-gradient(135deg,#7c3aed,#2563eb);color:#fff;font-weight:900;font-size:27px;box-shadow:0 18px 42px rgba(79,70,229,.22)}.brand{font-size:30px;font-weight:900;letter-spacing:-1px;margin:0 0 9px}.copy{margin:0 auto 28px;color:#64748b;font-size:14px;line-height:1.55;max-width:340px}.login{width:100%;height:52px;border:0;border-radius:15px;background:linear-gradient(100deg,#7c3aed,#2563eb);color:#fff;font-weight:800;font-size:15px}.choices{display:grid;gap:10px;margin-top:12px}.choice{height:49px;border-radius:14px;border:1px solid #ddd6fe;background:#fff;color:#5b21b6;font-weight:750}.choice.primary{background:linear-gradient(100deg,#7c3aed,#2563eb);color:#fff;border:0}.auth{margin-top:14px;padding:20px;background:#fff;border:1px solid #e7e9ef;border-radius:20px;box-shadow:0 18px 55px rgba(15,23,42,.09);text-align:left}.auth input{width:100%;height:48px;border:1px solid #dfe3eb;border-radius:12px;padding:0 12px;margin-bottom:10px;font-size:14px;outline:none}.auth h2{margin:0 0 5px}.auth p{color:#64748b;font-size:13px;margin:0 0 14px}.password{position:relative}.password input{padding-right:60px}.show{position:absolute;right:5px;top:5px;height:38px;border:0;background:none;color:#6d28d9;font-weight:700}.submit{width:100%;height:46px;border:0;border-radius:12px;background:#111827;color:#fff;font-weight:800}.back{width:100%;height:42px;border:0;border-radius:12px;background:#f8fafc;color:#64748b;margin-top:8px}.err{color:#dc2626!important;text-align:center}.foot{margin-top:28px;color:#9aa3b5;font-size:11px}
    `}</style><div className="landing-inner"><div className="mark">LA</div><h1 className="brand">LUMIA BUILDER</h1><p className="copy">Describe what you want to build and Lumia AI turns it into a project.</p><button className="login" onClick={() => {setShowAuth((v)=>!v);setAuthStep("choices");setS("")}}>Get Started</button>{showAuth&&authStep==="choices"&&<div className="choices"><button className="choice primary" onClick={()=>{setMode("signup");setAuthStep("form")}}>Create an account</button><button className="choice" onClick={()=>{setMode("signin");setAuthStep("form")}}>Sign in</button></div>}{showAuth&&authStep==="form"&&<div className="auth"><h2>{mode==="signin"?"Sign in":"Create an account"}</h2><p>{mode==="signin"?"Enter your details to continue.":"Create your Lumia Builder account."}</p>{mode==="signup"&&<input value={name} onChange={e=>setName(e.target.value)} placeholder="Name"/>}<input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" type="email"/><div className="password"><input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password (8+ characters)" type={showPassword?"text":"password"}/><button className="show" type="button" onClick={()=>setShowPassword(v=>!v)}>{showPassword?"Hide":"Show"}</button></div><button className="submit" onClick={()=>auth().catch(e=>setS(e.message))}>{mode==="signin"?"Sign in":"Create account"}</button><button className="back" onClick={()=>{setAuthStep("choices");setS("")}}>Back</button>{s&&<p className="err">{s}</p>}</div>}<div className="foot">LUMIA AI BUILDER</div></div></main>
  );

  return <main className="app"><style>{`
    *{box-sizing:border-box}.app{min-height:100vh;background:#f6f7fb;color:#111827;font-family:Inter,system-ui,sans-serif}.top{height:68px;background:rgba(255,255,255,.96);border-bottom:1px solid #e8eaf0;display:flex;align-items:center;justify-content:space-between;padding:0 20px;position:sticky;top:0;z-index:50;backdrop-filter:blur(12px)}.brandline{display:flex;align-items:center;gap:10px}.mini{width:36px;height:36px;border-radius:11px;background:linear-gradient(135deg,#7c3aed,#2563eb);display:grid;place-items:center;color:#fff;font-weight:900;font-size:12px}.btitle{font-weight:850;font-size:15px}.bsub{font-size:11px;color:#94a3b8;margin-left:6px}.userline{display:flex;align-items:center;gap:8px;color:#667085;font-size:12px}.signout{border:1px solid #e1e5eb;background:#fff;border-radius:10px;padding:8px 11px;color:#374151}.toggle{display:none;border:1px solid #e1e5eb;background:#fff;border-radius:10px;width:40px;height:40px}.shell{max-width:1480px;margin:auto;padding:18px;display:grid;grid-template-columns:245px minmax(0,1fr);gap:18px}.side{background:#fff;border:1px solid #e7e9ef;border-radius:18px;padding:14px;height:calc(100vh - 104px);position:sticky;top:86px;overflow:auto;box-shadow:0 10px 30px rgba(15,23,42,.04)}.label{font-size:11px;font-weight:800;color:#8b93a6;text-transform:uppercase;letter-spacing:.08em;margin:5px 0 9px}.select{width:100%;height:43px;border:1px solid #dfe3eb;border-radius:11px;background:#fff;padding:0 10px}.files{margin-top:10px}.file{display:block;width:100%;padding:9px 10px;border:0;border-radius:10px;background:transparent;text-align:left;color:#475569;margin-bottom:3px}.file.active{background:#f1edff;color:#5b21b6;font-weight:750}.empty{color:#9aa3b5;font-size:12px;line-height:1.5;padding:10px 4px}.main{min-width:0}.hero{background:linear-gradient(135deg,#6d28d9,#4f46e5 58%,#2563eb);border-radius:22px;padding:22px;color:#fff;box-shadow:0 18px 46px rgba(79,70,229,.18)}.kicker{font-size:10px;text-transform:uppercase;letter-spacing:.12em;font-weight:800;opacity:.8}.hero h1{font-size:28px;letter-spacing:-.8px;margin:7px 0}.hero p{margin:0 0 14px;color:rgba(255,255,255,.78);font-size:13px;max-width:760px}.prompt{background:#fff;border-radius:16px;padding:9px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px}.prompt textarea{min-height:96px;border:0;outline:0;resize:vertical;padding:10px;color:#111827;font-size:14px;line-height:1.55}.build{min-width:155px;border:0;border-radius:12px;background:#111827;color:#fff;font-weight:800}.build:disabled{opacity:.65}.bar{margin-top:14px;background:#fff;border:1px solid #e7e9ef;border-radius:15px;padding:9px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}.btn{border:1px solid #e1e5ec;background:#fff;border-radius:10px;padding:9px 12px;color:#374151;font-size:12px;font-weight:750}.btn.primary{background:#111827;color:#fff;border-color:#111827}.spacer{flex:1}.status{font-size:12px;color:#6b7280;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.work{margin-top:15px;display:grid;grid-template-columns:1fr 1fr;gap:15px}.panel{background:#fff;border:1px solid #e7e9ef;border-radius:18px;overflow:hidden;min-width:0;box-shadow:0 8px 24px rgba(15,23,42,.04)}.head{height:50px;padding:0 14px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #eceef3}.head strong{font-size:13px}.meta{font-size:11px;color:#98a0af}.editor{width:100%;min-height:500px;background:#0f172a;color:#e5e7eb;border:0;outline:0;resize:vertical;padding:16px;font:12px/1.65 ui-monospace,SFMono-Regular,Menlo,monospace}.preview{min-height:500px;padding:15px;background:#f7f8fc}.preview-inner{min-height:470px;background:#fff;border:1px solid #e7e9ef;border-radius:14px;padding:18px}.advanced{margin-top:15px;display:grid;grid-template-columns:1fr 1fr;gap:15px}.adv{background:#fff;border:1px solid #e7e9ef;border-radius:16px;padding:14px}.help{font-size:11px;color:#8b93a6;margin:5px 0 9px}.row{display:grid;grid-template-columns:1fr 120px;gap:8px}.field{height:41px;border:1px solid #dfe3eb;border-radius:10px;padding:0 10px;font-size:12px;width:100%}.row2{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:8px}.result{margin-top:9px;background:#f8f9fc;border:1px solid #e7e9ef;border-radius:10px;padding:9px;font-size:11px;color:#667085;white-space:pre-wrap}.empty-preview{min-height:420px;display:grid;place-items:center;text-align:center;color:#9aa3b5;font-size:12px}.empty-preview strong{display:block;color:#475569;margin-bottom:4px}
    @media(max-width:980px){.toggle{display:grid;place-items:center}.shell{grid-template-columns:1fr}.side{position:fixed;left:10px;top:78px;bottom:10px;width:min(300px,calc(100vw - 20px));height:auto;z-index:70;transform:translateX(-120%);transition:transform .2s}.side.open{transform:translateX(0)}.work{grid-template-columns:1fr}.advanced{grid-template-columns:1fr}}
    @media(max-width:680px){.top{height:62px;padding:0 11px}.bsub,.user-email{display:none}.shell{padding:10px}.hero{padding:17px;border-radius:18px}.hero h1{font-size:22px}.prompt{grid-template-columns:1fr}.build{height:45px;width:100%}.bar .btn{flex:1 1 auto}.status{width:100%;order:10}.editor,.preview{min-height:430px}.preview-inner{min-height:400px}.advanced{gap:10px}.row,.row2{grid-template-columns:1fr}.userline{gap:5px}.signout{padding:7px 9px}}
  `}</style><header className="top"><div className="brandline"><button className="toggle" onClick={()=>setSidebarOpen(v=>!v)}>☰</button><div className="mini">LA</div><div className="btitle">LUMIA AI BUILDER <span className="bsub">AI IDE · V9</span></div></div><div className="userline"><span className="user-email">{user.email}</span><button className="signout" onClick={signout}>Sign out</button></div></header><div className="shell"><aside className={`side ${sidebarOpen?"open":""}`}><div className="label">Projects</div><select className="select" value={selected} onChange={e=>openProject(e.target.value).catch(x=>setS(x.message))}><option value="">Select project</option>{projects.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><div className="label" style={{marginTop:18}}>Files</div><div className="files">{grouped.length?grouped.map(path=><button className={`file ${active?.path===path?"active":""}`} key={path} onClick={()=>selectFile(path)}>{path}</button>):<div className="empty">Generated files appear here after your first build.</div>}</div></aside><section className="main"><div className="hero"><div className="kicker">AI website builder</div><h1>Build anything with Lumia AI</h1><p>Describe your website or app. Lumia creates the project and keeps the code, files and deployment workflow in one workspace.</p><div className="prompt"><textarea value={p} onChange={e=>setP(e.target.value)} placeholder="Build a modern responsive business website with Home, About, Services, Pricing and Contact…"/><button className="build" onClick={build} disabled={!p.trim()||s.startsWith("Building")}>{s.startsWith("Building")?"Building…":"Build with Lumia AI"}</button></div></div><div className="bar"><button className={`btn ${view==="preview"?"primary":""}`} onClick={()=>setView("preview")}>Preview</button><button className={`btn ${view==="editor"?"primary":""}`} onClick={()=>setView("editor")}>Code</button><span className="spacer"/><button className="btn" disabled={!active||saving} onClick={save}>{saving?"Saving…":"Save"}</button><button className="btn" disabled={!active||fixing} onClick={aiFix}>{fixing?"Fixing…":"AI Fix"}</button><button className="btn primary" disabled={!selected||deploying} onClick={deploy}>{deploying?"Deploying…":"Deploy"}</button><span className="status">{s||"Ready"}</span></div><div className="work"><section className="panel" style={{display:view==="editor"?"block":"none"}}><div className="head"><strong>{active?.path||"Code editor"}</strong><span className="meta">{active?language(active.path):"Select a file"}</span></div><textarea className="editor" value={code} onChange={e=>setCode(e.target.value)} placeholder="Select a generated file to edit its code…"/></section><section className="panel" style={{display:view==="preview"?"block":"none"}}><div className="head"><strong>Live Preview</strong><span className="meta">Lumia Preview</span></div><div className="preview"><div className="preview-inner">{files.length?<><div style={{fontSize:11,color:"#8b93a6",marginBottom:10}}>Generated project</div><h3 style={{margin:"0 0 8px",fontSize:24}}>{projects.find(x=>x.id===selected)?.name||"Your project"}</h3><p style={{margin:"0 0 16px",fontSize:13,color:"#64748b"}}>{p||"Your generated project is ready."}</p><div style={{display:"grid",gap:8}}>{files.slice(0,9).map(f=><div key={f.id} style={{padding:"10px 12px",border:"1px solid #e8ebf0",borderRadius:10,fontSize:12,color:"#475569"}}>{f.path}</div>)}</div>{r&&<div className="result">{JSON.stringify({status:r.result?.status||"done",retries:r.retries||0,files:files.length},null,2)}</div>}</>:<div className="empty-preview"><div><strong>Your preview will appear here</strong>Build a project to populate this workspace.</div></div>}</div></div></section></div><div className="advanced"><section className="adv"><strong style={{fontSize:12}}>GitHub Sync</strong><div className="help">Push your generated files to a repository.</div><div className="row"><input className="field" value={repo} onChange={e=>setRepo(e.target.value)} placeholder="owner/repository"/><input className="field" value={branch} onChange={e=>setBranch(e.target.value)} placeholder="main"/></div><div className="row2"><input className="field" type="password" value={token} onChange={e=>setToken(e.target.value)} placeholder="GitHub token"/><button className="btn" disabled={syncing||!selected||!repo||!token} onClick={syncGitHub}>{syncing?"Syncing…":"Sync"}</button></div></section><section className="adv"><strong style={{fontSize:12}}>Build details</strong><div className="help">Current project status and generated files.</div><div className="row"><input className="field" readOnly value={selected||"No project selected"}/><input className="field" readOnly value={`${files.length} files`}/></div><div className="result">{r?JSON.stringify({status:r.result?.status||"done",retries:r.retries||0},null,2):"Build results will appear here."}</div></section></div></section></div></main>;
}
