import { isSupabaseConfigured, supabase } from "../lib/supabase.js";

const TABLE_NAME = "mood_logs";
let workspaceIdSupport = null;

function createMoodLogId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    const digit = char === "x" ? value : (value & 0x3) | 0x8;
    return digit.toString(16);
  });
}

function isMissingWorkspaceIdError(error) {
  return (
    error?.code === "42703" ||
    error?.code === "PGRST204" ||
    error?.message?.includes("workspace_id")
  );
}

async function tableSupportsWorkspaceId() {
  if (!isSupabaseConfigured) {
    return false;
  }

  if (workspaceIdSupport !== null) {
    return workspaceIdSupport;
  }

  const { error } = await supabase
    .from(TABLE_NAME)
    .select("workspace_id")
    .limit(1);

  workspaceIdSupport = !error;

  if (error && !isMissingWorkspaceIdError(error)) {
    throw error;
  }

  return workspaceIdSupport;
}

function normalizeMoodLog(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    date: row.date,
    score: row.score,
    workspaceId: row.workspace_id || null,
  };
}

export async function getMoodLogByDate(date, workspaceId = null) {
  if (!isSupabaseConfigured) {
    return null;
  }

  const supportsWorkspaceId = workspaceId
    ? await tableSupportsWorkspaceId()
    : false;
  let query = supabase
    .from(TABLE_NAME)
    .select(supportsWorkspaceId ? "id, date, score, workspace_id" : "id, date, score")
    .eq("date", date)
    .order("created_at", { ascending: false })
    .limit(1);

  if (supportsWorkspaceId) {
    query = query.eq("workspace_id", workspaceId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  return normalizeMoodLog(data);
}

export async function getMoodLogsForRange({ from, to, workspaceId = null }) {
  if (!isSupabaseConfigured) {
    return [];
  }

  const supportsWorkspaceId = workspaceId
    ? await tableSupportsWorkspaceId()
    : false;
  let query = supabase
    .from(TABLE_NAME)
    .select(supportsWorkspaceId ? "id, date, score, workspace_id" : "id, date, score")
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true })
    .order("created_at", { ascending: false });

  if (supportsWorkspaceId) {
    query = query.eq("workspace_id", workspaceId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const byDate = new Map();

  for (const row of data || []) {
    if (!byDate.has(row.date)) {
      byDate.set(row.date, normalizeMoodLog(row));
    }
  }

  return [...byDate.values()];
}

export async function saveMoodLog({ id, date, score, workspaceId = null }) {
  if (!isSupabaseConfigured) {
    return null;
  }

  const supportsWorkspaceId = workspaceId
    ? await tableSupportsWorkspaceId()
    : false;
  const existingMoodLog = id
    ? { id }
    : await getMoodLogByDate(date, supportsWorkspaceId ? workspaceId : null);

  if (existingMoodLog?.id) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update({ score })
      .eq("id", existingMoodLog.id)
      .select(supportsWorkspaceId ? "id, date, score, workspace_id" : "id, date, score")
      .single();

    if (error) {
      throw error;
    }

    return normalizeMoodLog(data);
  }

  const payload = {
    id: createMoodLogId(),
    date,
    score,
  };

  if (supportsWorkspaceId) {
    payload.workspace_id = workspaceId;
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert(payload)
    .select(supportsWorkspaceId ? "id, date, score, workspace_id" : "id, date, score")
    .single();

  if (error) {
    throw error;
  }

  return normalizeMoodLog(data);
}
