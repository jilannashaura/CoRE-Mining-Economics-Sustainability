import { supabase } from "./supabaseClient";

const DEFAULT_COMPANY = {
  name: "Unit Cost Research Team", address: "", email: "",
  currency: "Rp", city: "Bandung", signer: "Firly Rachmaditya Baskoro",
};

/* ---- projects ---- */
const projToApp = (r) => ({
  id: r.id, name: r.name, client: r.client || "", category: r.category || "Project",
  status: r.status || "Prospect", source: r.source || "", pic: r.pic || "",
  collaborators: r.collaborators || [], description: r.description || "",
  dataRoom: r.data_room || "", kickoff: r.kickoff || "", wrapup: r.wrapup || "",
  milestones: r.milestones || [], checklist: r.checklist || [],
  archived: r.archived || false, archivedAt: r.archived_at || "",
  finishedAt: r.finished_at || (r.status === "Finished" && r.updated_at ? r.updated_at.slice(0, 10) : ""),
  createdBy: r.created_by || "", createdAt: r.created_at, updatedAt: r.updated_at,
});
const projToRow = (p) => ({
  id: p.id, name: p.name, client: p.client || "", category: p.category || "Project",
  status: p.status || "Prospect", source: p.source || "", pic: p.pic || "",
  collaborators: p.collaborators || [], description: p.description || "",
  data_room: p.dataRoom || "", kickoff: p.kickoff || null, wrapup: p.wrapup || null,
  milestones: p.milestones || [], checklist: p.checklist || [],
  archived: !!p.archived, archived_at: p.archivedAt || null, finished_at: p.finishedAt || null,
  created_by: p.createdBy || "", updated_at: new Date().toISOString(),
});

export async function listProjects() {
  const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(projToApp);
}
export async function upsertProject(p) {
  const { data, error } = await supabase.from("projects").upsert(projToRow(p)).select().single();
  if (error) throw error;
  return projToApp(data);
}
export async function deleteProject(id) {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
}

/* ---- invoices ---- */
const invToApp = (r) => ({ id: r.id, projectId: r.project_id, number: r.number, date: r.date, generatedBy: r.generated_by || "", createdAt: r.created_at });
export async function listInvoices() {
  const { data, error } = await supabase.from("invoices").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(invToApp);
}
export async function insertInvoice(inv) {
  const row = { id: inv.id, project_id: inv.projectId, number: inv.number, date: inv.date, generated_by: inv.generatedBy || "" };
  const { data, error } = await supabase.from("invoices").insert(row).select().single();
  if (error) throw error;
  return invToApp(data);
}
export async function deleteInvoice(id) {
  const { error } = await supabase.from("invoices").delete().eq("id", id);
  if (error) throw error;
}

