import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  LayoutDashboard, FolderKanban, GanttChartSquare, ReceiptText, Settings, LogOut, Plus,
  Search, Pencil, Trash2, ExternalLink, X, Lock, Users, Clock, Eye, CircleDot,
  CheckCircle2, ChevronRight, Sparkles, FileText, Flag, Check, Calendar, User, UsersRound,
  Download, GripVertical, Mail, LogIn, Wifi
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from "recharts";
import { supabase } from "./supabaseClient";
import * as db from "./db";

/* ============================ THEME ============================ *
 * Light, warm canvas (video + BizLink reference). Blue + yellow as
 * data accents, near-black for primary actions. Sans-serif.
 * ============================================================== */
const C = {
  bg: "#F4F2ED", panel: "#FFFFFF", cream: "#EFECE3", sidebar: "#FFFFFF",
  ink: "#1A1712", ink2: "#4C4740", muted: "#8B857A", faint: "#B7B1A6",
  line: "#E7E3D9", lineSoft: "#EFEBE2",
  black: "#1A1712",
  blue: "#2F6BF6", blueSoft: "#EAF0FE",
  yellow: "#F5B301", yellowSoft: "#FDF3D6",
  green: "#1FA971", greenSoft: "#E4F5EE",
  slate: "#8B857A", slateSoft: "#EEEBE4",
  red: "#E0483D", violet: "#7C5CFF",
};

const CATEGORIES = ["Project", "Research", "Training"];
const STATUSES = ["Prospect", "On Going", "On Review", "Finished"];
const STATUS_META = {
  "Prospect":  { color: C.slate, soft: C.slateSoft, icon: CircleDot },
  "On Going":  { color: C.blue,  soft: C.blueSoft,  icon: Clock },
  "On Review": { color: C.yellow,soft: C.yellowSoft,icon: Eye },
  "Finished":  { color: C.green, soft: C.greenSoft, icon: CheckCircle2 },
};
const CATEGORY_COLOR = { "Project": C.blue, "Research": C.yellow, "Training": C.violet };

export const DEFAULT_COMPANY = { name: "Unit Cost Research Team", address: "", email: "",
  currency: "Rp", city: "Bandung", signer: "Firly Rachmaditya Baskoro" };

