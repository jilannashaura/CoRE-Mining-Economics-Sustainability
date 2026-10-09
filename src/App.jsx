import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  LayoutDashboard, FolderKanban, GanttChartSquare, ReceiptText, Settings, LogOut, Plus,
  Search, Pencil, Trash2, ExternalLink, X, Lock, Users, Clock, Eye, CircleDot,
  CheckCircle2, ChevronRight, Sparkles, FileText, Flag, Check, Calendar, UsersRound, EyeOff, Wifi,
  Download, ListChecks, Menu, Archive, ArchiveRestore, UserCircle, Bell, Megaphone, AtSign, UserPlus,
  Wallet, ArrowUpRight, ArrowDownRight, TrendingUp, Upload, FileSpreadsheet, ChevronLeft, Link2, Coins
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend
} from "recharts";
import * as XLSX from "xlsx";
import { supabase } from "./supabaseClient";
import * as db from "./db";

/* ============================ THEME (EduMate-inspired) ============================ */
const C = {
  bg: "#F5F5F7", panel: "#FFFFFF", tint: "#EEF3FF", sidebar: "#FFFFFF",
  ink: "#141414", ink2: "#3E4048", muted: "#7B808A", faint: "#AEB2BB",
  line: "#E7E8EC", lineSoft: "#F1F2F5",
  blue: "#036AFF", blueSoft: "#E7F0FF", blueDeep: "#0247B8",
  green: "#16A34A", greenSoft: "#E6F5EC",
  amber: "#F59E0B", amberSoft: "#FDF1DA",
  slate: "#6B7280", slateSoft: "#EEF0F3",
  red: "#E5484D", violet: "#7C5CFF",
};
const APP_NAME = "CoRE Mining Economics & Sustainability";
const LOGO_SRC = "/logo.png";
const CREDIT = "Designed, developed, and built by Nashaura Jilan A. Adityawarman (2026) for CoRE Mining Economics & Sustainability. All rights reserved.";

const CATEGORIES = ["Project", "Research", "Training"];
const STATUSES = ["Prospect", "On Going", "On Review", "Finished"];
const STATUS_META = {
  "Prospect":  { color: C.slate, soft: C.slateSoft, icon: CircleDot },
  "On Going":  { color: C.blue,  soft: C.blueSoft,  icon: Clock },
  "On Review": { color: C.amber, soft: C.amberSoft, icon: Eye },
  "Finished":  { color: C.green, soft: C.greenSoft, icon: CheckCircle2 },
};
const CATEGORY_COLOR = { "Project": C.blue, "Research": C.amber, "Training": C.violet };
const SUB_STATUS = {
  "Prospect": ["Awaiting Potential User", "To Be Proposed", "Under Discussion"],
  "On Going": ["Idle", "On Progress"],
  "On Review": ["Reviewed by FRB", "Reviewed by User"],
  "Finished": ["To Be Invoiced", "Invoiced", "Closed"],
};
const PRIORITIES = ["Critical", "Urgent", "Moderate", "Minor"];
const PRIORITY_META = {
  "Critical": { color: "#DC2626", soft: "#FDECEC" },
  "Urgent":   { color: "#EA580C", soft: "#FEEFE2" },
  "Moderate": { color: C.blue,    soft: C.blueSoft },
  "Minor":    { color: C.slate,   soft: C.slateSoft },
};
const isHotPriority = (p) => p && (p.priority === "Critical" || p.priority === "Urgent");

const KEY = "pmt:state:v2";
const SESSION_KEY = "pmt:session:v1";
const AdminCtx = React.createContext({ unlocked: false, unlock: async () => false, lock: () => {} });
const useAdmin = () => React.useContext(AdminCtx);
const DEFAULT_COMPANY = { name: "Unit Cost Research Team", address: "", email: "",
  currency: "Rp", city: "Bandung", signer: "Firly Rachmaditya Baskoro" };

