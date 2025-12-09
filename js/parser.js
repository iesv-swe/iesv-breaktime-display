const LESSONS_FILE = "../Lessons.txt";

async function getScheduleForYear(yearKey) {
  const raw = await fetch(LESSONS_FILE).then(r => r.text());
  return buildBreakSchedule(raw, yearKey);
}
window.getScheduleForYear = getScheduleForYear;

function buildBreakSchedule(text, yearKey){
  const lines=text.split(/\r?\n/);
  const out={Mon:[],Tue:[],Wed:[],Thur:[],Fri:[]};

  for(const raw of lines){
    if(!raw.trim()) continue;

    const cols = raw.includes("\t") ? raw.split("\t") : raw.split(/\s+/);
    if(cols.length < 7) continue;

    const title = (cols[1]||"").trim().toLowerCase();
    const day   = normalizeDay((cols[2]||"").trim());
    const start = (cols[3]||"").trim();
    const dur   = parseInt(cols[4]||"0",10);
    const groups= normalizeTokens(cols[6]||"");

    if(!day) continue;

    let type=null;
    if(title.includes("passing time")) type="passing";
    else if(title.includes("break senior")) type="senior";
    else if(title.includes("lunch")) type="lunch";
    else continue;

    if(!matchesYear(groups,yearKey)) continue;

    if(!/^\d{4}$/.test(start)) continue;
    if(dur<=0) continue;

    const s = hhmm(start);
    const e = s + dur;

    out[day].push({
      type,
      startMinutes:s,
      endMinutes:e,
      startLabel:mmhh(s),
      endLabel:mmhh(e)
    });
  }

  for(const d of Object.keys(out)){
    out[d].sort((a,b)=>a.startMinutes-b.startMinutes);
  }
  return {breaksByDay:out};
}

function normalizeDay(d){
  d=d.toLowerCase();
  if(d==="mon"||d==="mån")return"Mon";
  if(d==="tue"||d==="tis")return"Tue";
  if(d==="wed"||d==="ons")return"Wed";
  if(d==="thu"||d==="thur"||d==="tor")return"Thur";
  if(d==="fri"||d==="fre")return"Fri";
  return null;
}
function normalizeTokens(f){
  return f.split(/[^A-Za-z0-9:]+/).map(x=>x.trim()).filter(Boolean);
}
function matchesYear(tokens,y){
  if(y==="6") return tokens.some(t=>t.startsWith("6A")||t.startsWith("6B"));
  return tokens.some(t=>t.startsWith(y));
}
function hhmm(t){ return parseInt(t.slice(0,2))*60 + parseInt(t.slice(2,4)); }
function mmhh(m){
  const h=String(Math.floor(m/60)).padStart(2,"0");
  const mm=String(m%60).padStart(2,"0");
  return `${h}:${mm}`;
}