/* ------------------------------ helpers ------------------------------ */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : uid() + uid());
const fmtNum = (n) => new Intl.NumberFormat("en-US").format(Number(n) || 0);
const todayISO = () => new Date().toISOString().slice(0, 10);
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const ord = (n) => { if (n > 3 && n < 21) return "th"; return ({1:"st",2:"nd",3:"rd"})[n % 10] || "th"; };
function prettyDate(iso) {
  const d = iso ? new Date(iso + (iso.length === 10 ? "T00:00:00" : "")) : new Date();
  return `${MONTHS[d.getMonth()]} ${d.getDate()}${ord(d.getDate())}, ${d.getFullYear()}`;
}
const initials = (name) => (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const progressOf = (p) => {
  const list = p.checklist || [];
  if (!list.length) return 0;
  return Math.round((list.filter((i) => i.done).length / list.length) * 100);
};

const avatarColors = [C.blue, C.yellow, C.green, C.violet, C.red, C.slate];
const colorFor = (name, members) => avatarColors[Math.max(0, (members || []).indexOf(name)) % avatarColors.length];

/* ------------------------------ global styles ------------------------------ */
function GlobalStyle() {
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');
    * { box-sizing: border-box; }
    body { margin: 0; }
    .ui { font-family: 'Inter', system-ui, sans-serif; }
    .disp { font-family: 'Space Grotesk', system-ui, sans-serif; }
    .mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
    ::-webkit-scrollbar { width: 10px; height: 10px; }
    ::-webkit-scrollbar-thumb { background: #DED9CE; border-radius: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    button, a, input, select, textarea { outline: none; font-family: inherit; }
    button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {
      outline: 2px solid ${C.blue}; outline-offset: 2px; }
    @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
    .fade { animation: fade .2s ease; }
    @keyframes fade { from { opacity: 0; transform: translateY(5px);} to { opacity:1; transform:none;} }
    .drag-over { background: ${C.blueSoft} !important; outline: 2px dashed ${C.blue}; }
  `;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

/* =================================================================== */
export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [company, setCompany] = useState(DEFAULT_COMPANY);
  const [members, setMembers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [tab, setTab] = useState("dashboard");
  const [live, setLive] = useState(false);

  // keep refs so the (stable) actions object always reads current data
  const projRef = useRef(projects); useEffect(() => { projRef.current = projects; }, [projects]);
  const compRef = useRef(company); useEffect(() => { compRef.current = company; }, [company]);
  const memRef = useRef(members); useEffect(() => { memRef.current = members; }, [members]);

  // auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const refetchSettings = useCallback(async () => { const s = await db.getSettings(); setCompany(s.company); setMembers(s.members); }, []);
  const refetchProjects = useCallback(async () => { setProjects(await db.listProjects()); }, []);
  const refetchInvoices = useCallback(async () => { setInvoices(await db.listInvoices()); }, []);

  // initial load + realtime subscription (only when signed in)
  useEffect(() => {
    if (!session) return;
    let active = true;
    (async () => {
      setLoadingData(true);
      try { await Promise.all([refetchSettings(), refetchProjects(), refetchInvoices()]); }
      catch (e) { console.error(e); }
      if (active) setLoadingData(false);
    })();
    const ch = supabase.channel("rt-" + Math.random().toString(36).slice(2))
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, refetchSettings)
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, refetchProjects)
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, refetchInvoices)
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => { active = false; supabase.removeChannel(ch); setLive(false); };
  }, [session, refetchSettings, refetchProjects, refetchInvoices]);

  const currentUser = session ? (session.user.user_metadata?.full_name || session.user.email) : "";

  const actions = useMemo(() => ({
    async saveProject(p) {
      const payload = p.id
        ? { ...(projRef.current.find((x) => x.id === p.id) || {}), ...p }
        : { ...p, id: newId(), createdBy: currentUser };
      const saved = await db.upsertProject(payload);
      setProjects((prev) => prev.some((x) => x.id === saved.id) ? prev.map((x) => x.id === saved.id ? saved : x) : [saved, ...prev]);
    },
    async deleteProject(id) { await db.deleteProject(id); setProjects((prev) => prev.filter((x) => x.id !== id)); },
    async moveStatus(id, status) {
      const p = projRef.current.find((x) => x.id === id); if (!p) return;
      const upd = { ...p, status }; setProjects((prev) => prev.map((x) => x.id === id ? upd : x));
      try { await db.upsertProject(upd); } catch (e) { console.error(e); }
    },
    async patchProject(id, patch) {
      const p = projRef.current.find((x) => x.id === id); if (!p) return;
      const upd = { ...p, ...patch }; setProjects((prev) => prev.map((x) => x.id === id ? upd : x));
      try { await db.upsertProject(upd); } catch (e) { console.error(e); }
    },
    async addInvoice(inv) { const saved = await db.insertInvoice({ ...inv, id: newId() }); setInvoices((prev) => [saved, ...prev]); },
    async deleteInvoice(id) { await db.deleteInvoice(id); setInvoices((prev) => prev.filter((x) => x.id !== id)); },
    async saveSettings(patch) {
      const next = { company: patch.company ?? compRef.current, members: patch.members ?? memRef.current };
      setCompany(next.company); setMembers(next.members);
      try { await db.upsertSettings(next); } catch (e) { console.error(e); }
    },
  }), [currentUser]);

  if (!authReady) return <Splash text="Starting up…" />;
  if (!session) return <Auth />;
  if (loadingData) return <Splash text="Loading workspace…" />;

  const state = { company, members, projects, invoices };

  return (
    <div className="ui" style={{ minHeight: "100vh", background: C.bg, color: C.ink, display: "flex" }}>
      <GlobalStyle />
      <Sidebar tab={tab} setTab={setTab} currentUser={currentUser} state={state} live={live}
        onSignOut={() => supabase.auth.signOut()} />
      <main style={{ flex: 1, minWidth: 0, height: "100vh", overflowY: "auto" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "34px 40px 90px" }}>
          {tab === "dashboard" && <Dashboard state={state} actions={actions} currentUser={currentUser} setTab={setTab} />}
          {tab === "projects" && <Projects state={state} actions={actions} currentUser={currentUser} />}
          {tab === "timeline" && <Timeline state={state} actions={actions} currentUser={currentUser} />}
          {tab === "invoicing" && <Invoicing state={state} actions={actions} currentUser={currentUser} />}
          {tab === "settings" && <SettingsView state={state} actions={actions} session={session} />}
        </div>
      </main>
    </div>
  );
}

function Splash({ text }) {
  return (
    <div className="ui" style={{ minHeight: "100vh", background: C.bg, color: C.muted, display: "grid", placeItems: "center" }}>
      <GlobalStyle />
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ width: 9, height: 9, borderRadius: 3, background: C.yellow }} /> {text}
      </div>
    </div>
  );
}

/* ------------------------------ Sidebar ------------------------------ */
function Sidebar({ tab, setTab, currentUser, onSignOut, state, live }) {
  const items = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "projects", label: "Projects", icon: FolderKanban },
    { id: "timeline", label: "Timeline", icon: GanttChartSquare },
    { id: "invoicing", label: "Invoicing", icon: ReceiptText },
    { id: "settings", label: "Settings", icon: Settings },
  ];
  return (
    <aside style={{ width: 236, background: C.sidebar, borderRight: `1px solid ${C.line}`, height: "100vh",
      position: "sticky", top: 0, display: "flex", flexDirection: "column", padding: "22px 16px" }}>
      <div style={{ padding: "0 8px 24px", display: "flex", alignItems: "center", gap: 11 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: C.black, display: "grid", placeItems: "center" }}>
          <div style={{ width: 12, height: 12, background: C.yellow, borderRadius: 3, transform: "rotate(45deg)" }} />
        </div>
        <div style={{ lineHeight: 1.15 }}>
          <div className="disp" style={{ fontWeight: 700, fontSize: 15.5 }}>{state.company?.name || "Workspace"}</div>
          <div className="mono" style={{ fontSize: 9, color: C.faint, letterSpacing: 1 }}>PROJECT TRACKER</div>
        </div>
      </div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {items.map((it) => {
          const active = tab === it.id; const Icon = it.icon;
          return (
            <button key={it.id} onClick={() => setTab(it.id)} style={{ display: "flex", alignItems: "center", gap: 11,
              padding: "10px 12px", borderRadius: 10, border: "none", cursor: "pointer", textAlign: "left",
              fontSize: 13.5, fontWeight: 500, background: active ? C.black : "transparent",
              color: active ? "#fff" : C.ink2, transition: "background .15s" }}>
              <Icon size={17} color={active ? C.yellow : C.muted} /> {it.label}
            </button>
          );
        })}
      </nav>

      <div style={{ marginTop: 26, padding: "0 8px" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1, color: C.faint, textTransform: "uppercase" }}>Members</span>
          <span title={live ? "Live sync on" : "Connecting…"} style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9.5, color: live ? C.green : C.faint }}>
            <Wifi size={12} /> {live ? "Live" : "…"}
          </span>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {(state.members || []).map((m) => (
            <div key={m} style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <Avatar name={m} members={state.members} size={26} />
              <span style={{ fontSize: 12.5, color: C.ink2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m}</span>
              {m === currentUser && <span style={{ width: 6, height: 6, borderRadius: 3, background: C.green, marginLeft: "auto" }} />}
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: "auto", borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
        <button onClick={onSignOut} style={{ width: "100%", display: "flex", alignItems: "center", gap: 9,
          padding: "9px 12px", borderRadius: 9, border: `1px solid ${C.line}`, background: "transparent",
          color: C.ink2, cursor: "pointer", fontSize: 12.5 }}>
          <LogOut size={15} /> Sign out ({currentUser})
        </button>
      </div>
    </aside>
  );
}

/* ------------------------------ Auth (Supabase) ------------------------------ */
function Auth() {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr(""); setInfo(""); setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
        if (error) throw error;
      } else {
        if (!name.trim()) { setBusy(false); return setErr("Enter your name."); }
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password: pass, options: { data: { full_name: name.trim() } },
        });
        if (error) throw error;
        if (!data.session) setInfo("Account created. If email confirmation is on, check your inbox, then sign in.");
      }
    } catch (e) { setErr(e.message || "Something went wrong."); }
    setBusy(false);
  };

  return (
    <AuthShell title={mode === "signin" ? "Sign in" : "Create your account"}
      subtitle="Private workspace for your team. Each person signs in with their own account.">
      {mode === "signup" && <Field label="Your name"><TextInput value={name} onChange={setName} placeholder="e.g. Firly Rachmaditya Baskoro" /></Field>}
      <Field label="Email"><TextInput value={email} onChange={setEmail} placeholder="you@team.com" /></Field>
      <Field label="Password"><TextInput type="password" value={pass} onChange={setPass} placeholder="••••••••" onEnter={submit} /></Field>
      {err && <div style={{ color: C.red, fontSize: 12.5 }}>{err}</div>}
      {info && <div style={{ color: C.green, fontSize: 12.5 }}>{info}</div>}
      <PrimaryButton onClick={submit} full disabled={busy || !email || !pass}>
        {mode === "signin" ? <><LogIn size={15} /> Sign in</> : <><Mail size={15} /> Create account</>}
      </PrimaryButton>
      <button onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setErr(""); setInfo(""); }}
        style={{ background: "none", border: "none", color: C.blue, cursor: "pointer", fontSize: 12.5, marginTop: 2 }}>
        {mode === "signin" ? "Need an account? Create one" : "Already have an account? Sign in"}
      </button>
    </AuthShell>
  );
}
function AuthShell({ title, subtitle, children }) {
  return (
    <div className="ui" style={{ minHeight: "100vh", background: C.bg, color: C.ink, display: "grid", placeItems: "center", padding: 20 }}>
      <GlobalStyle />
      <div className="fade" style={{ width: "100%", maxWidth: 430 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: C.black, display: "grid", placeItems: "center" }}>
            <div style={{ width: 15, height: 15, background: C.yellow, borderRadius: 4, transform: "rotate(45deg)" }} />
          </div>
          <Lock size={16} color={C.muted} />
        </div>
        <h1 className="disp" style={{ fontSize: 26, fontWeight: 700, margin: "0 0 6px" }}>{title}</h1>
        <p style={{ color: C.muted, fontSize: 13.5, margin: "0 0 24px", lineHeight: 1.5 }}>{subtitle}</p>
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 22, display: "grid", gap: 14 }}>{children}</div>
        <p style={{ color: C.faint, fontSize: 11, marginTop: 14, lineHeight: 1.5 }}>Shared team lock for privacy, not bank-grade security. Data lives in the workspace.</p>
      </div>
    </div>
  );
}

/* ------------------------------ Dashboard ------------------------------ */
function Dashboard({ state, actions, currentUser, setTab }) {
  const { projects, invoices, members } = state;
  const [detail, setDetail] = useState(null);
  const [dragCol, setDragCol] = useState(null);

  const byCategory = CATEGORIES.map((c) => ({ name: c, value: projects.filter((p) => p.category === c).length }));
  const active = projects.filter((p) => p.status === "On Going" || p.status === "On Review");
  const avgProgress = active.length ? Math.round(active.reduce((s, p) => s + progressOf(p), 0) / active.length) : 0;
  const onGoing = projects.filter((p) => p.status === "On Going").length;

  const moveStatus = (id, status) => actions.moveStatus(id, status);

  return (
    <div className="fade">
      <Header title="Dashboard" sub="Your portfolio across projects, research and training." />

      {/* Top analytics panel — BizLink style */}
      <div style={{ background: C.cream, borderRadius: 20, padding: 26, marginBottom: 22,
        display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", gap: 26, alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Works by category</div>
          {projects.length === 0 ? <div style={{ height: 130, display: "grid", placeItems: "center", color: C.muted, fontSize: 12.5 }}>No data yet</div> : (
            <div style={{ height: 140 }}>
              <ResponsiveContainer>
                <BarChart data={byCategory} margin={{ top: 5, right: 6, left: -22, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "#00000008" }} contentStyle={{ borderRadius: 10, border: `1px solid ${C.line}`, fontSize: 12 }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                    {byCategory.map((d) => <Cell key={d.name} fill={CATEGORY_COLOR[d.name]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div style={{ display: "grid", placeItems: "center" }}>
          <Gauge value={avgProgress} label="Active progress" />
        </div>
        <div style={{ display: "grid", gap: 18 }}>
          <BigStat n={onGoing} label="Projects in progress" onArrow={() => setTab("projects")} accent={C.blue} />
          <BigStat n={invoices.length} label="Invoices generated" onArrow={() => setTab("invoicing")} accent={C.yellow} />
        </div>
      </div>

      {/* Kanban board */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h2 className="disp" style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Pipeline</h2>
        <span style={{ fontSize: 12, color: C.muted }}>Drag cards between stages</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, alignItems: "start" }}>
        {STATUSES.map((st) => {
          const items = projects.filter((p) => p.status === st);
          const meta = STATUS_META[st];
          return (
            <div key={st} onDragOver={(e) => { e.preventDefault(); setDragCol(st); }} onDragLeave={() => setDragCol(null)}
              onDrop={(e) => { const id = e.dataTransfer.getData("id"); if (id) moveStatus(id, st); setDragCol(null); }}
              className={dragCol === st ? "drag-over" : ""}
              style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 12, minHeight: 140 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 6px 12px" }}>
                <span style={{ width: 8, height: 8, borderRadius: 3, background: meta.color }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{st}</span>
                <span className="mono" style={{ marginLeft: "auto", fontSize: 12, color: C.muted, background: meta.soft, borderRadius: 6, padding: "1px 7px" }}>{items.length}</span>
              </div>
              <div style={{ display: "grid", gap: 9 }}>
                {items.map((p) => <KanbanCard key={p.id} p={p} members={members} onClick={() => setDetail(p.id)} />)}
                {items.length === 0 && <div style={{ fontSize: 11.5, color: C.faint, padding: "10px 6px", textAlign: "center" }}>—</div>}
              </div>
            </div>
          );
        })}
      </div>

      {projects.length === 0 && (
        <div style={{ marginTop: 20, textAlign: "center" }}>
          <button onClick={() => setTab("projects")} style={linkBtn}>Add your first project <ChevronRight size={14} /></button>
        </div>
      )}

      {detail && <ProjectDetail project={projects.find((p) => p.id === detail)} state={state} actions={actions}
        currentUser={currentUser} onClose={() => setDetail(null)} />}
    </div>
  );
}

function KanbanCard({ p, members, onClick }) {
  const prog = progressOf(p);
  return (
    <div draggable onDragStart={(e) => e.dataTransfer.setData("id", p.id)} onClick={onClick}
      style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 12, cursor: "pointer",
        boxShadow: "0 1px 2px #0000000a" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{p.name}</div>
          {p.client && <div style={{ fontSize: 11.5, color: C.blue, marginTop: 2 }}>{p.client}</div>}
        </div>
        <span style={{ fontSize: 9.5, color: C.muted, border: `1px solid ${C.line}`, borderRadius: 5, padding: "1px 5px", whiteSpace: "nowrap" }}>{p.category}</span>
      </div>
      {p.checklist && p.checklist.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ height: 5, background: C.lineSoft, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${prog}%`, height: "100%", background: prog === 100 ? C.green : C.blue }} />
          </div>
          <div style={{ fontSize: 10.5, color: C.muted, marginTop: 4 }}>{prog}% · {p.checklist.filter(i => i.done).length}/{p.checklist.length} done</div>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
        {p.wrapup && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, color: C.muted }}>
          <Calendar size={11} /> {p.wrapup}</span>}
        <div style={{ marginLeft: "auto", display: "flex" }}>
          {[p.pic, ...(p.collaborators || [])].filter(Boolean).slice(0, 3).map((m, i) => (
            <div key={m + i} style={{ marginLeft: i ? -7 : 0, border: "2px solid #fff", borderRadius: "50%" }}>
              <Avatar name={m} members={members} size={22} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Gauge({ value, label }) {
  const r = 62, cx = 78, cy = 78;
  const ticks = 44;
  const arr = Array.from({ length: ticks });
  return (
    <div style={{ textAlign: "center" }}>
      <svg width="156" height="96" viewBox="0 0 156 90">
        {arr.map((_, i) => {
          const a = Math.PI * (i / (ticks - 1)); // 0..PI (left to right, top)
          const on = (i / (ticks - 1)) * 100 <= value;
          const x1 = cx - r * Math.cos(a), y1 = cy - r * Math.sin(a);
          const x2 = cx - (r - 12) * Math.cos(a), y2 = cy - (r - 12) * Math.sin(a);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={on ? C.black : C.line} strokeWidth={2.4} strokeLinecap="round" />;
        })}
        <text x={cx} y={cy - 8} textAnchor="middle" className="disp" style={{ fontSize: 26, fontWeight: 700, fill: C.ink }}>{value}%</text>
      </svg>
      <div style={{ fontSize: 12, color: C.muted, marginTop: -4 }}>{label}</div>
    </div>
  );
}
function BigStat({ n, label, onArrow, accent }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div>
        <div className="disp" style={{ fontSize: 34, fontWeight: 700, lineHeight: 1, color: C.ink }}>{n}</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 5 }}>{label}</div>
      </div>
      <button onClick={onArrow} style={{ marginLeft: "auto", width: 34, height: 34, borderRadius: 10, border: `1px solid ${C.line}`,
        background: "#fff", cursor: "pointer", display: "grid", placeItems: "center" }}>
        <ChevronRight size={16} color={accent} />
      </button>
    </div>
  );
}