/* ------------------------------ helpers ------------------------------ */
const uid = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  const b = new Uint8Array(16); crypto.getRandomValues(b); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
const fmtNum = (n) => new Intl.NumberFormat("en-US").format(Number(n) || 0);
const todayISO = () => new Date().toISOString().slice(0, 10);
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
/* ------------- finance / balance ------------- */
const INCOME_CATS = ["Project Incentives", "Research Funds", "Training Incentives", "Others"];
const EXP_PURCHASE = ["Asset Purchases", "Transportation", "Utilities", "Consumption", "Others"];
const EXP_WORK = ["Project", "Research", "Training", "General"];
const TX_METHODS = ["VA", "QRIS", "Transfer", "Others"];
const DEFAULT_ACCOUNT = "BNI Nashaura Jilan";
const CAT_COLORS = ["#036AFF", "#16A34A", "#7C5CFF", "#F59E0B", "#E5484D", "#0EA5E9", "#EC4899", "#64748B"];
const fmtRp = (n) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(Number(n) || 0));
const monthKey = (iso) => (iso || "").slice(0, 7); // YYYY-MM
const quarterOf = (m) => Math.floor(m / 3); // 0..3
const QLABEL = ["Q1 (Jan – Mar)", "Q2 (Apr – Jun)", "Q3 (Jul – Sep)", "Q4 (Oct – Dec)"];
const ord = (n) => { if (n > 3 && n < 21) return "th"; return ({1:"st",2:"nd",3:"rd"})[n % 10] || "th"; };
function prettyDate(iso) {
  const d = iso ? new Date(iso + (iso.length === 10 ? "T00:00:00" : "")) : new Date();
  return `${MONTHS[d.getMonth()]} ${d.getDate()}${ord(d.getDate())}, ${d.getFullYear()}`;
}
const initials = (name) => (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const doneOf = (p) => (p.checklist || []).filter((i) => i.done).length;
const totalOf = (p) => (p.checklist || []).length;
const progressOf = (p) => { const t = totalOf(p); return t ? Math.round((doneOf(p) / t) * 100) : 0; };
const nowISO = () => new Date().toISOString();
const mkNotif = (to, type, text, projectId) => ({ id: uid(), to, type, text, projectId: projectId || "", createdAt: nowISO() });
const NOTIF_DAYS = 14;
const DURATIONS = [{ label: "1 day", ms: 864e5 }, { label: "1 week", ms: 7 * 864e5 }, { label: "1 month", ms: 30 * 864e5 }, { label: "Permanent", ms: null }];
function ago(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
const assigneesOf = (p) => [p.pic, ...(p.collaborators || [])].filter(Boolean);
const sameUser = (a, b) => (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase();
// who to notify about a project change: whole team if Critical/Urgent, else just PIC + collaborators
const notifyTargets = (p, members) => {
  const base = isHotPriority(p) ? Array.from(new Set([...(members || []), ...assigneesOf(p)])) : assigneesOf(p);
  return base.filter(Boolean);
};
const TASK_STATUS = ["Not Started", "On Progress", "Finished"];
const TASK_STATUS_META = {
  "Not Started": { color: C.slate, soft: C.slateSoft },
  "On Progress": { color: C.blue, soft: C.blueSoft },
  "Finished": { color: C.green, soft: "#DCFCE7" },
};
function dueInfo(item, ref) {
  if (!item.dueDate) return null;
  if (item.status === "Finished") return { label: "Done", color: C.green, overdue: false };
  const base = ref || todayISO();
  const days = Math.ceil((new Date(item.dueDate + "T00:00:00").getTime() - new Date(base + "T00:00:00").getTime()) / 864e5);
  if (days < 0) return { label: "Overdue", color: C.red, overdue: true };
  if (days === 0) return { label: "Due today", color: C.amber, overdue: false };
  if (days === 1) return { label: "Due in 1 day", color: C.amber, overdue: false };
  return { label: `Due in ${days} days`, color: days <= 5 ? C.amber : C.muted, overdue: false };
}
function mentionNodes(text, members) {
  // returns react-safe nodes with @Name highlighted
  const found = members.filter((m) => text.includes("@" + m)).sort((a, b) => b.length - a.length);
  if (!found.length) return text;
  let parts = [text];
  found.forEach((m) => {
    const next = [];
    parts.forEach((seg) => {
      if (typeof seg !== "string") { next.push(seg); return; }
      const bits = seg.split("@" + m);
      bits.forEach((b, i) => { if (i) next.push(<span key={m + i + Math.random()} style={{ color: C.blue, fontWeight: 700 }}>@{m}</span>); next.push(b); });
    });
    parts = next;
  });
  return parts;
}

async function sha256(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function loadState() {
  try { const r = await window.storage.get(KEY, true); if (r && r.value) return JSON.parse(r.value); } catch (e) {}
  return null;
}
async function saveState(s) { try { await window.storage.set(KEY, JSON.stringify(s), true); } catch (e) { console.error(e); } }
function normalize(s) {
  const projects = (s.projects || []).map((p) => {
    const q = { client: "", collaborators: [], milestones: [], checklist: [], kickoff: "", wrapup: "",
      source: "", pic: "", description: "", dataRoom: "", archived: false, archivedAt: "", finishedAt: "",
      subStatus: "", priority: "Moderate", ...p };
    q.checklist = (q.checklist || []).map((i) => {
      const it = { assignee: "All", dueDate: "", ...i };
      it.status = i.status || (i.done ? "Finished" : "Not Started");
      it.done = it.status === "Finished";
      return it;
    });
    if (q.status === "Finished" && !q.finishedAt) q.finishedAt = q.updatedAt || q.createdAt || todayISO();
    return q;
  });
  const announcements = (s.announcements || []).map((a) => ({ editedAt: null, comments: [], tags: [], ...a }));
  return { ...s, company: { ...DEFAULT_COMPANY, ...(s.company || {}) }, invoices: s.invoices || [], members: s.members || [], accounts: s.accounts || [],
    announcements, notifications: s.notifications || [], transactions: s.transactions || [], reports: s.reports || [], projects };
}
function cleanupNotifs(state) {
  const cut = Date.now() - NOTIF_DAYS * 864e5;
  return { ...state, notifications: (state.notifications || []).filter((n) => new Date(n.createdAt).getTime() >= cut) };
}
const ARCHIVE_DAYS = 30;
const isAutoArchivable = (p) => !p.archived && p.status === "Finished" && p.finishedAt &&
  (Date.now() - new Date(p.finishedAt + "T00:00:00").getTime()) >= ARCHIVE_DAYS * 864e5;
function autoArchive(state) {
  return { ...state, projects: state.projects.map((p) => isAutoArchivable(p) ? { ...p, archived: true, archivedAt: todayISO() } : p) };
}
// keeps finishedAt / archive flags consistent whenever a project's status changes
function withStatusMeta(p) {
  if (p.status === "Finished") return { ...p, finishedAt: p.finishedAt || todayISO() };
  return { ...p, finishedAt: "", archived: false, archivedAt: "" };
}
const avatarColors = [C.blue, C.amber, C.green, C.violet, C.red, C.slate];
const colorFor = (name, members) => avatarColors[Math.max(0, (members || []).indexOf(name)) % avatarColors.length];

/* ------------------------------ responsive hook ------------------------------ */
function useWidth() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => { const f = () => setW(window.innerWidth); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  return w;
}
const useIsMobile = () => useWidth() < 820;

/* ------------------------------ global styles ------------------------------ */
function GlobalStyle() {
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Nunito+Sans:opsz,wght@6..12,400;6..12,500;6..12,600;6..12,700;6..12,800&display=swap');
    * { box-sizing: border-box; }
    body { margin: 0; }
    .ui, .disp, .mono { font-family: 'Nunito Sans', system-ui, sans-serif; }
    .disp { font-weight: 800; letter-spacing: -0.3px; }
    .mono { font-weight: 700; font-variant-numeric: tabular-nums; }
    ::-webkit-scrollbar { width: 9px; height: 9px; }
    ::-webkit-scrollbar-thumb { background: #D7D9DE; border-radius: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    button, a, input, select, textarea { outline: none; font-family: inherit; }
    button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 2px solid ${C.blue}; outline-offset: 2px; }
    @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
    .fade { animation: fade .2s ease; }
    @keyframes fade { from { opacity: 0; transform: translateY(5px);} to { opacity:1; transform:none;} }
    .drag-over { background: ${C.blueSoft} !important; outline: 2px dashed ${C.blue}; }
    .report-page { background:#fff; border-radius:8px; width:794px; max-width:100%; height:1123px; box-sizing:border-box; padding:34px 32px; overflow:hidden; margin:0 auto 18px; }
    .print-holder { display: none; }
    @media print {
      body { background:#fff !important; }
      body, .print-holder, .print-holder * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
      body.printing-report > *:not(.print-holder) { display: none !important; }
      body.printing-report .print-holder { display: block !important; }
      .no-print { display: none !important; }
      @page { size: A4; margin: 0; }
      .print-holder .report-page { width:210mm !important; height:297mm !important; padding:12mm !important; margin:0 !important; border-radius:0 !important; overflow:hidden !important; box-shadow:none !important; break-after:page; page-break-after:always; }
      .print-holder .report-page:last-child { break-after:auto; page-break-after:auto; }
    }
  `;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

/* =================================================================== */
/* ============================================================
   Netlify / Supabase wrapper.
   Every view below is identical to the in-Claude preview: they all read one
   `state` object and change it with `update(prev => patch)`. Here `update`
   also diffs the change and writes it to Supabase; realtime keeps everyone
   in sync.
   ============================================================ */
const COLLECTIONS = ["projects", "invoices", "announcements", "notifications", "transactions", "reports"];
const same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);

async function persistDiff(prev, next) {
  const jobs = [];
  const newNotifs = [];
  for (const key of COLLECTIONS) {
    const a = prev[key] || [], b = next[key] || [];
    if (a === b) continue;
    const A = new Map(a.map((x) => [x.id, x])), B = new Map(b.map((x) => [x.id, x]));
    for (const [id, x] of B) {
      const old = A.get(id);
      if (old && same(old, x)) continue;
      const isNew = !old;
      if (key === "projects") jobs.push(db.upsertProject(x));
      else if (key === "invoices") jobs.push(db.upsertInvoice(x));
      else if (key === "announcements") jobs.push(db.insertAnnouncement(x));
      else if (key === "transactions") jobs.push(db.upsertTransaction(x));
      else if (key === "notifications") { if (isNew) newNotifs.push(x); }
      else if (key === "reports") { if (isNew) jobs.push(db.insertReport(x)); }
    }
    for (const [id] of A) {
      if (B.has(id)) continue;
      if (key === "projects") jobs.push(db.deleteProject(id));
      else if (key === "invoices") jobs.push(db.deleteInvoice(id));
      else if (key === "announcements") jobs.push(db.deleteAnnouncement(id));
      else if (key === "transactions") jobs.push(db.deleteTransaction(id));
      else if (key === "notifications") jobs.push(db.deleteNotification(id));
      else if (key === "reports") jobs.push(db.deleteReport(id));
    }
  }
  if (newNotifs.length) jobs.push(db.insertNotifications(newNotifs));
  if (!same(prev.company, next.company) || !same(prev.members, next.members)) jobs.push(db.upsertSettings({ company: next.company, members: next.members }));
  const res = await Promise.allSettled(jobs);
  const fail = res.find((r) => r.status === "rejected");
  if (fail) throw fail.reason;
}

const REFETCH = {
  settings: async () => { const s = await db.getSettings(); return { company: { ...DEFAULT_COMPANY, ...(s.company || {}) }, members: s.members || [] }; },
  projects: async () => ({ projects: normalize({ projects: await db.listProjects() }).projects }),
  invoices: async () => ({ invoices: await db.listInvoices() }),
  announcements: async () => ({ announcements: normalize({ announcements: await db.listAnnouncements() }).announcements }),
  notifications: async () => ({ notifications: cleanupNotifs({ notifications: await db.listNotifications() }).notifications }),
  transactions: async () => ({ transactions: await db.listTransactions() }),
  reports: async () => ({ reports: await db.listReports() }),
  team_members: async () => ({ accounts: await db.listTeamMembers() }),
};

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState(null);
  const [codeOkFor, setCodeOkFor] = useState(null); // user id that entered the access code this page-load
  const [state, setState] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [syncErr, setSyncErr] = useState("");
  const [adminOn, setAdminOn] = useState(false);
  const [live, setLive] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [navOpen, setNavOpen] = useState(false);
  const isMobile = useIsMobile();
  const stateRef = useRef(null);
  const setAll = (s) => { stateRef.current = s; setState(s); };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const user = session ? session.user : null;
  const userId = user ? user.id : null;
  const codeOk = !!userId && codeOkFor === userId;
  const currentUser = user ? ((user.user_metadata && user.user_metadata.full_name) || user.email) : "";

  const update = useCallback((patch) => {
    const prev = stateRef.current;
    if (!prev) return Promise.resolve();
    const delta = typeof patch === "function" ? patch(prev) : patch;
    const next = { ...prev, ...(delta || {}) };
    setAll(next);
    const p = persistDiff(prev, next);
    p.catch((e) => { console.error(e); setSyncErr((e && e.message) || "A change couldn't be saved."); });
    return p;
  }, []);

  // load everything once the access code has been entered
  const loadAll = useCallback(async () => {
    setLoadErr("");
    try {
      const [st, projects, invoices, announcements, notifications, transactions, reports, accounts] = await Promise.all([
        db.getSettings(), db.listProjects(), db.listInvoices(), db.listAnnouncements(), db.listNotifications(),
        db.listTransactions(), db.listReports(), db.listTeamMembers().catch(() => []),
      ]);
      const loaded = normalize({ company: st.company, members: st.members, projects, invoices, announcements, notifications, transactions, reports, accounts });
      let next = cleanupNotifs(autoArchive(loaded));
      if (currentUser && !(next.members || []).some((m) => sameUser(m, currentUser))) next = { ...next, members: [...(next.members || []), currentUser] };
      setAll(next);
      persistDiff(loaded, next).catch((e) => console.error(e)); // auto-archive, stale notifications, add me to members
    } catch (e) {
      console.error(e);
      setLoadErr((e && e.message) || "Couldn't load the workspace.");
    }
  }, [currentUser]);

  useEffect(() => {
    if (!codeOk) return;
    let alive = true;
    loadAll();
    const timers = {};
    const refetch = (table) => () => {
      clearTimeout(timers[table]);
      timers[table] = setTimeout(async () => {
        try { const patch = await REFETCH[table](); if (alive && stateRef.current) setAll({ ...stateRef.current, ...patch }); } catch (e) { console.error(e); }
      }, 250);
    };
    let ch = supabase.channel("rt-" + Math.random().toString(36).slice(2));
    Object.keys(REFETCH).forEach((t) => { ch = ch.on("postgres_changes", { event: "*", schema: "public", table: t }, refetch(t)); });
    ch.subscribe((st) => setLive(st === "SUBSCRIBED"));
    return () => { alive = false; Object.values(timers).forEach(clearTimeout); supabase.removeChannel(ch); setLive(false); };
  }, [codeOk, loadAll]);

  const admin = useMemo(() => ({
    unlocked: adminOn,
    unlock: async (code) => {
      const { data, error } = await supabase.rpc("check_admin", { code: (code || "").trim() });
      if (error) { console.error(error); return false; }
      const ok = data === true; if (ok) setAdminOn(true); return ok;
    },
    lock: () => setAdminOn(false),
  }), [adminOn]);

  const signOut = async () => { setAdminOn(false); setCodeOkFor(null); setAll(null); setTab("dashboard"); await supabase.auth.signOut(); };

  if (!authReady) return <Splash text="Loading…" />;
  if (!session) return <Auth onRegistered={(id) => setCodeOkFor(id)} />;
  if (!codeOk) return <AccessCodeGate account={{ name: currentUser, email: user.email }} onPass={() => setCodeOkFor(userId)} onSignOut={signOut} />;
  if (loadErr) return (
    <AuthShell title="Couldn't load the workspace">
      <div style={{ fontSize: 12.5, color: C.red }}>{loadErr}</div>
      <div style={{ fontSize: 12, color: C.muted }}>If this mentions a missing table, column or function, run the latest supabase-schema.sql in Supabase → SQL Editor.</div>
      <PrimaryButton onClick={loadAll} full>Try again</PrimaryButton>
      <GhostButton onClick={signOut}>Sign out</GhostButton>
    </AuthShell>
  );
  if (!state) return <Splash text="Loading workspace…" />;

  const account = { id: userId, name: currentUser, email: user.email };
  const go = (t) => { setTab(t); setNavOpen(false); };
  const nav = <Sidebar tab={tab} setTab={go} currentUser={currentUser} state={state} live={live} onSignOut={signOut} />;

  const views = (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: isMobile ? "16px 15px 90px" : "34px 40px 90px" }}>
      {syncErr && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#FDECEC", border: `1px solid ${C.red}`, color: C.red, padding: "10px 14px", borderRadius: 10, fontSize: 12.5, marginBottom: 16 }}>
          <span style={{ flex: 1 }}>Couldn't save a change: {syncErr}</span>
          <button onClick={() => { setSyncErr(""); loadAll(); }} style={{ ...linkBtn, fontSize: 12.5, color: C.red }}>Reload data</button>
          <IconBtn small onClick={() => setSyncErr("")} title="Dismiss"><X size={14} /></IconBtn>
        </div>
      )}
      {tab === "dashboard" && <Dashboard state={state} update={update} currentUser={currentUser} setTab={go} />}
      {tab === "personal" && <Personal state={state} update={update} currentUser={currentUser} setTab={go} />}
      {tab === "projects" && <Projects state={state} update={update} currentUser={currentUser} setTab={go} />}
      {tab.startsWith("cat:") && <CategorySubpage category={tab.slice(4)} state={state} update={update} currentUser={currentUser} setTab={go} />}
      {tab === "timeline" && <Timeline state={state} update={update} currentUser={currentUser} />}
      {tab === "todo" && <ToDo state={state} update={update} currentUser={currentUser} />}
      {tab === "balance" && (adminOn ? <Balance state={state} update={update} currentUser={currentUser} setTab={go} /> : <AdminGate title="Balance" />)}
      {tab === "invoicing" && (adminOn ? <Invoicing state={state} update={update} currentUser={currentUser} /> : <AdminGate title="Invoicing" />)}
      {tab === "archive" && <ArchiveView state={state} update={update} currentUser={currentUser} />}
      {tab === "settings" && <SettingsView state={state} update={update} account={account} />}
      <Footer />
    </div>
  );

  if (isMobile) return (
    <AdminCtx.Provider value={admin}>
    <div className="ui" style={{ minHeight: "100vh", background: C.bg, color: C.ink }}>
      <GlobalStyle />
      <div style={{ position: "sticky", top: 0, zIndex: 40, display: "flex", alignItems: "center", gap: 12,
        padding: "12px 15px", background: "#fff", borderBottom: `1px solid ${C.line}` }}>
        <button onClick={() => setNavOpen(true)} style={{ ...iconBtnStyle, border: "none" }}><Menu size={20} /></button>
        <Logo height={26} />
        <span style={{ marginLeft: "auto", fontSize: 12, color: C.muted }}>{currentUser}</span>
      </div>
      {navOpen && (
        <div onClick={() => setNavOpen(false)} style={{ position: "fixed", inset: 0, background: "#00000055", zIndex: 60 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 250, height: "100%", background: "#fff", overflowY: "auto" }}>{nav}</div>
        </div>
      )}
      <main>{views}</main>
    </div>
    </AdminCtx.Provider>
  );

  return (
    <AdminCtx.Provider value={admin}>
    <div className="ui" style={{ minHeight: "100vh", background: C.bg, color: C.ink, display: "flex" }}>
      <GlobalStyle />
      {nav}
      <main style={{ flex: 1, minWidth: 0, height: "100vh", overflowY: "auto" }}>{views}</main>
    </div>
    </AdminCtx.Provider>
  );
}

function Splash({ text }) {
  return <div className="ui" style={{ minHeight: "100vh", background: C.bg, color: C.muted, display: "grid", placeItems: "center" }}>
    <GlobalStyle /><div style={{ display: "flex", gap: 10, alignItems: "center" }}><span style={{ width: 9, height: 9, borderRadius: 3, background: C.blue }} /> {text}</div></div>;
}
function Logo({ height = 34 }) {
  return <img src={LOGO_SRC} alt="CoRE Mining Economics & Sustainability" style={{ height, width: "auto", display: "block" }} />;
}
function Footer() {
  return <div className="ui" style={{ textAlign: "center", fontSize: 10.5, color: C.faint, padding: "30px 16px 4px", lineHeight: 1.5, maxWidth: 640, margin: "0 auto" }}>{CREDIT}</div>;
}

/* ------------------------------ Sidebar ------------------------------ */
function Sidebar({ tab, setTab, currentUser, onSignOut, state, live }) {
  const admin = useAdmin();
  return (
    <aside style={{ width: 236, background: C.sidebar, borderRight: `1px solid ${C.line}`, minHeight: "100vh",
      display: "flex", flexDirection: "column", padding: "20px 15px" }}>
      <div style={{ padding: "0 6px 20px" }}>
        <Logo height={42} />
      </div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {[
          { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
          { id: "personal", label: "Personal", icon: UserCircle },
          { id: "projects", label: "Projects", icon: FolderKanban },
          { id: "timeline", label: "Timeline", icon: GanttChartSquare },
          { id: "todo", label: "To Do", icon: ListChecks },
          { id: "balance", label: "Balance", icon: Coins },
          { id: "invoicing", label: "Invoicing", icon: ReceiptText },
          { id: "archive", label: "Archive", icon: Archive },
          { id: "settings", label: "Settings", icon: Settings },
        ].map((it) => {
          const active = tab === it.id; const Icon = it.icon;
          return (
            <React.Fragment key={it.id}>
              <button onClick={() => setTab(it.id)} style={{ display: "flex", alignItems: "center", gap: 11,
                padding: "11px 13px", borderRadius: 12, border: "none", cursor: "pointer", textAlign: "left",
                fontSize: 14, fontWeight: 600, background: active ? C.blue : "transparent",
                color: active ? "#fff" : C.ink2, transition: "background .15s" }}>
                <Icon size={18} color={active ? "#fff" : C.muted} /> {it.label}
                {(it.id === "balance" || it.id === "invoicing") && !admin.unlocked && <Lock size={12} color={active ? "#fff" : C.faint} style={{ marginLeft: "auto" }} />}
              </button>
              {it.id === "projects" && CATEGORIES.map((c) => {
                const cid = "cat:" + c; const on = tab === cid;
                return (
                  <button key={cid} onClick={() => setTab(cid)} style={{ display: "flex", alignItems: "center", gap: 9,
                    margin: "1px 0 1px 24px", padding: "7px 11px", borderRadius: 10, border: "none", cursor: "pointer", textAlign: "left",
                    fontSize: 12.5, fontWeight: 600, background: on ? C.blueSoft : "transparent", color: on ? C.blue : C.muted }}>
                    <span style={{ width: 6, height: 6, borderRadius: 2, background: CATEGORY_COLOR[c] }} /> {c}
                  </button>
                );
              })}
            </React.Fragment>
          );
        })}
      </nav>
      <div style={{ marginTop: 24, padding: "0 6px" }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1, color: C.faint, textTransform: "uppercase", marginBottom: 12 }}>Members</div>
        <div style={{ display: "grid", gap: 10, maxHeight: 260, overflowY: "auto" }}>
          {(state.members || []).map((m) => (
            <div key={m} style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <Avatar name={m} members={state.members} size={26} />
              <span style={{ fontSize: 12.5, color: C.ink2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m}</span>
              {sameUser(m, currentUser) && <span style={{ width: 6, height: 6, borderRadius: 3, background: C.green, marginLeft: "auto", flexShrink: 0 }} />}
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: "auto", borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: live ? C.green : C.faint, margin: "0 4px 10px" }}><Wifi size={12} /> {live ? "Live sync on" : "Connecting…"}</div>
        <button onClick={onSignOut} style={{ width: "100%", display: "flex", alignItems: "center", gap: 9,
          padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.ink2, cursor: "pointer", fontSize: 12.5 }}>
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </aside>
  );
}

/* ------------------------------ Auth ------------------------------ */
function Auth({ onRegistered }) {
  const [mode, setMode] = useState("signin");
  const [f, setF] = useState({ name: "", email: "", pass: "", pass2: "", code: "" });
  const [err, setErr] = useState(""); const [info, setInfo] = useState(""); const [busy, setBusy] = useState(false);
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setErr(""); };
  const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const friendly = (e) => {
    const m = (e && e.message) || String(e || "");
    if (/invalid login credentials/i.test(m)) return "Incorrect email or password.";
    if (/email not confirmed/i.test(m)) return "Please confirm your email first (check your inbox), then sign in.";
    if (/already registered/i.test(m)) return "Email already registered — sign in instead.";
    if (/function .* does not exist|could not find the function/i.test(m)) return "Server isn't set up yet — run the latest supabase-schema.sql in Supabase.";
    return m;
  };
  const signin = async () => {
    if (!emailOk(f.email.trim())) return setErr("Enter a valid email.");
    const { error } = await supabase.auth.signInWithPassword({ email: f.email.trim(), password: f.pass });
    if (error) return setErr(friendly(error));
  };
  const register = async () => {
    if (!f.name.trim()) return setErr("Enter your full name.");
    if (!emailOk(f.email.trim())) return setErr("Enter a valid email.");
    if (f.pass.length < 6) return setErr("Password should be at least 6 characters.");
    if (f.pass !== f.pass2) return setErr("Passwords don't match.");
    const { data: ok, error: e1 } = await supabase.rpc("verify_access_code", { code: f.code.trim() });
    if (e1) return setErr(friendly(e1));
    if (ok !== true) return setErr("Invalid access code. Ask your team admin for the code.");
    const { data, error } = await supabase.auth.signUp({ email: f.email.trim(), password: f.pass,
      options: { data: { full_name: f.name.trim() }, emailRedirectTo: window.location.origin } });
    if (error) return setErr(friendly(error));
    if (data.session && data.user) {
      const { error: e2 } = await supabase.rpc("join_team", { code: f.code.trim() });
      if (e2) return setErr(friendly(e2));
      onRegistered(data.user.id);
    } else {
      setInfo("Account created. Check your email to confirm it, then sign in here.");
      setMode("signin"); setF((p) => ({ ...p, pass: "", pass2: "", code: "" }));
    }
  };
  const submit = async () => { if (busy) return; setBusy(true); setInfo(""); try { await (mode === "signin" ? signin() : register()); } catch (e) { setErr(friendly(e)); } finally { setBusy(false); } };
  const tabBtn = (m, l) => (
    <button onClick={() => { setMode(m); setErr(""); }} style={{ flex: 1, padding: "9px 0", border: "none", borderRadius: 9, cursor: "pointer", fontSize: 13, fontWeight: 700,
      background: mode === m ? "#fff" : "transparent", color: mode === m ? C.ink : C.muted, boxShadow: mode === m ? "0 1px 3px #0000001a" : "none" }}>{l}</button>
  );
  return (
    <AuthShell title={mode === "signin" ? "Sign in" : "Create your account"}>
      <div style={{ display: "flex", gap: 4, background: C.bg, borderRadius: 11, padding: 4 }}>{tabBtn("signin", "Sign in")}{tabBtn("register", "Register")}</div>
      {mode === "register" && <Field label="Full name"><TextInput value={f.name} onChange={(v) => set("name", v)} placeholder="As it should appear to the team" /></Field>}
      <Field label="Email"><TextInput value={f.email} onChange={(v) => set("email", v)} placeholder="name@email.com" autoFocus onEnter={submit} /></Field>
      <Field label="Password"><TextInput type="password" value={f.pass} onChange={(v) => set("pass", v)} onEnter={submit} /></Field>
      {mode === "register" && <>
        <Field label="Confirm password"><TextInput type="password" value={f.pass2} onChange={(v) => set("pass2", v)} onEnter={submit} /></Field>
        <Field label="Access code"><TextInput type="password" value={f.code} onChange={(v) => set("code", v)} placeholder="Universal team code" onEnter={submit} /></Field>
      </>}
      {info && <div style={{ color: C.green, fontSize: 12.5 }}>{info}</div>}
      {err && <div style={{ color: C.red, fontSize: 12.5 }}>{err}</div>}
      <PrimaryButton onClick={submit} full disabled={busy}>{busy ? "Please wait…" : (mode === "signin" ? "Sign in" : "Register & enter")}</PrimaryButton>
      <div style={{ fontSize: 11.5, color: C.muted, textAlign: "center" }}>
        {mode === "signin" ? <>New here? <button onClick={() => { setMode("register"); setErr(""); }} style={{ ...linkBtn, fontSize: 11.5 }}>Register with the team access code</button></>
          : <>Already registered? <button onClick={() => { setMode("signin"); setErr(""); }} style={{ ...linkBtn, fontSize: 11.5 }}>Sign in</button></>}
      </div>
    </AuthShell>
  );
}

function AccessCodeGate({ account, onPass, onSignOut }) {
  const [code, setCode] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const go = async () => {
    if (busy) return; setBusy(true); setErr("");
    try {
      const { data, error } = await supabase.rpc("join_team", { code: code.trim() });
      if (error) setErr(/function .* does not exist|could not find the function/i.test(error.message) ? "Server isn't set up yet — run the latest supabase-schema.sql in Supabase." : error.message);
      else if (data === true) onPass();
      else setErr("Invalid access code.");
    } finally { setBusy(false); }
  };
  return (
    <AuthShell title="Enter access code">
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: C.ink2 }}>
        <Avatar name={account.name} members={[account.name]} size={32} />
        <div style={{ minWidth: 0 }}><div style={{ fontWeight: 700 }}>{account.name}</div><div style={{ fontSize: 11.5, color: C.muted, overflow: "hidden", textOverflow: "ellipsis" }}>{account.email}</div></div>
      </div>
      <div style={{ fontSize: 12.5, color: C.muted }}>Enter the team access code to open the platform. It's required every time you sign in.</div>
      <Field label="Access code"><TextInput type="password" value={code} onChange={(v) => { setCode(v); setErr(""); }} autoFocus onEnter={go} /></Field>
      {err && <div style={{ color: C.red, fontSize: 12.5 }}>{err}</div>}
      <PrimaryButton onClick={go} full disabled={busy}><Lock size={14} /> {busy ? "Checking…" : "Enter platform"}</PrimaryButton>
      <div style={{ fontSize: 11.5, color: C.muted, textAlign: "center" }}>Not you? <button onClick={onSignOut} style={{ ...linkBtn, fontSize: 11.5 }}>Sign out</button></div>
    </AuthShell>
  );
}

function AdminPrompt({ onClose, onUnlocked, what = "this section" }) {
  const admin = useAdmin();
  const [code, setCode] = useState(""); const [err, setErr] = useState("");
  const go = async () => { if (await admin.unlock(code)) { onUnlocked && onUnlocked(); onClose && onClose(); } else setErr("Incorrect admin password."); };
  return (
    <Modal onClose={onClose} title="Admin access required">
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13, color: C.ink2 }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: C.blueSoft, display: "grid", placeItems: "center", flexShrink: 0 }}><Lock size={16} color={C.blue} /></span>
          Enter the admin password to open {what}. Access stays unlocked until you sign out.
        </div>
        <Field label="Admin password"><TextInput type="password" value={code} onChange={(v) => { setCode(v); setErr(""); }} autoFocus onEnter={go} /></Field>
        {err && <div style={{ color: C.red, fontSize: 12.5 }}>{err}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end" }}><PrimaryButton onClick={go}><Lock size={14} /> Unlock</PrimaryButton></div>
      </div>
    </Modal>
  );
}

function AdminGate({ title }) {
  const admin = useAdmin();
  const [code, setCode] = useState(""); const [err, setErr] = useState("");
  const go = async () => { if (!(await admin.unlock(code))) setErr("Incorrect admin password."); };
  return (
    <div className="fade">
      <Header title={title} />
      <Card style={{ padding: 30, maxWidth: 440, margin: "30px auto", textAlign: "center" }}>
        <span style={{ width: 48, height: 48, borderRadius: 14, background: C.blueSoft, display: "inline-grid", placeItems: "center", marginBottom: 12 }}><Lock size={22} color={C.blue} /></span>
        <div className="disp" style={{ fontSize: 17 }}>{title} is admin-only</div>
        <div style={{ fontSize: 12.5, color: C.muted, margin: "6px 0 18px" }}>Enter the admin password to continue. It stays unlocked until you sign out.</div>
        <div style={{ display: "grid", gap: 10, textAlign: "left" }}>
          <TextInput type="password" value={code} onChange={(v) => { setCode(v); setErr(""); }} placeholder="Admin password" autoFocus onEnter={go} />
          {err && <div style={{ color: C.red, fontSize: 12.5 }}>{err}</div>}
          <PrimaryButton onClick={go} full><Lock size={14} /> Unlock</PrimaryButton>
        </div>
      </Card>
    </div>
  );
}
function AuthShell({ title, children }) {
  return (
    <div className="ui" style={{ minHeight: "100vh", background: C.bg, color: C.ink, display: "grid", placeItems: "center", padding: 20 }}>
      <GlobalStyle />
      <div className="fade" style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ marginBottom: 20 }}><Logo height={46} /></div>
        <h1 className="disp" style={{ fontSize: 26, margin: "0 0 22px" }}>{title}</h1>
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, padding: 22, display: "grid", gap: 14 }}>{children}</div>
        <Footer />
      </div>
    </div>
  );
}

/* ------------------------------ Announcements ------------------------------ */
function Announcements({ state, update, currentUser }) {
  const members = state.members;
  const live = (state.announcements || []).filter((a) => !a.expiresAt || new Date(a.expiresAt).getTime() > Date.now());
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(""); const [dur, setDur] = useState("1 week");
  const [mention, setMention] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const taRef = React.useRef(null);

  const onText = (e) => {
    const v = e.target.value; setText(v);
    const caret = e.target.selectionStart; const upto = v.slice(0, caret);
    const m = upto.match(/@([^\s@]*)$/);
    setMention(m ? { query: m[1].toLowerCase(), at: caret - m[0].length } : null);
  };
  const pickMention = (name) => {
    const before = text.slice(0, mention.at); const caret = taRef.current ? taRef.current.selectionStart : text.length;
    const after = text.slice(caret); setText(before + "@" + name + " " + after); setMention(null);
    setTimeout(() => taRef.current && taRef.current.focus(), 0);
  };
  const suggestions = mention ? members.filter((m) => m.toLowerCase().includes(mention.query)) : [];

  const post = () => {
    if (!text.trim()) return;
    const d = DURATIONS.find((x) => x.label === dur);
    const expiresAt = d && d.ms ? new Date(Date.now() + d.ms).toISOString() : null;
    const tags = members.filter((m) => text.includes("@" + m));
    update((prev) => ({
      announcements: [{ id: uid(), author: currentUser, text: text.trim(), createdAt: nowISO(), expiresAt, tags, editedAt: null, comments: [] }, ...prev.announcements],
      notifications: [...tags.map((m) => mkNotif(m, "tagged", `${currentUser} tagged you in an announcement`)), ...prev.notifications],
    }));
    setText(""); setOpen(false); setDur("1 week");
  };
  const remove = (id) => update((prev) => ({ announcements: prev.announcements.filter((a) => a.id !== id) }));
  const editPost = (id, newText) => {
    const tags = members.filter((m) => newText.includes("@" + m));
    update((prev) => ({ announcements: prev.announcements.map((a) => a.id === id ? { ...a, text: newText, tags, editedAt: nowISO() } : a) }));
  };
  const addComment = (id, body) => update((prev) => ({ announcements: prev.announcements.map((a) => a.id === id ? { ...a, comments: [...(a.comments || []), { id: uid(), author: currentUser, text: body, createdAt: nowISO() }] } : a) }));
  const delComment = (id, cid) => update((prev) => ({ announcements: prev.announcements.map((a) => a.id === id ? { ...a, comments: (a.comments || []).filter((c) => c.id !== cid) } : a) }));

  const shown = showAll ? live : live.slice(0, 3);

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Megaphone size={16} color={C.blue} /><h2 className="disp" style={{ fontSize: 15, margin: 0 }}>Team Announcements</h2>
        <button onClick={() => setOpen((o) => !o)} style={{ marginLeft: "auto", ...linkBtn }}>{open ? "Close" : "New post"} {!open && <Plus size={14} />}</button>
      </div>

      {open && (
        <Card style={{ padding: 14, marginBottom: 12, position: "relative" }}>
          <textarea ref={taRef} value={text} onChange={onText} rows={3} placeholder="Share important info or work priorities…  Type @ to tag a member."
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
          {suggestions.length > 0 && (
            <div style={{ position: "absolute", zIndex: 5, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10, boxShadow: "0 8px 24px #14141420", padding: 6, marginTop: 2, minWidth: 200 }}>
              {suggestions.map((m) => <button key={m} onClick={() => pickMention(m)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", border: "none", background: "none", padding: "7px 8px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}><Avatar name={m} members={members} size={22} /> {m}</button>)}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: C.muted }}>Show for</span>
            <Select value={dur} onChange={setDur} options={DURATIONS.map((d) => d.label)} compact />
            <PrimaryButton small onClick={post} style={{ marginLeft: "auto" }}><Megaphone size={14} /> Post</PrimaryButton>
          </div>
        </Card>
      )}

      {live.length === 0 && !open ? (
        <Card style={{ padding: 16, fontSize: 13, color: C.muted, display: "flex", alignItems: "center", gap: 8 }}><Megaphone size={15} /> No announcements right now. Post one to share priorities with the team.</Card>
      ) : (
        <Card style={{ padding: 4 }}>
          {shown.map((a, idx) => (
            <div key={a.id} style={{ padding: "14px 14px", borderTop: idx ? `1px solid ${C.lineSoft}` : "none" }}>
              <AnnouncementPost a={a} members={members} currentUser={currentUser}
                onDelete={() => remove(a.id)} onEdit={(t) => editPost(a.id, t)}
                onComment={(t) => addComment(a.id, t)} onDelComment={(cid) => delComment(a.id, cid)} />
            </div>
          ))}
          {live.length > 3 && (
            <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.lineSoft}` }}>
              <button onClick={() => setShowAll((s) => !s)} style={linkBtn}>{showAll ? "Show less" : `See more (${live.length - 3})…`}</button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function AnnouncementPost({ a, members, currentUser, onDelete, onEdit, onComment, onDelComment }) {
  const mine = a.author === currentUser;
  const [editing, setEditing] = useState(false); const [draft, setDraft] = useState(a.text);
  const [comment, setComment] = useState(""); const [showComments, setShowComments] = useState(false);
  const comments = a.comments || [];
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
        <Avatar name={a.author} members={members} size={28} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700 }}>{a.author}</span>
            <span style={{ fontSize: 10.5, color: C.muted }}>{ago(a.createdAt)} · {a.expiresAt ? `until ${a.expiresAt.slice(0, 10)}` : "permanent"}{a.editedAt ? ` · edited ${ago(a.editedAt)}` : ""}</span>
          </div>
        </div>
        {mine && !editing && <IconBtn onClick={() => { setDraft(a.text); setEditing(true); }} title="Edit" small><Pencil size={12} /></IconBtn>}
        {mine && <button onClick={onDelete} title="Delete post" style={{ background: "none", border: "none", cursor: "pointer", color: C.faint, padding: 2, lineHeight: 0 }}><X size={13} /></button>}
      </div>

      {editing ? (
        <div style={{ marginTop: 8, marginLeft: 37 }}>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
            <GhostButton small onClick={() => setEditing(false)}>Cancel</GhostButton>
            <PrimaryButton small onClick={() => { if (draft.trim()) { onEdit(draft.trim()); setEditing(false); } }}>Save</PrimaryButton>
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.55, whiteSpace: "pre-wrap", marginLeft: 37, marginTop: 2 }}>{mentionNodes(a.text, members)}</div>
      )}

      <div style={{ marginLeft: 37, marginTop: 8 }}>
        <button onClick={() => setShowComments((s) => !s)} style={{ ...linkBtn, fontSize: 12 }}>{comments.length ? `${comments.length} comment${comments.length > 1 ? "s" : ""}` : "Comment"}</button>
        {showComments && (
          <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
            {comments.map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <Avatar name={c.author} members={members} size={22} />
                <div style={{ flex: 1, background: C.bg, borderRadius: 10, padding: "6px 10px" }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700 }}>{c.author} <span style={{ fontWeight: 400, color: C.muted }}>· {ago(c.createdAt)}</span></div>
                  <div style={{ fontSize: 12.5, color: C.ink }}>{c.text}</div>
                </div>
                {c.author === currentUser && <IconBtn onClick={() => onDelComment(c.id)} danger small><X size={11} /></IconBtn>}
              </div>
            ))}
            <div style={{ display: "flex", gap: 8 }}>
              <input value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && comment.trim()) { onComment(comment.trim()); setComment(""); } }} placeholder="Write a comment…" style={{ ...inputStyle, padding: "7px 10px" }} />
              <PrimaryButton small onClick={() => { if (comment.trim()) { onComment(comment.trim()); setComment(""); } }}>Send</PrimaryButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ Personal ------------------------------ */
