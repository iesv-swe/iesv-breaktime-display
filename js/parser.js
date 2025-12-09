// js/parser.js — COMPLETE FILE FOR GITHUB PAGES

const LESSONS_FILE = 'Lessons.txt';

/**
 * Fetches and parses schedule for a given year group
 * @param {string} yearKey - '6', '6A', or '6B'
 * @returns {Promise<{breaksByDay: Object}>}
 */
async function getScheduleForYear(yearKey) {
  try {
    const response = await fetch(LESSONS_FILE);
    
    if (!response.ok) {
      throw new Error(`Failed to load schedule: ${response.status} ${response.statusText}`);
    }
    
    const raw = await response.text();
    
    if (!raw.trim()) {
      console.warn('⚠️ Lessons.txt is empty');
      return { breaksByDay: emptySchedule() };
    }
    
    const schedule = buildBreakSchedule(raw, yearKey);
    console.log(`📅 Parsed schedule for ${yearKey}:`, schedule);
    
    return schedule;
    
  } catch (error) {
    console.error('❌ Error loading schedule:', error);
    return { breaksByDay: emptySchedule() };
  }
}

window.getScheduleForYear = getScheduleForYear;

/**
 * Returns empty schedule structure
 */
function emptySchedule() {
  return { Mon: [], Tue: [], Wed: [], Thur: [], Fri: [] };
}

/**
 * Parses raw text into break schedule
 * @param {string} text - Raw file contents
 * @param {string} yearKey - Year filter
 * @returns {{breaksByDay: Object}}
 */
function buildBreakSchedule(text, yearKey) {
  const lines = text.split(/\r?\n/);
  const out = emptySchedule();
  
  let parsed = 0;
  let skipped = 0;

  for (const raw of lines) {
    if (!raw.trim()) continue;
    
    // Split by tabs first, fall back to 2+ spaces
    const cols = raw.includes('\t') 
      ? raw.split('\t').map(c => c.trim())
      : raw.split(/\s{2,}/).map(c => c.trim());
    
    if (cols.length < 7) {
      skipped++;
      continue;
    }

    const title = (cols[1] || '').toLowerCase();
    const dayRaw = (cols[2] || '').trim();
    const startTime = (cols[3] || '').trim();
    const duration = parseInt(cols[4] || '0', 10);
    const groups = (cols[6] || '');

    const day = normalizeDay(dayRaw);
    if (!day) {
      skipped++;
      continue;
    }

    const type = classifyBreakType(title);
    if (!type) {
      skipped++;
      continue;
    }

    const tokens = normalizeTokens(groups);
    if (!matchesYear(tokens, yearKey)) {
      skipped++;
      continue;
    }

    if (!/^\d{4}$/.test(startTime)) {
      skipped++;
      continue;
    }

    if (duration <= 0 || duration > 120) {
      skipped++;
      continue;
    }

    const startMinutes = parseTime(startTime);
    const endMinutes = startMinutes + duration;

    out[day].push({
      type,
      startMinutes,
      endMinutes,
      startLabel: formatTime(startMinutes),
      endLabel: formatTime(endMinutes),
      duration
    });
    
    parsed++;
  }

  for (const day of Object.keys(out)) {
    out[day].sort((a, b) => a.startMinutes - b.startMinutes);
  }

  console.log(`📊 Parser: ${parsed} breaks found, ${skipped} lines skipped`);

  return { breaksByDay: out };
}

/**
 * Classifies a lesson title into a break type
 * @param {string} title - Lowercase title
 * @returns {string|null} - 'break', 'lunch', or null
 */
function classifyBreakType(title) {
  const t = title.toLowerCase();
  
  if (t.includes('lunch')) {
    return 'lunch';
  }
  
  if (
    t.includes('break senior') ||
    t.includes('break') ||
    t.includes('passing time') ||
    t.includes('recess') ||
    t.includes('morning tea') ||
    t.includes('interval') ||
    t.includes('rast')
  ) {
    return 'break';
  }
  
  return null;
}

/**
 * Normalizes day names (supports English and Swedish)
 * @param {string} d - Raw day string
 * @returns {string|null}
 */
function normalizeDay(d) {
  const day = d.toLowerCase().trim();
  
  const mapping = {
    'mon': 'Mon',
    'monday': 'Mon',
    'mån': 'Mon',
    'måndag': 'Mon',
    'tue': 'Tue',
    'tues': 'Tue',
    'tuesday': 'Tue',
    'tis': 'Tue',
    'tisdag': 'Tue',
    'wed': 'Wed',
    'wednesday': 'Wed',
    'ons': 'Wed',
    'onsdag': 'Wed',
    'thu': 'Thur',
    'thur': 'Thur',
    'thurs': 'Thur',
    'thursday': 'Thur',
    'tor': 'Thur',
    'torsdag': 'Thur',
    'fri': 'Fri',
    'friday': 'Fri',
    'fre': 'Fri',
    'fredag': 'Fri'
  };
  
  return mapping[day] || null;
}

/**
 * Splits group field into tokens
 * @param {string} field - Raw groups field
 * @returns {string[]}
 */
function normalizeTokens(field) {
  return field
    .split(/[^A-Za-z0-9:]+/)
    .map(x => x.trim().toUpperCase())
    .filter(Boolean);
}

/**
 * Checks if tokens match the requested year
 * @param {string[]} tokens - Parsed group tokens
 * @param {string} yearKey - '6', '6A', or '6B'
 * @returns {boolean}
 */
function matchesYear(tokens, yearKey) {
  if (yearKey === '6') {
    return tokens.some(t => 
      t.startsWith('6A') || t.startsWith('6B') || t === '6'
    );
  }
  
  return tokens.some(t => t.startsWith(yearKey.toUpperCase()));
}

/**
 * Parses HHMM string to minutes since midnight
 * @param {string} t - Time string like "0930"
 * @returns {number}
 */
function parseTime(t) {
  const hours = parseInt(t.slice(0, 2), 10);
  const minutes = parseInt(t.slice(2, 4), 10);
  return hours * 60 + minutes;
}

/**
 * Formats minutes to HH:MM string
 * @param {number} m - Minutes since midnight
 * @returns {string}
 */
function formatTime(m) {
  const hours = String(Math.floor(m / 60)).padStart(2, '0');
  const mins = String(m % 60).padStart(2, '0');
  return `${hours}:${mins}`;
}
