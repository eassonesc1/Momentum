import { isSupabaseConfigured, supabase } from "./supabase.js";

const LOCAL_PREFIX = "momentum:data";
let fallbackWarningShown = false;

function logPersistence(operation, details = {}) {
  console.info(`[Momentum persistence] ${operation}`, {
    supabaseConfigured: isSupabaseConfigured,
    ...details,
  });
}

function logPersistenceError(operation, error) {
  console.error(`[Momentum persistence] ${operation} failed`, {
    message: error?.message || "Unknown error",
    code: error?.code || null,
    details: error?.details || null,
    hint: error?.hint || null,
  });
}

function warnFallback(reason = "Supabase is not configured.") {
  if (fallbackWarningShown) {
    return;
  }

  fallbackWarningShown = true;
  console.warn(`Momentum is using localStorage fallback. ${reason}`);
}

function localKey(userId, resource) {
  return `${LOCAL_PREFIX}:${userId}:${resource}`;
}

function readLocal(userId, resource, fallback) {
  try {
    const raw = localStorage.getItem(localKey(userId, resource));
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.warn(`Could not read local ${resource}.`, error);
    return fallback;
  }
}

function writeLocal(userId, resource, value) {
  localStorage.setItem(localKey(userId, resource), JSON.stringify(value));
  return value;
}

function upsertLocalBy(userId, resource, value, predicate) {
  const items = readLocal(userId, resource, []);
  const nextItems = [
    ...items.filter((item) => !predicate(item)),
    value,
  ];
  writeLocal(userId, resource, nextItems);
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
  upsertLocalBy(
    "profiles",
    "items",
    profile,
    (item) => item.userId === userId,
  );
  logPersistence("createProfile:start", { userId });

  if (!isSupabaseConfigured) {
    warnFallback("Supabase env vars are missing.");
    logPersistence("createProfile:local", { userId, result: profile });
    return profile;
  }

  try {
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

    const normalized = normalizeProfile(data);
    upsertLocalBy(
      "profiles",
      "items",
      normalized,
      (item) => item.userId === userId,
    );
    logPersistence("createProfile:supabase", { userId, result: normalized });
    return normalized;
  } catch (error) {
    logPersistenceError("createProfile", error);
    throw error;
  }
}

export async function loadProfile(userId) {
  const localProfile = readLocal("profiles", "items", []).find(
    (item) => item.userId === userId,
  );
  logPersistence("loadProfile:start", { userId });

  if (!isSupabaseConfigured) {
    warnFallback("Supabase env vars are missing.");
    logPersistence("loadProfile:local", { userId, result: localProfile || null });
    return localProfile || null;
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, user_id, display_name")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const normalized = normalizeProfile(data);
    logPersistence("loadProfile:supabase", {
      userId,
      result: normalized || localProfile || null,
    });
    return normalized || localProfile || null;
  } catch (error) {
    logPersistenceError("loadProfile", error);
    throw error;
  }
}

export async function saveDailyEntry(userId, date, data) {
  const entry = { userId, date, data };
  upsertLocalBy(userId, "daily_entries", entry, (item) => item.date === date);
  logPersistence("saveDailyEntry:start", { userId, date, data });

  if (!isSupabaseConfigured) {
    warnFallback("Supabase env vars are missing.");
    logPersistence("saveDailyEntry:local", { userId, date, result: entry });
    return entry;
  }

  try {
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

    const normalized = normalizeDailyEntry(row);
    upsertLocalBy(userId, "daily_entries", normalized, (item) => item.date === date);
    logPersistence("saveDailyEntry:supabase", { userId, date, result: normalized });
    return normalized;
  } catch (error) {
    logPersistenceError("saveDailyEntry", error);
    throw error;
  }
}

export async function loadDailyEntry(userId, date) {
  const localEntry =
    readLocal(userId, "daily_entries", []).find((entry) => entry.date === date) ||
    null;
  logPersistence("loadDailyEntry:start", { userId, date });

  if (!isSupabaseConfigured) {
    warnFallback("Supabase env vars are missing.");
    logPersistence("loadDailyEntry:local", { userId, date, result: localEntry });
    return localEntry;
  }

  try {
    const { data, error } = await supabase
      .from("daily_entries")
      .select("id, user_id, entry_date, data")
      .eq("user_id", userId)
      .eq("entry_date", date)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const normalized = normalizeDailyEntry(data);
    logPersistence("loadDailyEntry:supabase", {
      userId,
      date,
      result: normalized || localEntry,
    });
    return normalized || localEntry;
  } catch (error) {
    logPersistenceError("loadDailyEntry", error);
    throw error;
  }
}