const NOTIF_ICON = { assigned_project: UserPlus, tagged: AtSign, assigned_task: ListChecks, status_change: GanttChartSquare };
function Personal({ state, update, currentUser, setTab }) {
  const mine = (state.notifications || []).filter((n) => sameUser(n.to, currentUser)).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? mine : mine.slice(0, 3);
  const dismiss = (id) => update((prev) => ({ notifications: prev.notifications.filter((n) => n.id !== id) }));
  const myProjects = state.projects.filter((p) => !p.archived && assigneesOf(p).some((m) => sameUser(m, currentUser)));
  const [detail, setDetail] = useState(null);

  return (
    <div className="fade">
      <Header title="Personal" sub={`Signed in as ${currentUser}`} />

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Bell size={16} color={C.blue} /><h2 className="disp" style={{ fontSize: 15, margin: 0 }}>Notifications</h2>
      </div>
      {mine.length === 0 ? (
        <Card style={{ padding: 16, fontSize: 13, color: C.muted }}>No notifications yet. You'll be alerted when you're assigned to work, tagged, or when your projects change status.</Card>
      ) : (
        <>
          <div style={{ display: "grid", gap: 8 }}>
            {shown.map((n) => { const Icon = NOTIF_ICON[n.type] || Bell;
              return (
                <Card key={n.id} style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: C.blueSoft, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={16} color={C.blue} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: C.ink }}>{n.text}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{ago(n.createdAt)}</div>
                  </div>
                  {n.projectId && state.projects.some((p) => p.id === n.projectId) && <button onClick={() => setDetail(n.projectId)} style={linkBtn}>View</button>}
                  <IconBtn onClick={() => dismiss(n.id)} title="Dismiss" small><X size={13} /></IconBtn>
                </Card>
              );
            })}
          </div>
          {mine.length > 3 && <button onClick={() => setShowAll((s) => !s)} style={{ ...linkBtn, marginTop: 10 }}>{showAll ? "Show less" : `See more (${mine.length - 3})…`}</button>}
        </>
      )}
      <div style={{ fontSize: 11, color: C.faint, marginTop: 10 }}>Notifications are automatically removed after 14 days.</div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "28px 0 12px" }}>
        <FolderKanban size={16} color={C.blue} /><h2 className="disp" style={{ fontSize: 15, margin: 0 }}>My projects</h2>
        <span className="mono" style={{ fontSize: 12, color: C.muted }}>{myProjects.length}</span>
      </div>
      {myProjects.length === 0 ? <EmptyState label="You're not assigned to any active project yet." /> : (
        <div style={{ display: "grid", gap: 10 }}>
          {myProjects.map((p) => (
            <div key={p.id} style={{ position: "relative" }}>
              <ProjectRow p={p} members={state.members} onOpen={() => setDetail(p.id)} />
              <span style={{ position: "absolute", top: 15, right: 16, fontSize: 10.5, fontWeight: 700, color: p.pic === currentUser ? C.blue : C.muted }}>{p.pic === currentUser ? "PIC" : "Collaborator"}</span>
            </div>
          ))}
        </div>
      )}
      {detail && <ProjectDetail project={state.projects.find((p) => p.id === detail)} state={state} update={update} currentUser={currentUser} onClose={() => setDetail(null)} />}
    </div>
  );
}

