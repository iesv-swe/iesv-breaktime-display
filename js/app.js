// js/app.js — COMPLETE REWRITE

const DOM = {
  clock: document.getElementById('clock'),
  dayName: document.getElementById('dayName'),
  iconEmoji: document.getElementById('iconEmoji'),
  statusTitle: document.getElementById('statusTitle'),
  statusSubtitle: document.getElementById('statusSubtitle'),
  countMin: document.getElementById('countMin'),
  countSec: document.getElementById('countSec'),
  countdown: document.getElementById('countdown'),
  progressContainer: document.getElementById('progressContainer'),
  progressFill: document.querySelector('.progressFill'),
  progressLabel: document.getElementById('progressLabel'),
  classPanels: document.getElementById('classPanels'),
  card6A: document.getElementById('card6A'),
  card6B: document.getElementById('card6B'),
  status6A: document.getElementById('status6A'),
  status6B: document.getElementById('status6B'),
  next6A: document.getElementById('next6A'),
  next6B: document.getElementById('next6B'),
  bar6A: document.getElementById('bar6A'),
  bar6B: document.getElementById('bar6B'),
  alertBanner: document.getElementById('alertBanner'),
  alertText: document.getElementById('alertText'),
  yearSelect: document.getElementById('yearSelect'),
  soundEnabled: document.getElementById('soundEnabled'),
  settingsToggle: document.getElementById('settingsToggle'),
  settingsPanel: document.getElementById('settingsPanel'),
  testSound: document.getElementById('testSound'),
  reloadData: document.getElementById('reloadData'),
  alertSound: document.getElementById('alertSound')
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thur', 'Fri', 'Sat'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

let schedule6A = null;
let schedule6B = null;
let lastAlertTime = 0;
let currentState = null;

/* ==================== INITIALIZATION ==================== */

async function init() {
  await loadSchedules();
  setupEventListeners();
  update();
  setInterval(update, 1000);
}

async function loadSchedules() {
  try {
    schedule6A = await getScheduleForYear('6A');
    schedule6B = await getScheduleForYear('6B');
    console.log('📅 Schedules loaded:', { schedule6A, schedule6B });
  } catch (err) {
    console.error('Failed to load schedules:', err);
    showError('Could not load schedule data');
  }
}

function setupEventListeners() {
  DOM.settingsToggle.addEventListener('click', () => {
    DOM.settingsPanel.classList.toggle('hidden');
  });
  
  DOM.testSound.addEventListener('click', () => playAlert());
  DOM.reloadData.addEventListener('click', () => loadSchedules());
  DOM.yearSelect.addEventListener('change', update);
  
  // Close settings when clicking outside
  document.addEventListener('click', (e) => {
    if (!DOM.settingsPanel.contains(e.target) && 
        !DOM.settingsToggle.contains(e.target)) {
      DOM.settingsPanel.classList.add('hidden');
    }
  });
}

/* ==================== TIME UTILITIES ==================== */

function getNow() {
  const d = new Date();
  return {
    date: d,
    hours: d.getHours(),
    minutes: d.getMinutes(),
    seconds: d.getSeconds(),
    totalSeconds: d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds(),
    dayIndex: d.getDay(),
    dayName: DAYS[d.getDay()],
    dayFullName: DAY_NAMES[d.getDay()]
  };
}

function formatTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return {
    mins: String(Math.max(0, mins)).padStart(2, '0'),
    secs: String(Math.max(0, secs)).padStart(2, '0'),
    display: `${Math.max(0, mins)}:${String(Math.max(0, secs)).padStart(2, '0')}`
  };
}

