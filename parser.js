// parser.js
// Reads Lessons.txt, extracts lessons for a given year/group (e.g. "6", "6A", "6B"),
// and computes break gaps automatically per day.
//
// Assumptions (based on the timetable structure):
// 0: ID
// 1: Title
// 2: Day (Mon/Tue/Wed/Thur/Fri)
// 3: Start time (HHMM, e.g. 0955)
// 4: Duration in minutes (integer)
// 5: Teacher(s)
// 6: Class/group list (e.g. "6A", "6B", "6A,6B")
// We use columns [2], [3], [4], [6].

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

/**
 * Convenience wrapper for "Year 6" (6A + 6B).
 */
async function getYear6Schedule() {
  return getScheduleForYear("6");
}

// ----------------------------
// Core builder
// ----------------------------

function buildSchedule(text, yearKey) {
  const lines = text.split(/\r?\n/);
  const lessonsByDay = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Prefer tab-separated; if no tabs, fall back to whitespace.
    const cols = line.includes("\t")
      ? line.split("\t")
      : line.split(/\s+/);

    if (cols.length < 7) continue;

    const day = cols[2];        // Mon, Tue, Wed, Thur, Fri
    const startStr = cols[3];   // 4-digit HHMM
    const durationStr = cols[4];
    const classField = cols[6] || "";

    if (!/^[0-2][0-9][0-5][0-9]$/.test(startStr)) continue;
    const duration = parseInt(durationStr, 10);
    if (Number.isNaN(duration) || duration <= 0) continue;

    if (!classMatchesYear(classField, yearKey)) continue;

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
      title: cols[1] || ""
    });
  }

  // Sort lessons by time and compute break gaps per day
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
// Matching year/groups
// ----------------------------

function classMatchesYear(classField, yearKey) {
  const tokens = classField.split(/[,\s]/).map(t => t.trim()).filter(Boolean);
  if (!tokens.length) return false;

  // Aggregate "Year 6" (treat 6A + 6B as one group)
  if (yearKey === "6") {
    return tokens.includes("6A") || tokens.includes("6B");
  }

  // Direct match (e.g. "6A", "6B", "7A", etc.)
  return tokens.includes(yearKey);
}

// ----------------------------
// Break calculation
// ----------------------------

/**
 * Compute gaps (breaks) between lessons for a single day.
 * Any gap >= 5 minutes is considered a break.
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

// ----------------------------
// Expose to browser
// ----------------------------
window.getScheduleForYear = getScheduleForYear;
window.getYear6Schedule = getYear6Schedule;