/* ------------------------------ Calendar ------------------------------ */
function EventCalendar({ projects, onOpenProject }) {
  const today = todayISO();
  const isMobile = useIsMobile();
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [selected, setSelected] = useState(today);
  const events = useMemo(() => {
    const list = [];
    (projects || []).filter((p) => !p.archived).forEach((p) => {
      if (p.kickoff) list.push({ date: p.kickoff, kind: "Kick-off", color: C.blue, project: p });
      if (p.wrapup) list.push({ date: p.wrapup, kind: "Wrap-up Target", color: C.green, project: p });
      (p.milestones || []).forEach((m) => list.push({ date: m.date, kind: m.name, color: C.amber, project: p }));
    });
    return list;
  }, [projects]);
  const byDate = useMemo(() => { const map = {}; events.forEach((e) => { (map[e.date] = map[e.date] || []).push(e); }); return map; }, [events]);

  const first = new Date(cursor.y, cursor.m, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const iso = (d) => `${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const cells = []; for (let i = 0; i < startDow; i++) cells.push(null); for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const prevM = () => setCursor((c) => { const m = c.m - 1; return m < 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m }; });
  const nextM = () => setCursor((c) => { const m = c.m + 1; return m > 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m }; });

  const selEvents = byDate[selected] || [];
  const upcoming = events.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);
  const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", borderBottom: `1px solid ${C.lineSoft}` }}>
        <Calendar size={16} color={C.blue} /><h2 className="disp" style={{ fontSize: 15, margin: 0 }}>Calendar</h2>
        <span style={{ fontSize: 11.5, color: C.muted, marginLeft: 6 }}>Kick-offs, wrap-up targets & milestones</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1fr) minmax(0,1fr)", gap: 0 }}>
        <div style={{ padding: 16, borderRight: isMobile ? "none" : `1px solid ${C.lineSoft}`, borderBottom: isMobile ? `1px solid ${C.lineSoft}` : "none" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
            <IconBtn small onClick={prevM}><ChevronRight size={15} style={{ transform: "rotate(180deg)" }} /></IconBtn>
            <div className="disp" style={{ flex: 1, textAlign: "center", fontSize: 13.5 }}>{MONTHS[cursor.m]} {cursor.y}</div>
            <IconBtn small onClick={nextM}><ChevronRight size={15} /></IconBtn>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, fontSize: 10.5, color: C.muted, textAlign: "center", marginBottom: 4 }}>
            {DOW.map((d) => <div key={d}>{d}</div>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const dISO = iso(d); const evs = byDate[dISO] || []; const isToday = dISO === today; const isSel = dISO === selected;
              return (
                <button key={i} onClick={() => setSelected(dISO)} style={{ aspectRatio: "1", border: isSel ? `1.5px solid ${C.blue}` : "1.5px solid transparent", background: isToday ? C.blue : "transparent", color: isToday ? "#fff" : C.ink, borderRadius: 9, cursor: "pointer", fontSize: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, position: "relative" }}>
                  {d}
                  {evs.length > 0 && <div style={{ display: "flex", gap: 2 }}>{evs.slice(0, 3).map((e, j) => <span key={j} style={{ width: 4, height: 4, borderRadius: "50%", background: isToday ? "#fff" : e.color }} />)}</div>}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 10 }}>{selEvents.length ? selected : "Upcoming events"}</div>
          <div style={{ display: "grid", gap: 8 }}>
            {(selEvents.length ? selEvents : upcoming).map((e, i) => (
              <button key={i} onClick={() => onOpenProject && onOpenProject(e.project.id)} style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: e.color, flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.kind} <span style={{ fontWeight: 400, color: C.muted }}>· {e.date.slice(5)}</span></div>
                  <div style={{ fontSize: 11, color: C.muted }}>{e.project.name}</div>
                </div>
              </button>
            ))}
            {!selEvents.length && !upcoming.length && <div style={{ fontSize: 12, color: C.muted }}>No events scheduled.</div>}
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------ Reports ------------------------------ */
const REPORT_META = {
  wtd: { title: "Week-to-Date Report", stampLabel: "As of", scope: "week", full: false, tag: "WTD",
    note: "WTD: Progress from the start of the week through the report date. Generated on demand as a current operational snapshot. Financial data reflects transactions recorded through the report date." },
  weekly: { title: "Weekly Report", stampLabel: "Generated on", scope: "week", full: true, tag: "Weekly",
    note: "Weekly: Full-week progress and activities (Monday – Sunday), generated on demand. Financial data reflects transactions recorded during the reporting cycle." },
  mtd: { title: "Month-to-Date Report", stampLabel: "As of", scope: "month", full: false, tag: "MTD",
    note: "MTD: Progress from the first day of the month through the report date. Generated on demand as a current management snapshot. Financial data reflects transactions recorded through the report date." },
  monthly: { title: "Monthly Report", stampLabel: "Generated on", scope: "month", full: true, tag: "Monthly",
    note: "Monthly: Full calendar-month progress and financial summary, generated on demand. Financial data reflects transactions recorded during the reporting cycle." },
};
const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function fmtRange(s, e) {
  const ds = new Date(s + "T00:00:00"), de = new Date(e + "T00:00:00");
  return `${MONTHS[ds.getMonth()].slice(0, 3)} ${ds.getDate()} - ${MONTHS[de.getMonth()].slice(0, 3)} ${de.getDate()}, ${de.getFullYear()}`;
}
function reportRange(type) {
  const meta = REPORT_META[type]; const today = new Date(todayISO() + "T00:00:00");
  if (meta.scope === "week") {
    const dow = (today.getDay() + 6) % 7; // Monday=0
    const start = new Date(today); start.setDate(today.getDate() - dow);
    const endFull = new Date(start); endFull.setDate(start.getDate() + 6);
    const end = meta.full ? endFull : today;
    return { start: isoOf(start), end: isoOf(end) };
  }
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const endFull = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const end = meta.full ? endFull : today;
  return { start: isoOf(start), end: isoOf(end) };
}
function shiftPeriod(type, period, dir) {
  const meta = REPORT_META[type];
  if (meta.scope === "week") {
    const s = new Date(period.start + "T00:00:00"); s.setDate(s.getDate() + dir * 7);
    const e = new Date(s); e.setDate(s.getDate() + 6);
    return { start: isoOf(s), end: isoOf(e) };
  }
  const s = new Date(period.start + "T00:00:00"); const nm = new Date(s.getFullYear(), s.getMonth() + dir, 1);
  const e = new Date(nm.getFullYear(), nm.getMonth() + 1, 0);
  return { start: isoOf(nm), end: isoOf(e) };
}

function ReportBar({ onGenerate }) {
  const btns = [["wtd", "Week-to-Date"], ["mtd", "Month-to-Date"], ["weekly", "Weekly"], ["monthly", "Monthly"]];
  const admin = useAdmin(); const [pending, setPending] = useState(null);
  const pick = (k) => admin.unlocked ? onGenerate(k) : setPending(k);
  return (<>
    <Card style={{ padding: 16, marginBottom: 20, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", borderLeft: `3px solid ${C.blue}` }}>
      <FileText size={18} color={C.blue} />
      <div><div className="disp" style={{ fontSize: 14 }}>Generate report</div><div style={{ fontSize: 11.5, color: C.muted }}>Download a PDF snapshot — opens your browser's print dialog, then choose "Save as PDF".</div></div>
      <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
        {!admin.unlocked && <span title="Admin password required" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: C.muted }}><Lock size={12} /> Admin</span>}
        {btns.map(([k, l]) => <button key={k} onClick={() => pick(k)} style={{ ...ghostBtnStyle, cursor: "pointer", display: "inline-flex", gap: 6, alignItems: "center" }}><Download size={13} /> {l}</button>)}
      </div>
    </Card>
    {pending && <AdminPrompt what="reports" onClose={() => setPending(null)} onUnlocked={() => onGenerate(pending)} />}
  </>);
}

function ReportOverlay({ type, state, saved, onSave, currentUser, onClose }) {
  const meta = REPORT_META[type];
  const canNav = !saved && (type === "weekly" || type === "monthly");
  const [period, setPeriod] = useState(() => saved ? { start: saved.start, end: saved.end } : reportRange(type));
  const [saveMsg, setSaveMsg] = useState("");
  const dataProjects = saved ? saved.snapshotProjects : state.projects;
  const dataTx = saved ? saved.snapshotTx : state.transactions;
  const active = dataProjects.filter((p) => !p.archived);
  const start = period.start, end = period.end;
  const asOf = end; // date-relative calcs anchor to the end of the reported window
  const printRef = React.useRef(null);
  useEffect(() => {
    return () => { document.body.classList.remove("printing-report"); document.querySelectorAll(".print-holder").forEach((n) => n.remove()); };
  }, []);
  const doPrint = () => {
    const src = printRef.current;
    if (!src) { window.print(); return; }
    document.querySelectorAll(".print-holder").forEach((n) => n.remove());
    const holder = document.createElement("div");
    holder.className = "print-holder ui";
    try { holder.style.fontFamily = getComputedStyle(src).fontFamily; } catch (e) {}
    holder.innerHTML = src.innerHTML;
    document.body.appendChild(holder);
    document.body.classList.add("printing-report");
    const prevTitle = document.title;
    document.title = `${meta.tag} Report_${end}`;
    const cleanup = () => { document.body.classList.remove("printing-report"); document.title = prevTitle; const h = document.querySelector(".print-holder"); if (h) h.remove(); window.removeEventListener("afterprint", cleanup); };
    window.addEventListener("afterprint", cleanup);
    setTimeout(() => window.print(), 120);
  };
  const saveToHistory = async () => {
    if (!onSave) return;
    setSaveMsg("saving");
    try {
      await onSave({ id: uid(), type, start, end, generatedBy: currentUser || "", generatedAt: nowISO(),
        snapshotProjects: JSON.parse(JSON.stringify(state.projects)), snapshotTx: JSON.parse(JSON.stringify(state.transactions)) });
      setSaveMsg("saved"); setTimeout(() => setSaveMsg((m) => m === "saved" ? "" : m), 2500);
    } catch (e) { setSaveMsg("err:" + ((e && e.message) || "Couldn't save — is the 'reports' table set up in Supabase?")); }
  };
  const plus = (days) => isoOf(new Date(new Date(asOf + "T00:00:00").getTime() + days * 864e5));

  // ---- project metrics ----
  const cnt = (s) => active.filter((p) => p.status === s).length;
  const totalItems = active.reduce((a, p) => a + totalOf(p), 0);
  const doneItems = active.reduce((a, p) => a + doneOf(p), 0);
  const pct = totalItems ? Math.round((doneItems / totalItems) * 100) : 0;
  const openTasks = active.flatMap((p) => (p.checklist || []).filter((i) => !i.done).map((i) => ({ ...i, project: p })));
  const notStarted = openTasks.filter((i) => i.status === "Not Started").length;
  const evAll = [];
  active.forEach((p) => {
    if (p.kickoff) evAll.push({ date: p.kickoff, kind: "Kick-off", project: p });
    if (p.wrapup) evAll.push({ date: p.wrapup, kind: "Wrap-up", project: p });
    (p.milestones || []).forEach((m) => evAll.push({ date: m.date, kind: m.name, project: p }));
  });
  const in14 = evAll.filter((e) => e.date >= asOf && e.date <= plus(14)).sort((a, b) => a.date.localeCompare(b.date));
  const msSoon = (active.flatMap((p) => (p.milestones || []))).filter((m) => m.date >= asOf && m.date <= plus(7));
  const nextMs = evAll.filter((e) => e.date >= asOf).sort((a, b) => a.date.localeCompare(b.date))[0];

  // ---- balance metrics (report month = month of the period end) ----
  const income = dataTx.filter((t) => t.type === "Income");
  const expense = dataTx.filter((t) => t.type === "Expense");
  const balance = sumTx(income) - sumTx(expense);
  const rEnd = new Date(end + "T00:00:00"); const by = rEnd.getFullYear(), bm = rEnd.getMonth();
  const mInc = income.filter((t) => inPeriod(t, "Monthly", by, bm)); const mExp = expense.filter((t) => inPeriod(t, "Monthly", by, bm));
  const monthIncome = sumTx(mInc), monthExpense = sumTx(mExp);
  const incByCat = INCOME_CATS.map((c, i) => ({ name: c, value: groupSum(mInc, (t) => t.category)[c] || 0, fill: CAT_COLORS[i] }));
  const expByPur = EXP_PURCHASE.map((c, i) => ({ name: c, value: groupSum(mExp, (t) => t.category)[c] || 0, fill: CAT_COLORS[i] }));
  const expByWork = EXP_WORK.map((c, i) => ({ name: c, value: groupSum(mExp, (t) => t.workCategory)[c] || 0, fill: CAT_COLORS[i] }));
  const recentTx = dataTx.filter((t) => monthKey(t.date) === `${by}-${String(bm + 1).padStart(2, "0")}`).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const projName = (id) => (dataProjects.find((p) => p.id === id) || {}).name || "—";

  const badge = `${meta.tag}: ${fmtRange(start, end)}`;
  const stampDate = saved ? saved.generatedAt.slice(0, 10) : todayISO();
  const netChange = monthIncome - monthExpense;
  const pctOf = (v, tot) => tot ? Math.round((v / tot) * 100) : 0;
  const statusLbl = (s) => s === "On Progress" ? "In Progress" : (s || "Not Started");
  const statusDot = (s) => s === "Finished" ? C.green : (s === "On Progress" ? C.blue : C.amber);
  const pipelineCols = STATUSES.map((st) => ({ st, items: active.filter((p) => p.status === st) }));
  const byPriority = PRIORITIES.map((pr) => ({ name: pr, items: active.filter((p) => (p.priority || "Moderate") === pr) }));
  const overviewRows = [["Total", active.length, C.blue], ["On Going", cnt("On Going"), C.blue], ["On Review", cnt("On Review"), C.amber], ["Finished", cnt("Finished"), C.green]];
  const catStats = (cat) => {
    const ps = active.filter((p) => p.category === cat);
    const ti = ps.reduce((a, p) => a + totalOf(p), 0), di = ps.reduce((a, p) => a + doneOf(p), 0);
    const open = ps.flatMap((p) => (p.checklist || []).filter((i) => !i.done).map((i) => ({ ...i, project: p })));
    const ms = ps.flatMap((p) => (p.milestones || []).map((m) => ({ ...m, project: p }))).filter((m) => m.date >= asOf).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
    return { ps, total: ps.length, ti, di, pc: ti ? Math.round(di / ti * 100) : 0, open, ns: open.filter((i) => i.status === "Not Started").length,
      pr: PRIORITIES.map((x) => ({ name: x, n: ps.filter((p) => (p.priority || "Moderate") === x).length })), ms };
  };
  // integrated timeline (month columns)
  const tproj2 = active.filter((p) => p.kickoff && p.wrapup);
  let tMin = 0, tMax = 1, tMonths = [];
  if (tproj2.length) {
    const ts = tproj2.flatMap((p) => [new Date(p.kickoff + "T00:00:00").getTime(), new Date(p.wrapup + "T00:00:00").getTime()]);
    const lo = new Date(Math.min(...ts)); lo.setDate(1); lo.setHours(0, 0, 0, 0);
    const hiEnd = new Date(Math.max(...ts)); tMin = lo.getTime();
    let d = new Date(lo); while (d <= hiEnd && tMonths.length < 7) { tMonths.push(new Date(d)); d.setMonth(d.getMonth() + 1); }
    const last = new Date(tMonths[tMonths.length - 1]); last.setMonth(last.getMonth() + 1); tMax = last.getTime();
  }
  const tpos = (t) => tMax > tMin ? ((t - tMin) / (tMax - tMin)) * 100 : 0;
  const CAT_ICON = { "Project": Calendar, "Research": Search, "Training": UsersRound };

  const PageHead = ({ suffix }) => (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
      <div>
        <h1 className="disp" style={{ margin: 0, fontSize: 26, letterSpacing: -0.5 }}>{meta.title}{suffix}</h1>
        <div style={{ fontSize: 12, color: C.muted, margin: "5px 0 9px" }}>Generated on {prettyDate(stampDate)}</div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.blue, color: "#fff", borderRadius: 9, padding: "6px 13px", fontSize: 12.5, fontWeight: 700 }}><Calendar size={13} /> {badge}</span>
      </div>
      <img src={LOGO_SRC} alt="CoRE" style={{ height: 48 }} />
    </div>
  );
  const box = { background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 14 };
  const th = { textAlign: "left", fontSize: 10, color: C.muted, fontWeight: 700, padding: "7px 9px", borderBottom: `1px solid ${C.line}`, textTransform: "uppercase", letterSpacing: 0.5 };
  const td = { fontSize: 11, padding: "7px 9px", borderBottom: `1px solid ${C.lineSoft}`, verticalAlign: "top" };

  // mini gantt fit
  const tproj = active.filter((p) => p.kickoff && p.wrapup);
  let gantt = null;
  if (tproj.length) {
    const all = tproj.flatMap((p) => [new Date(p.kickoff + "T00:00:00").getTime(), new Date(p.wrapup + "T00:00:00").getTime()]);
    const gmin = Math.min(...all), gmax = Math.max(...all), gspan = Math.max(1, gmax - gmin);
    const gpos = (t) => ((t - gmin) / gspan) * 100;
    const gmonths = []; let dd = new Date(gmin); dd.setDate(1); while (dd.getTime() <= gmax) { gmonths.push(new Date(dd)); dd.setMonth(dd.getMonth() + 1); }
    const nowT = Date.now(); const nowP = nowT >= gmin && nowT <= gmax ? gpos(nowT) : null;
    gantt = (
      <div>
        <div style={{ display: "flex", borderBottom: `1px solid ${C.line}`, marginBottom: 2 }}>
          <div style={{ width: 130, flexShrink: 0 }} />
          <div style={{ position: "relative", flex: 1, height: 16 }}>
            {gmonths.map((m, i) => <div key={i} style={{ position: "absolute", left: `${gpos(m.getTime())}%`, fontSize: 8, color: C.muted, borderLeft: `1px solid ${C.lineSoft}`, paddingLeft: 3, height: "100%" }}>{MONTHS[m.getMonth()].slice(0, 3)}</div>)}
          </div>
        </div>
        {tproj.map((p, idx) => { const s = new Date(p.kickoff + "T00:00:00").getTime(), e = new Date(p.wrapup + "T00:00:00").getTime(); const mt = STATUS_META[p.status];
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "center", minHeight: 26, borderTop: idx ? `1px solid ${C.lineSoft}` : "none" }}>
              <div style={{ width: 130, flexShrink: 0, fontSize: 9.5, fontWeight: 700, paddingRight: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
              <div style={{ position: "relative", flex: 1, height: 26 }}>
                {nowP !== null && <div style={{ position: "absolute", left: `${nowP}%`, top: 0, bottom: 0, width: 1, background: C.red }} />}
                <div style={{ position: "absolute", left: `${gpos(s)}%`, width: `${Math.max(1, gpos(e) - gpos(s))}%`, top: 7, height: 11, background: mt.color, borderRadius: 4, opacity: 0.9 }} />
                {(p.milestones || []).map((ms) => { const t = new Date(ms.date + "T00:00:00").getTime(); if (t < gmin || t > gmax) return null;
                  return <div key={ms.id} style={{ position: "absolute", left: `${gpos(t)}%`, top: 9, width: 8, height: 8, background: C.amber, transform: "translateX(-50%) rotate(45deg)", border: "1px solid #fff" }} />; })}
              </div>
            </div>
          ); })}
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#14141466", zIndex: 200, overflow: "auto", padding: 20 }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div className="no-print" style={{ display: "flex", gap: 10, marginBottom: 14, position: "sticky", top: 0, flexWrap: "wrap", alignItems: "center" }}>
          <PrimaryButton onClick={doPrint}><Download size={15} /> Save as PDF / Print</PrimaryButton>
          {canNav && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", borderRadius: 10, padding: "4px 6px" }}>
              <IconBtn small onClick={() => setPeriod((p) => shiftPeriod(type, p, -1))}><ChevronLeft size={15} /></IconBtn>
              <span style={{ fontSize: 12, fontWeight: 700, minWidth: 150, textAlign: "center" }}>{fmtRange(start, end)}</span>
              <IconBtn small onClick={() => setPeriod((p) => shiftPeriod(type, p, 1))}><ChevronRight size={15} /></IconBtn>
            </div>
          )}
          {canNav && <GhostButton onClick={saveToHistory}><Archive size={14} /> {saveMsg === "saving" ? "Saving…" : saveMsg === "saved" ? "Saved ✓" : "Save to history"}</GhostButton>}
          <GhostButton onClick={onClose}>Close</GhostButton>
          {saveMsg.startsWith("err:") && <span style={{ background: C.red, color: "#fff", borderRadius: 8, padding: "5px 9px", fontSize: 11, alignSelf: "center" }}>{saveMsg.slice(4)}</span>}
          <span style={{ marginLeft: "auto", color: "#fff", fontSize: 11.5, alignSelf: "center", maxWidth: 320 }}>
            {saved ? "Frozen snapshot from history." : canNav ? "Use ‹ › to view a past period, then Save to freeze it." : "On-demand snapshot."} PDF export needs the deployed site (this in-app preview can't open the print dialog).
          </span>
        </div>

        <div ref={printRef} className="report-print ui" style={{ background: C.bg }}>
          {/* PAGE 1 — operational */}
          <div className="report-page">
            <PageHead suffix="" />
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div style={{ ...box, padding: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textAlign: "center", marginBottom: 8 }}>Project Overview</div>
                {overviewRows.map(([l, v, c]) => (
                  <div key={l} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, padding: "2px 0" }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: c }} /><span style={{ color: C.ink2 }}>{l}</span>
                    <span className="mono" style={{ marginLeft: "auto", fontWeight: 800 }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ ...box, padding: 12, textAlign: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 2 }}>Overall Progress</div>
                <div style={{ display: "grid", placeItems: "center" }}><GaugeRing pct={pct} size={62} /></div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{doneItems} / {totalItems} to-dos done</div>
              </div>
              <div style={{ ...box, padding: 12, textAlign: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>Open To-Dos</div>
                <div className="disp" style={{ fontSize: 34, lineHeight: 1 }}>{openTasks.length}</div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 8 }}>{notStarted} not started</div>
              </div>
              <div style={{ ...box, padding: 12, textAlign: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>Upcoming Milestones</div>
                <div className="disp" style={{ fontSize: 34, lineHeight: 1 }}>{msSoon.length}</div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 8 }}>{nextMs ? `Next: ${nextMs.date}` : "—"}</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div style={{ ...box, padding: 12 }}>
                <SectionTitleR>Pipeline by Status</SectionTitleR>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
                  {pipelineCols.map(({ st, items }) => { const mt = STATUS_META[st]; return (
                    <div key={st} style={{ border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden" }}>
                      <div style={{ textAlign: "center", padding: "6px 3px", background: mt.soft }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: mt.color }}>{st}</div>
                        <div className="disp" style={{ fontSize: 17 }}>{items.length}</div>
                      </div>
                      <div style={{ padding: 6, display: "grid", gap: 4, minHeight: 74 }}>
                        {items.slice(0, 5).map((p) => <div key={p.id} style={{ fontSize: 8, color: C.ink2, lineHeight: 1.25 }}>• {p.name}</div>)}
                      </div>
                    </div>
                  ); })}
                </div>
              </div>
              <div style={{ ...box, padding: 12 }}>
                <SectionTitleR>Priority Summary</SectionTitleR>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
                  {byPriority.map(({ name, items }) => { const m = PRIORITY_META[name]; const hot = name === "Critical" || name === "Urgent"; const top = items[0]; return (
                    <div key={name} style={{ border: `1px solid ${hot ? m.color : C.line}`, borderRadius: 8, padding: 7, background: hot ? m.soft : "#fff", minHeight: 108 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: m.color }} /><span style={{ fontSize: 9.5, fontWeight: 700, color: m.color }}>{name}</span></div>
                      <div style={{ fontSize: 8.5, color: C.muted, marginBottom: 4 }}>{items.length} project{items.length !== 1 ? "s" : ""}</div>
                      {hot ? (items.length ? (
                        <div style={{ fontSize: 8, lineHeight: 1.35, display: "grid", gap: 2 }}>
                          {items.slice(0, 6).map((p) => <div key={p.id} style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>• {p.name}</div>)}
                          {items.length > 6 && <div style={{ color: C.muted }}>+{items.length - 6} more</div>}
                        </div>
                      ) : <div style={{ fontSize: 8, color: C.faint }}>None</div>) : null}
                    </div>
                  ); })}
                </div>
                <div style={{ fontSize: 8, color: C.muted, fontStyle: "italic", marginTop: 6 }}>Projects labeled Critical and Urgent notify all Members.</div>
              </div>
            </div>

            <div style={{ ...box, padding: 12, marginBottom: 12 }}>
              <SectionTitleR>Outstanding / Unresolved To-Dos</SectionTitleR>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>{["Task", "Project", "Assignee", "Due Date", "Status"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {openTasks.slice(0, 8).map((i) => (
                    <tr key={i.id}>
                      <td style={td}>{i.text}</td><td style={td}>{i.project.name}</td><td style={td}>{i.assignee === "All" ? "All" : i.assignee}</td><td style={td}>{i.dueDate || "—"}</td>
                      <td style={td}><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: statusDot(i.status) }} />{statusLbl(i.status)}</span></td>
                    </tr>
                  ))}
                  {Array.from({ length: Math.max(0, 8 - openTasks.length) }).map((_, k) => (<tr key={"e" + k}><td style={td}><span style={{ width: 9, height: 9, border: `1px solid ${C.line}`, borderRadius: "50%", display: "inline-block" }} /></td><td style={td} /><td style={td} /><td style={td} /><td style={td} /></tr>))}
                </tbody>
              </table>
            </div>

            <div style={{ ...box, padding: 12, marginBottom: 12 }}>
              <SectionTitleR>Integrated Project Timeline</SectionTitleR>
              {tproj2.length === 0 ? <div style={{ fontSize: 10, color: C.muted }}>No dated projects.</div> : (
                <div>
                  <div style={{ display: "flex", borderBottom: `1px solid ${C.line}`, paddingBottom: 3, marginBottom: 4 }}>
                    <div style={{ width: 150, flexShrink: 0, fontSize: 9, fontWeight: 700, color: C.muted }}>Project</div>
                    <div style={{ position: "relative", flex: 1, height: 12 }}>
                      {tMonths.map((m, i) => <span key={i} style={{ position: "absolute", left: `${tpos(m.getTime())}%`, fontSize: 8.5, fontWeight: 700, color: C.muted }}>{MONTHS[m.getMonth()].slice(0, 3)} {m.getFullYear()}</span>)}
                    </div>
                  </div>
                  {tproj2.map((p) => { const s = new Date(p.kickoff + "T00:00:00").getTime(), e = new Date(p.wrapup + "T00:00:00").getTime(); const col = CATEGORY_COLOR[p.category] || C.blue; return (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", minHeight: 21 }}>
                      <div style={{ width: 150, flexShrink: 0, fontSize: 8.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingRight: 4 }}>{p.name}</div>
                      <div style={{ position: "relative", flex: 1, height: 16 }}>
                        <div style={{ position: "absolute", left: 0, right: 0, top: 7, height: 3, background: C.lineSoft, borderRadius: 2 }} />
                        <div style={{ position: "absolute", left: `${tpos(s)}%`, width: `${Math.max(2, tpos(e) - tpos(s))}%`, top: 4, height: 9, background: col, borderRadius: 5 }} />
                      </div>
                    </div>
                  ); })}
                </div>
              )}
            </div>

            <div style={{ ...box, padding: 12, marginBottom: 10 }}>
              <SectionTitleR>Upcoming Events (Next 14 Days)</SectionTitleR>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>{["Date", "Event", "Project", "PIC"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {in14.slice(0, 5).map((e, i) => (<tr key={i}><td style={td}>{e.date}</td><td style={td}>{e.kind}</td><td style={td}>{e.project.name}</td><td style={td}>{e.project.pic || "—"}</td></tr>))}
                  {Array.from({ length: Math.max(0, 3 - in14.length) }).map((_, k) => (<tr key={"e" + k}><td style={td}><span style={{ width: 9, height: 9, border: `1px solid ${C.line}`, borderRadius: "50%", display: "inline-block" }} /></td><td style={td} /><td style={td} /><td style={td} /></tr>))}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 8, color: C.faint }}>{meta.note}</div>
          </div>

          {/* PAGE 2 — details by work category */}
          <div className="report-page">
            <PageHead suffix="" />
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>Details by Work Category</div>
            {CATEGORIES.map((cat) => { const s = catStats(cat); const col = CATEGORY_COLOR[cat]; const Icon = CAT_ICON[cat] || Calendar; return (
              <div key={cat} style={{ ...box, padding: 12, marginBottom: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1fr 1fr 1fr 1.1fr", gap: 8, alignItems: "stretch", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 34, height: 34, borderRadius: 9, background: col + "1A", display: "grid", placeItems: "center" }}><Icon size={17} color={col} /></span>
                    <div><div className="disp" style={{ fontSize: 16, color: col }}>{cat}</div><div style={{ fontSize: 9.5, color: C.muted }}>{s.total} work{s.total !== 1 ? "s" : ""}</div></div>
                  </div>
                  <div style={{ ...box, padding: 8, textAlign: "center" }}><div style={{ fontSize: 9, color: C.muted }}>Project Overview</div><div className="disp" style={{ fontSize: 22 }}>{s.total}</div><div style={{ fontSize: 8, color: C.muted }}>Total work{s.total !== 1 ? "s" : ""}</div></div>
                  <div style={{ ...box, padding: 8, textAlign: "center" }}><div style={{ fontSize: 9, color: C.muted }}>Overall Progress</div><div style={{ display: "grid", placeItems: "center" }}><GaugeRing pct={s.pc} size={46} /></div><div style={{ fontSize: 7.5, color: C.muted }}>{s.di} / {s.ti} to-dos done</div></div>
                  <div style={{ ...box, padding: 8, textAlign: "center" }}><div style={{ fontSize: 9, color: C.muted }}>Open To-Dos</div><div className="disp" style={{ fontSize: 22 }}>{s.open.length}</div><div style={{ fontSize: 8, color: C.muted }}>{s.ns} not started</div></div>
                  <div style={{ ...box, padding: 8 }}><div style={{ fontSize: 9, color: C.muted, textAlign: "center", marginBottom: 3 }}>Priority Summary</div>
                    {s.pr.map((x) => { const m = PRIORITY_META[x.name]; return <div key={x.name} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9, padding: "1px 0" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: m.color }} /><span>{x.name}</span><span className="mono" style={{ marginLeft: "auto", fontWeight: 700 }}>{x.n}</span></div>; })}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 9.5, fontWeight: 700, marginBottom: 4 }}>Outstanding / Unresolved To-Dos</div>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead><tr>{["Task", "Project", "Assignee", "Due Date", "Status"].map((h) => <th key={h} style={{ ...th, fontSize: 8, padding: "4px 5px" }}>{h}</th>)}</tr></thead>
                      <tbody>
                        {s.open.slice(0, 6).map((i) => (<tr key={i.id}><td style={{ ...td, fontSize: 8.5, padding: "4px 5px" }}>{i.text}</td><td style={{ ...td, fontSize: 8.5, padding: "4px 5px" }}>{i.project.name}</td><td style={{ ...td, fontSize: 8.5, padding: "4px 5px" }}>{i.assignee === "All" ? "All" : i.assignee}</td><td style={{ ...td, fontSize: 8.5, padding: "4px 5px" }}>{i.dueDate || "—"}</td><td style={{ ...td, fontSize: 8.5, padding: "4px 5px" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: statusDot(i.status) }} />{statusLbl(i.status)}</span></td></tr>))}
                        {Array.from({ length: Math.max(0, 3 - s.open.length) }).map((_, k) => (<tr key={"e" + k}><td style={{ ...td, fontSize: 8.5, padding: "4px 5px", color: C.faint }}>—</td><td style={{ ...td, padding: "4px 5px", color: C.faint }}>—</td><td style={{ ...td, padding: "4px 5px", color: C.faint }}>—</td><td style={{ ...td, padding: "4px 5px", color: C.faint }}>—</td><td style={{ ...td, padding: "4px 5px", color: C.faint }}>—</td></tr>))}
                      </tbody>
                    </table>
                  </div>
                  <div>
                    <div style={{ fontSize: 9.5, fontWeight: 700, marginBottom: 6 }}>Next Milestones</div>
                    {s.ms.length === 0 ? <div style={{ fontSize: 9, color: C.faint }}>None upcoming.</div> : s.ms.map((m, i) => { const dot = [C.green, C.blue, C.amber, C.violet][i % 4]; return (
                      <div key={i} style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot, marginTop: 3, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, fontWeight: 700, gap: 6 }}><span>{m.name}</span><span style={{ color: C.muted, whiteSpace: "nowrap" }}>{m.date}</span></div><div style={{ fontSize: 8.5, color: C.blue }}>{m.project.name}</div></div>
                      </div>
                    ); })}
                  </div>
                </div>
              </div>
            ); })}
            <div style={{ fontSize: 8, color: C.faint }}>{meta.note}</div>
          </div>

          {/* PAGE 3 — balance */}
          <div className="report-page">
            <PageHead suffix=" - Balance" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 12 }}>
              {[
                { t: "Current Balance", v: fmtRp(balance), sub: `As of ${end}`, icon: Wallet, tone: C.blue, val: C.ink },
                { t: "This Month Income", v: fmtRp(monthIncome), sub: "Total income received", icon: ArrowUpRight, tone: C.green, val: C.green },
                { t: "This Month Expense", v: fmtRp(monthExpense), sub: "Total expenses paid", icon: ArrowDownRight, tone: C.red, val: C.red },
                { t: "Net Change", v: `${netChange >= 0 ? "+" : ""}${fmtRp(netChange)}`, sub: "Income minus expense", icon: TrendingUp, tone: C.green, val: C.green },
              ].map((c, i) => (
                <div key={i} style={{ ...box, padding: "12px 8px", textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 6 }}>{c.t}</div>
                  <span style={{ width: 26, height: 26, borderRadius: "50%", background: c.tone + "1A", display: "inline-grid", placeItems: "center", marginBottom: 5 }}><c.icon size={14} color={c.tone} /></span>
                  <div className="disp" style={{ fontSize: 13.5, color: c.val, whiteSpace: "nowrap" }}>{c.v}</div>
                  <div style={{ fontSize: 8.5, color: C.muted, marginTop: 5 }}>{c.sub}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div style={{ ...box, padding: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 2 }}>Income vs Expense ({MONTHS[bm].slice(0, 3)} {by})</div>
                <div style={{ display: "flex", gap: 14, justifyContent: "center", fontSize: 9, marginBottom: 2 }}><span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, background: C.green, borderRadius: 2 }} />Income (Rp)</span><span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, background: C.red, borderRadius: 2 }} />Expense (Rp)</span></div>
                <div style={{ height: 148 }}><ResponsiveContainer>
                  <BarChart data={[{ name: "Income", value: monthIncome }, { name: "Expense", value: monthExpense }]} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => v >= 1e6 ? `${v / 1e6}M` : v} tick={{ fontSize: 8, fill: C.muted }} axisLine={false} tickLine={false} />
                    <Bar dataKey="value" radius={[5, 5, 0, 0]} label={{ position: "top", formatter: (v) => fmtRp(v), fontSize: 9, fill: C.ink }}><Cell fill={C.green} /><Cell fill={C.red} /></Bar>
                  </BarChart>
                </ResponsiveContainer></div>
              </div>
              <div style={{ ...box, padding: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>Income by Category ({MONTHS[bm].slice(0, 3)} {by})</div>
                <DonutBlock data={incByCat} total={monthIncome} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div style={{ ...box, padding: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>Expense by Purchase Category ({MONTHS[bm].slice(0, 3)} {by})</div>
                <DonutBlock data={expByPur} total={monthExpense} />
              </div>
              <div style={{ ...box, padding: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 2 }}>Expense by Work Category ({MONTHS[bm].slice(0, 3)} {by})</div>
                <div style={{ fontSize: 9, textAlign: "center", marginBottom: 6 }}><span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, background: C.blue, borderRadius: 2 }} />Amount (Rp)</span></div>
                {monthExpense === 0 ? <div style={{ fontSize: 10, color: C.muted }}>No data</div> : expByWork.map((r) => { const mx = Math.max(...expByWork.map((x) => x.value), 1); return (
                  <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <span style={{ width: 52, fontSize: 9, color: C.ink2 }}>{r.name}</span>
                    <div style={{ flex: 1, height: 12, background: C.lineSoft, borderRadius: 3 }}><div style={{ width: `${(r.value / mx) * 100}%`, height: "100%", background: C.blue, borderRadius: 3 }} /></div>
                    <span className="mono" style={{ fontSize: 8.5, color: C.ink2, whiteSpace: "nowrap" }}>{fmtRp(r.value)}</span>
                  </div>
                ); })}
              </div>
            </div>
            <div style={{ ...box, padding: 12, marginBottom: 10 }}>
              <SectionTitleR>Recent Transactions ({MONTHS[bm].slice(0, 3)} {by})</SectionTitleR>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>{["Date", "Project", "Description", "Type", "Category", "Amount (Rp)", "Account", "Method", "Receipt"].map((h) => <th key={h} style={{ ...th, fontSize: 8, padding: "5px 5px" }}>{h}</th>)}</tr></thead>
                <tbody>
                  {recentTx.map((t) => (<tr key={t.id}>
                    <td style={{ ...td, fontSize: 8.5, padding: "5px 5px" }}>{t.date}</td>
                    <td style={{ ...td, fontSize: 8.5, padding: "5px 5px" }}>{projName(t.projectId)}</td>
                    <td style={{ ...td, fontSize: 8.5, padding: "5px 5px" }}>{t.description}</td>
                    <td style={{ ...td, fontSize: 8.5, padding: "5px 5px", color: t.type === "Income" ? C.green : C.red, fontWeight: 700 }}>{t.type}</td>
                    <td style={{ ...td, fontSize: 8.5, padding: "5px 5px" }}>{t.category}</td>
                    <td style={{ ...td, fontSize: 8.5, padding: "5px 5px", color: t.type === "Income" ? C.green : C.red, fontWeight: 700 }}>{fmtRp(t.amount)}</td>
                    <td style={{ ...td, fontSize: 8.5, padding: "5px 5px" }}>{t.account === "Others" ? t.accountOther : t.account}</td>
                    <td style={{ ...td, fontSize: 8.5, padding: "5px 5px" }}>{t.method}</td>
                    <td style={{ ...td, fontSize: 8.5, padding: "5px 5px" }}>{t.receipt ? <span style={{ color: C.blue }}>{t.receipt.name || "receipt"}</span> : "—"}</td>
                  </tr>))}
                  {recentTx.length === 0 && <tr><td style={td} colSpan={9}>No transactions.</td></tr>}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 8, color: C.faint }}>Note: Balance is evaluated at the account level overall. Category analytics reflect transactions recorded in {MONTHS[bm]} {by}.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
function SectionTitleR({ children }) { return <div style={{ fontSize: 11.5, fontWeight: 800, color: C.ink, margin: "4px 0 8px", textTransform: "uppercase", letterSpacing: 0.5 }}>{children}</div>; }
function GaugeRing({ pct, size = 60 }) {
  const r = 40, CC = 2 * Math.PI * r, arc = 0.75 * CC, prog = arc * (Math.max(0, Math.min(100, pct)) / 100);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={r} fill="none" stroke={C.lineSoft} strokeWidth="11" strokeLinecap="round" strokeDasharray={`${arc} ${CC}`} transform="rotate(135 50 50)" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={C.blue} strokeWidth="11" strokeLinecap="round" strokeDasharray={`${prog} ${CC}`} transform="rotate(135 50 50)" />
      <text x="50" y="59" textAnchor="middle" style={{ fontSize: 25, fontWeight: 800, fill: C.ink }}>{pct}%</text>
    </svg>
  );
}

/* ------------------------------ Dashboard ------------------------------ */
function PriorityPanel({ byPriority, onOpen }) {
  const isMobile = useIsMobile();
  return (
    <Card style={{ padding: 18, marginBottom: 22 }}>
      <ChartTitle>Works by priority</ChartTitle>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 12 }}>
        {byPriority.map(({ name, items }) => {
          const meta = PRIORITY_META[name]; const hot = name === "Critical" || name === "Urgent";
          return (
            <div key={name} style={{ border: `1px solid ${hot ? meta.color : C.line}`, borderRadius: 12, padding: 12, background: hot ? meta.soft : "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: meta.color }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: meta.color }}>{name}</span>
                <span className="mono" style={{ marginLeft: "auto", fontSize: 15, fontWeight: 800 }}>{items.length}</span>
              </div>
              {hot ? (
                items.length > 0 ? (
                  <div style={{ marginTop: 8, display: "grid", gap: 4 }}>
                    {items.slice(0, 4).map((p) => (
                      <button key={p.id} onClick={() => onOpen(p.id)} title={`${p.status}${p.subStatus ? " · " + p.subStatus : ""}`} style={{ ...linkBtn, fontSize: 11.5, color: C.ink, textAlign: "left", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>• {p.name}</button>
                    ))}
                    {items.length > 4 && <span style={{ fontSize: 10.5, color: C.muted }}>+{items.length - 4} more</span>}
                  </div>
                ) : <div style={{ marginTop: 8, fontSize: 11, color: C.faint }}>None</div>
              ) : <div style={{ marginTop: 6, fontSize: 10.5, color: C.muted }}>{items.length === 1 ? "project" : "projects"}</div>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function WorkAnalytics({ state, projects, update, currentUser, setTab, showCategory = true }) {
  const { invoices, members } = state;
  const isMobile = useIsMobile();
  const [detail, setDetail] = useState(null);
  const [dragCol, setDragCol] = useState(null);
  const active = projects.filter((p) => !p.archived);
  const archivedCount = projects.filter((p) => p.archived).length;
  const byCategory = CATEGORIES.map((c) => ({ name: c, value: active.filter((p) => p.category === c).length }));
  const byStatus = STATUSES.map((s) => ({ name: s, value: active.filter((p) => p.status === s).length }));
  const maxStatus = Math.max(1, ...byStatus.map((s) => s.value));
  const totalDone = active.reduce((a, p) => a + doneOf(p), 0);
  const totalItems = active.reduce((a, p) => a + totalOf(p), 0);
  const todoPct = totalItems ? Math.round((totalDone / totalItems) * 100) : 0;
  const byPriority = PRIORITIES.map((pr) => ({ name: pr, items: active.filter((p) => (p.priority || "Moderate") === pr) }));

  const moveStatus = (id, status) => update((prev) => {
    const p = prev.projects.find((x) => x.id === id); if (!p) return {};
    const upd = withStatusMeta({ ...p, status, updatedAt: todayISO() });
    const notifs = notifyTargets(upd, prev.members).map((m) => mkNotif(m, "status_change", `${currentUser} moved “${p.name}” to ${status}`, id));
    return { projects: prev.projects.map((x) => x.id === id ? upd : x), notifications: [...notifs, ...prev.notifications] };
  });

  const cols = showCategory ? (isMobile ? "1fr" : "1.1fr 0.9fr 1fr") : (isMobile ? "1fr" : "0.9fr 1.2fr");
  return (
    <>
      <div style={{ background: C.tint, borderRadius: 20, padding: isMobile ? 18 : 24, marginBottom: 16,
        display: "grid", gridTemplateColumns: cols, gap: isMobile ? 22 : 24, alignItems: "center" }}>
        {showCategory && (
          <div>
            <PanelTitle>Works by category</PanelTitle>
            {active.length === 0 ? <NoData /> : (
              <div style={{ height: 140 }}>
                <ResponsiveContainer>
                  <BarChart data={byCategory} margin={{ top: 5, right: 6, left: -22, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: "#00000008" }} contentStyle={{ borderRadius: 10, border: `1px solid ${C.line}`, fontSize: 12 }} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={42}>{byCategory.map((d) => <Cell key={d.name} fill={CATEGORY_COLOR[d.name]} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
        <div style={{ display: "grid", placeItems: "center" }}>
          <Gauge value={todoPct} />
          <div style={{ fontSize: 12.5, color: C.ink2, marginTop: 2, fontWeight: 600 }}>Outputs completed</div>
          <div className="mono" style={{ fontSize: 12, color: C.muted }}>{totalDone} / {totalItems} to-dos done</div>
        </div>
        <div>
          <PanelTitle>Works by status</PanelTitle>
          <div style={{ display: "grid", gap: 10 }}>
            {byStatus.map((s) => {
              const subs = (SUB_STATUS[s.name] || []).map((ss) => ({ ss, n: active.filter((p) => p.status === s.name && p.subStatus === ss).length })).filter((x) => x.n > 0);
              return (
                <div key={s.name}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 74, fontSize: 12, color: C.ink2 }}>{s.name}</span>
                    <span style={{ flex: 1, height: 8, background: "#fff", borderRadius: 5, overflow: "hidden" }}>
                      <span style={{ display: "block", width: `${(s.value / maxStatus) * 100}%`, height: "100%", background: STATUS_META[s.name].color, borderRadius: 5 }} />
                    </span>
                    <span className="mono" style={{ fontSize: 13, width: 20, textAlign: "right" }}>{s.value}</span>
                  </div>
                  {subs.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, margin: "5px 0 0 84px" }}>
                      {subs.map((x) => <span key={x.ss} style={{ fontSize: 10, color: STATUS_META[s.name].color, background: STATUS_META[s.name].soft, borderRadius: 20, padding: "1px 8px" }}>{x.ss} · {x.n}</span>)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16, paddingTop: 14, borderTop: `1px solid #ffffff` }}>
            <button onClick={() => setTab && setTab("invoicing")} style={{ flex: 1, textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer" }}>
              <div className="disp" style={{ fontSize: 27 }}>{invoices.length}</div>
              <div style={{ fontSize: 11.5, color: C.muted }}>Invoices generated</div>
            </button>
            <div style={{ flex: 1, textAlign: "left" }}>
              <div className="disp" style={{ fontSize: 27 }}>{archivedCount}</div>
              <div style={{ fontSize: 11.5, color: C.muted, display: "inline-flex", alignItems: "center", gap: 4 }}><Archive size={11} /> Archived</div>
            </div>
          </div>
        </div>
      </div>

      <PriorityPanel byPriority={byPriority} onOpen={(id) => setDetail(id)} />

      <div style={{ marginBottom: 22 }}><EventCalendar projects={projects} onOpenProject={(id) => setDetail(id)} /></div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h2 className="disp" style={{ fontSize: 17, margin: 0 }}>Pipeline</h2>
        <span style={{ fontSize: 12, color: C.muted }}>{isMobile ? "Swipe columns →" : "Drag cards between stages"}</span>
      </div>
      <div style={{ display: "grid", gridAutoFlow: isMobile ? "column" : "unset", gridAutoColumns: isMobile ? "80%" : "unset",
        gridTemplateColumns: isMobile ? "unset" : "repeat(4, 1fr)", gap: 12, overflowX: isMobile ? "auto" : "visible",
        paddingBottom: isMobile ? 8 : 0, scrollSnapType: isMobile ? "x mandatory" : "none" }}>
        {STATUSES.map((st) => {
          const items = active.filter((p) => p.status === st); const meta = STATUS_META[st];
          return (
            <div key={st} onDragOver={(e) => { e.preventDefault(); setDragCol(st); }} onDragLeave={() => setDragCol(null)}
              onDrop={(e) => { const id = e.dataTransfer.getData("id"); if (id) moveStatus(id, st); setDragCol(null); }}
              className={dragCol === st ? "drag-over" : ""}
              style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 11, minHeight: 130, scrollSnapAlign: "start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 6px 11px" }}>
                <span style={{ width: 8, height: 8, borderRadius: 3, background: meta.color }} />
                <span style={{ fontSize: 13, fontWeight: 700 }}>{st}</span>
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

      {detail && <ProjectDetail project={projects.find((p) => p.id === detail)} state={state} update={update} currentUser={currentUser} onClose={() => setDetail(null)} />}
    </>
  );
}

function Dashboard({ state, update, currentUser, setTab }) {
  const [report, setReport] = useState(null);
  return (
    <div className="fade">
      <Header title="Dashboard" />
      <ReportBar onGenerate={setReport} />
      <Announcements state={state} update={update} currentUser={currentUser} />
      <WorkAnalytics state={state} projects={state.projects} update={update} currentUser={currentUser} setTab={setTab} showCategory />
      {state.projects.length === 0 && <div style={{ marginTop: 20, textAlign: "center" }}><button onClick={() => setTab("projects")} style={linkBtn}>Add your first project <ChevronRight size={14} /></button></div>}
      {report && <ReportOverlay type={report} state={state} currentUser={currentUser} onSave={(r) => update((prev) => ({ reports: [r, ...(prev.reports || [])] }))} onClose={() => setReport(null)} />}
    </div>
  );
}

function CategorySubpage({ category, state, update, currentUser, setTab }) {
  const projects = state.projects.filter((p) => p.category === category);
  return (
    <div className="fade">
      <Header title={category} sub={`Analytics & projects for the ${category} work category`} />
      <WorkAnalytics state={state} projects={projects} update={update} currentUser={currentUser} setTab={setTab} showCategory={false} />
      <div style={{ marginTop: 26 }}>
        <SectionLabel>{category} projects</SectionLabel>
        <ProjectList state={state} update={update} currentUser={currentUser} category={category} />
      </div>
    </div>
  );
}

function KanbanCard({ p, members, onClick }) {
  const prog = progressOf(p);
  return (
    <div draggable onDragStart={(e) => e.dataTransfer.setData("id", p.id)} onClick={onClick}
      style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 12, cursor: "pointer", boxShadow: "0 1px 2px #0000000a" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>{p.name}</div>
          {p.client && <div style={{ fontSize: 11.5, color: C.blue, marginTop: 2 }}>{p.client}</div>}
        </div>
        <span style={{ fontSize: 9.5, color: C.muted, border: `1px solid ${C.line}`, borderRadius: 5, padding: "1px 5px", whiteSpace: "nowrap" }}>{p.category}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
        <PriorityChip priority={p.priority} small />
        {p.subStatus && <span style={{ fontSize: 9.5, color: STATUS_META[p.status].color }}>{p.subStatus}</span>}
      </div>
      {totalOf(p) > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ height: 5, background: C.lineSoft, borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${prog}%`, height: "100%", background: prog === 100 ? C.green : C.blue }} /></div>
          <div style={{ fontSize: 10.5, color: C.muted, marginTop: 4 }}>{prog}% · {doneOf(p)}/{totalOf(p)} done</div>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
        {p.wrapup && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, color: C.muted }}><Calendar size={11} /> {p.wrapup}</span>}
        <div style={{ marginLeft: "auto", display: "flex" }}>
          {[p.pic, ...(p.collaborators || [])].filter(Boolean).slice(0, 3).map((m, i) => (
            <div key={m + i} style={{ marginLeft: i ? -7 : 0, border: "2px solid #fff", borderRadius: "50%" }}><Avatar name={m} members={members} size={22} /></div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Gauge({ value }) {
  const r = 62, cx = 78, cy = 78, ticks = 44;
  return (
    <svg width="156" height="90" viewBox="0 0 156 90">
      {Array.from({ length: ticks }).map((_, i) => {
        const a = Math.PI * (i / (ticks - 1)); const on = (i / (ticks - 1)) * 100 <= value;
        const x1 = cx - r * Math.cos(a), y1 = cy - r * Math.sin(a), x2 = cx - (r - 12) * Math.cos(a), y2 = cy - (r - 12) * Math.sin(a);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={on ? C.blue : C.line} strokeWidth={2.5} strokeLinecap="round" />;
      })}
      <text x={cx} y={cy - 8} textAnchor="middle" className="disp" style={{ fontSize: 26, fill: C.ink }}>{value}%</text>
    </svg>
  );
}

/* ------------------------------ Projects ------------------------------ */
function ProjectList({ state, update, currentUser, category }) {
  const { projects, members } = state;
  const [q, setQ] = useState(""); const [fCat, setFCat] = useState("All"); const [fStat, setFStat] = useState("All");
  const [editing, setEditing] = useState(null); const [detail, setDetail] = useState(null);
  const filtered = projects.filter((p) => {
    if (p.archived) return false;
    if (category && p.category !== category) return false;
    if (!category && fCat !== "All" && p.category !== fCat) return false;
    if (fStat !== "All" && p.status !== fStat) return false;
    if (q && !(`${p.name} ${p.client} ${p.description} ${p.source} ${p.pic}`.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  });
  const save = (proj) => {
    update((prev) => {
      const old = prev.projects.find((p) => p.id === proj.id);
      const exists = !!old; const base = old || {};
      const id = exists ? proj.id : uid();
      const merged = withStatusMeta({ ...base, ...proj, id, createdAt: base.createdAt || todayISO(), updatedAt: todayISO() });
      const before = exists ? assigneesOf(base) : [];
      const recipients = notifyTargets(merged, prev.members);
      const added = recipients.filter((m) => !before.includes(m));
      const notifs = added.map((m) => mkNotif(m, "assigned_project",
        isHotPriority(merged) ? `${currentUser} flagged “${merged.name}” as ${merged.priority}` : `${currentUser} added you to “${merged.name}” as ${m === merged.pic ? "PIC" : "collaborator"}`, id));
      if (exists && base.status !== merged.status) recipients.forEach((m) => notifs.push(mkNotif(m, "status_change", `${currentUser} moved “${merged.name}” to ${merged.status}`, id)));
      const projects = exists ? prev.projects.map((p) => p.id === id ? merged : p) : [merged, ...prev.projects];
      return { projects, notifications: [...notifs, ...prev.notifications] };
    });
    setEditing(null);
  };
  const remove = (id) => update((prev) => ({ projects: prev.projects.filter((p) => p.id !== id) }));
  const archive = (id) => update((prev) => ({ projects: prev.projects.map((p) => p.id === id ? { ...p, archived: true, archivedAt: todayISO() } : p) }));
  const unarchive = (id) => update((prev) => ({ projects: prev.projects.map((p) => p.id === id ? { ...p, archived: false, archivedAt: "", finishedAt: p.status === "Finished" ? todayISO() : p.finishedAt } : p) }));
  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 180 }}>
          <Search size={15} color={C.muted} style={{ position: "absolute", left: 12, top: 12 }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${category || "projects"}…`} style={{ ...inputStyle, paddingLeft: 34 }} />
        </div>
        {!category && <Select value={fCat} onChange={setFCat} options={["All", ...CATEGORIES]} compact />}
        <Select value={fStat} onChange={setFStat} options={["All", ...STATUSES]} compact />
        <PrimaryButton onClick={() => setEditing({})}><Plus size={16} /> New project</PrimaryButton>
      </div>
      {filtered.length === 0 ? <EmptyState label={projects.filter((p) => !p.archived && (!category || p.category === category)).length === 0 ? `No active ${category || "project"}s yet.` : "No projects match your filters."} cta={{ label: "New project", onClick: () => setEditing({}) }} />
        : <div style={{ display: "grid", gap: 10 }}>{filtered.map((p) => <ProjectRow key={p.id} p={p} members={members} onOpen={() => setDetail(p.id)} onEdit={() => setEditing(p)} onDelete={() => remove(p.id)} onArchive={() => archive(p.id)} onUnarchive={() => unarchive(p.id)} />)}</div>}
      {editing && <ProjectModal project={editing} members={members} currentUser={currentUser} lockCategory={category} onSave={save} onClose={() => setEditing(null)} />}
      {detail && <ProjectDetail project={projects.find((p) => p.id === detail)} state={state} update={update} currentUser={currentUser} onClose={() => setDetail(null)} onEdit={() => { const p = projects.find((x) => x.id === detail); setDetail(null); setEditing(p); }} />}
    </div>
  );
}

function Projects({ state, update, currentUser, setTab }) {
  const { projects } = state;
  const active = projects.filter((p) => !p.archived);
  return (
    <div className="fade">
      <Header title="Projects" sub={`${active.length} active works tracked`} />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        {CATEGORIES.map((c) => {
          const n = active.filter((p) => p.category === c).length;
          return (
            <button key={c} onClick={() => setTab && setTab("cat:" + c)} style={{ flex: "1 1 150px", textAlign: "left", background: "#fff", border: `1px solid ${C.line}`, borderLeft: `3px solid ${CATEGORY_COLOR[c]}`, borderRadius: 14, padding: "13px 16px", cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                <span className="disp" style={{ fontSize: 22 }}>{n}</span>
                <ChevronRight size={16} color={C.muted} style={{ marginLeft: "auto" }} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{c}</div>
              <div style={{ fontSize: 11, color: C.muted }}>Open category page →</div>
            </button>
          );
        })}
      </div>
      <ProjectList state={state} update={update} currentUser={currentUser} />
    </div>
  );
}

function ProjectRow({ p, members, onOpen, onEdit, onDelete, onArchive, onUnarchive }) {
  const [confirm, setConfirm] = useState(false); const prog = progressOf(p);
  return (
    <Card style={{ padding: 15, opacity: p.archived ? 0.72 : 1 }}>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div style={{ width: 4, alignSelf: "stretch", borderRadius: 3, background: CATEGORY_COLOR[p.category] || C.slate }} />
        <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={onOpen}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{p.name}</h3>
            {p.client && <span style={{ fontSize: 12.5, color: C.blue, fontWeight: 600 }}>· {p.client}</span>}
            <StatusPill status={p.status} />
            <SubStatusTag status={p.status} subStatus={p.subStatus} />
            <PriorityChip priority={p.priority} />
            {p.archived && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: C.muted, background: C.slateSoft, borderRadius: 20, padding: "3px 10px" }}><Archive size={12} /> Archived</span>}
            <span style={{ fontSize: 10.5, color: C.muted, border: `1px solid ${C.line}`, borderRadius: 5, padding: "1px 6px" }}>{p.category}</span>
          </div>
          {p.description && <p style={{ margin: "7px 0 0", fontSize: 12.5, color: C.ink2, lineHeight: 1.5, maxWidth: 720, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{p.description}</p>}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10, fontSize: 12, alignItems: "center" }}>
            <Meta label="PIC" value={p.pic || "—"} />
            {(p.collaborators || []).length > 0 && <Meta label="Team" value={`+${p.collaborators.length}`} />}
            {(p.kickoff || p.wrapup) && <Meta label="Timeline" value={`${p.kickoff || "?"} → ${p.wrapup || "?"}`} />}
            {totalOf(p) > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 60, height: 5, background: C.lineSoft, borderRadius: 3, overflow: "hidden", display: "inline-block" }}><span style={{ display: "block", width: `${prog}%`, height: "100%", background: prog === 100 ? C.green : C.blue }} /></span>
              <span style={{ fontSize: 11.5, color: C.muted }}>{prog}%</span></span>}
            {p.dataRoom && <a href={p.dataRoom} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 5, color: C.blue, textDecoration: "none" }}><ExternalLink size={13} /> Data room</a>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {onUnarchive && p.archived && <IconBtn onClick={onUnarchive} title="Unarchive"><ArchiveRestore size={15} /></IconBtn>}
          {onArchive && !p.archived && <IconBtn onClick={onArchive} title="Archive"><Archive size={15} /></IconBtn>}
          {onEdit && <IconBtn onClick={onEdit} title="Edit"><Pencil size={15} /></IconBtn>}
          {onDelete && (confirm ? <button onClick={onDelete} onMouseLeave={() => setConfirm(false)} style={{ ...iconBtnStyle, color: "#fff", background: C.red, borderColor: C.red, width: "auto", padding: "0 10px", fontSize: 11.5 }}>Confirm</button>
            : <IconBtn onClick={() => setConfirm(true)} title="Delete" danger><Trash2 size={15} /></IconBtn>)}
        </div>
      </div>
    </Card>
  );
}

function ProjectModal({ project, members, currentUser, onSave, onClose, lockCategory }) {
  const isMobile = useIsMobile();
  const [f, setF] = useState({
    name: project.name || "", client: project.client || "", category: project.category || lockCategory || "Project",
    status: project.status || "Prospect", subStatus: project.subStatus || "", priority: project.priority || "Moderate",
    source: project.source || "", pic: project.pic || "",
    collaborators: project.collaborators || [], description: project.description || "", dataRoom: project.dataRoom || "",
    kickoff: project.kickoff || "", wrapup: project.wrapup || "", milestones: project.milestones || [], checklist: project.checklist || [],
    id: project.id, createdAt: project.createdAt,
  });
  const setStatus = (v) => setF((p) => ({ ...p, status: v, subStatus: "" }));
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const toggleCollab = (m) => set("collaborators", f.collaborators.includes(m) ? f.collaborators.filter((x) => x !== m) : [...f.collaborators, m]);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const submit = async () => {
    if (!f.name.trim()) { setErr("Please enter a project name."); return; }
    setBusy(true); setErr("");
    try { await onSave(f); } catch (e) { setErr((e && e.message) || "Couldn't save — check your connection and that the database schema is up to date."); setBusy(false); }
  };
  const two = { display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 };
  return (
    <Modal onClose={onClose} title={project.id ? "Edit project" : "New project"} wide>
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.4fr 1fr", gap: 12 }}>
          <Field label="Project name *"><TextInput value={f.name} onChange={(v) => set("name", v)} placeholder="e.g. Coal Royalty Study" autoFocus /></Field>
          <Field label="Client name"><TextInput value={f.client} onChange={(v) => set("client", v)} placeholder="e.g. Ditjen Minerba" /></Field>
        </div>
        <div style={two}>
          <Field label="Category">{lockCategory ? <div style={{ ...inputStyle, background: C.bg, color: C.muted }}>{lockCategory}</div> : <Select value={f.category} onChange={(v) => set("category", v)} options={CATEGORIES} />}</Field>
          <Field label="Priority"><Select value={f.priority} onChange={(v) => set("priority", v)} options={PRIORITIES} /></Field>
        </div>
        <div style={two}>
          <Field label="Status"><Select value={f.status} onChange={setStatus} options={STATUSES} /></Field>
          <Field label="Stage (sub-status)"><Select value={f.subStatus} onChange={(v) => set("subStatus", v)} options={SUB_STATUS[f.status] || []} placeholder="Select stage" /></Field>
        </div>
        <div style={two}>
          <Field label="Project source"><TextInput value={f.source} onChange={(v) => set("source", v)} placeholder="Anyone — client, referral, member…" /></Field>
          <Field label="Person in charge (PIC)"><Select value={f.pic} onChange={(v) => set("pic", v)} options={members} placeholder="Option" /></Field>
        </div>
        <Field label="Collaborators">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {members.filter((m) => m !== f.pic).map((m) => {
              const on = f.collaborators.includes(m);
              return <button key={m} onClick={() => toggleCollab(m)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 20, fontSize: 12.5, cursor: "pointer", border: `1px solid ${on ? C.blue : C.line}`, background: on ? C.blueSoft : "#fff", color: on ? C.blue : C.ink2 }}>{on && <Check size={13} />} {m}</button>;
            })}
            {members.filter((m) => m !== f.pic).length === 0 && <span style={{ fontSize: 12, color: C.muted }}>Add members in Settings first.</span>}
          </div>
        </Field>
        <div style={two}>
          <Field label="Kick-off"><input type="date" value={f.kickoff} onChange={(e) => set("kickoff", e.target.value)} style={inputStyle} /></Field>
          <Field label="Wrap-up target"><input type="date" value={f.wrapup} onChange={(e) => set("wrapup", e.target.value)} style={inputStyle} /></Field>
        </div>
        <Field label="Description"><textarea value={f.description} onChange={(e) => set("description", e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} placeholder="Scope, objectives…" /></Field>
        <Field label="Data room (link)"><TextInput value={f.dataRoom} onChange={(v) => set("dataRoom", v)} placeholder="https://drive.google.com/…" /></Field>
        <div style={{ fontSize: 11.5, color: C.muted }}>Tip: add milestones & the checklist after saving, from the project's detail view.</div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
        <PrimaryButton onClick={submit} disabled={busy}>{busy ? "Saving…" : (project.id ? "Save changes" : "Create project")}</PrimaryButton>
      </div>
      {err ? <div style={{ textAlign: "right", fontSize: 11.5, color: C.red, marginTop: 8 }}>{err}</div>
        : (!f.name.trim() && <div style={{ textAlign: "right", fontSize: 11, color: C.muted, marginTop: 8 }}>A project name is required.</div>)}
    </Modal>
  );
}

/* --------------------- Project detail: Gantt + checklist --------------------- */
function ProjectDetail({ project, state, update, currentUser, onClose, onEdit }) {
  const p = project; const members = state.members; if (!p) return null;
  const prog = progressOf(p);
  const patchProject = (patch) => update((prev) => ({ projects: prev.projects.map((x) => x.id === p.id ? { ...x, ...patch, updatedAt: todayISO() } : x) }));
  const [newTask, setNewTask] = useState(""); const [taskAssignee, setTaskAssignee] = useState("All"); const [taskDue, setTaskDue] = useState("");
  const assignOptions = ["All", ...assigneesOf(p)];
  const addTask = () => {
    if (!newTask.trim()) return;
    const item = { id: uid(), text: newTask.trim(), done: false, status: "Not Started", dueDate: taskDue, assignee: assignOptions.includes(taskAssignee) ? taskAssignee : "All" };
    update((prev) => {
      const notifs = (item.assignee !== "All") ? [mkNotif(item.assignee, "assigned_task", `${currentUser} assigned you a task in “${p.name}”`, p.id)] : [];
      return { projects: prev.projects.map((x) => x.id === p.id ? { ...x, checklist: [...(x.checklist || []), item], updatedAt: todayISO() } : x), notifications: [...notifs, ...prev.notifications] };
    });
    setNewTask(""); setTaskAssignee("All"); setTaskDue("");
  };
  const patchTask = (id, patch) => patchProject({ checklist: p.checklist.map((i) => i.id === id ? { ...i, ...patch, done: (patch.status ?? i.status) === "Finished" } : i) });
  const toggleTask = (id) => { const i = p.checklist.find((x) => x.id === id); patchTask(id, { status: i.done ? "Not Started" : "Finished" }); };
  const delTask = (id) => patchProject({ checklist: p.checklist.filter((i) => i.id !== id) });
  const [msName, setMsName] = useState(""); const [msDate, setMsDate] = useState("");
  const addMs = () => { if (!msName.trim() || !msDate) return; patchProject({ milestones: [...(p.milestones || []), { id: uid(), name: msName.trim(), date: msDate }] }); setMsName(""); setMsDate(""); };
  const updateMs = (id, patch) => patchProject({ milestones: p.milestones.map((m) => m.id === id ? { ...m, ...patch } : m) });
  const delMs = (id) => patchProject({ milestones: p.milestones.filter((m) => m.id !== id) });
  return (
    <Modal onClose={onClose} title={null} xwide>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 4 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}><h2 className="disp" style={{ margin: 0, fontSize: 20 }}>{p.name}</h2><StatusPill status={p.status} /><SubStatusTag status={p.status} subStatus={p.subStatus} /><PriorityChip priority={p.priority} /></div>
          {p.client && <div style={{ fontSize: 13.5, color: C.blue, marginTop: 4, fontWeight: 600 }}>{p.client}</div>}
        </div>
        {onEdit && <GhostButton onClick={onEdit}><Pencil size={14} /> Edit</GhostButton>}
      </div>
      {p.description && <p style={{ fontSize: 13, color: C.ink2, lineHeight: 1.55, margin: "10px 0 16px" }}>{p.description}</p>}
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 12.5, marginBottom: 18, color: C.ink2 }}>
        <Meta label="Category" value={p.category} /><Meta label="Source" value={p.source || "—"} /><Meta label="PIC" value={p.pic || "—"} />
        {p.dataRoom && <a href={p.dataRoom} target="_blank" rel="noreferrer" style={{ color: C.blue, textDecoration: "none", display: "inline-flex", gap: 5, alignItems: "center" }}><ExternalLink size={13} /> Data room</a>}
      </div>
      <SubLabel><UsersRound size={14} /> Team</SubLabel>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {[p.pic, ...(p.collaborators || [])].filter(Boolean).map((m, i) => (
          <span key={m + i} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 20, padding: "4px 10px 4px 4px", fontSize: 12.5 }}>
            <Avatar name={m} members={members} size={22} /> {m} {i === 0 && <span style={{ fontSize: 10, color: C.muted }}>PIC</span>}</span>
        ))}
        {![p.pic, ...(p.collaborators || [])].filter(Boolean).length && <span style={{ fontSize: 12, color: C.muted }}>No one assigned yet.</span>}
      </div>
      <SubLabel><GanttChartSquare size={14} /> Timeline</SubLabel>
      <ProjectGantt p={p} />
      <div style={{ display: "flex", gap: 8, marginTop: 12, marginBottom: 22, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 180px" }}><Field label="Add milestone"><TextInput value={msName} onChange={setMsName} placeholder="e.g. Interim report" /></Field></div>
        <div><Field label="Date"><input type="date" value={msDate} onChange={(e) => setMsDate(e.target.value)} style={inputStyle} /></Field></div>
        <GhostButton onClick={addMs}><Plus size={14} /> Add</GhostButton>
      </div>
      {(p.milestones || []).length > 0 && <div style={{ display: "grid", gap: 6, marginBottom: 24 }}>
        {p.milestones.slice().sort((a, b) => a.date.localeCompare(b.date)).map((m) => (
          <MilestoneRow key={m.id} m={m} onSave={(patch) => updateMs(m.id, patch)} onDelete={() => delMs(m.id)} />
        ))}</div>}
      <SubLabel><CheckCircle2 size={14} /> Outputs & to-do — {prog}% complete</SubLabel>
      <div style={{ height: 7, background: C.lineSoft, borderRadius: 5, overflow: "hidden", marginBottom: 14 }}><div style={{ width: `${prog}%`, height: "100%", background: prog === 100 ? C.green : C.blue, transition: "width .25s" }} /></div>
      <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
        {(p.checklist || []).map((i) => (
          <TaskItem key={i.id} item={i} members={members} assignOptions={assignOptions} onToggle={() => toggleTask(i.id)} onSave={(patch) => patchTask(i.id, patch)} onDelete={() => delTask(i.id)} />
        ))}
        {(p.checklist || []).length === 0 && <div style={{ fontSize: 12, color: C.muted, padding: "4px 2px" }}>No items yet. Add outputs or tasks below.</div>}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTask()} placeholder="Add an output or task…" style={{ ...inputStyle, flex: "1 1 180px" }} />
        <input type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} title="Due date (optional)" style={{ ...inputStyle, width: 150 }} />
        <div style={{ minWidth: 150 }}><Select value={taskAssignee} onChange={setTaskAssignee} options={assignOptions} /></div>
        <PrimaryButton onClick={addTask}><Plus size={15} /> Add</PrimaryButton>
      </div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Set an optional due date and assign to <b>All</b> (PIC + collaborators) or one person. Edit any task to change its status (Not Started / On Progress / Finished).</div>
    </Modal>
  );
}