function formatClock(hours, minutes) {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/* ==================== BREAK STATE LOGIC ==================== */

function getBreakState(schedule, nowSec, day) {
  if (!schedule) return { active: null, next: null };
  
  const rows = schedule.breaksByDay[day] || [];
  let active = null;
  let next = null;

  for (const b of rows) {
    const startSec = b.startMinutes * 60;
    const endSec = b.endMinutes * 60;
    
    if (nowSec >= startSec && nowSec < endSec) {
      active = { ...b, startSec, endSec };
    } else if (nowSec < startSec && !next) {
      next = { ...b, startSec, endSec };
    }
  }
  
  return { active, next };
}

function getNextSchoolDayBreak(schedule, currentDayIndex) {
  if (!schedule) return null;
  
  for (let i = 1; i <= 7; i++) {
    const dayIndex = (currentDayIndex + i) % 7;
    const dayName = DAYS[dayIndex];
    
    if (dayName === 'Sat' || dayName === 'Sun') continue;
    
    const rows = schedule.breaksByDay[dayName] || [];
    if (rows.length > 0) {
      return {
        dayIndex,
        dayName,
        dayFullName: DAY_NAMES[dayIndex],
        firstBreak: rows[0]
      };
    }
  }
  
  return null;
}

/* ==================== UI UPDATE ==================== */

function update() {
  const now = getNow();
  
  // Update clock
  DOM.clock.textContent = formatClock(now.hours, now.minutes);
  DOM.dayName.textContent = now.dayFullName;
  
  const mode = DOM.yearSelect.value;
  
  // Get states for both classes
  const stateA = getBreakState(schedule6A, now.totalSeconds, now.dayName);
  const stateB = getBreakState(schedule6B, now.totalSeconds, now.dayName);
  
  // Update class panels
  updateClassPanel('A', stateA, now);
  updateClassPanel('B', stateB, now);
  
  // Determine main display state
  if (mode === '6A') {
    updateMainDisplay(stateA, now, '6A');
    DOM.card6B.style.opacity = '0.4';
    DOM.card6A.style.opacity = '1';
  } else if (mode === '6B') {
    updateMainDisplay(stateB, now, '6B');
    DOM.card6A.style.opacity = '0.4';
    DOM.card6B.style.opacity = '1';
  } else {
    // Combined mode - show most urgent
    DOM.card6A.style.opacity = '1';
    DOM.card6B.style.opacity = '1';
    updateMainDisplayCombined(stateA, stateB, now);
  }
}

function updateClassPanel(suffix, state, now) {
  const statusEl = DOM[`status6${suffix}`];
  const nextEl = DOM[`next6${suffix}`];
  const barEl = DOM[`bar6${suffix}`];
  const cardEl = DOM[`card6${suffix}`];
  
  cardEl.classList.remove('active', 'active-lunch');
  statusEl.classList.remove('on-break', 'on-lunch');
  
  if (state.active) {
    const isLunch = state.active.type === 'lunch';
    const remaining = state.active.endSec - now.totalSeconds;
    const time = formatTime(remaining);
    
    statusEl.textContent = isLunch ? '🍽️ LUNCH' : '⚽ BREAK';
    statusEl.classList.add(isLunch ? 'on-lunch' : 'on-break');
    cardEl.classList.add(isLunch ? 'active-lunch' : 'active');
    nextEl.textContent = `Ends in ${time.display}`;
    
    // Progress bar shows time elapsed
    const total = state.active.endSec - state.active.startSec;
    const elapsed = now.totalSeconds - state.active.startSec;
    barEl.style.width = `${(elapsed / total) * 100}%`;
    
  } else if (state.next) {
    const until = state.next.startSec - now.totalSeconds;
    const isLunch = state.next.type === 'lunch';
    
    statusEl.textContent = 'In Class';
    nextEl.textContent = `${isLunch ? 'Lunch' : 'Break'} at ${state.next.startLabel}`;
    
    // Progress towards next break (last 90 mins)
    const progress = Math.max(0, Math.min(1, 1 - until / 5400));
    barEl.style.width = `${progress * 100}%`;
    
  } else {
    statusEl.textContent = 'No breaks';
    nextEl.textContent = 'Check tomorrow';
    barEl.style.width = '0%';
  }
}

function updateMainDisplay(state, now, className) {
  const schedule = className === '6A' ? schedule6A : schedule6B;
  
  if (state.active) {
    showActiveBreak(state.active, now);
  } else if (state.next) {
    showUpcomingBreak(state.next, now);
  } else {
    // Look to next school day
    const nextDay = getNextSchoolDayBreak(schedule, now.dayIndex);
    if (nextDay) {
      showNextDayBreak(nextDay);
    } else {
      showNoBreaks();
    }
  }
}

function updateMainDisplayCombined(stateA, stateB, now) {
  // Priority: Active break > Upcoming break > Next day
  const activeA = stateA.active;
  const activeB = stateB.active;
  
  // If any break is active, show the one ending soonest
  if (activeA || activeB) {
    let chosen = activeA;
    if (activeB && (!activeA || activeB.endSec < activeA.endSec)) {
      chosen = activeB;
    }
    showActiveBreak(chosen, now);
    return;
  }
  
  // Show upcoming breaks
  const nextA = stateA.next;
  const nextB = stateB.next;
  
  if (nextA || nextB) {
    // Show the one coming soonest
    let chosen = nextA;
    if (nextB && (!nextA || nextB.startSec < nextA.startSec)) {
      chosen = nextB;
    }
    showUpcomingBreak(chosen, now);
    return;
  }
  
  // Look to next school day
  const nextDayA = getNextSchoolDayBreak(schedule6A, now.dayIndex);
  const nextDayB = getNextSchoolDayBreak(schedule6B, now.dayIndex);
  
  if (nextDayA || nextDayB) {
    showNextDayBreak(nextDayA || nextDayB);
  } else {
    showNoBreaks();
  }
}

/* ==================== STATE DISPLAYS ==================== */

function showActiveBreak(breakInfo, now) {
  const isLunch = breakInfo.type === 'lunch';
  const remaining = breakInfo.endSec - now.totalSeconds;
  const total = breakInfo.endSec - breakInfo.startSec;
  const elapsed = now.totalSeconds - breakInfo.startSec;
  const progress = elapsed / total;
  const time = formatTime(remaining);
  
  // Determine urgency
  const isEnding = remaining <= 60;
  const isWarning = remaining <= 180 && remaining > 60;
  
  // Set state
  let stateClass = isLunch ? 'state-lunch' : 'state-break';
  if (isEnding) stateClass = 'state-warning';
  
  setBodyState(stateClass);
  
  // Update display
  DOM.iconEmoji.textContent = isLunch ? '🍽️' : '⚽';
  DOM.statusTitle.textContent = isLunch ? 'LUNCH TIME' : 'BREAK TIME';
  
  if (isEnding) {
    DOM.statusSubtitle.textContent = '⚠️ GET BACK TO CLASS!';
    triggerAlert('Break ending! Return to class NOW!');
  } else if (isWarning) {
    DOM.statusSubtitle.textContent = 'Start heading back soon...';
    triggerAlert('Break ending in 3 minutes!', false);
  } else {
    DOM.statusSubtitle.textContent = `Ends at ${breakInfo.endLabel}`;
  }
  
  // Countdown
  DOM.countdown.style.display = 'flex';
  DOM.countMin.textContent = time.mins;
  DOM.countSec.textContent = time.secs;
  
  // Progress ring
  DOM.progressContainer.classList.add('visible');
  const circumference = 2 * Math.PI * 90;
  const offset = circumference * (1 - progress);
  DOM.progressFill.style.strokeDashoffset = offset;
  DOM.progressLabel.textContent = `${Math.round(progress * 100)}%`;
}

function showUpcomingBreak(breakInfo, now) {
  const isLunch = breakInfo.type === 'lunch';
  const until = breakInfo.startSec - now.totalSeconds;
  const time = formatTime(until);
  
  const isSoon = until <= 300; // 5 minutes
  
  setBodyState(isSoon ? 'state-soon' : 'state-class');
  
  DOM.iconEmoji.textContent = isSoon ? '🎉' : '📚';
  DOM.statusTitle.textContent = isSoon 
    ? `${isLunch ? 'LUNCH' : 'BREAK'} SOON!` 
    : 'CLASS TIME';
  DOM.statusSubtitle.textContent = `${isLunch ? 'Lunch' : 'Break'} starts at ${breakInfo.startLabel}`;
  
  // Countdown to start
  DOM.countdown.style.display = 'flex';
  DOM.countMin.textContent = time.mins;
  DOM.countSec.textContent = time.secs;
  
  // Hide progress ring during class
  DOM.progressContainer.classList.remove('visible');
}

function showNextDayBreak(nextDay) {
  setBodyState('state-class');
  
  DOM.iconEmoji.textContent = '📅';
  DOM.statusTitle.textContent = 'NO MORE BREAKS TODAY';
  
  const breakType = nextDay.firstBreak.type === 'lunch' ? 'Lunch' : 'Break';
  DOM.statusSubtitle.textContent = 
    `Next: ${breakType} on ${nextDay.dayFullName} at ${nextDay.firstBreak.startLabel}`;
  
  DOM.countdown.style.display = 'none';
  DOM.progressContainer.classList.remove('visible');
}

function showNoBreaks() {
  setBodyState('state-class');
  
  DOM.iconEmoji.textContent = '🎒';
  DOM.statusTitle.textContent = 'NO BREAKS SCHEDULED';
  DOM.statusSubtitle.textContent = 'Check back later';
  
  DOM.countdown.style.display = 'none';
  DOM.progressContainer.classList.remove('visible');
}

function showError(message) {
  setBodyState('state-warning');
  
  DOM.iconEmoji.textContent = '⚠️';
  DOM.statusTitle.textContent = 'ERROR';
  DOM.statusSubtitle.textContent = message;
  
  DOM.countdown.style.display = 'none';
  DOM.progressContainer.classList.remove('visible');
}

/* ==================== UTILITIES ==================== */

function setBodyState(stateClass) {
  if (currentState === stateClass) return;
  
  document.body.className = stateClass;
  currentState = stateClass;
}

function triggerAlert(message, critical = true) {
  const now = Date.now();
  
  // Don't spam alerts (minimum 30 seconds between)
  if (now - lastAlertTime < 30000) return;
  
  DOM.alertText.textContent = message;
  DOM.alertBanner.classList.remove('hidden');
  DOM.alertBanner.classList.add('visible');
  
  if (DOM.soundEnabled.checked) {
    playAlert();
  }
  
  lastAlertTime = now;
  
  // Hide after 10 seconds
  setTimeout(() => {
    DOM.alertBanner.classList.remove('visible');
    DOM.alertBanner.classList.add('hidden');
  }, critical ? 10000 : 5000);
}

function playAlert() {
  // Create oscillator for attention-getting sound
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Play a two-tone alert
    [440, 554.37, 659.25].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.frequency.value = freq;
      osc.type = 'sine';
      
      gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.15);
      gain.gain.exponentialDecayTo = 0.01;
      gain.gain.setValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.14);
      
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.15);
    });
  } catch (e) {
    // Fallback to audio element
    DOM.alertSound.currentTime = 0;
    DOM.alertSound.play().catch(() => {});
  }
}

/* ==================== START ==================== */

document.addEventListener('DOMContentLoaded', init);
