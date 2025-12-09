// app.js — COMPLETELY UPDATED FOR C1 CARD LAYOUT

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


/* --------- HELPERS --------- */

function nowClock(){
  const d = new Date();
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function fmt(sec){
  if(sec<0) sec = 0;
  const m = Math.floor(sec/60);
  const s = sec % 60;
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function barFill(next, now){
  if(!next) return "0%";
  const until = next.startSec - now;
  const ratio = Math.max(0, Math.min(1, 1 - until / 5400));
  return (ratio * 100) + "%";
}

function playBell(type){
  if(type === "lunch") return; // Lunch never rings
  bell.currentTime = 0;
  bell.play().catch(()=>{});
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

function setState(bgClass, icon, main, sub, anim=null){
  document.body.className = bgClass;
  iconArea.textContent = icon;
  mainMessage.textContent = main;
  subMessage.textContent = sub;
  iconArea.style.animationName = anim ? anim : "none";
}


/* --------- MAIN LOOP --------- */

async function loadAll(){
  schedule6A = await getScheduleForYear("6A");
  schedule6B = await getScheduleForYear("6B");
  debugOutput.value = JSON.stringify({schedule6A,schedule6B},null,2);
}

refreshBtn.onclick = loadAll;
testBell.onclick   = ()=> bell.play();
debugToggle.onclick = ()=> debugPanel.style.display =
  debugPanel.style.display==="block" ? "none" : "block";
yearSelect.onchange = loadAll;


function update(){
  const d   = new Date();
  const nowSec = d.getHours()*3600 + d.getMinutes()*60 + d.getSeconds();
  const day    = ["Sun","Mon","Tue","Wed","Thur","Fri","Sat"][d.getDay()];

  clockCorner.textContent = nowClock();

  if(nowSec < SCHOOL_OPEN || nowSec > SCHOOL_CLOSE){
    combinedSec.style.display="none";
    setState("state-class","🎒","School Closed","");
    return;
  }

  const stA = getBreakState(schedule6A, nowSec, day);
  const stB = getBreakState(schedule6B, nowSec, day);
  const mode = yearSelect.value;


  /* -------- SINGLE CLASS MODE -------- */
  if(mode==="6A" || mode==="6B"){
    combinedSec.style.display="none";
    const st = mode==="6A"? stA : stB;

    if(st.active){
      const left = st.active.endSec - nowSec;
      const isLunch = st.active.type === "lunch";

      setState(
        left<=60 ? "state-ending" : (isLunch?"state-lunch":"state-break"),
        isLunch ? "🍽️" : "⚽",
        isLunch ? "LUNCH TIME!" : "BREAK TIME!",
        `${isLunch?"Lunch ends in:":"Break ends in:"} ${fmt(left)}`,
        "bounce"
      );

      const last = mode==="6A"? lastEndA : lastEndB;
      if(!last) mode==="6A"? lastEndA=st.active.endSec : lastEndB=st.active.endSec;
      if(last===nowSec){
        playBell(st.active.type);
        mode==="6A"? lastEndA=null : lastEndB=null;
      }
      return;
    }

    if(st.next){
      const until = st.next.startSec - nowSec;
      const isLunch = st.next.type === "lunch";

      setState(
        until<=300 ? "state-soon":"state-class",
        isLunch ? "🍽️" : "🕒",
        isLunch ? "LUNCH SOON" : "BREAK SOON",
        `${isLunch?"Lunch starts in:":"Break starts in:"} ${fmt(until)}`,
        "pulse"
      );
      return;
    }

    setState("state-class","🎒","Class Time","Next break unknown");
    return;
  }



  /* -------- COMBINED MODE -------- */

  if(stA.active || stB.active){
    combinedSec.style.display="none";

    let ch = stA.active, owner="6A";
    if(stB.active && (!stA.active || stB.active.endSec < stA.active.endSec)){
      ch=stB.active; owner="6B";
    }

    const left = ch.endSec-nowSec;
    const isLunch = ch.type==="lunch";

    setState(
      left<=60 ? "state-ending" : (isLunch?"state-lunch":"state-break"),
      isLunch ? "🍽️" : "⚽",
      isLunch ? "LUNCH TIME!" : "BREAK TIME!",
      `${isLunch?"Lunch ends in:":"Break ends in:"} ${fmt(left)}`,
      "bounce"
    );

    const last = owner==="6A"? lastEndA : lastEndB;
    if(!last) owner==="6A"? lastEndA=ch.endSec : lastEndB=ch.endSec;
    if(last===nowSec){
      playBell(ch.type);
      owner==="6A"? lastEndA=null : lastEndB=null;
    }
    return;
  }


  /* -------- CLASS TIME WITH PREVIEW -------- */
  combinedSec.style.display="block";

  const nA = stA.next;
  const nB = stB.next;

  const txtA = nA ? `${nA.type==="lunch"?"Lunch":"Break"} at ${nA.startLabel}` : "—";
  const txtB = nB ? `${nB.type==="lunch"?"Lunch":"Break"} at ${nB.startLabel}` : "—";

  combinedText.textContent = `6A next: ${txtA} • 6B next: ${txtB}`;

  setState("state-class","🎒","Class Time","Next breaks shown below");

  barA.style.width = barFill(nA,nowSec);
  barB.style.width = barFill(nB,nowSec);
}


/* -------- START LOOP -------- */
(async()=>{
  await loadAll();
  update();
  setInterval(update,1000);
})();