export async function loadDailyEntries(userId) {
  const localEntries = readLocal(userId, "daily_entries", []);
  logPersistence("loadDailyEntries:start", { userId });

  if (!isSupabaseConfigured) {
    warnFallback("Supabase env vars are missing.");
    logPersistence("loadDailyEntries:local", { userId, result: localEntries });
    return localEntries;
  }

  try {
    const { data, error } = await supabase
      .from("daily_entries")
      .select("id, user_id, entry_date, data")
      .eq("user_id", userId)
      .order("entry_date", { ascending: true });

    if (error) {
      throw error;
    }

    const normalized = (data || []).map(normalizeDailyEntry);
    logPersistence("loadDailyEntries:supabase", {
      userId,
      result: normalized.length ? normalized : localEntries,
    });
    return normalized.length ? normalized : localEntries;
  } catch (error) {
    logPersistenceError("loadDailyEntries", error);
    throw error;
  }
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
  upsertLocalBy(
    userId,
    "journal_entries",
    normalized,
    (item) => item.date === normalized.date,
  );
  logPersistence("saveJournalEntry:start", {
    userId,
    date: normalized.date,
    textLength: normalized.text.length,
  });

  if (!isSupabaseConfigured) {
    warnFallback("Supabase env vars are missing.");
    logPersistence("saveJournalEntry:local", {
      userId,
      date: normalized.date,
      result: normalized,
    });
    return normalized;
  }

  try {
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

    const savedEntry = normalizeJournalEntry(data);
    upsertLocalBy(
      userId,
      "journal_entries",
      savedEntry,
      (item) => item.date === savedEntry.date,
    );
    logPersistence("saveJournalEntry:supabase", {
      userId,
      date: savedEntry.date,
      result: savedEntry,
    });
    return savedEntry;
  } catch (error) {
    logPersistenceError("saveJournalEntry", error);
    throw error;
  }
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
  const localEntries = readLocal(userId, "journal_entries", []);
  logPersistence("loadJournalEntries:start", { userId });

  if (!isSupabaseConfigured) {
    warnFallback("Supabase env vars are missing.");
    logPersistence("loadJournalEntries:local", { userId, result: localEntries });
    return localEntries;
  }

  try {
    const { data, error } = await supabase
      .from("journal_entries")
      .select("id, user_id, entry_date, content, mood, tags")
      .eq("user_id", userId)
      .order("entry_date", { ascending: true });

    if (error) {
      throw error;
    }

    const normalized = (data || []).map(normalizeJournalEntry);
    logPersistence("loadJournalEntries:supabase", {
      userId,
      result: normalized.length ? normalized : localEntries,
    });
    return normalized.length ? normalized : localEntries;
  } catch (error) {
    logPersistenceError("loadJournalEntries", error);
    throw error;
  }
}

export async function saveJobApplication(userId, application) {
  const localApplication = { ...application, userId };
  upsertLocalBy(
    userId,
    "job_applications",
    localApplication,
    (item) => item.id === localApplication.id,
  );
  logPersistence("saveJobApplication:start", {
    userId,
    applicationId: application.id,
    status: application.status,
  });

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
    warnFallback("Supabase env vars are missing.");
    logPersistence("saveJobApplication:local", {
      userId,
      result: localApplication,
    });
    return localApplication;
  }

  try {
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

    const savedApplication = normalizeApplication(data);
    const applications = readLocal(userId, "job_applications", []).filter(
      (item) => item.id !== application.id && item.id !== savedApplication.id,
    );
    writeLocal(userId, "job_applications", [...applications, savedApplication]);
    logPersistence("saveJobApplication:supabase", {
      userId,
      result: savedApplication,
    });
    return savedApplication;
  } catch (error) {
    logPersistenceError("saveJobApplication", error);
    throw error;
  }
}

export async function loadJobApplications(userId) {
  const localApplications = readLocal(userId, "job_applications", []);
  logPersistence("loadJobApplications:start", { userId });

  if (!isSupabaseConfigured) {
    warnFallback("Supabase env vars are missing.");
    logPersistence("loadJobApplications:local", {
      userId,
      result: localApplications,
    });
    return localApplications;
  }

  try {
    const { data, error } = await supabase
      .from("job_applications")
      .select("id, user_id, company, role, status, notes, applied_date")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const normalized = (data || []).map(normalizeApplication);
    logPersistence("loadJobApplications:supabase", {
      userId,
      result: normalized.length ? normalized : localApplications,
    });
    return normalized.length ? normalized : localApplications;
  } catch (error) {
    logPersistenceError("loadJobApplications", error);
    throw error;
  }
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
