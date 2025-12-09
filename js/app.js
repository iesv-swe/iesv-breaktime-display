// app.js — FULL VERSION WITH B2 "NEXT SCHOOL DAY LOOKAHEAD"

const iconArea     = document.getElementById("iconArea");
const mainMessage  = document.getElementById("mainMessage");
const subMessage   = document.getElementById("subMessage");
const clockCorner  = document.getElementById("clockCorner");
const combinedSec  = document.getElementById("combinedSection");
const combinedText = document.getElementById("combinedText");
const barA         = document.querySelector(".barFillA");
const barB         = document.querySelector(".barFillB");

const yearSelect   = document.getElementById("yearSelect");
const refreshBtn   = document.getElementById("refreshBtn");
const debugToggle  = document.getElementById("debugToggle");
const debugPanel   = document.getElementById("debugPanel");
const debugOutput  = document.getElementById("debugOutput");
const testBell     = document.getElementById("testBell");

const bell         = document.getElementById("bell");

let schedule6A = null;
let schedule6B = null;

let lastEndA = null;
let lastEndB = null;

const SCHOOL_OPEN  = 7 * 3600;
const SCHOOL_CLOSE = 17.5 * 3600;

const DAYS = ["Sun","Mon","Tue","Wed","Thur","Fri","Sat"];


/* ---------------- HELPERS ---------------- */

