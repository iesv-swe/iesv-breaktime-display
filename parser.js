// parser.js (FULL FILE with day-normalisation FIX)
// -------------------------------------------------

const LESSONS_FILE = "Lessons.txt";

// PUBLIC API
async function getScheduleForYear(yearKey) {
  const raw = await fetch(LESSONS_FILE).then(r => r.text());
  return buildSchedule(raw, yearKey);
}

async function getYear6Schedule() {
  return getScheduleForYear("6");
}

window.getScheduleForYear = getScheduleForYear;
window.getYear6Schedule = getYear6Schedule;


// -------------------------------------------------
// MAIN BUILDER
// -------------------------------------------------

function buildSchedule(text, yearKey) {
  const lines = text.split(/\r?\n/);

  // Canonical days
  const dayLessons = {
    Mon: [],
    Tue: [],
    Wed: [],
    Thur: [],
    Fri: []
  };

  for (const rawLine of lines) {
    if (!rawLine.trim()) continue;

    const cols = rawLine.includes("\t")
      ? rawLine.split("\t")
      : rawLine.split(/\s+/);

    if (cols.length < 7) continue;

    const title = (cols[1] || "").trim();
    const rawDay = (cols[2] || "").trim();
    const startStr = (cols[3] || "").trim();
    const durationStr = (cols[4] || "").trim();
    const classField = (cols[6] || "").trim();

    // NORMALISE DAY STRING HERE (FIX)
    const day = normalizeDay(rawDay);
    if (!day) continue; // skip unknown day

    // Skip explicit Break/Rast rows
    const low = title.toLowerCase();
    if (low.includes("break") || low.includes("rast")) continue;

    if (!/^[0-2][0-9][0-5][0-9]$/.test(startStr)) continue;

    const duration = parseInt(durationStr, 10);
    if (!Number.isFinite(duration) || duration < 1) continue;

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

  // Sort lessons per day
  for (const d of Object.keys(dayLessons)) {
    dayLessons[d].sort((a, b) => a.startMinutes - b.startMinutes);
  }

  // Build breaks per day
  const breaksByDay = {};
  for (const d of Object.keys(dayLessons)) {
    breaksByDay[d] = computeBreaks(dayLessons[d]);
  }

  return { lessonsByDay: dayLessons, breaksByDay };
}


// -------------------------------------------------
// NORMALISE DAY NAMES  (THE FIX)
// -------------------------------------------------

function normalizeDay(raw) {
  if (!raw) return null;

  const d = raw.trim().toLowerCase();

  if (d === "mon" || d === "mån" || d === "monday") return "Mon";
  if (d === "tue" || d === "tis" || d === "tuesday") return "Tue";
  if (d === "wed" || d === "ons" || d === "wednesday") return "Wed";

  // Your file uses "Thur" exactly – include tolerance:
  if (d === "thur" || d === "thu" || d === "tors" || d === "tor") return "Thur";

  if (d === "fri" || d === "fre" || d === "friday") return "Fri";

  // Unknown day → skip line
  return null;
}


// -------------------------------------------------
// CLASS TOKEN LOGIC
// -------------------------------------------------

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


// -------------------------------------------------
// BREAK COMPUTATION
// -------------------------------------------------

function computeBreaks(lessons) {
  const out = [];
  if (!lessons.length) return out;

  for (let i = 0; i < lessons.length - 1; i++) {
    const a = lessons[i];
    const b = lessons[i + 1];

    if (b.startMinutes > a.endMinutes) {
      const gap = b.startMinutes - a.endMinutes;
      if (gap >= 5) {
        out.push({
          day: a.day,
          startMinutes: a.endMinutes,
          endMinutes: b.startMinutes,
          duration: gap,
          startLabel: minutesToHHMM(a.endMinutes),
          endLabel: minutesToHHMM(b.startMinutes)
        });
      }
    }
  }
  return out;
}


// -------------------------------------------------
// TIME HELPERS
// -------------------------------------------------

function hhmmToMinutes(hhmm) {
  const hh = parseInt(hhmm.slice(0,2), 10);
  const mm = parseInt(hhmm.slice(2,4), 10);
  return hh * 60 + mm;
}

function minutesToHHMM(mins) {
  const hh = String(Math.floor(mins/60)).padStart(2,"0");
  const mm = String(mins % 60).padStart(2,"0");
  return `${hh}:${mm}`;
}