/* ------------------------------ Projects ------------------------------ */
function Projects({ state, actions, currentUser }) {
  const { projects, members } = state;
  const [q, setQ] = useState(""); const [fCat, setFCat] = useState("All"); const [fStat, setFStat] = useState("All");
  const [editing, setEditing] = useState(null); const [detail, setDetail] = useState(null);

  const filtered = projects.filter((p) => {
    if (fCat !== "All" && p.category !== fCat) return false;
    if (fStat !== "All" && p.status !== fStat) return false;
    if (q && !(`${p.name} ${p.client} ${p.description} ${p.source} ${p.pic}`.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  });

  const save = async (proj) => { await actions.saveProject(proj); setEditing(null); };
  const remove = (id) => actions.deleteProject(id);

  return (
    <div className="fade">
      <Header title="Projects" sub={`${projects.length} works tracked`}
        action={<PrimaryButton onClick={() => setEditing({})}><Plus size={16} /> New project</PrimaryButton>} />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
          <Search size={15} color={C.muted} style={{ position: "absolute", left: 12, top: 11 }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects…" style={{ ...inputStyle, paddingLeft: 34 }} />
        </div>
        <Select value={fCat} onChange={setFCat} options={["All", ...CATEGORIES]} compact />
        <Select value={fStat} onChange={setFStat} options={["All", ...STATUSES]} compact />
      </div>

      {filtered.length === 0 ? (
        <EmptyState label={projects.length === 0 ? "No projects yet." : "No projects match your filters."}
          cta={projects.length === 0 ? { label: "New project", onClick: () => setEditing({}) } : null} />
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {filtered.map((p) => <ProjectRow key={p.id} p={p} members={members}
            onOpen={() => setDetail(p.id)} onEdit={() => setEditing(p)} onDelete={() => remove(p.id)} />)}
        </div>
      )}

      {editing && <ProjectModal project={editing} members={members} currentUser={currentUser} onSave={save} onClose={() => setEditing(null)} />}
      {detail && <ProjectDetail project={projects.find((p) => p.id === detail)} state={state} actions={actions}
        currentUser={currentUser} onClose={() => setDetail(null)} onEdit={() => { const p = projects.find((x) => x.id === detail); setDetail(null); setEditing(p); }} />}
    </div>
  );
}

function ProjectRow({ p, members, onOpen, onEdit, onDelete }) {
  const [confirm, setConfirm] = useState(false); const prog = progressOf(p);
  return (
    <Card style={{ padding: 15 }}>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div style={{ width: 4, alignSelf: "stretch", borderRadius: 3, background: CATEGORY_COLOR[p.category] || C.slate }} />
        <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={onOpen}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{p.name}</h3>
            {p.client && <span style={{ fontSize: 12.5, color: C.blue, fontWeight: 500 }}>· {p.client}</span>}
            <StatusPill status={p.status} />
            <span style={{ fontSize: 10.5, color: C.muted, border: `1px solid ${C.line}`, borderRadius: 5, padding: "1px 6px" }}>{p.category}</span>
          </div>
          {p.description && <p style={{ margin: "7px 0 0", fontSize: 12.5, color: C.ink2, lineHeight: 1.5, maxWidth: 720,
            overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{p.description}</p>}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10, fontSize: 12, alignItems: "center" }}>
            <Meta label="PIC" value={p.pic || "—"} />
            {(p.collaborators || []).length > 0 && <Meta label="Team" value={`+${p.collaborators.length}`} />}
            {(p.kickoff || p.wrapup) && <Meta label="Timeline" value={`${p.kickoff || "?"} → ${p.wrapup || "?"}`} />}
            {p.checklist && p.checklist.length > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                <span style={{ width: 60, height: 5, background: C.lineSoft, borderRadius: 3, overflow: "hidden", display: "inline-block" }}>
                  <span style={{ display: "block", width: `${prog}%`, height: "100%", background: prog === 100 ? C.green : C.blue }} />
                </span>
                <span style={{ fontSize: 11.5, color: C.muted }}>{prog}%</span>
              </span>
            )}
            {p.dataRoom && <a href={p.dataRoom} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
              style={{ display: "flex", alignItems: "center", gap: 5, color: C.blue, textDecoration: "none" }}><ExternalLink size={13} /> Data room</a>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <IconBtn onClick={onEdit} title="Edit"><Pencil size={15} /></IconBtn>
          {confirm
            ? <button onClick={onDelete} onMouseLeave={() => setConfirm(false)} style={{ ...iconBtnStyle, color: "#fff", background: C.red, borderColor: C.red, width: "auto", padding: "0 10px", fontSize: 11.5 }}>Confirm</button>
            : <IconBtn onClick={() => setConfirm(true)} title="Delete" danger><Trash2 size={15} /></IconBtn>}
        </div>
      </div>
    </Card>
  );
}

function ProjectModal({ project, members, currentUser, onSave, onClose }) {
  const [f, setF] = useState({
    name: project.name || "", client: project.client || "", category: project.category || "Project",
    status: project.status || "Prospect", source: project.source || "", pic: project.pic || currentUser || "",
    collaborators: project.collaborators || [], description: project.description || "", dataRoom: project.dataRoom || "",
    kickoff: project.kickoff || "", wrapup: project.wrapup || "",
    milestones: project.milestones || [], checklist: project.checklist || [],
    id: project.id, createdAt: project.createdAt,
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const toggleCollab = (m) => set("collaborators", f.collaborators.includes(m) ? f.collaborators.filter((x) => x !== m) : [...f.collaborators, m]);
  const valid = f.name.trim() && f.kickoff && f.wrapup;

  return (
    <Modal onClose={onClose} title={project.id ? "Edit project" : "New project"} wide>
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12 }}>
          <Field label="Project name *"><TextInput value={f.name} onChange={(v) => set("name", v)} placeholder="e.g. Coal Royalty Study" autoFocus /></Field>
          <Field label="Client name"><TextInput value={f.client} onChange={(v) => set("client", v)} placeholder="e.g. Ditjen Minerba" /></Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Category"><Select value={f.category} onChange={(v) => set("category", v)} options={CATEGORIES} /></Field>
          <Field label="Status"><Select value={f.status} onChange={(v) => set("status", v)} options={STATUSES} /></Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Project source"><Combo value={f.source} onChange={(v) => set("source", v)} options={members} placeholder="Who brought it in" /></Field>
          <Field label="Person in charge (PIC)"><Combo value={f.pic} onChange={(v) => set("pic", v)} options={members} placeholder="Owner" /></Field>
        </div>
        <Field label="Collaborators">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {members.filter((m) => m !== f.pic).map((m) => {
              const on = f.collaborators.includes(m);
              return <button key={m} onClick={() => toggleCollab(m)} style={{ display: "inline-flex", alignItems: "center", gap: 6,
                padding: "6px 11px", borderRadius: 20, fontSize: 12.5, cursor: "pointer",
                border: `1px solid ${on ? C.blue : C.line}`, background: on ? C.blueSoft : "#fff", color: on ? C.blue : C.ink2 }}>
                {on && <Check size={13} />} {m}</button>;
            })}
            {members.filter((m) => m !== f.pic).length === 0 && <span style={{ fontSize: 12, color: C.muted }}>Add members in Settings first.</span>}
          </div>
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Kick-off *"><input type="date" value={f.kickoff} onChange={(e) => set("kickoff", e.target.value)} style={inputStyle} /></Field>
          <Field label="Wrap-up target *"><input type="date" value={f.wrapup} onChange={(e) => set("wrapup", e.target.value)} style={inputStyle} /></Field>
        </div>
        <Field label="Description"><textarea value={f.description} onChange={(e) => set("description", e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} placeholder="Scope, objectives…" /></Field>
        <Field label="Data room (link)"><TextInput value={f.dataRoom} onChange={(v) => set("dataRoom", v)} placeholder="https://drive.google.com/…" /></Field>
        <div style={{ fontSize: 11.5, color: C.muted }}>Tip: add milestones & the checklist after saving, from the project's detail view.</div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <PrimaryButton onClick={() => onSave(f)} disabled={!valid}>{project.id ? "Save changes" : "Create project"}</PrimaryButton>
      </div>
      {!valid && <div style={{ textAlign: "right", fontSize: 11, color: C.muted, marginTop: 8 }}>Name, kick-off and wrap-up are required.</div>}
    </Modal>
  );
}

/* --------------------- Project detail: Gantt + checklist --------------------- */
function ProjectDetail({ project, state, actions, currentUser, onClose, onEdit }) {
  const p = project; const members = state.members;
  if (!p) return null;
  const prog = progressOf(p);
  const patchProject = (patch) => actions.patchProject(p.id, patch);

  // checklist
  const [newTask, setNewTask] = useState("");
  const addTask = () => { if (!newTask.trim()) return; patchProject({ checklist: [...(p.checklist || []), { id: uid(), text: newTask.trim(), done: false }] }); setNewTask(""); };
  const toggleTask = (id) => patchProject({ checklist: p.checklist.map((i) => i.id === id ? { ...i, done: !i.done } : i) });
  const delTask = (id) => patchProject({ checklist: p.checklist.filter((i) => i.id !== id) });

  // milestones
  const [msName, setMsName] = useState(""); const [msDate, setMsDate] = useState("");
  const addMs = () => { if (!msName.trim() || !msDate) return; patchProject({ milestones: [...(p.milestones || []), { id: uid(), name: msName.trim(), date: msDate }] }); setMsName(""); setMsDate(""); };
  const delMs = (id) => patchProject({ milestones: p.milestones.filter((m) => m.id !== id) });

  return (
    <Modal onClose={onClose} title={null} xwide>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 4 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h2 className="disp" style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{p.name}</h2>
            <StatusPill status={p.status} />
          </div>
          {p.client && <div style={{ fontSize: 13.5, color: C.blue, marginTop: 4, fontWeight: 500 }}>{p.client}</div>}
        </div>
        {onEdit && <GhostButton onClick={onEdit}><Pencil size={14} /> Edit</GhostButton>}
        <IconBtn onClick={onClose}><X size={16} /></IconBtn>
      </div>

      {p.description && <p style={{ fontSize: 13, color: C.ink2, lineHeight: 1.55, margin: "10px 0 16px" }}>{p.description}</p>}

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 12.5, marginBottom: 18, color: C.ink2 }}>
        <Meta label="Category" value={p.category} />
        <Meta label="Source" value={p.source || "—"} />
        <Meta label="PIC" value={p.pic || "—"} />
        {p.dataRoom && <a href={p.dataRoom} target="_blank" rel="noreferrer" style={{ color: C.blue, textDecoration: "none", display: "inline-flex", gap: 5, alignItems: "center" }}><ExternalLink size={13} /> Data room</a>}
      </div>

      {/* Collaborators */}
      <SubLabel><UsersRound size={14} /> Team</SubLabel>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {[p.pic, ...(p.collaborators || [])].filter(Boolean).map((m, i) => (
          <span key={m + i} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: C.panel, border: `1px solid ${C.line}`,
            borderRadius: 20, padding: "4px 10px 4px 4px", fontSize: 12.5 }}>
            <Avatar name={m} members={members} size={22} /> {m} {i === 0 && <span style={{ fontSize: 10, color: C.muted }}>PIC</span>}
          </span>
        ))}
      </div>

      {/* Gantt */}
      <SubLabel><GanttChartSquare size={14} /> Timeline</SubLabel>
      <ProjectGantt p={p} />
      <div style={{ display: "flex", gap: 8, marginTop: 12, marginBottom: 22, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 180px" }}><Field label="Add milestone"><TextInput value={msName} onChange={setMsName} placeholder="e.g. Interim report" /></Field></div>
        <div><Field label="Date"><input type="date" value={msDate} onChange={(e) => setMsDate(e.target.value)} style={inputStyle} /></Field></div>
        <GhostButton onClick={addMs}><Plus size={14} /> Add</GhostButton>
      </div>
      {(p.milestones || []).length > 0 && (
        <div style={{ display: "grid", gap: 6, marginBottom: 24 }}>
          {p.milestones.slice().sort((a, b) => a.date.localeCompare(b.date)).map((m) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, padding: "6px 10px", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8 }}>
              <Flag size={13} color={C.yellow} /> <span style={{ flex: 1 }}>{m.name}</span>
              <span className="mono" style={{ color: C.muted }}>{m.date}</span>
              <IconBtn onClick={() => delMs(m.id)} danger small><Trash2 size={12} /></IconBtn>
            </div>
          ))}
        </div>
      )}

      {/* Checklist */}
      <SubLabel><CheckCircle2 size={14} /> Outputs & to-do — {prog}% complete</SubLabel>
      <div style={{ height: 7, background: C.lineSoft, borderRadius: 5, overflow: "hidden", marginBottom: 14 }}>
        <div style={{ width: `${prog}%`, height: "100%", background: prog === 100 ? C.green : C.blue, transition: "width .25s" }} />
      </div>
      <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
        {(p.checklist || []).map((i) => (
          <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9 }}>
            <button onClick={() => toggleTask(i.id)} style={{ width: 20, height: 20, borderRadius: 6, cursor: "pointer",
              border: `1.5px solid ${i.done ? C.green : C.faint}`, background: i.done ? C.green : "#fff", display: "grid", placeItems: "center" }}>
              {i.done && <Check size={13} color="#fff" />}
            </button>
            <span style={{ flex: 1, fontSize: 13, textDecoration: i.done ? "line-through" : "none", color: i.done ? C.muted : C.ink }}>{i.text}</span>
            <IconBtn onClick={() => delTask(i.id)} danger small><Trash2 size={13} /></IconBtn>
          </div>
        ))}
        {(p.checklist || []).length === 0 && <div style={{ fontSize: 12, color: C.muted, padding: "4px 2px" }}>No items yet. Add outputs or tasks below.</div>}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTask()}
          placeholder="Add an output or task…" style={inputStyle} />
        <PrimaryButton onClick={addTask}><Plus size={15} /></PrimaryButton>
      </div>
    </Modal>
  );
}