function TaskStatusPill({ status }) {
  const m = TASK_STATUS_META[status] || TASK_STATUS_META["Not Started"];
  return <span style={{ fontSize: 10.5, fontWeight: 700, color: m.color, background: m.soft, borderRadius: 20, padding: "2px 9px", whiteSpace: "nowrap" }}>{status}</span>;
}
function MilestoneRow({ m, onSave, onDelete }) {
  const [edit, setEdit] = useState(false); const [name, setName] = useState(m.name); const [date, setDate] = useState(m.date);
  useEffect(() => { setName(m.name); setDate(m.date); }, [m.id]);
  if (edit) return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 8px", background: C.panel, border: `1px solid ${C.blue}`, borderRadius: 8, flexWrap: "wrap" }}>
      <input value={name} onChange={(e) => setName(e.target.value)} style={{ ...inputStyle, flex: "1 1 140px", padding: "6px 8px" }} />
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputStyle, width: 150, padding: "6px 8px" }} />
      <PrimaryButton small onClick={() => { if (name.trim() && date) { onSave({ name: name.trim(), date }); setEdit(false); } }}>Save</PrimaryButton>
      <IconBtn small onClick={() => setEdit(false)}><X size={12} /></IconBtn>
    </div>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, padding: "6px 10px", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8 }}>
      <Flag size={13} color={C.amber} /> <span style={{ flex: 1 }}>{m.name}</span><span className="mono" style={{ color: C.muted }}>{m.date}</span>
      <IconBtn onClick={() => setEdit(true)} small><Pencil size={12} /></IconBtn>
      <IconBtn onClick={onDelete} danger small><Trash2 size={12} /></IconBtn>
    </div>
  );
}
function TaskItem({ item, members, assignOptions, onToggle, onSave, onDelete }) {
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState(item.text); const [assignee, setAssignee] = useState(item.assignee); const [due, setDue] = useState(item.dueDate || ""); const [status, setStatus] = useState(item.status);
  useEffect(() => { setText(item.text); setAssignee(item.assignee); setDue(item.dueDate || ""); setStatus(item.status); }, [item.id]);
  const di = dueInfo(item);
  if (edit) return (
    <div style={{ display: "grid", gap: 8, padding: 10, background: C.panel, border: `1px solid ${C.blue}`, borderRadius: 9 }}>
      <input value={text} onChange={(e) => setText(e.target.value)} style={inputStyle} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 130px" }}><Select value={assignee} onChange={setAssignee} options={assignOptions} /></div>
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} style={{ ...inputStyle, width: 150 }} />
        <div style={{ minWidth: 140 }}><Select value={status} onChange={setStatus} options={TASK_STATUS} /></div>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <GhostButton small onClick={() => setEdit(false)}>Cancel</GhostButton>
        <PrimaryButton small onClick={() => { if (text.trim()) { onSave({ text: text.trim(), assignee, dueDate: due, status }); setEdit(false); } }}>Save</PrimaryButton>
      </div>
    </div>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9 }}>
      <Checkbox on={item.done} onClick={onToggle} />
      <span style={{ flex: 1, minWidth: 0, fontSize: 13, textDecoration: item.done ? "line-through" : "none", color: item.done ? C.muted : C.ink }}>{item.text}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {di && <span style={{ fontSize: 11, fontWeight: 700, color: di.color, whiteSpace: "nowrap" }}>{di.label}</span>}
        {item.dueDate && <span className="mono" style={{ fontSize: 11, color: C.muted }}>{item.dueDate}</span>}
        <TaskStatusPill status={item.status} />
        <AssigneeChip assignee={item.assignee} members={members} />
        <IconBtn onClick={() => setEdit(true)} small><Pencil size={13} /></IconBtn>
        <IconBtn onClick={onDelete} danger small><Trash2 size={13} /></IconBtn>
      </div>
    </div>
  );
}
function ProjectGantt({ p }) {
  const points = [{ name: "Kick-off", date: p.kickoff, kind: "start" }, ...(p.milestones || []).map((m) => ({ ...m, kind: "ms" })), { name: "Wrap-up", date: p.wrapup, kind: "end" }].filter((x) => x.date);
  if (points.length < 2) return <div style={{ fontSize: 12.5, color: C.muted }}>Set kick-off and wrap-up dates to see the timeline.</div>;
  const times = points.map((x) => new Date(x.date + "T00:00:00").getTime());
  const min = Math.min(...times), max = Math.max(...times), span = Math.max(1, max - min);
  const pos = (t) => ((t - min) / span) * 100;
  const now = Date.now(); const nowPos = now >= min && now <= max ? pos(now) : null;
  const endT = new Date(p.wrapup + "T00:00:00").getTime();
  const laid = points.map((x) => ({ ...x, pp: pos(new Date(x.date + "T00:00:00").getTime()) })).sort((a, b) => a.pp - b.pp);
  const laneRight = [];
  laid.forEach((x) => { let lvl = 0; while (laneRight[lvl] !== undefined && x.pp - laneRight[lvl] < 14) lvl++; laneRight[lvl] = x.pp; x.level = lvl; });
  const maxLevel = laid.reduce((m, x) => Math.max(m, x.level), 0);
  const STEP = 30, TOP = 26;
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: "24px 26px 20px" }}>
      <div style={{ position: "relative", height: TOP + (maxLevel + 1) * STEP }}>
        <div style={{ position: "absolute", left: `${pos(times[0])}%`, right: `${100 - pos(endT)}%`, top: 12, height: 6, background: C.blueSoft, borderRadius: 4 }} />
        <div style={{ position: "absolute", left: `${pos(times[0])}%`, right: `${100 - pos(Math.min(now, max))}%`, top: 12, height: 6, background: C.blue, borderRadius: 4 }} />
        {nowPos !== null && <div style={{ position: "absolute", left: `${nowPos}%`, top: -2, height: 24, width: 2, background: C.red }}><span style={{ position: "absolute", top: -15, left: "50%", transform: "translateX(-50%)", fontSize: 9, color: C.red, fontWeight: 700, whiteSpace: "nowrap" }}>TODAY</span></div>}
        {laid.map((x, i) => {
          const col = x.kind === "start" ? C.green : x.kind === "end" ? C.ink : C.amber;
          const labelTop = TOP + x.level * STEP;
          return (
            <React.Fragment key={i}>
              {x.level > 0 && <div style={{ position: "absolute", left: `${x.pp}%`, top: 15, height: labelTop - 15, width: 1, background: C.line }} />}
              <div style={{ position: "absolute", left: `${x.pp}%`, top: 8, transform: "translateX(-50%)" }}>
                <div style={{ width: 13, height: 13, borderRadius: x.kind === "ms" ? 3 : "50%", background: col, border: "2px solid #fff", boxShadow: `0 0 0 1px ${col}`, transform: x.kind === "ms" ? "rotate(45deg)" : "none" }} />
              </div>
              <div style={{ position: "absolute", left: `${x.pp}%`, top: labelTop, transform: "translateX(-50%)", textAlign: "center", width: 88 }}>
                <div style={{ fontSize: 10, fontWeight: 700, lineHeight: 1.15 }}>{x.name}</div>
                <div className="mono" style={{ fontSize: 9, color: C.muted }}>{x.date.slice(5)}</div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ Timeline (integrated Gantt) ------------------------------ */
function Timeline({ state, update, currentUser }) {
  const projects = state.projects.filter((p) => p.kickoff && p.wrapup && !p.archived);
  const [detail, setDetail] = useState(null);
  if (projects.length === 0) return <div className="fade"><Header title="Timeline" /><EmptyState label="No projects have kick-off / wrap-up dates yet. Add dates on a project to see the integrated Gantt here." /></div>;

  const all = projects.flatMap((p) => [new Date(p.kickoff + "T00:00:00").getTime(), new Date(p.wrapup + "T00:00:00").getTime()]);
  const rawMin = Math.min(...all), rawMax = Math.max(...all);
  const pad = Math.round((rawMax - rawMin) * 0.03) || 864e5;
  const min = rawMin - pad, max = rawMax + pad, span = Math.max(1, max - min);
  const pos = (t) => ((t - min) / span) * 100;
  const now = Date.now(); const nowPos = now >= min && now <= max ? pos(now) : null;
  const months = []; let d = new Date(min); d.setDate(1);
  while (d.getTime() <= max) { months.push(new Date(d)); d.setMonth(d.getMonth() + 1); }
  const isMobile2 = typeof window !== "undefined" && window.innerWidth < 640;
  const LABEL = isMobile2 ? 108 : 176;

  return (
    <div className="fade">
      <Header title="Timeline" sub="Auto-fit — every project from start to end, no scrolling" />
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ width: "100%" }}>
          {/* month header */}
          <div style={{ display: "flex", borderBottom: `1px solid ${C.line}` }}>
            <div style={{ width: LABEL, flexShrink: 0, borderRight: `1px solid ${C.line}` }} />
            <div style={{ position: "relative", flex: 1, height: 32 }}>
              {months.map((m, i) => (
                <div key={i} style={{ position: "absolute", left: `${pos(m.getTime())}%`, top: 0, bottom: 0, borderLeft: `1px solid ${C.lineSoft}`, paddingLeft: 4, fontSize: 9.5, color: C.muted, display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
                  {MONTHS[m.getMonth()].slice(0, 3)} {String(m.getFullYear()).slice(2)}
                </div>
              ))}
              {nowPos !== null && <div style={{ position: "absolute", left: `${nowPos}%`, top: "50%", transform: "translate(-50%, -50%)", fontSize: 9, fontWeight: 700, color: C.red }}>TODAY</div>}
            </div>
          </div>
          {projects.map((p, idx) => {
            const s = new Date(p.kickoff + "T00:00:00").getTime(), e = new Date(p.wrapup + "T00:00:00").getTime(); const meta = STATUS_META[p.status];
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", borderTop: idx ? `1px solid ${C.lineSoft}` : "none", minHeight: 46 }}>
                <div onClick={() => setDetail(p.id)} style={{ width: LABEL, flexShrink: 0, padding: "8px 12px", cursor: "pointer", borderRight: `1px solid ${C.line}` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                  <div style={{ fontSize: 10, color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.client || p.category}</div>
                </div>
                <div style={{ position: "relative", flex: 1, height: 46 }}>
                  {months.map((m, i) => <div key={i} style={{ position: "absolute", left: `${pos(m.getTime())}%`, top: 0, bottom: 0, borderLeft: `1px solid ${C.lineSoft}` }} />)}
                  {nowPos !== null && <div style={{ position: "absolute", left: `${nowPos}%`, top: 0, bottom: 0, width: 2, background: C.red, opacity: 0.5 }} />}
                  <div onClick={() => setDetail(p.id)} title={`${p.kickoff} → ${p.wrapup}`} style={{ position: "absolute", left: `${pos(s)}%`, width: `${Math.max(1.5, pos(e) - pos(s))}%`, top: 13, height: 18, background: meta.color, borderRadius: 6, cursor: "pointer", opacity: 0.92, display: "flex", alignItems: "center", paddingLeft: 6, overflow: "hidden" }}>
                    <span style={{ fontSize: 10, color: "#fff", fontWeight: 700, whiteSpace: "nowrap" }}>{progressOf(p)}%</span>
                  </div>
                  {(p.milestones || []).map((ms) => { const t = new Date(ms.date + "T00:00:00").getTime(); if (t < min || t > max) return null;
                    return <div key={ms.id} title={`${ms.name} · ${ms.date}`} style={{ position: "absolute", left: `${pos(t)}%`, top: 16, width: 11, height: 11, background: C.amber, border: "2px solid #fff", transform: "translateX(-50%) rotate(45deg)", boxShadow: `0 0 0 1px ${C.amber}` }} />; })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      <div style={{ display: "flex", gap: 16, marginTop: 14, fontSize: 11.5, color: C.muted, flexWrap: "wrap" }}>
        {STATUSES.map((s) => <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: STATUS_META[s].color }} /> {s}</span>)}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 9, height: 9, background: C.amber, transform: "rotate(45deg)" }} /> Milestone</span>
        <span style={{ color: C.faint }}>Tip: click a project row to open its own timeline & checklist.</span>
      </div>

      <div style={{ marginTop: 22 }}><EventCalendar projects={state.projects} onOpenProject={(id) => setDetail(id)} /></div>

      {detail && <ProjectDetail project={state.projects.find((p) => p.id === detail)} state={state} update={update} currentUser={currentUser} onClose={() => setDetail(null)} />}
    </div>
  );
}

/* ------------------------------ Archive ------------------------------ */
function ArchiveView({ state, update, currentUser }) {
  const archived = state.projects.filter((p) => p.archived)
    .slice().sort((a, b) => (b.archivedAt || "").localeCompare(a.archivedAt || ""));
  const reports = (state.reports || []).slice().sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  const [detail, setDetail] = useState(null);
  const [openReport, setOpenReport] = useState(null);
  const [askReport, setAskReport] = useState(null); const admin = useAdmin();
  const [showAllReports, setShowAllReports] = useState(false);
  const shownReports = showAllReports ? reports : reports.slice(0, 3);
  const unarchive = (id) => update((prev) => ({ projects: prev.projects.map((p) => p.id === id ? { ...p, archived: false, archivedAt: "", finishedAt: p.status === "Finished" ? todayISO() : p.finishedAt } : p) }));
  const remove = (id) => update((prev) => ({ projects: prev.projects.filter((p) => p.id !== id) }));
  const delReport = (id) => update((prev) => ({ reports: (prev.reports || []).filter((r) => r.id !== id) }));
  return (
    <div className="fade">
      <Header title="Archive" sub={`${archived.length} archived ${archived.length === 1 ? "project" : "projects"} · excluded from active progress & to-dos`} />

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <FileText size={16} color={C.blue} /><h2 className="disp" style={{ fontSize: 15, margin: 0 }}>Report history</h2>
        <span className="mono" style={{ fontSize: 12, color: C.muted }}>{reports.length}</span>
      </div>
      {reports.length === 0 ? <EmptyState label="No saved reports yet. Generate a Weekly or Monthly report from the Dashboard and choose “Save to history”." /> : (
        <>
          <div style={{ display: "grid", gap: 8 }}>
            {shownReports.map((r) => (
              <Card key={r.id} style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ width: 32, height: 32, borderRadius: 9, background: C.blueSoft, display: "grid", placeItems: "center" }}><FileText size={16} color={C.blue} /></span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{REPORT_META[r.type].title} · {fmtRange(r.start, r.end)}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>Saved {r.generatedAt.slice(0, 10)}{r.generatedBy ? ` by ${r.generatedBy}` : ""}</div>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <GhostButton onClick={() => admin.unlocked ? setOpenReport(r) : setAskReport(r)}><Eye size={14} /> Open</GhostButton>
                  <IconBtn onClick={() => delReport(r.id)} danger small><Trash2 size={14} /></IconBtn>
                </div>
              </Card>
            ))}
          </div>
          {reports.length > 3 && <button onClick={() => setShowAllReports((v) => !v)} style={{ ...linkBtn, marginTop: 10 }}>{showAllReports ? "Show less" : `See more (${reports.length - 3})…`}</button>}
        </>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "30px 0 12px" }}>
        <Archive size={16} color={C.slate} /><h2 className="disp" style={{ fontSize: 15, margin: 0 }}>Archived projects</h2>
        <span className="mono" style={{ fontSize: 12, color: C.muted }}>{archived.length}</span>
      </div>
      <div style={{ background: C.slateSoft, border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 16px", fontSize: 12.5, color: C.ink2, marginBottom: 16, display: "flex", gap: 10, alignItems: "center" }}>
        <Archive size={16} color={C.slate} /> Finished projects are moved here automatically 30 days after completion. Unarchive any project to return it to your active views.
      </div>
      {archived.length === 0 ? <EmptyState label="Nothing archived yet." /> : (
        <div style={{ display: "grid", gap: 10 }}>
          {archived.map((p) => (
            <div key={p.id}>
              <ProjectRow p={p} members={state.members} onOpen={() => setDetail(p.id)} onDelete={() => remove(p.id)} onUnarchive={() => unarchive(p.id)} />
              {p.archivedAt && <div style={{ fontSize: 11, color: C.faint, margin: "-4px 0 0 20px" }}>Archived {p.archivedAt}</div>}
            </div>
          ))}
        </div>
      )}

      {detail && <ProjectDetail project={state.projects.find((p) => p.id === detail)} state={state} update={update} currentUser={currentUser} onClose={() => setDetail(null)} />}
      {openReport && <ReportOverlay type={openReport.type} saved={openReport} state={state} currentUser={currentUser} onClose={() => setOpenReport(null)} />}
      {askReport && <AdminPrompt what="this report" onClose={() => setAskReport(null)} onUnlocked={() => setOpenReport(askReport)} />}
    </div>
  );
}

/* ------------------------------ To Do ------------------------------ */
function ToDo({ state, update, currentUser }) {
  const projects = state.projects.filter((p) => !p.archived);
  const withItems = projects.filter((p) => totalOf(p) > 0);
  const totalDone = projects.reduce((a, p) => a + doneOf(p), 0);
  const totalItems = projects.reduce((a, p) => a + totalOf(p), 0);
  const toggle = (pid, iid) => update((prev) => ({ projects: prev.projects.map((p) => p.id === pid ? { ...p, checklist: p.checklist.map((i) => i.id === iid ? { ...i, done: !i.done, status: i.done ? "Not Started" : "Finished" } : i), updatedAt: todayISO() } : p) }));

  return (
    <div className="fade">
      <Header title="To Do" />
      {totalItems === 0 ? <EmptyState label="No outputs or tasks yet. Add a checklist inside any project and its items will appear here, grouped by project." /> : (
        <>
          <Card style={{ padding: 18, marginBottom: 16, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div><div className="disp" style={{ fontSize: 26 }}>{totalItems - totalDone}</div><div style={{ fontSize: 12, color: C.muted }}>items open</div></div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.muted, marginBottom: 6 }}><span>Overall progress</span><span className="mono">{totalDone} / {totalItems} done</span></div>
              <div style={{ height: 9, background: C.lineSoft, borderRadius: 6, overflow: "hidden" }}><div style={{ width: `${totalItems ? (totalDone / totalItems) * 100 : 0}%`, height: "100%", background: C.blue }} /></div>
            </div>
          </Card>
          <div style={{ display: "grid", gap: 14 }}>
            {withItems.map((p) => {
              const open = p.checklist.filter((i) => !i.done); const done = p.checklist.filter((i) => i.done);
              return (
                <Card key={p.id} style={{ padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                    <span style={{ width: 4, height: 18, borderRadius: 3, background: CATEGORY_COLOR[p.category] || C.slate }} />
                    <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700 }}>{p.name}</h3>
                    {p.client && <span style={{ fontSize: 12, color: C.blue }}>· {p.client}</span>}
                    <StatusPill status={p.status} />
                    <span className="mono" style={{ marginLeft: "auto", fontSize: 12, color: C.muted }}>{doneOf(p)} / {totalOf(p)} done</span>
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    {open.map((i) => { const di = dueInfo(i); return (
                      <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", background: C.bg, borderRadius: 9 }}>
                        <Checkbox on={false} onClick={() => toggle(p.id, i.id)} />
                        <span style={{ flex: 1, minWidth: 0, fontSize: 13 }}>{i.text}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                          {di && <span style={{ fontSize: 11, fontWeight: 700, color: di.color, whiteSpace: "nowrap" }}>{di.label}</span>}
                          <TaskStatusPill status={i.status} /><AssigneeChip assignee={i.assignee} members={state.members} />
                        </div>
                      </div>
                    ); })}
                    {open.length === 0 && <div style={{ fontSize: 12, color: C.green, padding: "2px 2px" }}>All done for this project 🎉</div>}
                  </div>
                  {done.length > 0 && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px dashed ${C.line}` }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 8 }}>Completed · {done.length}</div>
                      <div style={{ display: "grid", gap: 4 }}>
                        {done.map((i) => (
                          <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", borderRadius: 9 }}>
                            <Checkbox on={true} onClick={() => toggle(p.id, i.id)} /><span style={{ flex: 1, fontSize: 13, textDecoration: "line-through", color: C.muted }}>{i.text}</span><AssigneeChip assignee={i.assignee} members={state.members} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
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
@page WordSection1 { size: 841.9pt 595.3pt; mso-page-orientation: landscape; margin: 2.2cm 2.6cm; }
div.WordSection1 { page: WordSection1; }
body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color:#000; }
h1 { text-align:center; font-size:20pt; letter-spacing:1pt; text-decoration:underline; margin:0 0 26pt; }
table.items { border-collapse:collapse; width:100%; margin-top:22pt; }
table.items td, table.items th { border:1px solid #000; padding:6pt 9pt; font-size:11pt; }
.ph { color:#9a9a9a; font-style:italic; } .muted { color:#6b6b6b; font-style:italic; }
</style></head><body><div class=WordSection1>
<h1>INVOICE</h1>
<table style="width:100%; border:none;"><tr>
<td style="border:none; vertical-align:top; width:55%;">To: ${client}<br><span class="ph">Add Address here</span></td>
<td style="border:none; vertical-align:top; text-align:right;">Date: ${dateStr}<br><span class="muted">${projName}</span>${teamName ? `<br><span class="muted">${teamName}</span>` : ""}</td>
</tr></table>
<table class="items">
<tr><th style="width:8%; text-align:left;">No</th><th style="text-align:left;">Description</th><th style="width:26%; text-align:left;">Amount</th></tr>
<tr><td>1</td><td class="ph">Add description here</td><td class="ph">Add amount here</td></tr>
<tr><td></td><td style="text-align:right; font-weight:bold;">TOTAL</td><td class="ph">Add amount here</td></tr>
<tr><td colspan="3" class="ph" style="text-align:center;">Add amount in words here</td></tr>
</table>
<table style="width:100%; border:none; margin-top:46pt;"><tr><td style="border:none;"></td>
<td style="border:none; text-align:right; width:40%;">${city}, ${dateStr}<br><br><br><br><b>${signer}</b></td></tr></table>
</div></body></html>`;
  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = `${number}.doc`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/* ------------------------------ Balance ------------------------------ */
function fileToReceipt(file, cb) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const max = 1400; let w = img.width, h = img.height;
      const scale = Math.min(1, max / Math.max(w, h));
      const cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
      const canvas = document.createElement("canvas"); canvas.width = cw; canvas.height = ch;
      canvas.getContext("2d").drawImage(img, 0, 0, cw, ch);
      cb({ name: file.name, dataUrl: canvas.toDataURL("image/jpeg", 0.82) });
    };
    img.onerror = () => cb({ name: file.name, dataUrl: reader.result });
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}
const sumTx = (arr) => arr.reduce((a, t) => a + (Number(t.amount) || 0), 0);
function inPeriod(t, mode, y, m) {
  const d = t.date; if (!d) return false; const ty = +d.slice(0, 4), tm = +d.slice(5, 7) - 1;
  if (mode === "Yearly") return ty === y;
  if (mode === "Quarterly") return ty === y && quarterOf(tm) === quarterOf(m);
  return ty === y && tm === m;
}
function groupSum(arr, keyFn) {
  const map = {}; arr.forEach((t) => { const k = keyFn(t) || "Others"; map[k] = (map[k] || 0) + (Number(t.amount) || 0); });
  return map;
}

function Balance({ state, update, currentUser, setTab }) {
  const isMobile = useIsMobile();
  const { transactions, projects, members, company } = state;
  const projName = (id) => (projects.find((p) => p.id === id) || {}).name || "—";
  const income = transactions.filter((t) => t.type === "Income");
  const expense = transactions.filter((t) => t.type === "Expense");
  const balance = sumTx(income) - sumTx(expense);
  const now = new Date(); const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthIncome = sumTx(income.filter((t) => monthKey(t.date) === curKey));
  const monthExpense = sumTx(expense.filter((t) => monthKey(t.date) === curKey));

  const [cur, setCur] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [ieMode, setIeMode] = useState("Monthly");
  const [drill, setDrill] = useState(null); // null | "Quarterly" | "Yearly"
  const stepCat = (dir) => setCur((c) => { let m = c.m + dir, y = c.y; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } return { y, m }; });
  const stepIe = (dir) => setCur((c) => {
    if (ieMode === "Yearly") return { ...c, y: c.y + dir };
    if (ieMode === "Quarterly") { let q = quarterOf(c.m) + dir, y = c.y; if (q < 0) { q = 3; y--; } if (q > 3) { q = 0; y++; } return { y, m: q * 3 }; }
    let m = c.m + dir, y = c.y; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } return { y, m };
  });
  const ieLabel = ieMode === "Yearly" ? `${cur.y}` : ieMode === "Quarterly" ? `${QLABEL[quarterOf(cur.m)].split(" ")[0]} ${cur.y}` : `${MONTHS[cur.m]} ${cur.y}`;
  const catLabel = `${MONTHS[cur.m]} ${cur.y}`;

  const ieInc = sumTx(income.filter((t) => inPeriod(t, ieMode, cur.y, cur.m)));
  const ieExp = sumTx(expense.filter((t) => inPeriod(t, ieMode, cur.y, cur.m)));
  const monthInc = income.filter((t) => inPeriod(t, "Monthly", cur.y, cur.m));
  const monthExp = expense.filter((t) => inPeriod(t, "Monthly", cur.y, cur.m));
  const incByCat = INCOME_CATS.map((c, i) => ({ name: c, value: groupSum(monthInc, (t) => t.category)[c] || 0, fill: CAT_COLORS[i] }));
  const expByPur = EXP_PURCHASE.map((c, i) => ({ name: c, value: groupSum(monthExp, (t) => t.category)[c] || 0, fill: CAT_COLORS[i] }));
  const expByWork = EXP_WORK.map((c, i) => ({ name: c, value: groupSum(monthExp, (t) => t.workCategory)[c] || 0, fill: CAT_COLORS[i] }));

  const recent = transactions.slice().sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt)).slice(0, 8);

  // add-transaction form
  const blank = { date: todayISO(), projectId: "", description: "", type: "Income", category: "", workCategory: "Project", amount: "", account: DEFAULT_ACCOUNT, accountOther: "", method: "", receipt: null };
  const [f, setF] = useState(blank);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const catOptions = f.type === "Income" ? INCOME_CATS : EXP_PURCHASE;
  const addTx = () => {
    if (!f.date || !f.amount || !f.category) return;
    const tx = { id: uid(), date: f.date, projectId: f.projectId, description: f.description.trim(), type: f.type, category: f.category,
      workCategory: f.type === "Expense" ? f.workCategory : "", amount: Number(f.amount) || 0,
      account: f.account, accountOther: f.account === "Others" ? f.accountOther.trim() : "", method: f.method, receipt: f.receipt, createdBy: currentUser, createdAt: nowISO() };
    update((prev) => ({ transactions: [tx, ...prev.transactions] }));
    setF({ ...blank, date: f.date, account: f.account, accountOther: f.accountOther });
  };
  const delTx = (id) => update((prev) => ({ transactions: prev.transactions.filter((t) => t.id !== id) }));

  // excel export
  const [range, setRange] = useState({ start: `${now.getFullYear()}-01-01`, end: todayISO() });
  const exportExcel = () => {
    const rows = transactions.filter((t) => (!range.start || t.date >= range.start) && (!range.end || t.date <= range.end)).sort((a, b) => a.date.localeCompare(b.date));
    const totInc = rows.filter((t) => t.type === "Income").reduce((a, t) => a + (Number(t.amount) || 0), 0);
    const totExp = rows.filter((t) => t.type === "Expense").reduce((a, t) => a + (Number(t.amount) || 0), 0);
    const head = [
      [company.name || APP_NAME], ["Financial Records"],
      ["Date of Record :", prettyDate(todayISO())], ["Starting Date :", range.start || "—"], ["End Date :", range.end || "—"], [],
      ["Total Income :", totInc], ["Total Expense :", totExp], ["Balance :", totInc - totExp], [],
      ["Date", "Project", "Description", "Type", "Category", "Work Category", "Income (Rp)", "Expense (Rp)", "Account", "Method", "Receipt"],
    ];
    const body = rows.map((t) => [t.date, projName(t.projectId), t.description, t.type, t.category, t.type === "Expense" ? (t.workCategory || "") : "",
      t.type === "Income" ? (Number(t.amount) || 0) : "", t.type === "Expense" ? (Number(t.amount) || 0) : "",
      t.account === "Others" ? `Others: ${t.accountOther}` : t.account, t.method, t.receipt ? t.receipt.name : ""]);
    const ws = XLSX.utils.aoa_to_sheet([...head, ...body]);
    ws["!cols"] = [{ wch: 12 }, { wch: 22 }, { wch: 28 }, { wch: 9 }, { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 22 }, { wch: 10 }, { wch: 20 }];
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } }];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Financial Records");
    XLSX.writeFile(wb, `Financial_Records_${range.start || "all"}_to_${range.end || "all"}.xlsx`);
  };

  const download = (r) => { const a = document.createElement("a"); a.href = r.dataUrl; a.download = r.name || "receipt.jpg"; a.click(); };
  const two = { display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 };

  return (
    <div className="fade">
      <Header title="Balance" sub={`As of ${prettyDate(todayISO())} · balance is all-time; category analytics reflect the selected period`} />

      {/* summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        <SummaryCard icon={Wallet} tone={C.green} label="Current Balance" value={fmtRp(balance)} sub="All-time balance" big />
        <SummaryCard icon={ArrowUpRight} tone={C.blue} label="This Month’s Income" value={fmtRp(monthIncome)} />
        <SummaryCard icon={ArrowDownRight} tone={C.red} label="This Month’s Expense" value={fmtRp(monthExpense)} />
        <SummaryCard icon={TrendingUp} tone={C.green} label="Net Change" value={`${monthIncome - monthExpense >= 0 ? "+" : ""}${fmtRp(monthIncome - monthExpense)}`} />
      </div>

      {/* charts */}
      <div style={{ ...two, marginBottom: 16 }}>
        <Card style={{ padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            <ChartTitle>Income vs Expense</ChartTitle>
            <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
              {["Monthly", "Quarterly", "Yearly"].map((m) => <Seg key={m} on={ieMode === m} onClick={() => setIeMode(m)}>{m}</Seg>)}
            </div>
          </div>
          <MonthNav label={ieLabel} onPrev={() => stepIe(-1)} onNext={() => stepIe(1)} />
          <div style={{ height: 210 }}>
            <ResponsiveContainer>
              <BarChart data={[{ name: "Income", value: ieInc }, { name: "Expense", value: ieExp }]} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fill: C.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => v >= 1e6 ? `${v / 1e6}M` : v} tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => fmtRp(v)} contentStyle={{ borderRadius: 10, border: `1px solid ${C.line}`, fontSize: 12 }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} label={{ position: "top", formatter: (v) => fmtRp(v), fontSize: 10, fill: C.ink }}>
                  <Cell fill={C.blue} /><Cell fill={C.red} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ marginTop: 10 }}><button onClick={() => setDrill("Quarterly")} style={linkBtn}>Detailed analytics (quarterly / yearly) →</button></div>
        </Card>

        <Card style={{ padding: 18 }}>
          <ChartTitle>Income by Category</ChartTitle>
          <MonthNav label={catLabel} onPrev={() => stepCat(-1)} onNext={() => stepCat(1)} />
          <DonutBlock data={incByCat} total={sumTx(monthInc)} />
        </Card>
      </div>

      <div style={{ ...two, marginBottom: 20 }}>
        <Card style={{ padding: 18 }}>
          <ChartTitle>Expense by Purchase Category</ChartTitle>
          <MonthNav label={catLabel} onPrev={() => stepCat(-1)} onNext={() => stepCat(1)} />
          <DonutBlock data={expByPur} total={sumTx(monthExp)} />
        </Card>
        <Card style={{ padding: 18 }}>
          <ChartTitle>Expense by Work Category</ChartTitle>
          <MonthNav label={catLabel} onPrev={() => stepCat(-1)} onNext={() => stepCat(1)} />
          <div style={{ marginTop: 8 }}>
            {sumTx(monthExp) === 0 ? <NoData /> : expByWork.map((r, i) => {
              const pct = sumTx(monthExp) ? Math.round((r.value / sumTx(monthExp)) * 100) : 0;
              return (
                <div key={r.name} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span>{r.name}</span><span className="mono" style={{ color: C.muted }}>{fmtRp(r.value)} ({pct}%)</span></div>
                  <div style={{ height: 10, background: C.lineSoft, borderRadius: 6, overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: r.fill }} /></div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* add transaction */}
      <SectionLabel>Add transaction</SectionLabel>
      <Card style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 12 }}>
          <Field label="Date"><input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} style={inputStyle} /></Field>
          <Field label="Project"><Select value={f.projectId} onChange={(v) => set("projectId", v)} options={projects.filter((p) => !p.archived).map((p) => ({ value: p.id, label: p.name }))} placeholder="Select project" /></Field>
          <div style={{ gridColumn: isMobile ? "span 2" : "span 2" }}><Field label="Description of transaction"><TextInput value={f.description} onChange={(v) => set("description", v)} placeholder="e.g. Honor narasumber interim #1" /></Field></div>
          <Field label="Type">
            <div style={{ display: "flex", gap: 6 }}>
              {["Income", "Expense"].map((t) => <Seg key={t} on={f.type === t} onClick={() => { set("type", t); set("category", ""); }} grow>{t}</Seg>)}
            </div>
          </Field>
          <Field label="Category"><Select value={f.category} onChange={(v) => set("category", v)} options={catOptions} placeholder="Select category" /></Field>
          {f.type === "Expense" && <Field label="Work category"><Select value={f.workCategory} onChange={(v) => set("workCategory", v)} options={EXP_WORK} /></Field>}
          <Field label="Amount (Rp)"><input type="number" value={f.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0" style={inputStyle} /></Field>
          <Field label="Account"><Select value={f.account} onChange={(v) => set("account", v)} options={[DEFAULT_ACCOUNT, "Others"]} /></Field>
          {f.account === "Others" && <Field label="Account name"><TextInput value={f.accountOther} onChange={(v) => set("accountOther", v)} placeholder="Others: …" /></Field>}
          <Field label="Method"><Select value={f.method} onChange={(v) => set("method", v)} options={TX_METHODS} placeholder="Select method" /></Field>
          <Field label="Receipt (jpg/png)">
            <label style={{ ...ghostBtnStyle, cursor: "pointer", display: "inline-flex", gap: 6, alignItems: "center", justifyContent: "center" }}>
              <Upload size={14} /> {f.receipt ? "Change" : "Upload"}
              <input type="file" accept="image/png,image/jpeg" style={{ display: "none" }} onChange={(e) => { const file = e.target.files[0]; if (file) fileToReceipt(file, (r) => set("receipt", r)); }} />
            </label>
            {f.receipt && <span style={{ fontSize: 11, color: C.muted, marginLeft: 8 }}>{f.receipt.name}</span>}
          </Field>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}><PrimaryButton onClick={addTx}><Plus size={15} /> Add transaction</PrimaryButton></div>
      </Card>

      {/* recent + excel */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <SectionLabel style={{ margin: 0 }}>Recent transactions</SectionLabel>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11.5, color: C.muted }}>Export</span>
          <input type="date" value={range.start} onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))} style={{ ...inputStyle, width: 150, padding: "7px 8px" }} />
          <span style={{ fontSize: 12, color: C.muted }}>→</span>
          <input type="date" value={range.end} onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))} style={{ ...inputStyle, width: 150, padding: "7px 8px" }} />
          <GhostButton onClick={exportExcel}><FileSpreadsheet size={14} /> Excel</GhostButton>
        </div>
      </div>
      {recent.length === 0 ? <EmptyState label="No transactions yet. Add income or expenses above." /> : (
        <Card style={{ padding: 0, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 720 }}>
            <thead><tr style={{ textAlign: "left", color: C.muted, fontSize: 11 }}>
              {["Date", "Project", "Description", "Type", "Category", "Amount", "Account", "Method", "Receipt", ""].map((h) => <th key={h} style={{ padding: "10px 12px", borderBottom: `1px solid ${C.line}`, fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {recent.map((t) => (
                <tr key={t.id} style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
                  <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }} className="mono">{t.date}</td>
                  <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>{t.projectId ? <button onClick={() => setTab("projects")} style={{ ...linkBtn, fontSize: 12.5 }}><Link2 size={11} /> {projName(t.projectId)}</button> : <span style={{ color: C.muted }}>—</span>}</td>
                  <td style={{ padding: "9px 12px" }}>{t.description || "—"}</td>
                  <td style={{ padding: "9px 12px" }}><span style={{ fontSize: 11, fontWeight: 700, color: t.type === "Income" ? C.blue : C.red, background: t.type === "Income" ? C.blueSoft : "#FDECEC", borderRadius: 20, padding: "2px 9px" }}>{t.type}</span></td>
                  <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>{t.category}{t.type === "Expense" && t.workCategory ? ` · ${t.workCategory}` : ""}</td>
                  <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }} className="mono">{fmtRp(t.amount)}</td>
                  <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>{t.account === "Others" ? `Others: ${t.accountOther}` : t.account}</td>
                  <td style={{ padding: "9px 12px" }}>{t.method || "—"}</td>
                  <td style={{ padding: "9px 12px" }}>{t.receipt ? <button onClick={() => download(t.receipt)} title="Download receipt" style={{ ...iconBtnStyle, width: 28, height: 28 }}><FileText size={14} /></button> : <span style={{ color: C.faint }}>—</span>}</td>
                  <td style={{ padding: "9px 12px" }}><IconBtn onClick={() => delTx(t.id)} danger small><Trash2 size={13} /></IconBtn></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <div style={{ fontSize: 11, color: C.faint, marginTop: 8 }}>Receipts are stored with each transaction; click a receipt to download it. The Excel export includes an auto-filled header (company, record date, start/end) and every transaction in the chosen range.</div>

      {drill && <DetailedAnalytics income={income} expense={expense} initialMode={drill} year={cur.y} onClose={() => setDrill(null)} />}
    </div>
  );
}

function SummaryCard({ icon: Icon, tone, label, value, sub, big }) {
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ width: 30, height: 30, borderRadius: 9, background: tone + "1A", display: "grid", placeItems: "center" }}><Icon size={16} color={tone} /></span>
        <span style={{ fontSize: 11.5, color: C.muted }}>{label}</span>
      </div>
      <div className="disp" style={{ fontSize: big ? 21 : 19, color: tone }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: C.faint, marginTop: 2 }}>{sub}</div>}
    </Card>
  );
}
function Seg({ on, onClick, children, grow }) {
  return <button onClick={onClick} style={{ flex: grow ? 1 : "none", fontSize: 11.5, fontWeight: 600, padding: "6px 11px", borderRadius: 8, cursor: "pointer", border: `1px solid ${on ? C.blue : C.line}`, background: on ? C.blue : "#fff", color: on ? "#fff" : C.ink2 }}>{children}</button>;
}
function MonthNav({ label, onPrev, onNext }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, margin: "6px 0 4px" }}>
      <IconBtn small onClick={onPrev}><ChevronLeft size={15} /></IconBtn>
      <span className="disp" style={{ fontSize: 13 }}>{label}</span>
      <IconBtn small onClick={onNext}><ChevronRight size={15} /></IconBtn>
    </div>
  );
}
function DonutBlock({ data, total }) {
  const nonzero = data.filter((d) => d.value > 0);
  if (!total) return <NoData />;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <div style={{ position: "relative", width: 132, height: 132, flexShrink: 0 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={nonzero} dataKey="value" nameKey="name" innerRadius={40} outerRadius={62} paddingAngle={2} stroke="none">
              {nonzero.map((d, i) => <Cell key={i} fill={d.fill} />)}
            </Pie>
            <Tooltip formatter={(v) => fmtRp(v)} contentStyle={{ borderRadius: 10, border: `1px solid ${C.line}`, fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none" }}>
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 8.5, color: C.muted }}>Rp</div><div className="disp" style={{ fontSize: 11 }}>{new Intl.NumberFormat("id-ID").format(total)}</div></div>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 118, display: "grid", gap: 5 }}>
        {data.map((d, i) => { const pct = total ? (d.value / total * 100) : 0; return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 10.5 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.fill, flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</span>
            <span style={{ color: C.muted, flexShrink: 0 }} className="mono">{pct.toFixed(1)}%</span>
          </div>
        ); })}
      </div>
    </div>
  );
}
function DetailedAnalytics({ income, expense, initialMode, year, onClose }) {
  const [mode, setMode] = useState(initialMode === "Yearly" ? "Yearly" : "Quarterly");
  const [y, setY] = useState(year);
  const [q, setQ] = useState(quarterOf(new Date().getMonth()));
  const step = (dir) => { if (mode === "Yearly") setY((v) => v + dir); else { let nq = q + dir, ny = y; if (nq < 0) { nq = 3; ny--; } if (nq > 3) { nq = 0; ny++; } setQ(nq); setY(ny); } };
  const monthsList = mode === "Yearly" ? [0,1,2,3,4,5,6,7,8,9,10,11] : [q*3, q*3+1, q*3+2];
  const data = monthsList.map((m) => ({
    name: MONTHS[m].slice(0, 3),
    Income: sumTx(income.filter((t) => inPeriod(t, "Monthly", y, m))),
    Expense: sumTx(expense.filter((t) => inPeriod(t, "Monthly", y, m))),
  }));
  const totInc = data.reduce((a, d) => a + d.Income, 0), totExp = data.reduce((a, d) => a + d.Expense, 0);
  const label = mode === "Yearly" ? `${y}` : `${QLABEL[q]} ${y}`;
  return (
    <Modal onClose={onClose} title="Detailed Analytics" wide>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: C.muted }}>View by</span>
        {["Quarterly", "Yearly"].map((m) => <Seg key={m} on={mode === m} onClick={() => setMode(m)}>{m}</Seg>)}
      </div>
      <div style={{ fontSize: 12, color: C.muted, margin: "8px 0 4px" }}>Drill-down income vs expense for {label}</div>
      <MonthNav label={label} onPrev={() => step(-1)} onNext={() => step(1)} />
      <div style={{ height: 220 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 16, right: 10, left: 0, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => v >= 1e6 ? `${v / 1e6}M` : v} tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v) => fmtRp(v)} contentStyle={{ borderRadius: 10, border: `1px solid ${C.line}`, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Income" fill={C.blue} radius={[4, 4, 0, 0]} /><Bar dataKey="Expense" fill={C.red} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 12 }}>
        <MiniStat label="Total Income" value={fmtRp(totInc)} tone={C.blue} />
        <MiniStat label="Total Expense" value={fmtRp(totExp)} tone={C.red} />
        <MiniStat label="Net Change" value={`${totInc - totExp >= 0 ? "+" : ""}${fmtRp(totInc - totExp)}`} tone={C.green} />
      </div>
    </Modal>
  );
}
function MiniStat({ label, value, tone }) {
  return <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 12 }}><div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{label}</div><div className="disp" style={{ fontSize: 14, color: tone }}>{value}</div></div>;
}

