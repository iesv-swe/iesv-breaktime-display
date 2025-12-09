// parser.js
// Reads Lessons.txt, extracts lessons for a given year/group (e.g. "6", "6A", "6B"),
// and computes break gaps automatically per day.
//
// Assumptions (based on timetable structure):
// Columns are tab-separated. Typical layout:
// 0: ID
// 1: Title (subject / Break / Rast / etc.)
// 2: Day (Mon/Tue/Wed/Thur/Fri or empty)
// 3: Start time (HHMM, e.g. 0955)
// 4: Duration in minutes (integer)
// 5: Teacher(s)
// 6: Class/group list (e.g. "6A", "6A,6B", "6A:1")
// We use [2], [3], [4], [6].
const LESSONS_FILE = "Lessons.txt";

// ----------------------------
// Public API
// ----------------------------

/**
 * Get schedule for a given yearKey.
 * yearKey examples:
 *  - "6"  -> aggregate of 6A + 6B
 *  - "6A" -> only 6A lessons
 *  - "6B" -> only 6B lessons
 */
async function getScheduleForYear(yearKey) {
  const raw = await fetch(LESSONS_FILE).then(r => r.text());
  return buildSchedule(raw, yearKey);
}

/** Convenience wrapper for Year 6 aggregate. */
async function getYear6Schedule() {
  return getScheduleForYear("6");
}

// Expose to browser
window.getScheduleForYear = getScheduleForYear;
window.getYear6Schedule = getYear6Schedule;

// ----------------------------
// Core builder
// ----------------------------

function buildSchedule(text, yearKey) {
  const lines = text.split(/\r?\n/);
  const lessonsByDay = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Prefer tabs (Untis export), fall back to whitespace.
    const cols = line.includes("\t")
      ? line.split("\t")
      : line.split(/\s+/);

    if (cols.length < 7) continue;

    const title = (cols[1] || "").trim();
    const day = (cols[2] || "").trim();              // Mon/Tue/Wed/Thur/Fri
    const startStr = (cols[3] || "").trim();         // HHMM
    const durationStr = (cols[4] || "").trim();
    const classField = (cols[6] || "").trim();

    // We only handle actual days
    if (!day) continue;

    // Ignore "Break" & "Rast" lines when building lesson blocks.
    // Breaks are derived from gaps between lessons.
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes("break") || lowerTitle.includes("rast")) {
      continue;
    }

    if (!/^[0-2][0-9][0-5][0-9]$/.test(startStr)) continue;
    const duration = parseInt(durationStr, 10);
    if (!Number.isFinite(duration) || duration <= 0) continue;

    const tokens = normalizeClassTokens(classField);
    if (!classTokensMatchYear(tokens, yearKey)) continue;

    const startMinutes = hhmmToMinutes(startStr);
    const endMinutes = startMinutes + duration;

    if (!lessonsByDay[day]) lessonsByDay[day] = [];
    lessonsByDay[day].push({
      day,
      classGroup: classField,
      startMinutes,
      endMinutes,
      duration,
      startLabel: minutesToHHMM(startMinutes),
      endLabel: minutesToHHMM(endMinutes),
      title
    });
  }

  const breaksByDay = {};
  for (const day of Object.keys(lessonsByDay)) {
    const lessons = lessonsByDay[day].sort((a, b) => a.startMinutes - b.startMinutes);
    const breaks = computeBreaks(lessons);
    lessonsByDay[day] = lessons;
    breaksByDay[day] = breaks;
  }

  return { lessonsByDay, breaksByDay };
}

// ----------------------------
// Class token helpers
// ----------------------------

/**
 * Normalise class field into clean tokens, tolerant of commas, spaces, semicolons etc.
 * Examples:
 *  "6A,6B"   -> ["6A","6B"]
 *  "6A  6B"  -> ["6A","6B"]
 *  "6A:1"    -> ["6A:1"]
 */
function normalizeClassTokens(field) {
  return field
    .split(/[^A-Za-z0-9:]+/)          // split on any non-alphanumeric/colon
    .map(t => t.trim())
    .filter(Boolean);
}

/** Does this token represent base class "6A" or "6B"? */
function tokenIsBaseClass(token, base) {
  if (token === base) return true;
  if (token.startsWith(base + ":")) return true; // e.g. 6A:1, 6A:2
  return false;
}

/**
 * Match against target yearKey:
 *  - "6"  -> any 6A/6B token
 *  - "6A" -> only base 6A tokens
 *  - "6B" -> only base 6B tokens
 * Shared lessons "6A,6B" count as belonging to BOTH (L1 behaviour).
 */
function classTokensMatchYear(tokens, yearKey) {
  if (!tokens.length) return false;

  if (yearKey === "6") {
    return tokens.some(t => tokenIsBaseClass(t, "6A") || tokenIsBaseClass(t, "6B"));
  }

  if (yearKey === "6A" || yearKey === "6B") {
    return tokens.some(t => tokenIsBaseClass(t, yearKey));
  }

  // Default: no match
  return false;
}

// ----------------------------
// Break calculation
// ----------------------------

/**
 * Compute gaps (breaks) between lessons for a single day.
 * Any gap >= 5 minutes is treated as a break.
 */
function computeBreaks(lessons) {
  const breaks = [];
  if (!lessons.length) return breaks;

  for (let i = 0; i < lessons.length - 1; i++) {
    const current = lessons[i];
    const next = lessons[i + 1];

    if (next.startMinutes > current.endMinutes) {
      const gap = next.startMinutes - current.endMinutes;
      if (gap >= 5) {
        breaks.push({
          day: current.day,
          startMinutes: current.endMinutes,
          endMinutes: next.startMinutes,
          duration: gap,
          startLabel: minutesToHHMM(current.endMinutes),
          endLabel: minutesToHHMM(next.startMinutes),
          type: gap >= 20 ? "major-break" : "minor-break"
        });
      }
    }
  }

  return breaks;
}

// ----------------------------
// Time helpers
// ----------------------------

function hhmmToMinutes(hhmm) {
  const hh = parseInt(hhmm.slice(0, 2), 10);
  const mm = parseInt(hhmm.slice(2, 4), 10);
  return hh * 60 + mm;
}

function minutesToHHMM(m) {
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}
