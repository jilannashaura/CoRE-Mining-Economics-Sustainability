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
  createdBy: r.created_by || "", createdAt: r.created_at, updatedAt: r.updated_at,
});
const projToRow = (p) => ({
  id: p.id, name: p.name, client: p.client || "", category: p.category || "Project",
  status: p.status || "Prospect", source: p.source || "", pic: p.pic || "",
  collaborators: p.collaborators || [], description: p.description || "",
  data_room: p.dataRoom || "", kickoff: p.kickoff || null, wrapup: p.wrapup || null,
  milestones: p.milestones || [], checklist: p.checklist || [],
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