function Invoicing({ state, update, currentUser }) {
  const { projects, invoices, company } = state;
  const invoiceable = projects.filter((p) => p.status !== "Prospect" && !p.archived);
  const [target, setTarget] = useState(null);
  const nextNumber = () => `INV-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(4, "0")}`;
  const generate = (project, number, date) => {
    buildInvoiceDoc({ company, project, number, dateStr: prettyDate(date) });
    update((prev) => ({ invoices: [{ id: uid(), projectId: project.id, number, date, generatedBy: currentUser, createdAt: todayISO() }, ...prev.invoices] }));
    setTarget(null);
  };
  const removeInvoice = (id) => update((prev) => ({ invoices: prev.invoices.filter((i) => i.id !== id) }));
  const regenerate = (inv) => { const p = projects.find((x) => x.id === inv.projectId); if (p) buildInvoiceDoc({ company, project: p, number: inv.number, dateStr: prettyDate(inv.date) }); };
  return (
    <div className="fade">
      <Header title="Invoicing" />
      <div style={{ background: C.amberSoft, border: `1px solid ${C.amber}44`, borderRadius: 12, padding: "12px 16px", fontSize: 12.5, color: C.ink2, marginBottom: 20, display: "flex", gap: 10, alignItems: "center" }}>
        <FileText size={16} color={C.amber} /> Generates a Word (A4 landscape) invoice with date, client and project pre-filled. Address & amounts are placeholders you type in Word.
      </div>
      <SectionLabel>Projects available to invoice</SectionLabel>
      {invoiceable.length === 0 ? <EmptyState label="No invoiceable projects yet. Any project past 'Prospect' can be invoiced." /> : (
        <div style={{ display: "grid", gap: 10, marginBottom: 30 }}>
          {invoiceable.map((p) => (
            <Card key={p.id} style={{ padding: 15, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <div style={{ width: 4, alignSelf: "stretch", borderRadius: 3, background: STATUS_META[p.status].color }} />
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}><h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700 }}>{p.name}</h3>{p.client && <span style={{ fontSize: 12, color: C.blue }}>· {p.client}</span>}<StatusPill status={p.status} /></div>
                <div style={{ fontSize: 11.5, color: C.muted, marginTop: 4 }}>PIC {p.pic || "—"}</div>
              </div>
              <PrimaryButton small onClick={() => setTarget(p)}><Download size={14} /> Create invoice</PrimaryButton>
            </Card>
          ))}
        </div>
      )}
      {invoices.length > 0 && (<>
        <SectionLabel>Generated invoices</SectionLabel>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          {invoices.map((inv, idx) => { const proj = projects.find((p) => p.id === inv.projectId);
            return (
              <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderTop: idx ? `1px solid ${C.lineSoft}` : "none", flexWrap: "wrap" }}>
                <span className="mono" style={{ fontSize: 12.5, color: C.blue, width: 120 }}>{inv.number}</span>
                <span style={{ flex: 1, fontSize: 13, minWidth: 120, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{proj?.name || "—"}{proj?.client ? ` · ${proj.client}` : ""}</span>
                <span style={{ fontSize: 12, color: C.muted, width: 130 }}>{prettyDate(inv.date)}</span>
                <span style={{ fontSize: 11.5, color: C.muted, width: 90 }}>{inv.generatedBy}</span>
                <IconBtn onClick={() => regenerate(inv)} title="Download again"><Download size={14} /></IconBtn>
                <IconBtn onClick={() => removeInvoice(inv.id)} title="Delete" danger><Trash2 size={14} /></IconBtn>
              </div>
            ); })}
        </Card>
      </>)}
      {target && <InvoiceModal project={target} defaultNumber={nextNumber()} company={company} onGenerate={generate} onClose={() => setTarget(null)} />}
    </div>
  );
}

