import { isSupabaseConfigured } from "./lib/supabase.js";
import {
  getMoodLogByDate,
  getMoodLogsForRange,
  saveMoodLog,
} from "./services/moodLogs.js";
import { LandingPage } from "./components/LandingPage.js";
import { MainWorkspace } from "./components/MainWorkspace.js";

let landingPanel = null;
let workspaceSelected = false;

function App() {
  return workspaceSelected
    ? MainWorkspace()
    : LandingPage(landingPanel, getSavedWorkspace());
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
let activePage = "Workspace";
let autoSaveTimer = null;

const state = {
  workspace: {
    selectedDate: getTodayISO(),
  },
  sleep: {
    entries: [
      {
        date: getTodayISO(),
        wakeUp: "07:38",
        bedtime: "23:30",
      },
    ],
  },
  focus: {
    sessions: [],
  },
  career: {
    company: "",
    position: "",
    status: "Saved",
    applications: [],
  },
  jobTracker: {
    search: "",
    filter: "All",
    sort: "Newest",
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
  if (!start || !end) {
    return 0;
  }

  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;

  return (endTotal - startTotal + 24 * 60) % (24 * 60);
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
  if (!value) {
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
      wakeUp: "07:38",
      bedtime: "23:30",
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
  const previousEntry = getSleepEntry(addDays(date, -1));

  if (!currentEntry?.wakeUp || !previousEntry?.bedtime) {
    return null;
  }

  return minutesBetween(previousEntry.bedtime, currentEntry.wakeUp);
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
  const careerItems = state.career.applications.filter((application) =>
    isWithinRange(application.date, range),
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
      saved: careerItems.filter((item) => item.status === "Saved").length,
      applied: careerItems.filter((item) => item.status === "Applied").length,
      interview: careerItems.filter((item) => item.status === "Interview")
        .length,
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
        : "0.0",
      values: moodEntries.map((entry) => entry.score),
    },
    journal: {
      keywords: extractKeywords(journalEntries),
    },
  };
}

function pointsForLine(values, width = 320, height = 118, padding = 14) {
  const chartValues = values.length ? values : [0];
  const min = Math.min(...chartValues);
  const max = Math.max(...chartValues);
  const range = max - min || 1;

  return chartValues.map((value, index) => {
    const x =
      chartValues.length === 1
        ? width / 2
        : padding + (index * (width - padding * 2)) / (chartValues.length - 1);
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return { x, y, value };
  });
}

function LineChart({ values, soft = false, accent = "" }) {
  const points = pointsForLine(values);
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  return `
    <svg class="line-chart" viewBox="0 0 320 118" role="img" aria-hidden="true">
      <line class="chart-grid-line" x1="14" y1="24" x2="306" y2="24"></line>
      <line class="chart-grid-line" x1="14" y1="94" x2="306" y2="94"></line>
      <path class="chart-line ${soft ? "soft-line" : ""} ${accent ? `chart-${accent}` : ""}" d="${path}"></path>
      ${points
        .map(
          (point) =>
            `<circle class="chart-dot" cx="${point.x}" cy="${point.y}" r="4"></circle>`,
        )
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

function getRangeTitle(range) {
  if (state.analytics.range === "week") {
    return "This week";
  }

  if (state.analytics.range === "custom") {
    return "Selected days";
  }

  return new Intl.DateTimeFormat("en-GB", { month: "long" }).format(
    new Date(`${range.to}T00:00:00`),
  );
}

function getFocusTotal(data) {
  return data.focus.study + data.focus.work;
}

function formatHours(minutes) {
  const hours = minutes / 60;
  return `${hours % 1 === 0 ? hours.toFixed(0) : hours.toFixed(1)}h`;
}

function getCareerProgress(data) {
  const total = data.career.saved + data.career.applied + data.career.interview;

  if (!total) {
    return "No career activity yet";
  }

  if (data.career.interview) {
    return `${data.career.interview} interview${data.career.interview === 1 ? "" : "s"}`;
  }

  if (data.career.applied) {
    return `${data.career.applied} applied`;
  }

  return `${data.career.saved} saved`;
}

function getHealthActivity(data) {
  const sessions = data.health.upper + data.health.lower;

  if (!sessions) {
    return "No activity yet";
  }

  return `${sessions} training${sessions === 1 ? "" : "s"}`;
}

function getHeroInsight(data) {
  const focusTotal = getFocusTotal(data);
  const moodAverage = Number(data.mood.average);

  if (focusTotal >= 60 * 10 && moodAverage >= 6.5) {
    return "Good progress.";
  }

  if (focusTotal >= 60 * 4) {
    return "Momentum is building.";
  }

  if (moodAverage > 0 && moodAverage < 5) {
    return "A quieter stretch.";
  }

  return "A gentle start.";
}

function InsightMetric(label, value, description, accent) {
  return `
    <div class="insight-metric accent-${accent}">
      <span>${label}</span>
      <strong>${value}</strong>
      <p>${description}</p>
    </div>
  `;
}

function InsightsHero() {
  const data = getAnalyticsData();
  const range = getRangeBounds();
  const focusTotal = getFocusTotal(data);

  return `
    <section class="insights-hero" aria-label="Insights overview">
      <p class="insights-kicker">${getRangeTitle(range)}</p>
      <h2>${getHeroInsight(data)}</h2>
      <div class="insights-story">
        <p>You focused for <strong>${formatHours(focusTotal)}</strong>.</p>
        <p>Average sleep was <strong>${data.sleep.averageDuration}</strong>.</p>
        <p>Mood averaged <strong>${data.mood.average}</strong>.</p>
      </div>
    </section>
  `;
}

function MonthlySummaryCard() {
  const data = getAnalyticsData();

  return `
    <section class="insights-feature-card" aria-label="Monthly summary">
      <div class="insights-section-heading">
        <p>Monthly Summary</p>
        <h2>Your life signals, softened.</h2>
      </div>
      <div class="insight-metrics-grid">
        ${InsightMetric("Average Sleep", data.sleep.averageDuration, "Schedule consistency and rest.", "sleep")}
        ${InsightMetric("Average Mood", data.mood.average, "Your emotional baseline.", "mood")}
        ${InsightMetric("Total Focus", formatHours(getFocusTotal(data)), "Study and work combined.", "focus")}
        ${InsightMetric("Career Progress", getCareerProgress(data), "Applications and interviews.", "career")}
        ${InsightMetric("Health Activity", getHealthActivity(data), "Training and body notes.", "health")}
      </div>
    </section>
  `;
}

function getActivityIntensity(date) {
  const focusMinutes = state.focus.sessions
    .filter((session) => session.date === date)
    .reduce((sum, session) => sum + minutesBetween(session.start, session.end), 0);
  const careerCount = state.career.applications.filter(
    (application) => application.date === date,
  ).length;
  const healthEntry = getHealthEntry(date);
  const healthCount = healthEntry
    ? Number(healthEntry.training !== "Rest")
    : 0;
  const moodCount = state.mood.entries.some(
    (entry) => entry.date === date && entry.persisted,
  )
    ? 1
    : 0;

  return Math.min(
    4,
    Math.ceil(focusMinutes / 120) + careerCount + healthCount + moodCount,
  );
}

function ActivityHeatmapCard() {
  const range = getRangeBounds();
  const dates = getRangeDates(range);

  return `
    <section class="insights-feature-card" aria-label="Activity heatmap">
      <div class="insights-section-heading">
        <p>Activity Heatmap</p>
        <h2>Your month, at a glance.</h2>
      </div>
      <div class="activity-heatmap">
        ${dates
          .map((date) => {
            const day = new Date(`${date}T00:00:00`).getDate();
            return `<span class="heatmap-cell level-${getActivityIntensity(date)}" title="${date}" aria-label="${date}">${day}</span>`;
          })
          .join("")}
      </div>
    </section>
  `;
}

function InsightsObservationsCard() {
  const data = getAnalyticsData();
  const focusTotal = getFocusTotal(data);
  const observations = [
    focusTotal
      ? `Your focused work is strongest when sessions are captured consistently.`
      : `Start with one focused session and Momentum will begin finding patterns.`,
    Number(data.mood.average) >= 6
      ? `Mood remained steady across the saved days.`
      : `Mood has room to recover; gentle routines may matter this week.`,
    data.health.upper + data.health.lower
      ? `Movement is part of this rhythm.`
      : `Health activity is still quiet in this range.`,
    data.sleep.averageDuration === "Not enough data"
      ? `Sleep patterns will become clearer after a few saved nights.`
      : `Average sleep gives you a useful baseline for the next reflection.`,
  ];

  return `
    <section class="insights-feature-card" aria-label="Reflective insights">
      <div class="insights-section-heading">
        <p>Insights</p>
        <h2>Patterns worth noticing.</h2>
      </div>
      <div class="insight-observations">
        ${observations.map((item) => `<p>${item}</p>`).join("")}
      </div>
    </section>
  `;
}

function DonutChart({ study, work }) {
  const total = study + work;
  const radius = 76;
  const circumference = 2 * Math.PI * radius;
  const studyLength = total ? (study / total) * circumference : 0;
  const workLength = total ? (work / total) * circumference : 0;

  return `
    <div class="donut-wrap">
      <svg class="donut-chart" viewBox="0 0 190 190" role="img" aria-hidden="true">
        <circle cx="95" cy="95" r="${radius}" fill="none" stroke="#f1f1f3" stroke-width="18"></circle>
        <circle cx="95" cy="95" r="${radius}" fill="none" stroke="#1d1d1f" stroke-width="18" stroke-linecap="round"
          stroke-dasharray="${studyLength} ${circumference - studyLength}" stroke-dashoffset="0"></circle>
        <circle cx="95" cy="95" r="${radius}" fill="none" stroke="#8e8e93" stroke-width="18" stroke-linecap="round"
          stroke-dasharray="${workLength} ${circumference - workLength}" stroke-dashoffset="${-studyLength}"></circle>
      </svg>
      <div class="donut-center">
        <div>
          <strong>${formatDuration(total)}</strong>
          <span>Total Focus</span>
        </div>
      </div>
    </div>
  `;
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
        ${["week", "month", "custom"]
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
  return `
    <label class="time-card" for="${id}" data-time-card="${id}">
      <span class="micro-label">${label}</span>
      <span class="time-value" id="${id}Display">${value}</span>
      <input class="native-time-input" id="${id}" type="time" value="${value}" aria-label="${label}" />
    </label>
  `;
}

function SleepCard() {
  const selectedDate = getSelectedDate();
  const selectedSleep = getOrCreateSleepEntry(selectedDate);
  const duration = getSleepDurationForDate(selectedDate);
  const durationLabel =
    duration === null ? "Not enough data" : formatDuration(duration);

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
  const saved = state.career.applications.filter(
    (application) =>
      application.date === selectedDate && application.status === "Saved",
  ).length;
  const applied = state.career.applications.filter(
    (application) =>
      application.date === selectedDate && application.status === "Applied",
  ).length;
  const interview = state.career.applications.filter(
    (application) =>
      application.date === selectedDate && application.status === "Interview",
  ).length;
  const hasActivity = saved + applied + interview > 0;

  return Card({
    icon: "💼",
    title: "Career",
    children: `
      <div class="field-grid">
        <label class="field">
          <span class="field-label">Company</span>
          <input class="input" id="careerCompany" value="${state.career.company}" />
        </label>
        <label class="field">
          <span class="field-label">Position</span>
          <input class="input" id="careerPosition" value="${state.career.position}" />
        </label>
      </div>
      <div class="segmented three" id="careerStatus" aria-label="Status">
        <button class="segment ${state.career.status === "Saved" ? "is-active" : ""}" type="button" data-status="Saved">Saved</button>
        <button class="segment ${state.career.status === "Applied" ? "is-active" : ""}" type="button" data-status="Applied">Applied</button>
        <button class="segment ${state.career.status === "Interview" ? "is-active" : ""}" type="button" data-status="Interview">Interview</button>
      </div>
      <button class="small-button" type="button" id="addApplication">Add Application</button>
      <div class="divider"></div>
      <div class="output">
        ${
          hasActivity
            ? `
              <p class="output-title">Today</p>
              <div class="summary-row"><span>Applied Today</span><strong>${applied}</strong></div>
              <div class="summary-row"><span>Saved Today</span><strong>${saved}</strong></div>
              <div class="summary-row"><span>Interview Today</span><strong>${interview}</strong></div>
            `
            : `<p class="empty-state">No career activity yet today.</p>`
        }
      </div>
    `,
  });
}

function statusOptions(selected) {
  return ["Saved", "Applied", "Interview"]
    .map(
      (status) =>
        `<option value="${status}" ${selected === status ? "selected" : ""}>${status}</option>`,
    )
    .join("");
}

function getFilteredApplications() {
  const query = state.jobTracker.search.trim().toLowerCase();
  const filtered = state.career.applications.filter((application) => {
    const matchesQuery =
      !query ||
      application.company.toLowerCase().includes(query) ||
      application.position.toLowerCase().includes(query);
    const matchesFilter =
      state.jobTracker.filter === "All" ||
      application.status === state.jobTracker.filter;

    return matchesQuery && matchesFilter;
  });

  return [...filtered].sort((a, b) => {
    if (state.jobTracker.sort === "Oldest") {
      return a.date.localeCompare(b.date);
    }

    if (state.jobTracker.sort === "Company") {
      return a.company.localeCompare(b.company);
    }

    return b.date.localeCompare(a.date);
  });
}

function JobTrackerRow(application) {
  return `
    <div class="tracker-row" data-application-id="${application.id}">
      <label class="field">
        <span class="field-label">Company</span>
        <input class="input tracker-company" value="${escapeHTML(application.company)}" />
      </label>
      <label class="field">
        <span class="field-label">Position</span>
        <input class="input tracker-position" value="${escapeHTML(application.position)}" />
      </label>
      <label class="field">
        <span class="field-label">Status</span>
        <select class="select tracker-status">${statusOptions(application.status)}</select>
      </label>
      <label class="field">
        <span class="field-label">Date</span>
        <input class="input tracker-date" type="date" value="${application.date}" />
      </label>
      <button class="icon-button delete-application" type="button" aria-label="Delete application">×</button>
    </div>
  `;
}

function JobTrackerPage() {
  const applications = getFilteredApplications();

  return `
    <div class="tracker-page">
      <section class="tracker-card" aria-label="Job Tracker">
        <div class="tracker-controls">
          <label class="field">
            <span class="field-label">Search</span>
            <input class="input" id="jobSearch" value="${escapeHTML(state.jobTracker.search)}" placeholder="Company or position" />
          </label>
          <label class="field">
            <span class="field-label">Filter</span>
            <select class="select" id="jobFilter">
              <option value="All" ${state.jobTracker.filter === "All" ? "selected" : ""}>All</option>
              ${statusOptions(state.jobTracker.filter)}
            </select>
          </label>
          <label class="field">
            <span class="field-label">Sort</span>
            <select class="select" id="jobSort">
              <option ${state.jobTracker.sort === "Newest" ? "selected" : ""}>Newest</option>
              <option ${state.jobTracker.sort === "Oldest" ? "selected" : ""}>Oldest</option>
              <option ${state.jobTracker.sort === "Company" ? "selected" : ""}>Company</option>
            </select>
          </label>
        </div>
        <div class="divider"></div>
        <div class="tracker-list">
          ${
            applications.length
              ? applications.map((application) => JobTrackerRow(application)).join("")
              : `<p class="empty-state">No applications yet.</p>`
          }
        </div>
      </section>
    </div>
  `;
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
        ${StatTile("Applied", data.career.applied)}
        ${StatTile("Saved", data.career.saved)}
        ${StatTile("Interview", data.career.interview)}
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
  return AnalyticsCard({
    title: "Mood",
    children: `
      <div class="mood-value mood-gradient-panel">
        <span class="micro-label">${data.label} Average</span>
        <strong class="mood-number">${data.mood.average}</strong>
      </div>
      ${LineChart({ values: data.mood.values, accent: "mood" })}
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
      <button class="date-nav-button" type="button" data-date-nav="previous">← Previous Day</button>
      <button class="date-nav-button ${isToday ? "is-active" : ""}" type="button" data-date-nav="today">Today</button>
      <button class="date-nav-button" type="button" data-date-nav="next">Next Day →</button>
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

function renderAnalytics() {
  activePage = "Insights";
  const data = getAnalyticsData();
  pageEyebrow.textContent = "Insights";
  pageEyebrow.hidden = true;
  pageTitle.textContent = "Insights";
  pageSubtitle.textContent = "A reflective view of your patterns over time.";
  pageSubtitle.hidden = false;
  if (workspaceDateRegion) {
    workspaceDateRegion.innerHTML = "";
  }
  if (workspaceSaveStatus) {
    workspaceSaveStatus.hidden = true;
  }
  pageContent.innerHTML = `
    <div class="insights-page">
      ${TimeRangeSelector()}
      ${InsightsHero()}
      ${MonthlySummaryCard()}
      <div class="insights-feature-grid">
        ${ActivityHeatmapCard()}
        ${InsightsObservationsCard()}
      </div>
      <div class="analytics-grid insights-secondary-grid">
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
  activePage = "Workspace";
  const selectedDate = getDateParts(getSelectedDate());
  const workspaceName = localStorage.getItem("workspaceName") || "Chen";
  const firstName = workspaceName.split(/\s+/)[0] || "Chen";
  pageEyebrow.textContent = `Good morning, ${firstName}.`;
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
      ${CareerCard()}
      ${HealthCard()}
      ${MoodCard()}
    </div>
  `;
  wireWorkspace();
}

function renderJobTracker() {
  activePage = "Job Tracker";
  pageEyebrow.textContent = "Job Tracker";
  pageEyebrow.hidden = true;
  pageTitle.textContent = "Job Tracker";
  pageSubtitle.textContent = "Career applications in one place.";
  pageSubtitle.hidden = false;
  if (workspaceDateRegion) {
    workspaceDateRegion.innerHTML = "";
  }
  if (workspaceSaveStatus) {
    workspaceSaveStatus.hidden = true;
  }
  pageContent.innerHTML = JobTrackerPage();
  wireJobTracker();
}

function rerenderJobTracker({ focusSearch = false } = {}) {
  renderJobTracker();

  if (focusSearch) {
    const search = document.getElementById("jobSearch");
    search?.focus();
    search?.setSelectionRange(search.value.length, search.value.length);
  }
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
  if (page === "Workspace") {
    renderWorkspace();
    return;
  }

  if (page === "Journal") {
    renderJournal();
    return;
  }

  if (page === "Job Tracker") {
    renderJobTracker();
    return;
  }

  if (page === "Insights" || page === "Analytics") {
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
    if (dirtyModules.includes("mood")) {
      await saveMoodChanges();
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
  if (!isSupabaseConfigured) {
    return;
  }

  try {
    const selectedDate = getSelectedDate();
    const moodLog = await getMoodLogByDate(selectedDate, getWorkspaceId());

    if (moodLog) {
      upsertMoodEntry({
        date: moodLog.date,
        score: moodLog.score,
        logId: moodLog.id,
        persisted: true,
        workspaceId: moodLog.workspaceId || getWorkspaceId(),
      });
      state.mood.score = Number(moodLog.score);
      state.mood.logId = moodLog.id;
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
  if (!isSupabaseConfigured) {
    return;
  }

  const range = getRangeBounds();
  const key = moodRangeKey(range);

  if (!force && state.mood.loadedRanges.includes(key)) {
    return;
  }

  try {
    const moodLogs = await getMoodLogsForRange({
      from: range.from,
      to: range.to,
      workspaceId: getWorkspaceId(),
    });

    moodLogs.forEach((moodLog) => {
      upsertMoodEntry({
        date: moodLog.date,
        score: moodLog.score,
        logId: moodLog.id,
        persisted: true,
        workspaceId: moodLog.workspaceId || getWorkspaceId(),
      });
    });

    if (!state.mood.loadedRanges.includes(key)) {
      state.mood.loadedRanges.push(key);
    }

    if (activePage === "Insights") {
      renderAnalytics();
    }
  } catch (error) {
    console.error(
      `Mood analytics load failed: ${error?.message || "Unknown error"} ${error?.code || ""}`.trim(),
    );
  }
}

async function saveMoodChanges() {
  if (!isSupabaseConfigured) {
    throw new Error("Add Supabase env variables to save mood.");
  }

  const moodLog = await saveMoodLog({
    id: getOrCreateMoodEntry(getSelectedDate()).logId,
    date: getSelectedDate(),
    score: state.mood.score,
    workspaceId: getWorkspaceId(),
  });

  if (moodLog) {
    upsertMoodEntry({
      date: moodLog.date,
      score: moodLog.score,
      logId: moodLog.id,
      persisted: true,
      workspaceId: moodLog.workspaceId || getWorkspaceId(),
    });
    state.mood.logId = moodLog.id;
    state.mood.score = Number(moodLog.score);
  }
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
      loadTodayMood();
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

  document.getElementById("careerCompany")?.addEventListener("input", (event) => {
    state.career.company = event.target.value;
    markUnsavedChange("career");
  });

  document.getElementById("careerPosition")?.addEventListener("input", (event) => {
    state.career.position = event.target.value;
    markUnsavedChange("career");
  });

  document.querySelectorAll("[data-status]").forEach((button) => {
    button.addEventListener("click", () => {
      state.career.status = button.dataset.status;
      markUnsavedChange("career");
      rerenderWorkspace();
    });
  });

  document.getElementById("addApplication")?.addEventListener("click", () => {
    if (!state.career.company.trim() && !state.career.position.trim()) {
      return;
    }

    state.career.applications.push({
      id: createId("career"),
      date: getSelectedDate(),
      company: state.career.company.trim(),
      position: state.career.position.trim(),
      status: state.career.status,
    });
    state.career.company = "";
    state.career.position = "";
    markUnsavedChange("career");
    rerenderWorkspace();
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

function findApplication(id) {
  return state.career.applications.find((application) => application.id === id);
}

function wireJobTracker() {
  document.getElementById("jobSearch")?.addEventListener("input", (event) => {
    state.jobTracker.search = event.target.value;
    rerenderJobTracker({ focusSearch: true });
  });

  document.getElementById("jobFilter")?.addEventListener("change", (event) => {
    state.jobTracker.filter = event.target.value;
    rerenderJobTracker();
  });

  document.getElementById("jobSort")?.addEventListener("change", (event) => {
    state.jobTracker.sort = event.target.value;
    rerenderJobTracker();
  });

  document.querySelectorAll("[data-application-id]").forEach((row) => {
    const application = findApplication(row.dataset.applicationId);

    if (!application) {
      return;
    }

    row.querySelector(".tracker-company")?.addEventListener("input", (event) => {
      application.company = event.target.value;
    });

    row.querySelector(".tracker-position")?.addEventListener("input", (event) => {
      application.position = event.target.value;
    });

    row.querySelector(".tracker-status")?.addEventListener("change", (event) => {
      application.status = event.target.value;
      rerenderJobTracker();
    });

    row.querySelector(".tracker-date")?.addEventListener("input", (event) => {
      application.date = event.target.value;
      rerenderJobTracker();
    });

    row.querySelector(".delete-application")?.addEventListener("click", () => {
      state.career.applications = state.career.applications.filter(
        (item) => item.id !== application.id,
      );
      rerenderJobTracker();
    });
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
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const suffix = Array.from({ length: 5 }, () =>
    alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join("");

  return `MOM-${suffix}`;
}

function saveWorkspace({ workspaceName, momentumId }) {
  if (workspaceName) {
    localStorage.setItem("workspaceName", workspaceName);
  }

  localStorage.setItem("momentumId", momentumId);
}

function getSavedWorkspace() {
  const momentumId = localStorage.getItem("momentumId");

  if (!momentumId) {
    return null;
  }

  return {
    workspaceName: localStorage.getItem("workspaceName") || "Workspace",
    momentumId,
  };
}

function renderWorkspaceInfo() {
  const workspaceName = localStorage.getItem("workspaceName") || "Workspace";

  const nameNode = document.getElementById("sidebarWorkspaceName");

  if (nameNode) {
    nameNode.textContent = workspaceName;
  }
}

function enterWorkspace() {
  workspaceSelected = true;
  renderApp();
  initMainWorkspace();
}

function wireLandingPage() {
  document.querySelector("[data-continue-workspace]")?.addEventListener("click", () => {
    enterWorkspace();
  });

  document.querySelectorAll("[data-landing-card]").forEach((card) => {
    card.addEventListener("click", () => {
      landingPanel = card.dataset.landingCard;
      renderApp();
      wireLandingPage();
    });
  });

  document.getElementById("createWorkspaceForm")?.addEventListener("submit", (event) => {
    event.preventDefault();

    const workspaceName =
      document.getElementById("workspaceNameInput")?.value.trim() || "Workspace";
    const momentumId = generateMomentumId();

    saveWorkspace({ workspaceName, momentumId });
    enterWorkspace();
  });

  document.getElementById("openWorkspaceForm")?.addEventListener("submit", (event) => {
    event.preventDefault();

    const momentumId = document.getElementById("momentumIdInput")?.value.trim();

    if (!momentumId) {
      return;
    }

    saveWorkspace({ workspaceName: localStorage.getItem("workspaceName") || "Workspace", momentumId });
    enterWorkspace();
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
    