function ProjectGantt({ p }) {
  const points = [
    { name: "Kick-off", date: p.kickoff, kind: "start" },
    ...(p.milestones || []).map((m) => ({ ...m, kind: "ms" })),
    { name: "Wrap-up", date: p.wrapup, kind: "end" },
  ].filter((x) => x.date);
  if (points.length < 2) return <div style={{ fontSize: 12.5, color: C.muted }}>Set kick-off and wrap-up dates to see the timeline.</div>;
  const times = points.map((x) => new Date(x.date + "T00:00:00").getTime());
  const min = Math.min(...times), max = Math.max(...times);
  const span = Math.max(1, max - min);
  const pos = (t) => ((t - min) / span) * 100;
  const now = Date.now();
  const nowPos = now >= min && now <= max ? pos(now) : null;

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: "22px 20px 30px" }}>
      <div style={{ position: "relative", height: 30 }}>
        {/* baseline bar kickoff -> wrapup */}
        <div style={{ position: "absolute", left: `${pos(times[0])}%`, right: `${100 - pos(new Date(p.wrapup + "T00:00:00").getTime())}%`,
          top: 12, height: 6, background: C.blueSoft, borderRadius: 4 }} />
        <div style={{ position: "absolute", left: `${pos(times[0])}%`, right: `${100 - pos(Math.min(now, max))}%`,
          top: 12, height: 6, background: C.blue, borderRadius: 4 }} />
        {nowPos !== null && (
          <div style={{ position: "absolute", left: `${nowPos}%`, top: 0, bottom: -18, width: 2, background: C.red }}>
            <span style={{ position: "absolute", top: -16, left: -14, fontSize: 9, color: C.red, fontWeight: 600 }}>TODAY</span>
          </div>
        )}
        {points.map((x, i) => {
          const t = new Date(x.date + "T00:00:00").getTime();
          const col = x.kind === "start" ? C.green : x.kind === "end" ? C.black : C.yellow;
          return (
            <div key={i} style={{ position: "absolute", left: `${pos(t)}%`, top: 6, transform: "translateX(-50%)", textAlign: "center" }}>
              <div style={{ width: 14, height: 14, borderRadius: x.kind === "ms" ? 3 : "50%", background: col, border: "2px solid #fff",
                boxShadow: `0 0 0 1px ${col}`, transform: x.kind === "ms" ? "rotate(45deg)" : "none" }} />
              <div style={{ marginTop: 10, fontSize: 10, fontWeight: 600, whiteSpace: "nowrap" }}>{x.name}</div>
              <div className="mono" style={{ fontSize: 9, color: C.muted }}>{x.date.slice(5)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ Timeline (portfolio Gantt) ------------------------------ */
function Timeline({ state, actions, currentUser }) {
  const projects = state.projects.filter((p) => p.kickoff && p.wrapup);
  const [detail, setDetail] = useState(null);
  if (projects.length === 0) return (
    <div className="fade"><Header title="Timeline" sub="Portfolio Gantt across all works." />
      <EmptyState label="No projects have kick-off / wrap-up dates yet. Add dates on a project to see it here." /></div>
  );

  const all = projects.flatMap((p) => [new Date(p.kickoff + "T00:00:00").getTime(), new Date(p.wrapup + "T00:00:00").getTime()]);
  const min = Math.min(...all), max = Math.max(...all); const span = Math.max(1, max - min);
  const pos = (t) => ((t - min) / span) * 100;
  const now = Date.now(); const nowPos = now >= min && now <= max ? pos(now) : null;

  // month gridlines
  const months = [];
  let d = new Date(min); d.setDate(1);
  while (d.getTime() <= max) { months.push(new Date(d)); d.setMonth(d.getMonth() + 1); }

  return (
    <div className="fade">
      <Header title="Timeline" sub="Portfolio Gantt — kick-off to wrap-up, with milestones." />
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {/* month header */}
        <div style={{ position: "relative", height: 30, borderBottom: `1px solid ${C.line}`, marginLeft: 220 }}>
          {months.map((m, i) => (
            <div key={i} style={{ position: "absolute", left: `${pos(m.getTime())}%`, top: 0, bottom: 0,
              borderLeft: `1px solid ${C.lineSoft}`, paddingLeft: 6, fontSize: 10.5, color: C.muted, display: "flex", alignItems: "center" }}>
              {MONTHS[m.getMonth()].slice(0, 3)} {String(m.getFullYear()).slice(2)}
            </div>
          ))}
        </div>
        {projects.map((p, idx) => {
          const s = new Date(p.kickoff + "T00:00:00").getTime(), e = new Date(p.wrapup + "T00:00:00").getTime();
          const meta = STATUS_META[p.status];
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "center", borderTop: idx ? `1px solid ${C.lineSoft}` : "none", minHeight: 44 }}>
              <div onClick={() => setDetail(p.id)} style={{ width: 220, flexShrink: 0, padding: "8px 16px", cursor: "pointer" }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                <div style={{ fontSize: 10.5, color: C.muted }}>{p.client || p.category}</div>
              </div>
              <div style={{ position: "relative", flex: 1, height: 44 }}>
                {months.map((m, i) => <div key={i} style={{ position: "absolute", left: `${pos(m.getTime())}%`, top: 0, bottom: 0, borderLeft: `1px solid ${C.lineSoft}` }} />)}
                {nowPos !== null && <div style={{ position: "absolute", left: `${nowPos}%`, top: 0, bottom: 0, width: 2, background: C.red, opacity: 0.5 }} />}
                <div onClick={() => setDetail(p.id)} title={`${p.kickoff} → ${p.wrapup}`} style={{ position: "absolute", left: `${pos(s)}%`, width: `${Math.max(1.5, pos(e) - pos(s))}%`,
                  top: 12, height: 18, background: meta.color, borderRadius: 6, cursor: "pointer", opacity: 0.9,
                  display: "flex", alignItems: "center", paddingLeft: 8 }}>
                  <span style={{ fontSize: 10, color: "#fff", fontWeight: 600, whiteSpace: "nowrap" }}>{progressOf(p)}%</span>
                </div>
                {(p.milestones || []).map((ms) => {
                  const t = new Date(ms.date + "T00:00:00").getTime();
                  if (t < min || t > max) return null;
                  return <div key={ms.id} title={`${ms.name} · ${ms.date}`} style={{ position: "absolute", left: `${pos(t)}%`, top: 15,
                    width: 11, height: 11, background: C.yellow, border: "2px solid #fff", transform: "translateX(-50%) rotate(45deg)", boxShadow: `0 0 0 1px ${C.yellow}` }} />;
                })}
              </div>
            </div>
          );
        })}
      </Card>
      <div style={{ display: "flex", gap: 16, marginTop: 14, fontSize: 11.5, color: C.muted, flexWrap: "wrap" }}>
        {STATUSES.map((s) => <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: STATUS_META[s].color }} /> {s}</span>)}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 9, height: 9, background: C.yellow, transform: "rotate(45deg)" }} /> Milestone</span>
      </div>
      {detail && <ProjectDetail project={state.projects.find((p) => p.id === detail)} state={state} actions={actions} currentUser={currentUser} onClose={() => setDetail(null)} />}
    </div>
  );
}