function InvoiceModal({ project, defaultNumber, company, onGenerate, onClose }) {
  const isMobile = useIsMobile();
  const [number, setNumber] = useState(defaultNumber); const [date, setDate] = useState(todayISO());
  return (
    <Modal onClose={onClose} title="Create Word invoice" wide>
      <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 16 }}>For: <span style={{ color: C.ink }}>{project.name}</span>{project.client ? ` — ${project.client}` : ""}</div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
        <Field label="Invoice number"><TextInput value={number} onChange={setNumber} /></Field>
        <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} /></Field>
      </div>
      <div style={{ background: C.panel, border: `1px dashed ${C.line}`, borderRadius: 10, padding: 14, marginTop: 16, fontSize: 12, color: C.ink2, lineHeight: 1.6 }}>
        <b>Auto-filled:</b> Date · To: {project.client || "(client)"} · Project: {project.name}<br /><b>Placeholders in Word:</b> Address, Description, Amount, Amount in words<br /><b>Signed:</b> {company.city}, {prettyDate(date)} — {company.signer}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <PrimaryButton onClick={() => onGenerate(project, number, date)}><Download size={15} /> Download .doc</PrimaryButton>
      </div>
    </Modal>
  );
}

/* ------------------------------ Settings ------------------------------ */
function SettingsView({ state, update, account }) {
  const isMobile = useIsMobile(); const admin = useAdmin();
  const [names, setNames] = useState(() => (state.members && state.members.length ? [...state.members] : [""]));
  const [comp, setComp] = useState({ ...state.company });
  const [pw, setPw] = useState({ cur: "", n1: "", n2: "" }); const [msg, setMsg] = useState("");
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 2500); };
  const saveTeam = () => { update({ members: Array.from(new Set(names.map((n) => n.trim()).filter(Boolean))), company: comp }); flash("Saved."); };
  const changePw = async () => {
    if (!account) return;
    if (pw.n1.length < 6) return flash("New password should be at least 6 characters."); if (pw.n1 !== pw.n2) return flash("New passwords don't match.");
    const { error: e1 } = await supabase.auth.signInWithPassword({ email: account.email, password: pw.cur });
    if (e1) return flash("Current password is incorrect.");
    const { error } = await supabase.auth.updateUser({ password: pw.n1 });
    if (error) return flash(error.message);
    setPw({ cur: "", n1: "", n2: "" }); flash("Your password was updated.");
  };
  const accounts = state.accounts || [];
  const two = { display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 };
  return (
    <div className="fade">
      <Header title="Settings" />
      {msg && <div style={{ background: C.blueSoft, border: `1px solid ${C.blue}`, color: C.blueDeep, padding: "10px 14px", borderRadius: 10, fontSize: 12.5, marginBottom: 16 }}>{msg}</div>}
      <Card style={{ padding: 22, marginBottom: 16 }}>
        <ChartTitle><Users size={15} style={{ marginRight: 7, verticalAlign: -2 }} />Team members</ChartTitle>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>These names fill the PIC and collaborator pickers. New accounts are added automatically when someone registers.</div>
        <div style={two}>{names.map((n, i) => (
          <div key={i} style={{ display: "flex", gap: 6 }}>
            <TextInput value={n} onChange={(v) => setNames((p) => p.map((x, j) => j === i ? v : x))} placeholder={`Member ${i + 1}`} />
            <IconBtn onClick={() => setNames((p) => p.filter((_, j) => j !== i))} title="Remove" danger><Trash2 size={14} /></IconBtn>
          </div>
        ))}</div>
        <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
          <GhostButton onClick={() => setNames((p) => [...p, ""])}><Plus size={14} /> Add member</GhostButton>
          <PrimaryButton onClick={saveTeam}>Save members</PrimaryButton>
        </div>
      </Card>
      <Card style={{ padding: 22, marginBottom: 16 }}>
        <ChartTitle><UserCircle size={15} style={{ marginRight: 7, verticalAlign: -2 }} />Registered accounts <span style={{ color: C.muted, fontWeight: 600 }}>({accounts.length})</span></ChartTitle>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>Anyone with an email, a personal password and the team access code can register.</div>
        <div style={{ display: "grid", gap: 8 }}>
          {accounts.map((a) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, padding: "8px 10px", border: `1px solid ${C.lineSoft}`, borderRadius: 10 }}>
              <Avatar name={a.name} members={state.members} size={26} />
              <div style={{ minWidth: 0, flex: 1 }}><div style={{ fontWeight: 700 }}>{a.name}{account && a.id === account.id ? <span style={{ color: C.blue, fontWeight: 600 }}> · you</span> : null}</div><div style={{ color: C.muted, fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis" }}>{a.email}</div></div>
              <span style={{ color: C.faint, fontSize: 11, whiteSpace: "nowrap" }}>{(a.createdAt || "").slice(0, 10)}</span>
            </div>
          ))}
          {accounts.length === 0 && <div style={{ fontSize: 12, color: C.faint }}>No accounts yet.</div>}
        </div>
      </Card>
      <Card style={{ padding: 22, marginBottom: 16 }}>
        <ChartTitle>Company details — used on invoices only</ChartTitle>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: 12 }}>
            <Field label="Company name (on invoices)"><TextInput value={comp.name || ""} onChange={(v) => setComp({ ...comp, name: v })} /></Field>
            <Field label="Currency"><Select value={comp.currency || "Rp"} onChange={(v) => setComp({ ...comp, currency: v })} options={["Rp", "USD", "SGD", "AUD", "EUR"]} /></Field>
          </div>
          <div style={two}>
            <Field label="Invoice signed in (city)"><TextInput value={comp.city || ""} onChange={(v) => setComp({ ...comp, city: v })} /></Field>
            <Field label="Invoice signer name"><TextInput value={comp.signer || ""} onChange={(v) => setComp({ ...comp, signer: v })} /></Field>
          </div>
          <Field label="Address (optional)"><textarea value={comp.address || ""} onChange={(e) => setComp({ ...comp, address: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical" }} /></Field>
        </div>
        <div style={{ marginTop: 16 }}><PrimaryButton onClick={saveTeam}>Save details</PrimaryButton></div>
      </Card>
      <Card style={{ padding: 22 }}>
        <ChartTitle><Lock size={14} style={{ marginRight: 7, verticalAlign: -2 }} />Change my password <span style={{ color: C.muted, fontWeight: 600 }}>{account ? `· ${account.email}` : ""}</span></ChartTitle>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12 }}>
          <Field label="Current"><TextInput type="password" value={pw.cur} onChange={(v) => setPw({ ...pw, cur: v })} /></Field>
          <Field label="New"><TextInput type="password" value={pw.n1} onChange={(v) => setPw({ ...pw, n1: v })} /></Field>
          <Field label="Confirm new"><TextInput type="password" value={pw.n2} onChange={(v) => setPw({ ...pw, n2: v })} /></Field>
        </div>
        <div style={{ marginTop: 16 }}><GhostButton onClick={changePw}>Update password</GhostButton></div>
      </Card>
      <Card style={{ padding: 22, marginTop: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Lock size={16} color={admin.unlocked ? C.green : C.muted} />
        <div style={{ flex: 1, minWidth: 200 }}><div style={{ fontSize: 13.5, fontWeight: 700 }}>Admin access</div><div style={{ fontSize: 12, color: C.muted }}>Reports, Balance and Invoicing need the admin password. {admin.unlocked ? "Currently unlocked for this session." : "Currently locked."}</div></div>
        {admin.unlocked && <GhostButton onClick={admin.lock}>Lock again</GhostButton>}
      </Card>
    </div>
  );
}

/* ============================ primitives ============================ */
const inputStyle = { width: "100%", background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10, color: C.ink, fontSize: 13.5, padding: "10px 12px" };
const iconBtnStyle = { width: 34, height: 34, borderRadius: 9, border: `1px solid ${C.line}`, background: "#fff", color: C.ink2, cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 };
const ghostBtnStyle = { background: "#fff", color: C.ink2, border: `1px solid ${C.line}`, borderRadius: 10, padding: "9px 12px", fontSize: 13, fontWeight: 600 };
const linkBtn = { display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", color: C.blue, cursor: "pointer", fontSize: 13.5, fontWeight: 600 };

function Header({ title, sub, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 22, gap: 16, flexWrap: "wrap" }}>
      <div><h1 className="disp" style={{ fontSize: 25, margin: 0 }}>{title}</h1>{sub && <p style={{ margin: "6px 0 0", color: C.muted, fontSize: 13.5 }}>{sub}</p>}</div>
      {action}
    </div>
  );
}
function Card({ children, style }) { return <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, ...style }}>{children}</div>; }
function PanelTitle({ children }) { return <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 12 }}>{children}</div>; }
function ChartTitle({ children }) { return <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink, marginBottom: 8 }}>{children}</div>; }
function SectionLabel({ children }) { return <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: C.muted, margin: "4px 0 12px" }}>{children}</div>; }
function SubLabel({ children }) { return <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 700, color: C.ink2, margin: "6px 0 12px" }}>{children}</div>; }
function Meta({ label, value }) { return <span style={{ color: C.muted }}>{label}: <span style={{ color: C.ink2 }}>{value}</span></span>; }
function NoData() { return <div style={{ height: 140, display: "grid", placeItems: "center", color: C.muted, fontSize: 12.5 }}>No data yet</div>; }
function Avatar({ name, members, size = 26 }) {
  const bg = colorFor(name, members);
  return <div style={{ width: size, height: size, borderRadius: "50%", background: bg + "22", color: bg, display: "grid", placeItems: "center", fontSize: size * 0.4, fontWeight: 700, flexShrink: 0 }}>{initials(name)}</div>;
}
function Checkbox({ on, onClick }) {
  return <button onClick={onClick} style={{ width: 20, height: 20, minWidth: 20, padding: 0, margin: 0, lineHeight: 0, borderRadius: 6, cursor: "pointer", border: `1.5px solid ${on ? C.green : C.faint}`, background: on ? C.green : "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, appearance: "none", WebkitAppearance: "none" }}>{on && <Check size={13} color="#fff" strokeWidth={3} style={{ display: "block" }} />}</button>;
}
function AssigneeChip({ assignee, members }) {
  if (!assignee || assignee === "All") return <span style={{ fontSize: 10.5, fontWeight: 600, color: C.muted, background: C.slateSoft, borderRadius: 20, padding: "2px 9px", whiteSpace: "nowrap" }}>All</span>;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 600, color: C.ink2, background: C.bg, borderRadius: 20, padding: "2px 9px 2px 2px", whiteSpace: "nowrap" }}><Avatar name={assignee} members={members} size={18} /> {assignee.split(" ")[0]}</span>;
}
function StatusPill({ status }) {
  const m = STATUS_META[status] || STATUS_META["Prospect"]; const Icon = m.icon;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: m.color, background: m.soft, borderRadius: 20, padding: "3px 10px" }}><Icon size={12} /> {status}</span>;
}
function SubStatusTag({ status, subStatus }) {
  if (!subStatus) return null;
  const m = STATUS_META[status] || STATUS_META["Prospect"];
  return <span style={{ fontSize: 10.5, fontWeight: 600, color: m.color, border: `1px solid ${m.color}`, borderRadius: 20, padding: "2px 9px" }}>{subStatus}</span>;
}
function PriorityChip({ priority, small }) {
  const m = PRIORITY_META[priority] || PRIORITY_META["Moderate"];
  return <span title={`Priority: ${priority}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: small ? 9.5 : 11, fontWeight: 700, color: m.color, background: m.soft, borderRadius: 20, padding: small ? "1px 7px" : "2px 9px" }}><Flag size={small ? 9 : 11} /> {priority}</span>;
}
function EmptyState({ label, cta }) {
  return <Card style={{ padding: 44, textAlign: "center" }}><Sparkles size={22} color={C.faint} style={{ marginBottom: 12 }} /><div style={{ color: C.ink2, fontSize: 13.5 }}>{label}</div>{cta && <div style={{ marginTop: 16 }}><PrimaryButton onClick={cta.onClick}><Plus size={15} /> {cta.label}</PrimaryButton></div>}</Card>;
}
function IconBtn({ children, onClick, title, danger, small }) {
  const s = small ? { width: 28, height: 28 } : {};
  return <button onClick={onClick} title={title} style={{ ...iconBtnStyle, ...s, ...(danger ? { color: C.red } : {}) }} onMouseEnter={(e) => (e.currentTarget.style.background = C.bg)} onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}>{children}</button>;
}
function PrimaryButton({ children, onClick, disabled, full, small, style }) {
  return <button onClick={onClick} disabled={disabled} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, background: disabled ? C.lineSoft : C.blue, color: disabled ? C.faint : "#fff", border: "none", borderRadius: 11, padding: small ? "8px 13px" : "11px 17px", fontSize: small ? 12.5 : 13.5, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", width: full ? "100%" : "auto", ...style }}>{children}</button>;
}
function GhostButton({ children, onClick }) {
  return <button onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#fff", color: C.ink2, border: `1px solid ${C.line}`, borderRadius: 11, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>{children}</button>;
}
function Field({ label, children }) { return <label style={{ display: "block" }}><div style={{ fontSize: 12, color: C.ink2, marginBottom: 7, fontWeight: 600 }}>{label}</div>{children}</label>; }
function TextInput({ value, onChange, placeholder, type = "text", autoFocus, onEnter }) {
  const [peek, setPeek] = useState(false);
  const isPw = type === "password";
  const input = <input type={isPw && peek ? "text" : type} value={value} autoFocus={autoFocus} placeholder={placeholder}
    autoComplete={isPw ? "current-password" : undefined}
    onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && onEnter) onEnter(); }}
    style={isPw ? { ...inputStyle, paddingRight: 40 } : inputStyle} />;
  if (!isPw) return input;
  return (
    <div style={{ position: "relative", width: "100%" }}>
      {input}
      <button type="button" onClick={() => setPeek((p) => !p)} title={peek ? "Hide" : "Show"} aria-label={peek ? "Hide password" : "Show password"}
        style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", width: 30, height: 30, border: "none", background: "transparent",
          color: peek ? C.blue : C.muted, cursor: "pointer", display: "grid", placeItems: "center", borderRadius: 8 }}>
        {peek ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
function Select({ value, onChange, options, compact, placeholder }) {
  const opts = (options || []).map((o) => (o && typeof o === "object" ? o : { value: o, label: o }));
  return <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, width: compact ? "auto" : "100%", cursor: "pointer", appearance: "none", paddingRight: 30, color: value ? C.ink : C.muted,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237B808A' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" }}>
    {placeholder !== undefined && <option value="">{placeholder}</option>}
    {opts.map((o) => <option key={o.value} value={o.value} style={{ color: C.ink }}>{o.label}</option>)}
  </select>;
}
function Modal({ children, onClose, title, wide, xwide }) {
  const isMobile = useIsMobile();
  useEffect(() => { const f = (e) => e.key === "Escape" && onClose(); window.addEventListener("keydown", f); return () => window.removeEventListener("keydown", f); }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "#14141433", backdropFilter: "blur(3px)", display: "grid", placeItems: isMobile ? "end stretch" : "center", zIndex: 100, padding: isMobile ? 0 : 20 }}>
      <div onClick={(e) => e.stopPropagation()} className="fade ui" style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: isMobile ? "18px 18px 0 0" : 18, width: "100%", maxWidth: isMobile ? "100%" : (xwide ? 720 : wide ? 560 : 440), maxHeight: isMobile ? "92vh" : "90vh", overflowY: "auto", padding: isMobile ? 20 : 26, boxShadow: "0 20px 60px #14141426" }}>
        <div style={{ display: "flex", justifyContent: title ? "space-between" : "flex-end", alignItems: "center", marginBottom: title ? 20 : 4 }}>
          {title && <h2 className="disp" style={{ margin: 0, fontSize: 18 }}>{title}</h2>}
          <IconBtn onClick={onClose} title="Close"><X size={16} /></IconBtn>
        </div>
        {children}
      </div>
    </div>
  );
}