/* ---- settings (single row keyed 'main') ---- */
export async function getSettings() {
  const { data, error } = await supabase.from("settings").select("*").eq("id", "main").maybeSingle();
  if (error) throw error;
  if (!data) {
    const def = { id: "main", company: DEFAULT_COMPANY, members: ["Firly Rachmaditya Baskoro"] };
    const { data: ins, error: e2 } = await supabase.from("settings").upsert(def).select().single();
    if (e2) throw e2;
    return { company: { ...DEFAULT_COMPANY, ...(ins.company || {}) }, members: ins.members || [] };
  }
  return { company: { ...DEFAULT_COMPANY, ...(data.company || {}) }, members: data.members || [] };
}
export async function upsertSettings({ company, members }) {
  const { error } = await supabase.from("settings").upsert({ id: "main", company, members, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/* ---- announcements ---- */
const annToApp = (r) => ({ id: r.id, author: r.author || "", text: r.text || "", createdAt: r.created_at, expiresAt: r.expires_at || null, tags: r.tags || [], editedAt: r.edited_at || null, comments: r.comments || [] });
export async function listAnnouncements() {
  const { data, error } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(annToApp);
}
export async function insertAnnouncement(a) {
  const row = { id: a.id, author: a.author || "", text: a.text || "", created_at: a.createdAt || new Date().toISOString(), expires_at: a.expiresAt || null, tags: a.tags || [], edited_at: a.editedAt || null, comments: a.comments || [] };
  const { data, error } = await supabase.from("announcements").upsert(row).select().single();
  if (error) throw error;
  return annToApp(data);
}
export async function updateAnnouncement(a) { return insertAnnouncement(a); }
export async function deleteAnnouncement(id) {
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) throw error;
}

/* ---- notifications ---- */
const notifToApp = (r) => ({ id: r.id, to: r.to_member || "", type: r.type || "", text: r.text || "", projectId: r.project_id || "", createdAt: r.created_at });
export async function listNotifications() {
  const { data, error } = await supabase.from("notifications").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(notifToApp);
}
export async function insertNotifications(list) {
  if (!list || !list.length) return [];
  const rows = list.map((n) => ({ id: n.id, to_member: n.to, type: n.type, text: n.text, project_id: n.projectId || null, created_at: n.createdAt || new Date().toISOString() }));
  const { data, error } = await supabase.from("notifications").insert(rows).select();
  if (error) throw error;
  return (data || []).map(notifToApp);
}
export async function deleteNotification(id) {
  const { error } = await supabase.from("notifications").delete().eq("id", id);
  if (error) throw error;
}

/* ---- transactions ---- */
const txToApp = (r) => ({ id: r.id, date: r.date || "", projectId: r.project_id || "", description: r.description || "",
  type: r.type || "Expense", category: r.category || "", workCategory: r.work_category || "", amount: Number(r.amount) || 0,
  account: r.account || "", accountOther: r.account_other || "", method: r.method || "", receipt: r.receipt || null,
  createdBy: r.created_by || "", createdAt: r.created_at });
const txToRow = (t) => ({ id: t.id, date: t.date || null, project_id: t.projectId || null, description: t.description || "",
  type: t.type, category: t.category || "", work_category: t.workCategory || "", amount: Number(t.amount) || 0,
  account: t.account || "", account_other: t.accountOther || "", method: t.method || "", receipt: t.receipt || null,
  created_by: t.createdBy || "", created_at: t.createdAt || new Date().toISOString() });
export async function listTransactions() {
  const { data, error } = await supabase.from("transactions").select("*").order("date", { ascending: false });
  if (error) throw error; return (data || []).map(txToApp);
}
export async function insertTransaction(t) {
  const { data, error } = await supabase.from("transactions").insert(txToRow(t)).select().single();
  if (error) throw error; return txToApp(data);
}
export async function deleteTransaction(id) {
  const { error } = await supabase.from("transactions").delete().eq("id", id); if (error) throw error;
}

/* ---- reports (history snapshots) ---- */
const repToApp = (r) => ({ id: r.id, type: r.type, start: r.start_date, end: r.end_date,
  generatedBy: r.generated_by || "", generatedAt: r.generated_at,
  snapshotProjects: (r.snapshot && r.snapshot.projects) || [], snapshotTx: (r.snapshot && r.snapshot.transactions) || [] });
export async function listReports() {
  const { data, error } = await supabase.from("reports").select("*").order("generated_at", { ascending: false });
  if (error) throw error; return (data || []).map(repToApp);
}
export async function insertReport(r) {
  const id = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : (Date.now() + "-" + Math.random().toString(16).slice(2));
  const row = { id, type: r.type, start_date: r.start, end_date: r.end,
    generated_by: r.generatedBy || "", generated_at: r.generatedAt || new Date().toISOString(),
    snapshot: { projects: r.snapshotProjects || [], transactions: r.snapshotTx || [] } };
  const { data, error } = await supabase.from("reports").insert(row).select().single();
  if (error) throw error; return repToApp(data);
}
export async function deleteReport(id) {
  const { error } = await supabase.from("reports").delete().eq("id", id); if (error) throw error;
}
