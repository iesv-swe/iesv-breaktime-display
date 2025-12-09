// js/app.js — COMPLETE APPLICATION LOGIC (FIXED CALENDAR EMOJI)

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
    console.log('✅ Schedules loaded successfully');
  } catch (err) {
    console.error('❌ Failed to load schedules:', err);
    showError('Could not load schedule data');
  }
}

function setupEventListeners() {
  DOM.settingsToggle.addEventListener('click', function() {
    DOM.settingsPanel.classList.toggle('hidden');
  });
  
  DOM.testSound.addEventListener('click', function() {
    playAlert();
  });
  
  DOM.reloadData.addEventListener('click', function() {
    loadSchedules();
  });
  
  DOM.yearSelect.addEventListener('change', function() {
    update();
  });
  
  document.addEventListener('click', function(e) {
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

function formatCountdown(totalSeconds) {
  if (totalSeconds < 0) totalSeconds = 0;
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return {
    mins: String(mins).padStart(2, '0'),
    secs: String(secs).padStart(2, '0'),
    display: mins + ':' + String(secs).padStart(2, '0')
  };
}

function formatClock(hours, minutes) {
  return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
}

/* ==================== BREAK STATE LOGIC ==================== */

function getBreakState(schedule, nowSec, day) {
  if (!schedule || !schedule.breaksByDay) {
    return { active: null, next: null };
  }
  
  const rows = schedule.breaksByDay[day] || [];
  let active = null;
  let next = null;

  for (let i = 0; i < rows.length; i++) {
    const b = rows[i];
    const startSec = b.startMinutes * 60;
    const endSec = b.endMinutes * 60;
    
    if (nowSec >= startSec && nowSec < endSec) {
      active = {
        type: b.type,
        startMinutes: b.startMinutes,
        endMinutes: b.endMinutes,
        startLabel: b.startLabel,
        endLabel: b.endLabel,
        startSec: startSec,
        endSec: endSec
      };
    } else if (nowSec < startSec && !next) {
      next = {
        type: b.type,
        startMinutes: b.startMinutes,
        endMinutes: b.endMinutes,
        startLabel: b.startLabel,
        endLabel: b.endLabel,
        startSec: startSec,
        endSec: endSec
      };
    }
  }
  
  return { active: active, next: next };
}

function getNextSchoolDayBreak(schedule, currentDayIndex) {
  if (!schedule || !schedule.breaksByDay) {
    return null;
  }
  
  for (let i = 1; i <= 7; i++) {
    var dayIndex = (currentDayIndex + i) % 7;
    var dayName = DAYS[dayIndex];
    
    if (dayName === 'Sat' || dayName === 'Sun') {
      continue;
    }
    
    var rows = schedule.breaksByDay[dayName] || [];
    if (rows.length > 0) {
      return {
        dayIndex: dayIndex,
        dayName: dayName,
        dayFullName: DAY_NAMES[dayIndex],
        firstBreak: rows[0]
      };
    }
  }
  
  return null;
}

/* ==================== UI UPDATE ==================== */

function update() {
  var now = getNow();
  
  DOM.clock.textContent = formatClock(now.hours, now.minutes);
  DOM.dayName.textContent = now.dayFullName;
  
  var mode = DOM.yearSelect.value;
  
  var stateA = getBreakState(schedule6A, now.totalSeconds, now.dayName);
  var stateB = getBreakState(schedule6B, now.totalSeconds, now.dayName);
  
  updateClassPanel('A', stateA, now);
  updateClassPanel('B', stateB, now);
  
  if (mode === '6A') {
    updateMainDisplay(stateA, now, '6A');
    DOM.card6B.style.opacity = '0.4';
    DOM.card6A.style.opacity = '1';
  } else if (mode === '6B') {
    updateMainDisplay(stateB, now, '6B');
    DOM.card6A.style.opacity = '0.4';
    DOM.card6B.style.opacity = '1';
  } else {
    DOM.card6A.style.opacity = '1';
    DOM.card6B.style.opacity = '1';
    updateMainDisplayCombined(stateA, stateB, now);
  }
}

function updateClassPanel(suffix, state, now) {
  var statusEl = DOM['status6' + suffix];
  var nextEl = DOM['next6' + suffix];
  var barEl = DOM['bar6' + suffix];
  var cardEl = DOM['card6' + suffix];
  
  cardEl.classList.remove('active', 'active-lunch');
  statusEl.classList.remove('on-break', 'on-lunch');
  
  if (state.active) {
    var isLunch = state.active.type === 'lunch';
    var remaining = state.active.endSec - now.totalSeconds;
    var time = formatCountdown(remaining);
    
    statusEl.textContent = isLunch ? '🍽️ LUNCH' : '⚽ BREAK';
    statusEl.classList.add(isLunch ? 'on-lunch' : 'on-break');
    cardEl.classList.add(isLunch ? 'active-lunch' : 'active');
    nextEl.textContent = 'Ends in ' + time.display;
    
    var total = state.active.endSec - state.active.startSec;
    var elapsed = now.totalSeconds - state.active.startSec;
    barEl.style.width = ((elapsed / total) * 100) + '%';
    
  } else if (state.next) {
    var until = state.next.startSec - now.totalSeconds;
    var isLunchNext = state.next.type === 'lunch';
    
    statusEl.textContent = 'In Class';
    nextEl.textContent = (isLunchNext ? 'Lunch' : 'Break') + ' at ' + state.next.startLabel;
    
    var progress = Math.max(0, Math.min(1, 1 - until / 5400));
    barEl.style.width = (progress * 100) + '%';
    
  } else {
    statusEl.textContent = 'No breaks';
    nextEl.textContent = 'Check tomorrow';
    barEl.style.width = '0%';
  }
}

function updateMainDisplay(state, now, className) {
  var schedule = className === '6A' ? schedule6A : schedule6B;
  
  if (state.active) {
    showActiveBreak(state.active, now);
  } else if (state.next) {
    showUpcomingBreak(state.next, now);
  } else {
    var nextDay = getNextSchoolDayBreak(schedule, now.dayIndex);
    if (nextDay) {
      showNextDayBreak(nextDay);
    } else {
      showNoBreaks();
    }
  }
}

function updateMainDisplayCombined(stateA, stateB, now) {
  var activeA = stateA.active;
  var activeB = stateB.active;
  
  if (activeA || activeB) {
    var chosen = activeA;
    if (activeB && (!activeA || activeB.endSec < activeA.endSec)) {
      chosen = activeB;
    }
    showActiveBreak(chosen, now);
    return;
  }
  
  var nextA = stateA.next;
  var nextB = stateB.next;
  
  if (nextA || nextB) {
    var chosenNext = nextA;
    if (nextB && (!nextA || nextB.startSec < nextA.startSec)) {
      chosenNext = nextB;
    }
    showUpcomingBreak(chosenNext, now);
    return;
  }
  
  var nextDayA = getNextSchoolDayBreak(schedule6A, now.dayIndex);
  var nextDayB = getNextSchoolDayBreak(schedule6B, now.dayIndex);
  
  if (nextDayA || nextDayB) {
    showNextDayBreak(nextDayA || nextDayB);
  } else {
    showNoBreaks();
  }
}

/* ==================== STATE DISPLAYS ==================== */

function showActiveBreak(breakInfo, now) {
  var isLunch = breakInfo.type === 'lunch';
  var remaining = breakInfo.endSec - now.totalSeconds;
  var total = breakInfo.endSec - breakInfo.startSec;
  var elapsed = now.totalSeconds - breakInfo.startSec;
  var progress = elapsed / total;
  var time = formatCountdown(remaining);
  
  var isEnding = remaining <= 60;
  var isWarning = remaining <= 180 && remaining > 60;
  
  var stateClass = isLunch ? 'state-lunch' : 'state-break';
  if (isEnding) {
    stateClass = 'state-warning';
  }
  
  setBodyState(stateClass);
  
  DOM.iconEmoji.textContent = isLunch ? '🍽️' : '⚽';
  DOM.statusTitle.textContent = isLunch ? 'LUNCH TIME' : 'BREAK TIME';
  
  if (isEnding) {
    DOM.statusSubtitle.textContent = '⚠️ GET BACK TO CLASS!';
    triggerAlert('Break ending! Return to class NOW!', true);
  } else if (isWarning) {
    DOM.statusSubtitle.textContent = 'Start heading back soon...';
    triggerAlert('Break ending in 3 minutes!', false);
  } else {
    DOM.statusSubtitle.textContent = 'Ends at ' + breakInfo.endLabel;
  }
  
  DOM.countdown.style.display = 'flex';
  DOM.countMin.textContent = time.mins;
  DOM.countSec.textContent = time.secs;
  
  DOM.progressContainer.classList.add('visible');
  var circumference = 2 * Math.PI * 90;
  var offset = circumference * (1 - progress);
  DOM.progressFill.style.strokeDashoffset = offset;
  DOM.progressLabel.textContent = Math.round(progress * 100) + '%';
}

function showUpcomingBreak(breakInfo, now) {
  var isLunch = breakInfo.type === 'lunch';
  var until = breakInfo.startSec - now.totalSeconds;
  var time = formatCountdown(until);
  
  var isSoon = until <= 300;
  
  setBodyState(isSoon ? 'state-soon' : 'state-class');
  
  DOM.iconEmoji.textContent = isSoon ? '🎉' : '📚';
  
  if (isSoon) {
    DOM.statusTitle.textContent = (isLunch ? 'LUNCH' : 'BREAK') + ' SOON!';
  } else {
    DOM.statusTitle.textContent = 'CLASS TIME';
  }
  
  DOM.statusSubtitle.textContent = (isLunch ? 'Lunch' : 'Break') + ' starts at ' + breakInfo.startLabel;
  
  DOM.countdown.style.display = 'flex';
  DOM.countMin.textContent = time.mins;
  DOM.countSec.textContent = time.secs;
  
  DOM.progressContainer.classList.remove('visible');
}

function showNextDayBreak(nextDay) {
  setBodyState('state-class');
  
  // Changed from 📅 to 🗓️ to avoid the "July 17" date display
  DOM.iconEmoji.textContent = '🗓️';
  DOM.statusTitle.textContent = 'NO MORE BREAKS TODAY';
  
  var breakType = nextDay.firstBreak.type === 'lunch' ? 'Lunch' : 'Break';
  DOM.statusSubtitle.textContent = 'Next: ' + breakType + ' on ' + nextDay.dayFullName + ' at ' + nextDay.firstBreak.startLabel;
  
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
  if (currentState === stateClass) {
    return;
  }
  
  document.body.className = stateClass;
  currentState = stateClass;
}

function triggerAlert(message, critical) {
  var now = Date.now();
  
  if (now - lastAlertTime < 30000) {
    return;
  }
  
  DOM.alertText.textContent = message;
  DOM.alertBanner.classList.remove('hidden');
  DOM.alertBanner.classList.add('visible');
  
  if (DOM.soundEnabled.checked) {
    playAlert();
  }
  
  lastAlertTime = now;
  
  var hideDelay = critical ? 10000 : 5000;
  setTimeout(function() {
    DOM.alertBanner.classList.remove('visible');
    DOM.alertBanner.classList.add('hidden');
  }, hideDelay);
}

function playAlert() {
  try {
    var AudioContext = window.AudioContext || window.webkitAudioContext;
    var ctx = new AudioContext();
    
    var frequencies = [440, 554.37, 659.25];
    
    for (var i = 0; i < frequencies.length; i++) {
      (function(index) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.frequency.value = frequencies[index];
        osc.type = 'sine';
        
        var startTime = ctx.currentTime + index * 0.15;
        gain.gain.setValueAtTime(0.3, startTime);
        gain.gain.setValueAtTime(0.01, startTime + 0.14);
        
        osc.start(startTime);
        osc.stop(startTime + 0.15);
      })(i);
    }
  } catch (e) {
    if (DOM.alertSound) {
      DOM.alertSound.currentTime = 0;
      DOM.alertSound.play().catch(function() {});
    }
  }
}

/* ==================== START APPLICATION ==================== */

document.addEventListener('DOMContentLoaded', init);
