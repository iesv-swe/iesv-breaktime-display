// parser.js
// Reads Lessons.txt, extracts lessons for a given class group (6A, 6B, or combined Year 6),
// and computes break gaps automatically per day.

const LESSONS_FILE = "Lessons.txt";

// -------- PUBLIC API --------

async function getScheduleForYear(yearKey) {
  const raw = await fetch(LESSONS_FILE).then(r => r.text());
  return buildSchedule(raw, yearKey);
}

async function getYear6Schedule() {
  return getScheduleForYear("6");
}

window.getScheduleForYear = getScheduleForYear;
window.getYear6Schedule = getYear6Schedule;

// -------- CORE BUILD --------

function buildSchedule(text, yearKey) {
  const lines = text.split(/\r?\n/);
  const dayLessons = { Mon: [], Tue: [], Wed: [], Thur: [], Fri: [] };

  for (const rawLine of lines) {
    if (!rawLine.trim()) continue;

    const cols = rawLine.includes("\t")
      ? rawLine.split("\t")
      : rawLine.split(/\s+/);

    if (cols.length < 7) continue;

    const title = (cols[1] || "").trim();
    const day = (cols[2] || "").trim();
    const startStr = (cols[3] || "").trim();
    const durationStr = (cols[4] || "").trim();
    const classField = (cols[6] || "").trim();

    if (!day || !/^[MTWFS]/i.test(day)) continue;
    if (!/^[0-2][0-9][0-5][0-9]$/.test(startStr)) continue;

    const duration = parseInt(durationStr, 10);
    if (!Number.isFinite(duration) || duration < 1) continue;

    // Ignore explicit Break/Rast rows — we compute real breaks from gaps.
    const tt = title.toLowerCase();
    if (tt.includes("break") || tt.includes("rast")) continue;

    const tokens = normalizeTokens(classField);
    if (!matchesYear(tokens, yearKey)) continue;

    const startMin = hhmmToMinutes(startStr);
    const endMin = startMin + duration;

    dayLessons[day].push({
      day,
      startMinutes: startMin,
      endMinutes: endMin,
      duration,
      startLabel: minutesToHHMM(startMin),
      endLabel: minutesToHHMM(endMin),
      tokens,
      title
    });
  }

  // SORT lessons per day
  for (const day of Object.keys(dayLessons)) {
    dayLessons[day].sort((a, b) => a.startMinutes - b.startMinutes);
  }

  // BUILD BREAKS per group
  const breaksByDay = {};
  for (const day of Object.keys(dayLessons)) {
    breaksByDay[day] = computeBreaks(dayLessons[day]);
  }

  return { lessonsByDay: dayLessons, breaksByDay };
}

// -------- CLASS TOKEN LOGIC --------

function normalizeTokens(field) {
  return field
    .split(/[^A-Za-z0-9:]+/)
    .map(t => t.trim())
    .filter(Boolean);
}

function tokenIsGroup(t, base) {
  if (t === base) return true;
  if (t.startsWith(base + ":")) return true;
  return false;
}

function matchesYear(tokens, yearKey) {
  if (yearKey === "6") {
    return tokens.some(t => tokenIsGroup(t, "6A") || tokenIsGroup(t, "6B"));
  }
  if (yearKey === "6A" || yearKey === "6B") {
    return tokens.some(t => tokenIsGroup(t, yearKey));
  }
  return false;
}

// -------- BREAKS (GAPS) --------

function computeBreaks(lessons) {
  const out = [];
  if (!lessons.length) return out;

  for (let i = 0; i < lessons.length - 1; i++) {
    const cur = lessons[i];
    const nxt = lessons[i + 1];
    if (nxt.startMinutes > cur.endMinutes) {
      const gap = nxt.startMinutes - cur.endMinutes;
      if (gap >= 5) {
        out.push({
          day: cur.day,
          startMinutes: cur.endMinutes,
          endMinutes: nxt.startMinutes,
          duration: gap,
          startLabel: minutesToHHMM(cur.endMinutes),
          endLabel: minutesToHHMM(nxt.startMinutes)
        });
      }
    }
  }

  return out;
}

// -------- TIME HELPERS --------

function hhmmToMinutes(hhmm) {
  const hh = parseInt(hhmm.substring(0, 2), 10);
  const mm = parseInt(hhmm.substring(2, 4), 10);
  return hh * 60 + mm;
}

function minutesToHHMM(mins) {
  const h = String(Math.floor(mins / 60)).padStart(2, "0");
  const m = String(mins % 60).padStart(2, "0");
  return `${h}:${m}`;
}
