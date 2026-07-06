import {
  createProfile,
  loadDailyEntries,
  loadDailyEntry,
  loadJobApplications,
  loadJournalEntries,
  loadProfile,
  normalizeUserId,
  saveDailyEntry,
  saveJournalEntry,
} from "./lib/dataStore.js";
import { supabaseConfig } from "./lib/supabase.js";
import { LandingPage } from "./components/LandingPage.js";
import { MainWorkspace } from "./components/MainWorkspace.js";

let landingPanel = null;
let landingError = "";
let workspaceSelected = false;

function App() {
  return workspaceSelected
    ? MainWorkspace()
    : LandingPage(landingPanel, getSavedAccount(), landingError);
}

function renderApp() {
  document.getElementById("app").innerHTML = App();
}

let buttons = [];
let pageEyebrow = null;
let pageTitle = null;
let pageSubtitle = null;
let pageContent = null;
let workspaceDateRegion = null;
let workspaceSaveStatus = null;
let activePage = "Daily";
let autoSaveTimer = null;

const state = {
  workspace: {
    selectedDate: getTodayISO(),
  },
  sleep: {
    entries: [
      {
        date: getTodayISO(),
        wakeUp: "",
        bedtime: "",
      },
    ],
  },
  focus: {
    sessions: [],
  },
  career: {
    entries: [
      {
        date: getTodayISO(),
        applicationsSubmitted: 0,
        interviews: 0,
        offers: 0,
      },
    ],
  },
  health: {
    entries: [
      {
        date: getTodayISO(),
        training: "Rest",
        period: "No",
      },
    ],
  },
  mood: {
    score: 6,
    entries: [
      {
        date: getTodayISO(),
        score: 6,
        logId: null,
        persisted: false,
        workspaceId: null,
      },
    ],
    logId: null,
    loadedRanges: [],
  },
  save: {
    status: "saved",
    dirtyModules: [],
  },
  journal: {
    today: "",
    entries: [],
    openHistoryId: null,
  },
  analytics: {
    range: "week",
    from: "2026-07-01",
    to: "2026-07-04",
  },
};

function minutesBetween(start, end) {
  if (!isValidTime(start) || !isValidTime(end)) {
    return 0;
  }

  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;

  return (endTotal - startTotal + 24 * 60) % (24 * 60);
}

function isValidTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value || "");
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${String(mins).padStart(2, "0")}m`;
}

function formatClock(value) {
  const normalized = value >= 24 ? value - 24 : value;
  let hour = Math.floor(normalized);
  let minute = Math.round((normalized - hour) * 60);

  if (minute === 60) {
    hour = (hour + 1) % 24;
    minute = 0;
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function timeToNumber(value, overnight = false) {
  if (!isValidTime(value)) {
    return 0;
  }

  const [hour, minute] = value.split(":").map(Number);
  const total = hour + minute / 60;
  return overnight && total < 12 ? total + 24 : total;
}

function addDays(date, days) {
  const copy = new Date(`${date}T00:00:00`);
  copy.setDate(copy.getDate() + days);
  const year = copy.getFullYear();
  const month = String(copy.getMonth() + 1).padStart(2, "0");
  const day = String(copy.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getSleepEntry(date) {
  return state.sleep.entries.find((entry) => entry.date === date);
}

function getOrCreateSleepEntry(date) {
  let entry = getSleepEntry(date);

  if (!entry) {
    entry = {
      date,
      wakeUp: "",
      bedtime: "",
    };
    state.sleep.entries.push(entry);
  }

  return entry;
}

function getSelectedDate() {
  return state.workspace.selectedDate;
}

function getSleepDurationForDate(date) {
  const currentEntry = getSleepEntry(date);

  if (!isValidTime(currentEntry?.wakeUp) || !isValidTime(currentEntry?.bedtime)) {
    return null;
  }

  return minutesBetween(currentEntry.bedtime, currentEntry.wakeUp);
}

function getHealthEntry(date) {
  return state.health.entries.find((entry) => entry.date === date);
}

function getOrCreateHealthEntry(date) {
  let entry = getHealthEntry(date);

  if (!entry) {
    entry = {
      date,
      training: "Rest",
      period: "No",
    };
    state.health.entries.push(entry);
  }

  return entry;
}

function getCareerEntry(date) {
  return state.career.entries.find((entry) => entry.date === date);
}

function getOrCreateCareerEntry(date) {
  let entry = getCareerEntry(date);

  if (!entry) {
    entry = {
      date,
      applicationsSubmitted: 0,
      interviews: 0,
      offers: 0,
    };
    state.career.entries.push(entry);
  }

  return entry;
}

function getMoodEntry(date) {
  return state.mood.entries.find((entry) => entry.date === date);
}

function getOrCreateMoodEntry(date) {
  let entry = getMoodEntry(date);

  if (!entry) {
    entry = {
      date,
      score: 6,
      logId: null,
      persisted: false,
      workspaceId: null,
    };
    state.mood.entries.push(entry);
  }

  return entry;
}

function getWorkspaceId() {
  return localStorage.getItem("momentumId");
}

function getUsername() {
  return localStorage.getItem("username") || localStorage.getItem("workspace" + "Name") || "username";
}

window.momentumDebugStorage = function momentumDebugStorage() {
  const report = {
    hasSupabaseUrl: supabaseConfig.hasSupabaseUrl,
    hasSupabaseKey: supabaseConfig.hasSupabaseKey,
    activeBackend: supabaseConfig.activeBackend,
    currentUserId: getWorkspaceId(),
  };

  console.log("[Momentum persistence] debug storage", report);
  return report;
};

function getDailyDataForDate(date) {
  return {
    sleep: getSleepEntry(date) || null,
    focusSessions: state.focus.sessions.filter((session) => session.date === date),
    career: getCareerEntry(date) || null,
    health: getHealthEntry(date) || null,
    mood: getMoodEntry(date) || null,
  };
}

function applyDailyEntry(entry) {
  if (!entry?.date || !entry.data) {
    return;
  }

  const { date, data } = entry;

  if (data.sleep) {
    const sleepEntry = getOrCreateSleepEntry(date);
    sleepEntry.wakeUp = data.sleep.wakeUp || sleepEntry.wakeUp;
    sleepEntry.bedtime = data.sleep.bedtime || sleepEntry.bedtime;
  }

  if (Array.isArray(data.focusSessions)) {
    state.focus.sessions = [
      ...state.focus.sessions.filter((session) => session.date !== date),
      ...data.focusSessions.map((session) => ({
        id: session.id || createId("focus"),
        date,
        start: session.start || "09:00",
        end: session.end || "10:00",
        type: session.type || "Study",
      })),
    ];
  }

  if (data.health) {
    const healthEntry = getOrCreateHealthEntry(date);
    healthEntry.training = data.health.training || healthEntry.training;
  }

  if (data.career) {
    const careerEntry = getOrCreateCareerEntry(date);
    careerEntry.applicationsSubmitted = Number(
      data.career.applicationsSubmitted ?? data.career.applied ?? 0,
    );
    careerEntry.interviews = Number(data.career.interviews ?? data.career.interview ?? 0);
    careerEntry.offers = Number(data.career.offers ?? 0);
  }

  if (data.mood) {
    upsertMoodEntry({
      date,
      score: data.mood.score || 6,
      logId: data.mood.logId || null,
      persisted: true,
      workspaceId: getWorkspaceId(),
    });
  }
}

function applyJournalEntries(entries) {
  const today = getTodayISO();
  const todayEntry = entries.find((entry) => entry.date === today);

  state.journal.today = todayEntry?.text || "";
  state.journal.entries = entries
    .filter((entry) => entry.date !== today && entry.text?.trim())
    .map((entry) => ({
      id: entry.id || createId("journal"),
      date: entry.date,
      text: entry.text,
    }));
}

function applyJobApplications(applications) {
  applications.forEach((application) => {
    const entry = getOrCreateCareerEntry(application.date || getTodayISO());
    const status = application.status || "";

    if (status === "Applied") {
      entry.applicationsSubmitted += 1;
    }

    if (status === "Interview") {
      entry.interviews += 1;
    }

    if (status === "Offer") {
      entry.offers += 1;
    }
  });
}

async function loadUserData() {
  const userId = getWorkspaceId();
  console.info("[Momentum persistence] current user_id", { userId });

  if (!userId) {
    return;
  }

  try {
    const [dailyEntries, journalEntries, applications] = await Promise.all([
      loadDailyEntries(userId),
      loadJournalEntries(userId),
      loadJobApplications(userId),
    ]);

    console.info("[Momentum persistence] hydrate result", {
      userId,
      dailyEntries,
      journalEntries,
      applications,
    });
    dailyEntries.forEach(applyDailyEntry);
    applyJournalEntries(journalEntries);
    applyJobApplications(applications);
  } catch (error) {
    setSaveStatus("error");
    console.error(
      `Could not load Momentum data: ${error?.message || "Unknown error"}`.trim(),
    );
  }
}

async function loadSelectedDailyEntry() {
  const userId = getWorkspaceId();

  if (!userId) {
    return;
  }

  const selectedDate = getSelectedDate();

  try {
    const entries = await Promise.all([
      loadDailyEntry(userId, addDays(selectedDate, -1)),
      loadDailyEntry(userId, selectedDate),
    ]);
    entries.forEach(applyDailyEntry);
  } catch (error) {
    console.error(
      `Could not load selected day: ${error?.message || "Unknown error"}`.trim(),
    );
  }
}

function upsertMoodEntry({
  date,
  score,
  logId = null,
  persisted = false,
  workspaceId = null,
}) {
  const entry = getOrCreateMoodEntry(date);
  entry.score = Number(score);
  entry.logId = logId;
  entry.persisted = persisted;
  entry.workspaceId = workspaceId;

  return entry;
}

function isWithinRange(date, range) {
  return date >= range.from && date <= range.to;
}

function getRangeBounds() {
  const today = getTodayISO();

  if (state.analytics.range === "month") {
    return {
      label: "Month",
      from: `${today.slice(0, 8)}01`,
      to: today,
    };
  }

  if (state.analytics.range === "year") {
    return {
      label: "Year",
      from: `${today.slice(0, 4)}-01-01`,
      to: today,
    };
  }

  if (state.analytics.range === "custom") {
    return {
      label: "Custom",
      from: state.analytics.from || today,
      to: state.analytics.to || today,
    };
  }

  return {
    label: "Week",
    from: addDays(today, -6),
    to: today,
  };
}

function getCurrentJournalEntry() {
  const text = state.journal.today.trim();
  return text ? [{ date: getTodayISO(), text }] : [];
}

function extractKeywords(entries) {
  const stopWords = new Set([
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "today",
    "about",
    "anything",
    "you",
    "your",
    "like",
    "remember",
  ]);
  const counts = new Map();

  entries
    .flatMap((entry) => entry.text.toLowerCase().match(/[a-z]{3,}/g) || [])
    .filter((word) => !stopWords.has(word))
    .forEach((word) => counts.set(word, (counts.get(word) || 0) + 1));

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([word]) => word[0].toUpperCase() + word.slice(1));
}

function getAnalyticsData() {
  const range = getRangeBounds();
  const sleepEntries = state.sleep.entries.filter((entry) =>
    isWithinRange(entry.date, range),
  );
  const focusSessions = state.focus.sessions.filter((session) =>
    isWithinRange(session.date, range),
  );
  const careerEntries = state.career.entries.filter((entry) =>
    isWithinRange(entry.date, range),
  );
  const healthEntries = state.health.entries.filter((entry) =>
    isWithinRange(entry.date, range),
  );
  const moodEntries = state.mood.entries
    .filter((entry) => entry.persisted)
    .filter((entry) => !entry.workspaceId || entry.workspaceId === getWorkspaceId())
    .filter((entry) => isWithinRange(entry.date, range))
    .sort((a, b) => a.date.localeCompare(b.date));
  const journalEntries = [
    ...state.journal.entries,
    ...getCurrentJournalEntry(),
  ].filter((entry) => isWithinRange(entry.date, range));

  const sleepDurations = sleepEntries
    .map((entry) => getSleepDurationForDate(entry.date))
    .filter((duration) => duration !== null);
  const averageSleep = sleepDurations.length
    ? Math.round(
        sleepDurations.reduce((sum, duration) => sum + duration, 0) /
          sleepDurations.length,
      )
    : null;

  return {
    label: range.label,
    sleep: {
      bedtime: sleepEntries.map((entry) => timeToNumber(entry.bedtime, true)),
      wakeUp: sleepEntries.map((entry) => timeToNumber(entry.wakeUp)),
      averageDuration:
        averageSleep === null ? "Not enough data" : formatDuration(averageSleep),
    },
    focus: {
      study: focusSessions
        .filter((session) => session.type === "Study")
        .reduce(
          (sum, session) => sum + minutesBetween(session.start, session.end),
          0,
        ),
      work: focusSessions
        .filter((session) => session.type === "Work")
        .reduce(
          (sum, session) => sum + minutesBetween(session.start, session.end),
          0,
        ),
    },
    career: {
      applied: careerEntries.reduce(
        (sum, entry) => sum + Number(entry.applicationsSubmitted || 0),
        0,
      ),
      interview: careerEntries.reduce(
        (sum, entry) => sum + Number(entry.interviews || 0),
        0,
      ),
      offers: careerEntries.reduce(
        (sum, entry) => sum + Number(entry.offers || 0),
        0,
      ),
    },
    health: {
      upper: healthEntries.filter((entry) => entry.training === "Upper").length,
      lower: healthEntries.filter((entry) => entry.training === "Lower").length,
    },
    mood: {
      average: moodEntries.length
        ? (
            moodEntries.reduce((sum, entry) => sum + entry.score, 0) /
            moodEntries.length
          ).toFixed(1)
        : null,
      values: moodEntries.map((entry) => entry.score),
      labels: moodEntries.map((entry) => formatMoodXAxisLabel(entry.date)),
    },
    journal: {
      keywords: extractKeywords(journalEntries),
    },
  };
}

function pointsForLine(values, width = 360, height = 160, padding = 18) {
  const chartValues = values.length ? values : [0];
  const min = Math.min(...chartValues);
  const max = Math.max(...chartValues);
  const range = max - min || 1;
  const chartLeft = 46;
  const chartRight = width - 10;
  const chartTop = 18;
  const chartBottom = height - 34;

  return chartValues.map((value, index) => {
    const x =
      chartValues.length === 1
        ? (chartLeft + chartRight) / 2
        : chartLeft + (index * (chartRight - chartLeft)) / (chartValues.length - 1);
    const y = chartBottom - ((value - min) / range) * (chartBottom - chartTop);
    return { x, y, value };
  });
}

function getChartXAxisLabels() {
  if (state.analytics.range === "month") {
    return ["1", "5", "10", "15", "20", "25", "30"];
  }

  if (state.analytics.range === "year") {
    return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  }

  if (state.analytics.range === "custom") {
    return getRangeDates(getRangeBounds())
      .filter((_, index, dates) => index === 0 || index === dates.length - 1)
      .map((date) => new Date(`${date}T00:00:00`).getDate().toString());
  }

  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
}

function formatMoodXAxisLabel(date) {
  const dateValue = new Date(`${date}T00:00:00`);

  if (state.analytics.range === "week") {
    return new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(dateValue);
  }

  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "numeric",
  }).format(dateValue);
}

function getChartYTicks(values) {
  const chartValues = values.length ? values : [0];
  const min = Math.min(...chartValues);
  const max = Math.max(...chartValues);

  if (min === max) {
    return [max + 1, max, Math.max(0, max - 1)];
  }

  const middle = min + (max - min) / 2;
  return [max, middle, min];
}

function formatChartTick(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function LineChart({ values, labels = null, soft = false, accent = "" }) {
  const points = pointsForLine(values);
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const xLabels = labels || getChartXAxisLabels();
  const yTicks = getChartYTicks(values);
  const yPositions = [18, 72, 126];
  const xStart = 46;
  const xEnd = 350;

  return `
    <svg class="line-chart" viewBox="0 0 360 160" role="img" aria-hidden="true">
      ${yPositions
        .map(
          (y, index) => `
            <text class="chart-y-label" x="4" y="${y + 4}">${formatChartTick(yTicks[index])}</text>
            <line class="chart-grid-line" x1="46" y1="${y}" x2="350" y2="${y}"></line>
          `,
        )
        .join("")}
      <path class="chart-line ${soft ? "soft-line" : ""} ${accent ? `chart-${accent}` : ""}" d="${path}"></path>
      ${points
        .map(
          (point) =>
            `<circle class="chart-dot" cx="${point.x}" cy="${point.y}" r="4"></circle>`,
        )
        .join("")}
      ${xLabels
        .map((label, index) => {
          const x =
            xLabels.length === 1
              ? (xStart + xEnd) / 2
              : xStart + (index * (xEnd - xStart)) / (xLabels.length - 1);
          return `<text class="chart-x-label" x="${x}" y="152">${escapeHTML(label)}</text>`;
        })
        .join("")}
    </svg>
  `;
}

function getRangeDates(range) {
  const dates = [];
  let cursor = range.from;

  while (cursor <= range.to && dates.length < 42) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return dates;
}

function getFocusTotal(data) {
  return data.focus.study + data.focus.work;
}

function formatHours(minutes) {
  const hours = minutes / 60;
  return `${hours % 1 === 0 ? hours.toFixed(0) : hours.toFixed(1)}h`;
}

function AnalyticsCard({ title, children, wide = false }) {
  return `
    <article class="analytics-card ${wide ? "wide" : ""}" data-analytics-card="${title}">
      <div class="analytics-header">
        <h2 class="analytics-title">${title}</h2>
      </div>
      ${children}
    </article>
  `;
}

function StatTile(label, value) {
  return `
    <div class="stat-tile">
      <span class="stat-value">${value}</span>
      <span class="micro-label">${label}</span>
    </div>
  `;
}

function ComparisonBar(label, value, max) {
  const width = max ? Math.round((value / max) * 100) : 0;
  return `
    <div class="bar-row">
      <div class="bar-top">
        <span>${label}</span>
        <span>${value}</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill" style="width: ${width}%"></div>
      </div>
    </div>
  `;
}

function TimeRangeSelector() {
  const customVisible = state.analytics.range === "custom";
  return `
    <div class="analytics-controls">
      <div class="range-segmented" aria-label="Time range">
        ${["week", "month", "year", "custom"]
          .map(
            (range) =>
              `<button class="range-option ${state.analytics.range === range ? "is-active" : ""}" type="button" data-range="${range}">${range[0].toUpperCase()}${range.slice(1)}</button>`,
          )
          .join("")}
      </div>
      ${
        customVisible
          ? `
            <div class="custom-range">
              <label class="date-field">
                <span class="micro-label">From</span>
                <input class="date-input" id="analyticsFrom" type="date" value="${state.analytics.from}" />
              </label>
              <label class="date-field">
                <span class="micro-label">To</span>
                <input class="date-input" id="analyticsTo" type="date" value="${state.analytics.to}" />
              </label>
            </div>
          `
          : ""
      }
    </div>
  `;
}

function Card({ icon, title, children }) {
  return `
    <article class="workspace-card" data-card="${title}">
      <div class="card-header">
        <div class="card-icon" aria-hidden="true">${icon}</div>
        <h2 class="card-title">${title}</h2>
      </div>
      <div class="card-body">${children}</div>
    </article>
  `;
}

function TimeCard({ label, value, id }) {
  const displayValue = isValidTime(value) ? value : "--:--";
  const inputValue = isValidTime(value) ? value : "";

  return `
    <label class="time-card" for="${id}" data-time-card="${id}">
      <span class="micro-label">${label}</span>
      <span class="time-value" id="${id}Display">${displayValue}</span>
      <input class="native-time-input" id="${id}" type="time" value="${inputValue}" aria-label="${label}" />
    </label>
  `;
}

function SleepCard() {
  const selectedDate = getSelectedDate();
  const selectedSleep = getOrCreateSleepEntry(selectedDate);
  const duration = getSleepDurationForDate(selectedDate);
  const durationLabel = duration === null ? "--h --m" : formatDuration(duration);

  return Card({
    icon: "😴",
    title: "Sleep",
    children: `
      <div class="time-card-grid">
        ${TimeCard({ label: "☀ Wake Up", value: selectedSleep.wakeUp, id: "sleepWakeUp" })}
        ${TimeCard({ label: "🌙 Bedtime", value: selectedSleep.bedtime, id: "sleepBedtime" })}
      </div>
      <div class="divider"></div>
      <div class="output">
        <p class="output-title">Sleep Duration</p>
        <div class="metric-card">
          <span class="metric-value" id="sleepDuration">${durationLabel}</span>
        </div>
      </div>
    `,
  });
}

function FocusCard() {
  const selectedDate = getSelectedDate();
  const sessions = state.focus.sessions.filter(
    (session) => session.date === selectedDate,
  );
  const rows = sessions
    .map((session) => {
      const duration = formatDuration(minutesBetween(session.start, session.end));
      return `
        <div class="session-row" data-session-id="${session.id}">
          <div class="field">
            <span class="field-label">Start</span>
            <input class="input focus-start" type="time" value="${session.start}" />
          </div>
          <div class="field">
            <span class="field-label">End</span>
            <input class="input focus-end" type="time" value="${session.end}" />
          </div>
          <div class="field">
            <span class="field-label">Type</span>
            <select class="select focus-type">
              <option ${session.type === "Study" ? "selected" : ""}>Study</option>
              <option ${session.type === "Work" ? "selected" : ""}>Work</option>
            </select>
          </div>
          <div class="session-duration">${duration}</div>
          <button class="icon-button delete-focus-session" type="button" aria-label="Delete session">×</button>
        </div>
      `;
    })
    .join("");

  const total = sessions.reduce(
    (sum, session) => sum + minutesBetween(session.start, session.end),
    0,
  );

  return Card({
    icon: "📚",
    title: "Focus",
    children: `
      <div class="quiet-list" id="focusSessions">
        ${rows || ""}
      </div>
      <button class="small-button" type="button" id="addFocusSession">+ Add Session</button>
      <div class="divider"></div>
      <div class="output">
        <div class="summary-row">
          <span>Today's Total</span>
          <strong id="focusTotal">${formatDuration(total)}</strong>
        </div>
      </div>
    `,
  });
}

function CareerCard() {
  const selectedDate = getSelectedDate();
  const career = getOrCreateCareerEntry(selectedDate);
  const hasActivity =
    career.applicationsSubmitted + career.interviews + career.offers > 0;

  return Card({
    icon: "💼",
    title: "Career",
    children: `
      <div class="counter-grid">
        <label class="field">
          <span class="field-label">Applications submitted today</span>
          <input class="input counter-input" id="careerApplicationsSubmitted" type="number" min="0" inputmode="numeric" value="${career.applicationsSubmitted}" />
        </label>
        <label class="field">
          <span class="field-label">Interviews today</span>
          <input class="input counter-input" id="careerInterviews" type="number" min="0" inputmode="numeric" value="${career.interviews}" />
        </label>
        <label class="field">
          <span class="field-label">Offers received today</span>
          <input class="input counter-input" id="careerOffers" type="number" min="0" inputmode="numeric" value="${career.offers}" />
        </label>
      </div>
      <div class="divider"></div>
      <div class="output">
        ${
          hasActivity
            ? `
              <p class="output-title">Today</p>
              <div class="summary-row"><span>Applications</span><strong>${career.applicationsSubmitted}</strong></div>
              <div class="summary-row"><span>Interviews</span><strong>${career.interviews}</strong></div>
              <div class="summary-row"><span>Offers</span><strong>${career.offers}</strong></div>
            `
            : `<p class="empty-state">No career activity yet today.</p>`
        }
      </div>
    `,
  });
}

function HealthCard() {
  const activities = [];
  const selectedHealth = getOrCreateHealthEntry(getSelectedDate());

  if (selectedHealth.training === "Upper") {
    activities.push("🏋 Upper Body");
  }

  if (selectedHealth.training === "Lower") {
    activities.push("🏋 Lower Body");
  }

  return Card({
    icon: "🏋",
    title: "Health",
    children: `
      <div class="field">
        <span class="field-label">Training</span>
        <div class="segmented three" id="trainingOptions">
          ${["Rest", "Upper", "Lower"]
            .map(
              (option) =>
                `<button class="segment ${selectedHealth.training === option ? "is-active" : ""}" type="button" data-training="${option}">${option}</button>`,
            )
            .join("")}
        </div>
      </div>
      <div class="divider"></div>
      <div class="output">
        <p class="output-title">Today's Activity</p>
        ${
          activities.length
            ? `<div class="activity-list">${activities.map((item) => `<span class="activity-pill">${item}</span>`).join("")}</div>`
            : `<p class="empty-state">No health activity yet today.</p>`
        }
      </div>
    `,
  });
}

function MoodCard() {
  const selectedMood = getOrCreateMoodEntry(getSelectedDate());
  state.mood.score = selectedMood.score;
  state.mood.logId = selectedMood.logId || null;

  return Card({
    icon: "😊",
    title: "Mood",
    children: `
      <div class="mood-value">
        <span class="field-label">Today</span>
        <strong class="mood-number" id="moodDisplay">${selectedMood.score}</strong>
      </div>
      <input class="range" id="moodRange" type="range" min="1" max="10" value="${selectedMood.score}" aria-label="Mood" />
    `,
  });
}

function MomentumScoreCard() {
  const data = getAnalyticsData();
  return AnalyticsCard({
    title: "Momentum Score",
    children: `
      <div class="score-placeholder">
        <div class="score-ring">Pending</div>
      </div>
      <p class="analytics-muted">${data.label} view</p>
    `,
  });
}

function SleepAnalyticsCard() {
  const data = getAnalyticsData();
  return AnalyticsCard({
    title: "Sleep",
    children: `
      <div class="sleep-chart-stack">
        <div class="chart-block">
          <p class="chart-label">Bedtime Trend</p>
          ${LineChart({ values: data.sleep.bedtime, accent: "sleep" })}
        </div>
        <div class="chart-block">
          <p class="chart-label">Wake Up Trend</p>
          ${LineChart({ values: data.sleep.wakeUp, soft: true, accent: "sleep" })}
        </div>
        <div class="average-metric">
          <div>
            <div class="metric-large">${data.sleep.averageDuration}</div>
            <p class="analytics-muted">Average Sleep Duration</p>
          </div>
        </div>
      </div>
    `,
  });
}

function FocusAnalyticsCard() {
  const data = getAnalyticsData();
  const max = Math.max(data.focus.study, data.focus.work);
  return AnalyticsCard({
    title: "Focus",
    children: `
      <div class="bar-list">
        ${ComparisonBar("Study", data.focus.study, max)}
        ${ComparisonBar("Work", data.focus.work, max)}
      </div>
      <div class="center-metric accent-focus">
        <div>
          <div class="metric-large">${formatHours(getFocusTotal(data))}</div>
          <p class="analytics-muted">Total Focus Time</p>
        </div>
      </div>
    `,
  });
}

function CareerAnalyticsCard() {
  const data = getAnalyticsData();
  return AnalyticsCard({
    title: "Career",
    children: `
      <div class="stats-row">
        ${StatTile("Applications", data.career.applied)}
        ${StatTile("Interviews", data.career.interview)}
        ${StatTile("Offers", data.career.offers)}
      </div>
    `,
  });
}

function HealthAnalyticsCard() {
  const data = getAnalyticsData();
  const max = Math.max(data.health.upper, data.health.lower);
  return AnalyticsCard({
    title: "Health",
    children: `
      <div class="bar-list">
        ${ComparisonBar("Upper Body", data.health.upper, max)}
        ${ComparisonBar("Lower Body", data.health.lower, max)}
      </div>
    `,
  });
}

function MoodAnalyticsCard() {
  const data = getAnalyticsData();
  const hasMoodRecords = data.mood.values.length > 0;

  return AnalyticsCard({
    title: "Mood",
    children: `
      ${
        hasMoodRecords
          ? `
            <div class="mood-value mood-gradient-panel">
              <span class="micro-label">Recorded Average</span>
              <strong class="mood-number">${data.mood.average}</strong>
            </div>
            ${LineChart({
              values: data.mood.values,
              labels: data.mood.labels,
              accent: "mood",
            })}
          `
          : `<p class="empty-state">No mood records yet.</p>`
      }
    `,
  });
}

function JournalAnalyticsCard() {
  const data = getAnalyticsData();

  if (!data.journal.keywords.length) {
    return "";
  }

  return AnalyticsCard({
    title: "Journal",
    children: `
      <p class="output-title">Top Keywords</p>
      <div class="keyword-list">
        ${data.journal.keywords
          .map((keyword) => `<span class="keyword">${keyword}</span>`)
          .join("")}
      </div>
    `,
  });
}

function getDateParts(dateString = getTodayISO()) {
  const date = new Date(`${dateString}T00:00:00`);
  return {
    day: new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(date),
    date: new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date),
  };
}

function getTodayParts() {
  return getDateParts();
}

function renderWorkspaceDateControls() {
  if (!workspaceDateRegion) {
    return;
  }

  const selectedDate = getSelectedDate();
  const isToday = selectedDate === getTodayISO();

  workspaceDateRegion.innerHTML = `
    <div class="date-nav" aria-label="Workspace date navigation">
      <button class="date-nav-button" type="button" data-date-nav="previous">← Prev</button>
      <button class="date-nav-button ${isToday ? "is-active" : ""}" type="button" data-date-nav="today">Today</button>
      <button class="date-nav-button" type="button" data-date-nav="next">Next →</button>
    </div>
  `;
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getTodayISO() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getJournalDateLabel(dateString) {
  const entryDate = new Date(`${dateString}T00:00:00`);
  const today = new Date(`${getTodayISO()}T00:00:00`);
  const daysAgo = Math.round((today - entryDate) / 86400000);

  if (daysAgo === 1) {
    return "Yesterday";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
  }).format(entryDate);
}

function getPreviousJournalEntries() {
  return state.journal.entries
    .filter((entry) => entry.date < getTodayISO() && entry.text.trim())
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((entry) => ({
      ...entry,
      id: entry.id || entry.date,
      dateLabel: getJournalDateLabel(entry.date),
    }));
}

function HistoryCard(entry) {
  const isOpen = state.journal.openHistoryId === entry.id;
  const text = escapeHTML(entry.text);
  return `
    <button class="history-card ${isOpen ? "is-open" : ""}" type="button" data-history-id="${entry.id}">
      <p class="history-date">${entry.dateLabel}</p>
      <p class="history-excerpt">${text}</p>
      ${isOpen ? `<p class="history-full">${text}</p>` : ""}
    </button>
  `;
}

function renderJournal() {
  activePage = "Journal";
  const today = getTodayParts();
  const historyEntries = getPreviousJournalEntries();
  const historySection = historyEntries.length
    ? `
      <section class="history-section" aria-label="History">
        <h2 class="history-title">History</h2>
        <div class="history-list">
          ${historyEntries.map((entry) => HistoryCard(entry)).join("")}
        </div>
      </section>
    `
    : "";

  pageEyebrow.textContent = "Journal";
  pageEyebrow.hidden = true;
  pageTitle.textContent = "Journal";
  pageSubtitle.textContent = "Capture today's memories.";
  pageSubtitle.hidden = false;
  if (workspaceDateRegion) {
    workspaceDateRegion.innerHTML = "";
  }
  if (workspaceSaveStatus) {
    workspaceSaveStatus.hidden = true;
  }
  pageContent.innerHTML = `
    <div class="journal-page">
      <section class="today-journal" aria-label="Today's Journal">
        <div class="journal-date">
          <p class="journal-day">${today.day}</p>
          <p class="journal-full-date">${today.date}</p>
        </div>
        <textarea
          class="journal-textarea"
          id="todayJournal"
          placeholder="Anything you'd like to remember today?"
        >${escapeHTML(state.journal.today)}</textarea>
      </section>

      ${historySection}
    </div>
  `;
  wireJournal();
}

function clearWorkspaceHeaderControls() {
  if (workspaceDateRegion) {
    workspaceDateRegion.innerHTML = "";
  }
  if (workspaceSaveStatus) {
    workspaceSaveStatus.hidden = true;
  }
}

function renderAnalytics() {
  activePage = "Analytics";
  const data = getAnalyticsData();
  pageEyebrow.textContent = "Analytics";
  pageEyebrow.hidden = true;
  pageTitle.textContent = "Analytics";
  pageSubtitle.textContent = "Clear trends from your saved Momentum history.";
  pageSubtitle.hidden = false;
  clearWorkspaceHeaderControls();
  pageContent.innerHTML = `
    <div class="analytics-page">
      ${TimeRangeSelector()}
      <div class="analytics-grid">
        ${MomentumScoreCard()}
        ${SleepAnalyticsCard()}
        ${FocusAnalyticsCard()}
        ${MoodAnalyticsCard()}
        ${CareerAnalyticsCard()}
        ${HealthAnalyticsCard()}
        ${data.journal.keywords.length ? JournalAnalyticsCard() : ""}
      </div>
    </div>
  `;
  wireAnalytics();
  loadMoodRangeForAnalytics();
}

function renderWorkspace() {
  activePage = "Daily";
  const selectedDate = getDateParts(getSelectedDate());
  const username = getUsername();
  pageEyebrow.textContent = `Good morning, ${username}.`;
  pageEyebrow.hidden = false;
  pageTitle.textContent = selectedDate.day;
  pageSubtitle.textContent = selectedDate.date;
  pageSubtitle.hidden = false;
  if (workspaceSaveStatus) {
    workspaceSaveStatus.hidden = false;
  }
  renderWorkspaceDateControls();
  renderSaveStatus();
  pageContent.innerHTML = `
    <div class="workspace-grid">
      ${SleepCard()}
      ${FocusCard()}
      ${HealthCard()}
      ${MoodCard()}
      ${CareerCard()}
    </div>
  `;
  wireWorkspace();
}

function renderComingSoon(page) {
  activePage = page;
  pageEyebrow.textContent = page;
  pageEyebrow.hidden = true;
  pageTitle.textContent = page;
  pageSubtitle.hidden = true;
  if (workspaceDateRegion) {
    workspaceDateRegion.innerHTML = "";
  }
  if (workspaceSaveStatus) {
    workspaceSaveStatus.hidden = true;
  }
  pageContent.innerHTML = `
    <section class="content-card">
      <div class="placeholder">
        <p class="placeholder-title">Coming Soon</p>
        <p class="placeholder-copy">${page}</p>
      </div>
    </section>
  `;
}

function renderPage(page) {
  if (page === "Daily" || page === "Workspace") {
    renderWorkspace();
    return;
  }

  if (page === "Journal" || page === "Insights") {
    renderJournal();
    return;
  }

  if (page === "Analytics") {
    renderAnalytics();
    return;
  }

  renderComingSoon(page);
}

function rerenderWorkspace() {
  renderWorkspace();
}

function getSaveStatusLabel() {
  if (state.save.status === "unsaved") {
    return "Unsaved changes";
  }

  if (state.save.status === "saving") {
    return "Saving...";
  }

  if (state.save.status === "error") {
    return "Couldn't save changes";
  }

  return "✓ All changes saved";
}

function renderSaveStatus() {
  if (!workspaceSaveStatus) {
    return;
  }

  workspaceSaveStatus.textContent = getSaveStatusLabel();
  workspaceSaveStatus.className = `save-status is-${state.save.status}`;
}

function setSaveStatus(status) {
  state.save.status = status;
  renderSaveStatus();
}

function queueDirtyModule(moduleName) {
  if (!state.save.dirtyModules.includes(moduleName)) {
    state.save.dirtyModules.push(moduleName);
  }
}

function markUnsavedChange(moduleName) {
  queueDirtyModule(moduleName);
  setSaveStatus("unsaved");

  window.clearTimeout(autoSaveTimer);
  autoSaveTimer = window.setTimeout(() => {
    autoSaveChanges();
  }, 1000);
}

async function autoSaveChanges() {
  window.clearTimeout(autoSaveTimer);
  autoSaveTimer = null;

  const dirtyModules = [...state.save.dirtyModules];

  if (!dirtyModules.length) {
    setSaveStatus("saved");
    return;
  }

  setSaveStatus("saving");

  try {
    if (
      dirtyModules.some((moduleName) =>
        ["sleep", "focus", "career", "health", "mood"].includes(moduleName),
      )
    ) {
      await saveSelectedDailyEntry();
    }

    if (dirtyModules.includes("journal")) {
      await saveJournalChanges();
    }

    state.save.dirtyModules = state.save.dirtyModules.filter(
      (moduleName) => !dirtyModules.includes(moduleName),
    );
    setSaveStatus(state.save.dirtyModules.length ? "unsaved" : "saved");
  } catch (error) {
    setSaveStatus("error");
    console.error(
      `Auto save failed: ${error?.message || "Unknown error"} ${error?.code || ""}`.trim(),
    );
  }
}

async function saveSelectedDailyEntry() {
  const userId = getWorkspaceId();

  if (!userId) {
    return;
  }

  const date = getSelectedDate();
  const savedEntry = await saveDailyEntry(userId, date, getDailyDataForDate(date));
  applyDailyEntry(savedEntry);

  const mood = getMoodEntry(date);
  if (mood) {
    mood.persisted = true;
    mood.workspaceId = userId;
  }
}

async function saveJournalChanges() {
  const userId = getWorkspaceId();

  if (!userId) {
    return;
  }

  const savedEntry = await saveJournalEntry(userId, {
    date: getTodayISO(),
    text: state.journal.today,
    mood: state.mood.score,
    tags: [],
  });

  const previousEntries = state.journal.entries.filter(
    (entry) => entry.date !== savedEntry.date,
  );
  applyJournalEntries([...previousEntries, savedEntry]);
}

function setTodayMood(score, logId = state.mood.logId, persisted = Boolean(logId)) {
  const entry = upsertMoodEntry({
    date: getSelectedDate(),
    score,
    logId,
    persisted,
    workspaceId: getWorkspaceId(),
  });
  state.mood.score = Number(score);
  state.mood.logId = entry.logId;
}

function setDefaultMoodForSelectedDate() {
  const entry = upsertMoodEntry({
    date: getSelectedDate(),
    score: 6,
    logId: null,
    persisted: false,
    workspaceId: getWorkspaceId(),
  });
  state.mood.score = entry.score;
  state.mood.logId = null;
}

async function loadTodayMood() {
  try {
    const selectedDate = getSelectedDate();
    const dailyEntry = await loadDailyEntry(getWorkspaceId(), selectedDate);
    const moodLog = dailyEntry?.data?.mood || null;

    if (moodLog) {
      upsertMoodEntry({
        date: selectedDate,
        score: moodLog.score,
        logId: moodLog.logId || null,
        persisted: true,
        workspaceId: getWorkspaceId(),
      });
      state.mood.score = Number(moodLog.score);
      state.mood.logId = moodLog.logId || null;
    } else {
      setDefaultMoodForSelectedDate();
    }

    rerenderWorkspace();
  } catch (error) {
    setSaveStatus("error");
    rerenderWorkspace();
    console.error(error);
  }
}

function moodRangeKey(range) {
  return `${getWorkspaceId() || "default"}:${range.from}:${range.to}`;
}

async function loadMoodRangeForAnalytics({ force = false } = {}) {
  const range = getRangeBounds();
  const key = moodRangeKey(range);

  if (!force && state.mood.loadedRanges.includes(key)) {
    return;
  }

  try {
    const dailyEntries = await loadDailyEntries(getWorkspaceId());

    dailyEntries
      .filter((entry) => isWithinRange(entry.date, range))
      .filter((entry) => entry.data?.mood)
      .forEach((entry) => {
        const moodLog = entry.data.mood;
      upsertMoodEntry({
        date: entry.date,
        score: moodLog.score,
        logId: moodLog.logId || null,
        persisted: true,
        workspaceId: getWorkspaceId(),
      });
    });

    if (!state.mood.loadedRanges.includes(key)) {
      state.mood.loadedRanges.push(key);
    }

    if (activePage === "Analytics") {
      renderAnalytics();
    }
  } catch (error) {
    console.error(
      `Mood analytics load failed: ${error?.message || "Unknown error"} ${error?.code || ""}`.trim(),
    );
  }
}

async function saveMoodChanges() {
  await saveSelectedDailyEntry();
}

function wireWorkspace() {
  const wakeUp = document.getElementById("sleepWakeUp");
  const bedtime = document.getElementById("sleepBedtime");

  document.querySelectorAll("[data-date-nav]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.dateNav === "previous") {
        state.workspace.selectedDate = addDays(getSelectedDate(), -1);
      }

      if (button.dataset.dateNav === "today") {
        state.workspace.selectedDate = getTodayISO();
      }

      if (button.dataset.dateNav === "next") {
        state.workspace.selectedDate = addDays(getSelectedDate(), 1);
      }

      renderWorkspace();
      loadSelectedDailyEntry().then(() => {
        renderWorkspace();
      });
    });
  });

  document.querySelectorAll("[data-time-card]").forEach((card) => {
    card.addEventListener("click", () => {
      const input = document.getElementById(card.dataset.timeCard);
      input?.focus();
      input?.showPicker?.();
    });
  });

  wakeUp?.addEventListener("input", (event) => {
    getOrCreateSleepEntry(getSelectedDate()).wakeUp = event.target.value;
    markUnsavedChange("sleep");
    rerenderWorkspace();
  });

  bedtime?.addEventListener("input", (event) => {
    getOrCreateSleepEntry(getSelectedDate()).bedtime = event.target.value;
    markUnsavedChange("sleep");
    rerenderWorkspace();
  });

  document.getElementById("addFocusSession")?.addEventListener("click", () => {
    state.focus.sessions.push({
      id: createId("focus"),
      date: getSelectedDate(),
      start: "09:00",
      end: "10:00",
      type: "Study",
    });
    markUnsavedChange("focus");
    rerenderWorkspace();
  });

  document.querySelectorAll("[data-session-id]").forEach((row) => {
    const session = state.focus.sessions.find(
      (item) => item.id === row.dataset.sessionId,
    );

    if (!session) {
      return;
    }

    row.querySelector(".focus-start")?.addEventListener("input", (event) => {
      session.start = event.target.value;
      markUnsavedChange("focus");
      rerenderWorkspace();
    });

    row.querySelector(".focus-end")?.addEventListener("input", (event) => {
      session.end = event.target.value;
      markUnsavedChange("focus");
      rerenderWorkspace();
    });

    row.querySelector(".focus-type")?.addEventListener("change", (event) => {
      session.type = event.target.value;
      markUnsavedChange("focus");
      rerenderWorkspace();
    });

    row.querySelector(".delete-focus-session")?.addEventListener("click", () => {
      state.focus.sessions = state.focus.sessions.filter(
        (item) => item.id !== session.id,
      );
      markUnsavedChange("focus");
      rerenderWorkspace();
    });
  });

  [
    ["careerApplicationsSubmitted", "applicationsSubmitted"],
    ["careerInterviews", "interviews"],
    ["careerOffers", "offers"],
  ].forEach(([inputId, key]) => {
    document.getElementById(inputId)?.addEventListener("input", (event) => {
      getOrCreateCareerEntry(getSelectedDate())[key] = Math.max(
        0,
        Number(event.target.value || 0),
      );
      markUnsavedChange("career");
      rerenderWorkspace();
    });
  });

  document.querySelectorAll("[data-training]").forEach((button) => {
    button.addEventListener("click", () => {
      getOrCreateHealthEntry(getSelectedDate()).training = button.dataset.training;
      markUnsavedChange("health");
      rerenderWorkspace();
    });
  });

  document.getElementById("moodRange")?.addEventListener("input", (event) => {
    setTodayMood(event.target.value, state.mood.logId, false);
    document.getElementById("moodDisplay").textContent = state.mood.score;
    markUnsavedChange("mood");
  });

}

function autoGrowTextarea(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function wireJournal() {
  const todayJournal = document.getElementById("todayJournal");

  if (todayJournal) {
    autoGrowTextarea(todayJournal);
    todayJournal.addEventListener("input", (event) => {
      state.journal.today = event.target.value;
      autoGrowTextarea(event.target);
      markUnsavedChange("journal");
    });
  }

  document.querySelectorAll("[data-history-id]").forEach((card) => {
    card.addEventListener("click", () => {
      const id = card.dataset.historyId;
      state.journal.openHistoryId =
        state.journal.openHistoryId === id ? null : id;
      renderJournal();
    });
  });
}

function wireAnalytics() {
  document.querySelectorAll("[data-range]").forEach((button) => {
    button.addEventListener("click", () => {
      state.analytics.range = button.dataset.range;
      renderAnalytics();
      loadMoodRangeForAnalytics({ force: true });
    });
  });

  document.getElementById("analyticsFrom")?.addEventListener("input", (event) => {
    state.analytics.from = event.target.value;
    loadMoodRangeForAnalytics({ force: true });
  });

  document.getElementById("analyticsTo")?.addEventListener("input", (event) => {
    state.analytics.to = event.target.value;
    loadMoodRangeForAnalytics({ force: true });
  });
}

function generateMomentumId() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 6 }, () =>
    alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join("");
}

async function createUniqueProfile(username, attempts = 8) {
  let lastError = null;

  for (let index = 0; index < attempts; index += 1) {
    const momentumId = generateMomentumId();

    try {
      return await createProfile(momentumId, username);
    } catch (error) {
      lastError = error;

      if (error?.code !== "profile_exists") {
        throw error;
      }
    }
  }

  throw lastError || new Error("Could not create a unique User ID.");
}

function saveAccount({ username, momentumId }) {
  if (username) {
    localStorage.setItem("username", username);
    localStorage.removeItem("workspace" + "Name");
  }

  localStorage.setItem("momentumId", momentumId);
}

function getSavedAccount() {
  const momentumId = localStorage.getItem("momentumId");

  if (!momentumId) {
    return null;
  }

  return {
    username: getUsername(),
    momentumId,
  };
}

function renderWorkspaceInfo() {
  const username = getUsername();
  const workspaceId = getWorkspaceId() || "--";

  const headerUsernameNode = document.getElementById("headerUsername");
  const headerUserIdNode = document.getElementById("headerUserId");

  if (headerUsernameNode) {
    headerUsernameNode.textContent = username;
  }

  if (headerUserIdNode) {
    headerUserIdNode.textContent = workspaceId;
  }
}

async function enterWorkspace() {
  workspaceSelected = true;
  renderApp();
  initMainWorkspace();
  await loadUserData();
  renderPage(activePage);
}

function wireLandingPage() {
  document.querySelector("[data-continue-workspace]")?.addEventListener("click", () => {
    landingError = "";
    const savedAccount = getSavedAccount();
    const momentumId = normalizeUserId(savedAccount?.momentumId);

    if (!momentumId) {
      landingPanel = "open";
      landingError = "Please enter a username or User ID.";
      renderApp();
      wireLandingPage();
      return;
    }

    loadProfile(momentumId)
      .then((profile) => {
        if (!profile) {
          landingPanel = "open";
          landingError = "No workspace found for this username or ID. Please create it first.";
          console.info("[Momentum persistence] openProfile:not-found", {
            userId: momentumId,
          });
          renderApp();
          wireLandingPage();
          return;
        }

        saveAccount({
          username: profile.username || savedAccount.username,
          momentumId: profile.userId || momentumId,
        });
        console.info("[Momentum persistence] loadProfile result", {
          userId: momentumId,
          profile,
        });
        enterWorkspace();
      })
      .catch((error) => {
        landingPanel = "open";
        landingError =
          error?.message ||
          "Could not open this workspace. Please check the console.";
        setSaveStatus("error");
        console.error("[Momentum persistence] loadProfile failed", error);
        renderApp();
        wireLandingPage();
      });
  });

  document.querySelectorAll("[data-landing-card]").forEach((card) => {
    card.addEventListener("click", () => {
      landingPanel = card.dataset.landingCard;
      landingError = "";
      renderApp();
      wireLandingPage();
    });
  });

  document.getElementById("createWorkspaceForm")?.addEventListener("submit", (event) => {
    event.preventDefault();

    const username = document.getElementById("usernameInput")?.value.trim() || "";

    if (!username) {
      landingPanel = "create";
      landingError = "Please enter a username.";
      renderApp();
      wireLandingPage();
      return;
    }

    createUniqueProfile(username)
      .then((profile) => {
        landingError = "";
        saveAccount({
          username: profile?.username || username,
          momentumId: profile?.userId,
        });
        console.info("[Momentum persistence] createProfile result", {
          userId: profile?.userId,
          profile,
        });
        enterWorkspace();
      })
      .catch((error) => {
        landingPanel = "create";
        landingError =
          error?.message ||
          "Could not create this workspace. Please check the console.";
        setSaveStatus("error");
        console.error("[Momentum persistence] createProfile failed", error);
        renderApp();
        wireLandingPage();
      });
  });

  document.getElementById("openWorkspaceForm")?.addEventListener("submit", (event) => {
    event.preventDefault();

    const workspaceIdentity = normalizeUserId(
      document.getElementById("momentumIdInput")?.value,
    );

    if (!workspaceIdentity) {
      landingPanel = "open";
      landingError = "Please enter a username or User ID.";
      renderApp();
      wireLandingPage();
      return;
    }

    loadProfile(workspaceIdentity)
      .then((profile) => {
        if (!profile) {
          landingPanel = "open";
          landingError = "No workspace found for this username or ID. Please create it first.";
          console.info("[Momentum persistence] openProfile:not-found", {
            identity: workspaceIdentity,
          });
          renderApp();
          wireLandingPage();
          return;
        }

        landingError = "";
        saveAccount({
          username: profile.username || getUsername(),
          momentumId: profile.userId || workspaceIdentity,
        });
        console.info("[Momentum persistence] loadProfile result", {
          identity: workspaceIdentity,
          profile,
        });
        enterWorkspace();
      })
      .catch((error) => {
        landingPanel = "open";
        landingError =
          error?.message ||
          "Could not open this workspace. Please check the console.";
        setSaveStatus("error");
        console.error("[Momentum persistence] loadProfile failed", error);
        renderApp();
        wireLandingPage();
      });
  });
}

function initMainWorkspace() {
  buttons = document.querySelectorAll(".nav-button");
  workspaceDateRegion = document.getElementById("workspaceDateRegion");
  workspaceSaveStatus = document.getElementById("workspaceSaveStatus");
  pageEyebrow = document.getElementById("pageEyebrow");
  pageTitle = document.getElementById("pageTitle");
  pageSubtitle = document.getElementById("pageSubtitle");
  pageContent = document.getElementById("pageContent");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const page = button.dataset.page;

      buttons.forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");

      renderPage(page);
    });
  });

  renderWorkspaceInfo();
  renderWorkspace();
  loadTodayMood();
}

renderApp();
wireLandingPage();
    
