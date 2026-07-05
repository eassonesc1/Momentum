import { isSupabaseConfigured, supabase } from "./supabase.js";

const LOCAL_PREFIX = "momentum:data";
let fallbackWarningShown = false;

function warnFallback() {
  if (isSupabaseConfigured || fallbackWarningShown) {
    return;
  }

  fallbackWarningShown = true;
  console.warn("Momentum is saving to localStorage because Supabase is not configured.");
}

function localKey(userId, resource) {
  return `${LOCAL_PREFIX}:${userId}:${resource}`;
}

function readLocal(userId, resource, fallback) {
  warnFallback();

  try {
    const raw = localStorage.getItem(localKey(userId, resource));
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.warn(`Could not read local ${resource}.`, error);
    return fallback;
  }
}

function writeLocal(userId, resource, value) {
  warnFallback();
  localStorage.setItem(localKey(userId, resource), JSON.stringify(value));
  return value;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value || "",
  );
}

function normalizeProfile(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id || null,
    userId: row.user_id,
    displayName: row.display_name || "Workspace",
  };
}

function normalizeDailyEntry(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id || null,
    userId: row.user_id,
    date: row.entry_date,
    data: row.data || {},
  };
}

function normalizeJournalEntry(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id || null,
    userId: row.user_id,
    date: row.entry_date,
    text: row.content || "",
    mood: row.mood ?? null,
    tags: row.tags || [],
  };
}

function normalizeApplication(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    date: row.applied_date,
    company: row.company || "",
    position: row.role || "",
    status: row.status || "Saved",
    notes: row.notes || "",
  };
}

export async function createProfile(userId, displayName) {
  const profile = { userId, displayName: displayName || "Workspace" };

  if (!isSupabaseConfigured) {
    const profiles = readLocal("profiles", "items", []);
    const nextProfiles = [
      ...profiles.filter((item) => item.userId !== userId),
      profile,
    ];
    writeLocal("profiles", "items", nextProfiles);
    return profile;
  }

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        user_id: userId,
        display_name: profile.displayName,
      },
      { onConflict: "user_id" },
    )
    .select("id, user_id, display_name")
    .single();

  if (error) {
    throw error;
  }

  return normalizeProfile(data);
}

export async function loadProfile(userId) {
  if (!isSupabaseConfigured) {
    const profiles = readLocal("profiles", "items", []);
    return profiles.find((item) => item.userId === userId) || null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, user_id, display_name")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return normalizeProfile(data);
}

export async function saveDailyEntry(userId, date, data) {
  if (!isSupabaseConfigured) {
    const entries = readLocal(userId, "daily_entries", []);
    const entry = { userId, date, data };
    const nextEntries = [
      ...entries.filter((item) => item.date !== date),
      entry,
    ].sort((a, b) => a.date.localeCompare(b.date));
    writeLocal(userId, "daily_entries", nextEntries);
    return entry;
  }

  const { data: row, error } = await supabase
    .from("daily_entries")
    .upsert(
      {
        user_id: userId,
        entry_date: date,
        data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,entry_date" },
    )
    .select("id, user_id, entry_date, data")
    .single();

  if (error) {
    throw error;
  }

  return normalizeDailyEntry(row);
}

export async function loadDailyEntry(userId, date) {
  if (!isSupabaseConfigured) {
    const entries = readLocal(userId, "daily_entries", []);
    return entries.find((entry) => entry.date === date) || null;
  }

  const { data, error } = await supabase
    .from("daily_entries")
    .select("id, user_id, entry_date, data")
    .eq("user_id", userId)
    .eq("entry_date", date)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return normalizeDailyEntry(data);
}

export async function loadDailyEntries(userId) {
  if (!isSupabaseConfigured) {
    return readLocal(userId, "daily_entries", []);
  }

  const { data, error } = await supabase
    .from("daily_entries")
    .select("id, user_id, entry_date, data")
    .eq("user_id", userId)
    .order("entry_date", { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []).map(normalizeDailyEntry);
}

export async function saveJournalEntry(userId, entry) {
  const normalized = {
    id: entry.id || null,
    userId,
    date: entry.date,
    text: entry.text || "",
    mood: entry.mood ?? null,
    tags: entry.tags || [],
  };

  if (!isSupabaseConfigured) {
    const entries = readLocal(userId, "journal_entries", []);
    const nextEntries = [
      ...entries.filter((item) => item.date !== normalized.date),
      normalized,
    ].sort((a, b) => a.date.localeCompare(b.date));
    writeLocal(userId, "journal_entries", nextEntries);
    return normalized;
  }

  const existing = normalized.id
    ? { id: normalized.id }
    : await findJournalEntry(userId, normalized.date);

  const payload = {
    user_id: userId,
    entry_date: normalized.date,
    content: normalized.text,
    mood: normalized.mood,
    tags: normalized.tags,
    updated_at: new Date().toISOString(),
  };

  const query = existing?.id
    ? supabase.from("journal_entries").update(payload).eq("id", existing.id)
    : supabase.from("journal_entries").insert(payload);

  const { data, error } = await query
    .select("id, user_id, entry_date, content, mood, tags")
    .single();

  if (error) {
    throw error;
  }

  return normalizeJournalEntry(data);
}

async function findJournalEntry(userId, date) {
  const { data, error } = await supabase
    .from("journal_entries")
    .select("id")
    .eq("user_id", userId)
    .eq("entry_date", date)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function loadJournalEntries(userId) {
  if (!isSupabaseConfigured) {
    return readLocal(userId, "journal_entries", []);
  }

  const { data, error } = await supabase
    .from("journal_entries")
    .select("id, user_id, entry_date, content, mood, tags")
    .eq("user_id", userId)
    .order("entry_date", { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []).map(normalizeJournalEntry);
}

export async function saveJobApplication(userId, application) {
  const payload = {
    user_id: userId,
    company: application.company || "",
    role: application.position || "",
    status: application.status || "Saved",
    notes: application.notes || "",
    applied_date: application.date,
    updated_at: new Date().toISOString(),
  };

  if (!isSupabaseConfigured) {
    const applications = readLocal(userId, "job_applications", []);
    const localApplication = { ...application, userId };
    const nextApplications = [
      ...applications.filter((item) => item.id !== localApplication.id),
      localApplication,
    ];
    writeLocal(userId, "job_applications", nextApplications);
    return localApplication;
  }

  const query =
    isUuid(application.id)
      ? supabase.from("job_applications").update(payload).eq("id", application.id)
      : supabase.from("job_applications").insert(payload);

  const { data, error } = await query
    .select("id, user_id, company, role, status, notes, applied_date")
    .single();

  if (error) {
    throw error;
  }

  return normalizeApplication(data);
}

export async function loadJobApplications(userId) {
  if (!isSupabaseConfigured) {
    return readLocal(userId, "job_applications", []);
  }

  const { data, error } = await supabase
    .from("job_applications")
    .select("id, user_id, company, role, status, notes, applied_date")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map(normalizeApplication);
}

export async function deleteJobApplication(userId, applicationId) {
  if (!isSupabaseConfigured) {
    const applications = readLocal(userId, "job_applications", []);
    writeLocal(
      userId,
      "job_applications",
      applications.filter((item) => item.id !== applicationId),
    );
    return;
  }

  if (!isUuid(applicationId)) {
    return;
  }

  const { error } = await supabase
    .from("job_applications")
    .delete()
    .eq("user_id", userId)
    .eq("id", applicationId);

  if (error) {
    throw error;
  }
}
