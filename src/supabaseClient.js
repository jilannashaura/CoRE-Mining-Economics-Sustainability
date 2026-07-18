import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  // Helps you catch a missing .env / Netlify env var during setup.
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Set them in .env (local) and in Netlify (Site settings → Environment variables).");
}

export const supabase = createClient(url || "", key || "");