/* ------------------------------ Invoicing ------------------------------ */
function buildInvoiceDoc({ company, project, number, dateStr }) {
  const client = project.client || "Add Client Name here";
  const projName = project.name || "";
  const signer = company.signer || "Firly Rachmaditya Baskoro";
  const city = company.city || "Bandung";
  const teamName = company.name || "";
  const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'>
<style>
@page WordSection1 { size: 841.9pt 595.3pt; mso-page-orientation: landscape; margin: 2.2cm 2.6cm 2.2cm 2.6cm; }
div.WordSection1 { page: WordSection1; }
body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #000; }
h1 { text-align: center; font-size: 20pt; letter-spacing: 1pt; text-decoration: underline; margin: 0 0 26pt; }
table.items { border-collapse: collapse; width: 100%; margin-top: 22pt; }
table.items td, table.items th { border: 1px solid #000; padding: 6pt 9pt; font-size: 11pt; }
.ph { color: #9a9a9a; font-style: italic; }
.right { text-align: right; }
.muted { color: #6b6b6b; font-style: italic; }
</style></head>
<body><div class=WordSection1>
<h1>INVOICE</h1>
<table style="width:100%; border:none;"><tr>
  <td style="border:none; vertical-align:top; width:55%;">
    To: ${client}<br>
    <span class="ph">Add Address here</span>
  </td>
  <td style="border:none; vertical-align:top; text-align:right;">
    Date: ${dateStr}<br>
    <span class="muted">${projName}</span>${teamName ? `<br><span class="muted">${teamName}</span>` : ""}
  </td>
</tr></table>

<table class="items">
  <tr><th style="width:8%; text-align:left;">No</th><th style="text-align:left;">Description</th><th style="width:26%; text-align:left;">Amount</th></tr>
  <tr><td>1</td><td class="ph">Add description here</td><td class="ph">Add amount here</td></tr>
  <tr><td></td><td style="text-align:right; font-weight:bold;">TOTAL</td><td class="ph">Add amount here</td></tr>
  <tr><td colspan="3" class="ph" style="text-align:center;">Add amount in words here</td></tr>
</table>

<table style="width:100%; border:none; margin-top:46pt;"><tr>
  <td style="border:none;"></td>
  <td style="border:none; text-align:right; width:40%;">
    ${city}, ${dateStr}<br><br><br><br>
    <b>${signer}</b>
  </td>
</tr></table>
</div></body></html>`;
  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${number}.doc`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function Invoicing({ state, actions, currentUser }) {
  const { projects, invoices, company } = state;
  const invoiceable = projects.filter((p) => p.status !== "Prospect");
  const [target, setTarget] = useState(null);

  const nextNumber = () => `INV-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(4, "0")}`;

  const generate = (project, number, date) => {
    buildInvoiceDoc({ company, project, number, dateStr: prettyDate(date) });
    actions.addInvoice({ projectId: project.id, number, date, generatedBy: currentUser });
    setTarget(null);
  };
  const removeInvoice = (id) => actions.deleteInvoice(id);
  const regenerate = (inv) => { const p = projects.find((x) => x.id === inv.projectId); if (p) buildInvoiceDoc({ company, project: p, number: inv.number, dateStr: prettyDate(inv.date) }); };

  return (
    <div className="fade">
      <Header title="Invoicing" sub="Generate a Word (A4 landscape) invoice for any project that isn't a prospect. Fill amounts in Word." />

      <div style={{ background: C.yellowSoft, border: `1px solid ${C.yellow}44`, borderRadius: 12, padding: "12px 16px",
        fontSize: 12.5, color: C.ink2, marginBottom: 20, display: "flex", gap: 10, alignItems: "center" }}>
        <FileText size={16} color={C.yellowDeep || C.yellow} />
        The download auto-fills date, client (To), and project name. Address, description and amounts are left as placeholders for you to type in Word.
      </div>

      <SectionLabel>Projects available to invoice</SectionLabel>
      {invoiceable.length === 0 ? <EmptyState label="No invoiceable projects yet. Any project past 'Prospect' can be invoiced." /> : (
        <div style={{ display: "grid", gap: 10, marginBottom: 30 }}>
          {invoiceable.map((p) => (
            <Card key={p.id} style={{ padding: 15, display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 4, alignSelf: "stretch", borderRadius: 3, background: STATUS_META[p.status].color }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                  <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 600 }}>{p.name}</h3>
                  {p.client && <span style={{ fontSize: 12, color: C.blue }}>· {p.client}</span>}
                  <StatusPill status={p.status} />
                </div>
                <div style={{ fontSize: 11.5, color: C.muted, marginTop: 4 }}>PIC {p.pic || "—"}</div>
              </div>
              <PrimaryButton small onClick={() => setTarget(p)}><Download size={14} /> Create invoice</PrimaryButton>
            </Card>
          ))}
        </div>
      )}

      {invoices.length > 0 && (
        <>
          <SectionLabel>Generated invoices</SectionLabel>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            {invoices.map((inv, idx) => {
              const proj = projects.find((p) => p.id === inv.projectId);
              return (
                <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", borderTop: idx ? `1px solid ${C.lineSoft}` : "none" }}>
                  <span className="mono" style={{ fontSize: 12.5, color: C.blue, width: 130 }}>{inv.number}</span>
                  <span style={{ flex: 1, fontSize: 13, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{proj?.name || "—"}{proj?.client ? ` · ${proj.client}` : ""}</span>
                  <span style={{ fontSize: 12, color: C.muted, width: 130 }}>{prettyDate(inv.date)}</span>
                  <span style={{ fontSize: 11.5, color: C.muted, width: 90 }}>{inv.generatedBy}</span>
                  <IconBtn onClick={() => regenerate(inv)} title="Download again"><Download size={14} /></IconBtn>
                  <IconBtn onClick={() => removeInvoice(inv.id)} title="Delete" danger><Trash2 size={14} /></IconBtn>
                </div>
              );
            })}
          </Card>
        </>
      )}

      {target && <InvoiceModal project={target} defaultNumber={nextNumber()} company={company} onGenerate={generate} onClose={() => setTarget(null)} />}
    </div>
  );
}

function InvoiceModal({ project, defaultNumber, company, onGenerate, onClose }) {
  const [number, setNumber] = useState(defaultNumber);
  const [date, setDate] = useState(todayISO());
  return (
    <Modal onClose={onClose} title="Create Word invoice" wide>
      <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 16 }}>For: <span style={{ color: C.ink }}>{project.name}</span>{project.client ? ` — ${project.client}` : ""}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Invoice number"><TextInput value={number} onChange={setNumber} /></Field>
        <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} /></Field>
      </div>
      <div style={{ background: C.panel, border: `1px dashed ${C.line}`, borderRadius: 10, padding: 14, marginTop: 16, fontSize: 12, color: C.ink2, lineHeight: 1.6 }}>
        <b>Auto-filled:</b> Date · To: {project.client || "(client)"} · Project: {project.name}<br />
        <b>Placeholders to fill in Word:</b> Address, Description, Amount, Amount in words<br />
        <b>Signed:</b> {company.city}, {prettyDate(date)} — {company.signer}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <PrimaryButton onClick={() => onGenerate(project, number, date)}><Download size={15} /> Download .doc</PrimaryButton>
      </div>
    </Modal>
  );
}

/* ------------------------------ Settings ------------------------------ */
function SettingsView({ state, actions, session }) {
  const [names, setNames] = useState(() => { const a = [...state.members]; while (a.length < 4) a.push(""); return a.slice(0, 4); });
  const [comp, setComp] = useState({ ...state.company });
  const [pw, setPw] = useState({ n1: "", n2: "" }); const [msg, setMsg] = useState("");

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };
  const saveTeam = async () => { await actions.saveSettings({ members: names.map((n) => n.trim()).filter(Boolean), company: comp }); flash("Saved."); };
  const changePw = async () => {
    if (pw.n1.length < 6) return flash("New password should be at least 6 characters.");
    if (pw.n1 !== pw.n2) return flash("New passwords don't match.");
    const { error } = await supabase.auth.updateUser({ password: pw.n1 });
    if (error) return flash(error.message);
    setPw({ n1: "", n2: "" }); flash("Your password was updated.");
  };

  return (
    <div className="fade">
      <Header title="Settings" sub="Team, company details, invoice signature and access." />
      {msg && <div style={{ background: C.blueSoft, border: `1px solid ${C.blue}`, color: C.blue, padding: "10px 14px", borderRadius: 10, fontSize: 12.5, marginBottom: 16 }}>{msg}</div>}

      <Card style={{ padding: 22, marginBottom: 16 }}>
        <ChartTitle><Users size={15} style={{ marginRight: 7, verticalAlign: -2 }} />Team member names</ChartTitle>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>These names fill the PIC, source and collaborator pickers. To add or remove who can <b>log in</b>, manage accounts in your Supabase dashboard (Authentication → Users).</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {names.map((n, i) => <TextInput key={i} value={n} onChange={(v) => setNames((p) => p.map((x, j) => j === i ? v : x))} placeholder={`Member ${i + 1}`} />)}
        </div>
      </Card>

      <Card style={{ padding: 22, marginBottom: 16 }}>
        <ChartTitle>Company & invoice details</ChartTitle>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
            <Field label="Team / company name"><TextInput value={comp.name || ""} onChange={(v) => setComp({ ...comp, name: v })} /></Field>
            <Field label="Currency"><Select value={comp.currency || "Rp"} onChange={(v) => setComp({ ...comp, currency: v })} options={["Rp", "USD", "SGD", "AUD", "EUR"]} /></Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Invoice signed in (city)"><TextInput value={comp.city || ""} onChange={(v) => setComp({ ...comp, city: v })} /></Field>
            <Field label="Invoice signer name"><TextInput value={comp.signer || ""} onChange={(v) => setComp({ ...comp, signer: v })} /></Field>
          </div>
          <Field label="Address (optional)"><textarea value={comp.address || ""} onChange={(e) => setComp({ ...comp, address: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical" }} /></Field>
        </div>
        <div style={{ marginTop: 16 }}><PrimaryButton onClick={saveTeam}>Save details</PrimaryButton></div>
      </Card>

      <Card style={{ padding: 22 }}>
        <ChartTitle><Lock size={14} style={{ marginRight: 7, verticalAlign: -2 }} />Change my password</ChartTitle>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>Signed in as {session?.user?.email}. This changes your own account password.</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxWidth: 420 }}>
          <Field label="New password"><TextInput type="password" value={pw.n1} onChange={(v) => setPw({ ...pw, n1: v })} /></Field>
          <Field label="Confirm new"><TextInput type="password" value={pw.n2} onChange={(v) => setPw({ ...pw, n2: v })} /></Field>
        </div>
        <div style={{ marginTop: 16 }}><GhostButton onClick={changePw}>Update password</GhostButton></div>
      </Card>
    </div>
  );
}

/* ============================ primitives ============================ */
const inputStyle = { width: "100%", background: "#fff", border: `1px solid ${C.line}`, borderRadius: 9, color: C.ink, fontSize: 13.5, padding: "10px 12px" };
const iconBtnStyle = { width: 34, height: 34, borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", color: C.ink2, cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 };
const linkBtn = { display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", color: C.blue, cursor: "pointer", fontSize: 13.5, fontWeight: 500 };

function Header({ title, sub, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
      <div>
        <h1 className="disp" style={{ fontSize: 25, fontWeight: 700, margin: 0 }}>{title}</h1>
        {sub && <p style={{ margin: "6px 0 0", color: C.muted, fontSize: 13.5 }}>{sub}</p>}
      </div>
      {action}
    </div>
  );
}
function Card({ children, style }) { return <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, ...style }}>{children}</div>; }
function ChartTitle({ children }) { return <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink, marginBottom: 14 }}>{children}</div>; }
function SectionLabel({ children }) { return <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: C.muted, margin: "4px 0 12px" }}>{children}</div>; }
function SubLabel({ children }) { return <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, color: C.ink2, letterSpacing: 0.3, margin: "6px 0 12px" }}>{children}</div>; }
function Meta({ label, value }) { return <span style={{ color: C.muted }}>{label}: <span style={{ color: C.ink2 }}>{value}</span></span>; }
function Avatar({ name, members, size = 26 }) {
  const bg = colorFor(name, members);
  return <div style={{ width: size, height: size, borderRadius: "50%", background: bg + "22", color: bg, display: "grid", placeItems: "center", fontSize: size * 0.4, fontWeight: 700, flexShrink: 0 }}>{initials(name)}</div>;
}
function StatusPill({ status }) {
  const m = STATUS_META[status] || STATUS_META["Prospect"]; const Icon = m.icon;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: m.color, background: m.soft, borderRadius: 6, padding: "3px 9px" }}><Icon size={12} /> {status}</span>;
}
function EmptyState({ label, cta }) {
  return <Card style={{ padding: 44, textAlign: "center" }}>
    <Sparkles size={22} color={C.faint} style={{ marginBottom: 12 }} />
    <div style={{ color: C.ink2, fontSize: 13.5 }}>{label}</div>
    {cta && <div style={{ marginTop: 16 }}><PrimaryButton onClick={cta.onClick}><Plus size={15} /> {cta.label}</PrimaryButton></div>}
  </Card>;
}
function IconBtn({ children, onClick, title, danger, small }) {
  const s = small ? { width: 28, height: 28 } : {};
  return <button onClick={onClick} title={title} style={{ ...iconBtnStyle, ...s, ...(danger ? { color: C.red } : {}) }}
    onMouseEnter={(e) => (e.currentTarget.style.background = C.bg)} onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}>{children}</button>;
}
function PrimaryButton({ children, onClick, disabled, full, small, style }) {
  return <button onClick={onClick} disabled={disabled} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
    background: disabled ? C.lineSoft : C.black, color: disabled ? C.faint : "#fff", border: "none", borderRadius: 9,
    padding: small ? "8px 13px" : "10px 16px", fontSize: small ? 12.5 : 13.5, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
    width: full ? "100%" : "auto", ...style }}>{children}</button>;
}
function GhostButton({ children, onClick }) {
  return <button onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#fff", color: C.ink2,
    border: `1px solid ${C.line}`, borderRadius: 9, padding: "10px 16px", fontSize: 13.5, fontWeight: 500, cursor: "pointer" }}>{children}</button>;
}
function Field({ label, children }) {
  return <label style={{ display: "block" }}><div style={{ fontSize: 12, color: C.ink2, marginBottom: 7, fontWeight: 500 }}>{label}</div>{children}</label>;
}
function TextInput({ value, onChange, placeholder, type = "text", autoFocus, onEnter }) {
  return <input type={type} value={value} autoFocus={autoFocus} placeholder={placeholder}
    onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && onEnter) onEnter(); }} style={inputStyle} />;
}
function Select({ value, onChange, options, compact }) {
  return <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, width: compact ? "auto" : "100%", cursor: "pointer", appearance: "none", paddingRight: 30,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238B857A' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" }}>
    {options.map((o) => <option key={o} value={o}>{o}</option>)}
  </select>;
}
function Combo({ value, onChange, options, placeholder }) {
  const id = useMemo(() => "dl" + uid(), []);
  return <><input list={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    <datalist id={id}>{(options || []).map((o) => <option key={o} value={o} />)}</datalist></>;
}
function Modal({ children, onClose, title, wide, xwide }) {
  useEffect(() => { const f = (e) => e.key === "Escape" && onClose(); window.addEventListener("keydown", f); return () => window.removeEventListener("keydown", f); }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "#1a171233", backdropFilter: "blur(3px)", display: "grid", placeItems: "center", zIndex: 100, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} className="fade ui" style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 18,
        width: "100%", maxWidth: xwide ? 720 : wide ? 560 : 440, maxHeight: "92vh", overflowY: "auto", padding: 26, boxShadow: "0 20px 60px #1a171226" }}>
        {title && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 className="disp" style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{title}</h2>
          <IconBtn onClick={onClose}><X size={16} /></IconBtn>
        </div>}
        {children}
      </div>
    </div>
  );
}
