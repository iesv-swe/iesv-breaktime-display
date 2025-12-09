// app.js — FINAL STATE ENGINE

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

const bell         = document.getElementById("bell");

let schedule6A = null;
let schedule6B = null;
let lastEndA=null, lastEndB=null;

const SCHOOL_OPEN  = 7*3600;
const SCHOOL_CLOSE = 17.5*3600;

async function loadAll(){
  schedule6A = await getScheduleForYear("6A");
  schedule6B = await getScheduleForYear("6B");
  debugOutput.value = JSON.stringify({schedule6A,schedule6B},null,2);
}
refreshBtn.onclick = loadAll;
debugToggle.onclick = ()=> debugPanel.style.display = debugPanel.style.display==="block" ? "none" : "block";
document.getElementById("testBell").onclick = ()=> bell.play();

yearSelect.onchange = loadAll;

function nowClock(){
  const d=new Date();
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function fmt(sec){
  if(sec<0)sec=0;
  const m=Math.floor(sec/60), s=sec%60;
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function getBreakState(schedule, nowSec, day){
  const arr = schedule.breaksByDay[day] || [];
  let active=null, next=null;
  for(const b of arr){
    const s=b.startMinutes*60, e=b.endMinutes*60;
    if(nowSec>=s && nowSec<e) active={...b,startSec:s,endSec:e};
    else if(nowSec<s && !next) next={...b,startSec:s,endSec:e};
  }
  return {active,next};
}

function barFill(next,now){
  if(!next) return "0%";
  const until = next.startSec-now;
  const ratio = Math.max(0,Math.min(1,1-until/5400));
  return (ratio*100)+"%";
}

function playBell(type){
  if(type==="lunch") return;
  bell.currentTime=0;
  bell.play().catch(()=>{});
}

function update(){
  const d = new Date();
  const nowSec = d.getHours()*3600 + d.getMinutes()*60 + d.getSeconds();
  const day = ["Sun","Mon","Tue","Wed","Thur","Fri","Sat"][d.getDay()];
  clockCorner.textContent = nowClock();

  if(nowSec<SCHOOL_OPEN || nowSec>SCHOOL_CLOSE){
    setState("class","🎒","School Closed"," ");
    combinedSec.style.display="none";
    return;
  }

  const stA = getBreakState(schedule6A,nowSec,day);
  const stB = getBreakState(schedule6B,nowSec,day);

  const mode = yearSelect.value;

  // ---------------- SINGLE CLASS MODES ----------------
  if(mode==="6A" || mode==="6B"){
    combinedSec.style.display="none";
    const st = mode==="6A"? stA : stB;

    if(st.active){
      const left=st.active.endSec-nowSec;
      const label = st.active.type==="lunch"?"Lunch ends in:":"Break ends in:";
      const icon  = st.active.type==="lunch"?"🍽️":"⚽";
      const anim  = st.active.type==="lunch"?"bounce":"bounce";
      const bg    = left<=60 ? "state-ending":"state-break";

      setState(bg,icon,(st.active.type==="lunch"?"LUNCH":"BREAK TIME!"),`${label} ${fmt(left)}`,anim);

      const last = mode==="6A"? lastEndA : lastEndB;
      if(!last) mode==="6A"? lastEndA=st.active.endSec : lastEndB=st.active.endSec;
      if(last===nowSec){
        playBell(st.active.type);
        mode==="6A"? lastEndA=null : lastEndB=null;
      }
      return;
    }

    if(st.next){
      const until = st.next.startSec-nowSec;
      const isLunch = st.next.type==="lunch";
      const label = isLunch?"Lunch starts in:":"Break starts in:";
      const icon  = isLunch?"🍽️":"🕒";
      const anim  = "pulse";
      const bg    = until<=300 ? "state-soon" : "state-class";
      setState(bg,icon,(isLunch?"LUNCH SOON":"BREAK SOON"),`${label} ${fmt(until)}`,anim);
      return;
    }

    setState("state-class","🎒","Class Time","Next break unknown");
    return;
  }


  // ---------------- COMBINED MODE (Year 6) ----------------

  // Active break for either?
  if(stA.active || stB.active){
    combinedSec.style.display="none";

    let ch = stA.active, owner="6A";
    if(stB.active && (!stA.active || stB.active.endSec < stA.active.endSec)){
      ch=stB.active; owner="6B";
    }

    const left = ch.endSec-nowSec;
    const isLunch = ch.type==="lunch";
    const icon = isLunch?"🍽️":"⚽";
    const msg  = isLunch?"LUNCH":"BREAK TIME!";
    const label= isLunch?"Lunch ends in:":"Break ends in:";
    const anim = isLunch?"bounce":"bounce";
    const bg   = left<=60 ? "state-ending":"state-break";

    setState(bg,icon,msg,`${label} ${fmt(left)}`,anim);

    const last = owner==="6A"? lastEndA:lastEndB;
    if(!last) owner==="6A"? lastEndA=ch.endSec : lastEndB=ch.endSec;
    if(last===nowSec){
      playBell(ch.type);
      owner==="6A"? lastEndA=null : lastEndB=null;
    }
    return;
  }

  // No active breaks → combined preview
  combinedSec.style.display="block";

  const nA = stA.next;
  const nB = stB.next;

  setState("state-class","🎒","Class Time"," ");

  combinedText.textContent =
    `6A next: ${nA? (nA.type==="lunch"?"Lunch":"Break")+" at "+nA.startLabel : "—"} • `+
    `6B next: ${nB? (nB.type==="lunch"?"Lunch":"Break")+" at "+nB.startLabel : "—"}`;

  barA.style.width = barFill(nA,nowSec);
  barB.style.width = barFill(nB,nowSec);
}


function setState(bgClass, icon, main, sub, anim=null){
  document.body.className = bgClass;
  iconArea.textContent = icon;
  mainMessage.textContent = main;
  subMessage.textContent = sub;

  iconArea.style.animationName = anim ? anim : "none";
}

(async()=>{
  await loadAll();
  update();
  setInterval(update,1000);
})();
