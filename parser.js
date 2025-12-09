// parser.js — FINAL VERSION (only break rows, no gap detection)

const LESSONS_FILE = "Lessons.txt";

// PUBLIC API
async function getScheduleForYear(yearKey) {
  const raw = await fetch(LESSONS_FILE).then(r => r.text());
  return buildBreakSchedule(raw, yearKey);
}

async function getYear6Schedule() {
  return getScheduleForYear("6");
}

window.getScheduleForYear = getScheduleForYear;
window.getYear6Schedule = getYear6Schedule;


// ----------------------------------------------
// MAIN BREAK BUILDER
// ----------------------------------------------
function buildBreakSchedule(text, yearKey) {
  const lines = text.split(/\r?\n/);

  const dayMap = { Mon: [], Tue: [], Wed: [], Thur: [], Fri: [] };

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

    // NORMALISE DAY
    const day = normalizeDay(rawDay);
    if (!day) continue;

    // IDENTIFY BREAK TYPES
    const low = title.toLowerCase();
    let type = null;

    if (low.includes("passing time")) type = "passing";
    else if (low.includes("break senior")) type = "senior";
    else if (low.includes("lunch")) type = "lunch";
    else continue; // ignore all others

    const tokens = normalizeTokens(classField);
    if (!matchesYear(tokens, yearKey)) continue;

    if (!/^[0-2][0-9][0-5][0-9]$/.test(startStr)) continue;
    const duration = parseInt(durationStr, 10);
    if (!Number.isFinite(duration) || duration < 1) continue;

    const startMin = hhmmToMinutes(startStr);
    const endMin = startMin + duration;

    dayMap[day].push({
      day,
      type,              // "passing", "senior", "lunch"
      startMinutes: startMin,
      endMinutes: endMin,
      duration,
      startLabel: minutesToHHMM(startMin),
      endLabel: minutesToHHMM(endMin)
    });
  }

  // Sort by time
  for (const d of Object.keys(dayMap)) {
    dayMap[d].sort((a, b) => a.startMinutes - b.startMinutes);
  }

  return { breaksByDay: dayMap };
}


// ----------------------------------------------
// NORMALISE DAY
// ----------------------------------------------
function normalizeDay(raw) {
  if (!raw) return null;
  const d = raw.trim().toLowerCase();

  if (d === "mon" || d === "mån") return "Mon";
  if (d === "tue" || d === "tis") return "Tue";
  if (d === "wed" || d === "ons") return "Wed";
  if (d === "thu" || d === "thur" || d === "tor" || d === "tors") return "Thur";
  if (d === "fri" || d === "fre") return "Fri";

  return null;
}


// ----------------------------------------------
// CLASS TOKENS
// ----------------------------------------------
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


// ----------------------------------------------
// TIME HELPERS
// ----------------------------------------------
function hhmmToMinutes(hhmm) {
  const hh = parseInt(hhmm.slice(0,2), 10);
  const mm = parseInt(hhmm.slice(2,4), 10);
  return hh * 60 + mm;
}

function minutesToHHMM(mins) {
  const hh = String(Math.floor(mins / 60)).padStart(2, "0");
  const mm = String(mins % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}
