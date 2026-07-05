import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// Supabase's current dashboard labels this browser-safe key as a publishable key.
// Keep the env name stable for Vite/Vercel compatibility.
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabasePublishableKey,
);

export const supabaseConfig = {
  hasSupabaseUrl: Boolean(supabaseUrl),
  hasSupabaseKey: Boolean(supabasePublishableKey),
  activeBackend: isSupabaseConfigured ? "Supabase" : "localStorage",
};

console.log("[Momentum Supabase] Environment check", supabaseConfig);
console.log(`Storage backend: ${supabaseConfig.activeBackend}`);

if (!isSupabaseConfigured) {
  console.warn(
    "Momentum Supabase env vars are missing. Using localStorage fallback.",
  );
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey)
  : null;