function nowClock(){
  const d = new Date();
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function fmt(sec){
  if(sec < 0) sec = 0;
  const m=Math.floor(sec/60), s=sec%60;
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function getBreakState(schedule, nowSec, day){
  const rows = schedule.breaksByDay[day] || [];
  let active=null, next=null;

  for(const b of rows){
    const s=b.startMinutes*60, e=b.endMinutes*60;
    if(nowSec>=s && nowSec<e)
      active={...b,startSec:s,endSec:e};
    else if(nowSec<s && !next)
      next={...b,startSec:s,endSec:e};
  }
  return {active,next};
}

function barFill(next, now){
  if(!next) return "0%";
  const until = next.startSec - now;
  return (Math.max(0, Math.min(1, 1 - until / 5400)) * 100) + "%";
}


/* -------------- NEXT SCHOOL DAY LOGIC (B2) -------------- */

function getNextSchoolDayBreak(schedule, currentDayIndex){
  let dayIndex = currentDayIndex;

  for(let i=0;i<7;i++){
    dayIndex = (dayIndex + 1) % 7;
    const dName = DAYS[dayIndex];

    if(dName === "Sat" || dName === "Sun") continue;

    const rows = schedule.breaksByDay[dName] || [];
    if(rows.length > 0) return { dayIndex, rows };
  }

  return null;
}


/* ---------------- STATE SETTER ---------------- */

function setState(bgClass, icon, main, sub, anim=null){
  document.body.className = bgClass;
  iconArea.textContent = icon;
  mainMessage.textContent = main;
  subMessage.textContent = sub;
  iconArea.style.animationName = anim ? anim : "none";
}


/* ---------------- MAIN LOOP ---------------- */

async function loadAll(){
  schedule6A = await getScheduleForYear("6A");
  schedule6B = await getScheduleForYear("6B");
  debugOutput.value = JSON.stringify({schedule6A,schedule6B},null,2);
}

refreshBtn.onclick = loadAll;
testBell.onclick = ()=> bell.play();
debugToggle.onclick = ()=> debugPanel.style.display =
  debugPanel.style.display==="block" ? "none" : "block";
yearSelect.onchange = loadAll;


function update(){
  const now = new Date();
  const nowSec = now.getHours()*3600 + now.getMinutes()*60 + now.getSeconds();
  const todayIndex = now.getDay();
  const today = DAYS[todayIndex];

  clockCorner.textContent = nowClock();

  const stA_today = getBreakState(schedule6A, nowSec, today);
  const stB_today = getBreakState(schedule6B, nowSec, today);

  const mode = yearSelect.value;


  /* -------- IF TODAY HAS NO BREAKS LEFT, LOOK AHEAD (B2) -------- */

  function getFallback(schedule){
    const nextDay = getNextSchoolDayBreak(schedule, todayIndex);
    if(!nextDay) return null;

    const first = nextDay.rows[0];
    return {
      next: {
        ...first,
        startSec: first.startMinutes * 60,
        endSec: first.endMinutes * 60,
        fallbackDay: DAYS[nextDay.dayIndex]
      }
    };
  }

  const fallbackA = (!stA_today.active && !stA_today.next) ? getFallback(schedule6A) : null;
  const fallbackB = (!stB_today.active && !stB_today.next) ? getFallback(schedule6B) : null;


  /* ---------------- SINGLE CLASS MODE ---------------- */

  if(mode==="6A" || mode==="6B"){
    combinedSec.style.display="none";
    const stToday = mode==="6A" ? stA_today : stB_today;
    const stTomorrow = mode==="6A" ? fallbackA : fallbackB;

    if(stToday.active){
      const left = stToday.active.endSec - nowSec;
      const isLunch = stToday.active.type==="lunch";

      setState(
        left<=60 ? "state-ending" : (isLunch?"state-lunch":"state-break"),
        isLunch?"🍽️":"⚽",
        isLunch?"LUNCH TIME!":"BREAK TIME!",
        `${isLunch?"Lunch ends in:":"Break ends in:"} ${fmt(left)}`,
        "bounce"
      );
      return;
    }

    if(stToday.next){
      const until = stToday.next.startSec - nowSec;
      const isLunch = stToday.next.type==="lunch";

      setState(
        until<=300?"state-soon":"state-class",
        isLunch?"🍽️":"🕒",
        isLunch?"LUNCH SOON":"BREAK SOON",
        `${isLunch?"Lunch starts in:":"Break starts in:"} ${fmt(until)}`,
        "pulse"
      );
      return;
    }

    if(stTomorrow){
      const label = stTomorrow.next.type==="lunch" ? "LUNCH (next school day)" : "BREAK (next school day)";
      setState(
        "state-class",
        "🎒",
        "Next School Day",
        `${label} at ${stTomorrow.next.startLabel}`
      );
      return;
    }

    setState("state-class","🎒","Class Time","No breaks available");
    return;
  }



  /* ---------------- COMBINED MODE ---------------- */

  /* Active break RIGHT NOW */
  if(stA_today.active || stB_today.active){
    combinedSec.style.display="none";

    let ch = stA_today.active, owner="6A";
    if(stB_today.active && (!stA_today.active || stB_today.active.endSec < stA_today.active.endSec)){
      ch = stB_today.active; owner="6B";
    }

    const left = ch.endSec - nowSec;
    const isLunch = ch.type==="lunch";

    setState(
      left<=60?"state-ending":(isLunch?"state-lunch":"state-break"),
      isLunch?"🍽️":"⚽",
      isLunch?"LUNCH TIME!":"BREAK TIME!",
      `${isLunch?"Lunch ends in:":"Break ends in:"} ${fmt(left)}`,
      "bounce"
    );

    return;
  }


  /* Next break today? */
  const nA = stA_today.next;
  const nB = stB_today.next;

  if(nA || nB){
    combinedSec.style.display="block";

    const txtA = nA ? `${nA.type==="lunch"?"Lunch":"Break"} at ${nA.startLabel}` : "—";
    const txtB = nB ? `${nB.type==="lunch"?"Lunch":"Break"} at ${nB.startLabel}` : "—";

    combinedText.textContent = `6A next: ${txtA} • 6B next: ${txtB}`;

    setState("state-class","🎒","Class Time","Next breaks shown below");

    barA.style.width = barFill(nA,nowSec);
    barB.style.width = barFill(nB,nowSec);

    return;
  }


  /* FALLBACK TO NEXT SCHOOL DAY FOR COMBINED MODE */

  const nA_f = fallbackA ? fallbackA.next : null;
  const nB_f = fallbackB ? fallbackB.next : null;

  if(nA_f || nB_f){
    combinedSec.style.display="block";

    const txtA = nA_f ? `${nA_f.type==="lunch"?"Lunch":"Break"} at ${nA_f.startLabel} (${nA_f.fallbackDay})` : "—";
    const txtB = nB_f ? `${nB_f.type==="lunch"?"Lunch":"Break"} at ${nB_f.startLabel} (${nB_f.fallbackDay})` : "—";

    combinedText.textContent = `6A next: ${txtA} • 6B next: ${txtB}`;

    setState("state-class","🎒","Next School Day","Break schedule below");

    barA.style.width = "0%";
    barB.style.width = "0%";

    return;
  }


  /* Nothing at all */
  combinedSec.style.display="none";
  setState("state-class","🎒","Class Time","No breaks found");
}


/* ---------------- START ---------------- */
(async()=>{
  await loadAll();
  update();
  setInterval(update,1000);
})();
