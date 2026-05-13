import { useState, useEffect } from "react";

// ─── Persistent storage helpers ────────────────────────────────────────────────
async function dbGet(key) {
  try { const r = await window.storage.get(key); return r ? JSON.parse(r.value) : null; } catch { return null; }
}
async function dbSet(key, value) {
  try { await window.storage.set(key, JSON.stringify(value)); } catch(e) { console.error(e); }
}

// ─── Default clients (used only on first load) ─────────────────────────────────
const DEFAULT_CLIENTS = ["MasTec","Hope","Bluetuskr","A1 - Technology","2020 Companies"];

const STATUS_OPTIONS = [
  { value:"present",       label:"Present",          color:"#16a34a", bg:"#dcfce7" },
  { value:"late",          label:"Late",              color:"#d97706", bg:"#fef3c7" },
  { value:"absent",        label:"Absent",            color:"#7c3aed", bg:"#e8f0fd" },
  { value:"vacation",      label:"Vacation",          color:"#0284c7", bg:"#e0f2fe" },
  { value:"dayoff",        label:"Day Off",           color:"#64748b", bg:"#f1f5f9" },
  { value:"holiday_off",   label:"Holiday Off",       color:"#db2777", bg:"#fce7f3" },
  { value:"holiday_worked",label:"Holiday Worked",    color:"#9d174d", bg:"#fdf2f8" },
  { value:"pending",       label:"Unreported",        color:"#dc2626", bg:"#fee2e2" },
];

const LOCATION_OPTIONS = [
  { value:"office",   label:"Work in Office", icon:"🏢" },
  { value:"home",     label:"Home Office",    icon:"🏠" },
];

function statusCfg(s) { return STATUS_OPTIONS.find(o => o.value === s) || STATUS_OPTIONS.at(-1); }
function todayKey() { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function fmtDate(str) { if(!str) return "—"; const d=new Date(str+"T12:00:00"); return d.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); }
function initials(n="") { return n.trim().split(" ").slice(0,2).map(w=>w[0]?.toUpperCase()??"").join(""); }
function monthLabel(str) { if(!str) return ""; const [y,m]=str.split("-"); return new Date(y,m-1,1).toLocaleDateString("en-US",{month:"long",year:"numeric"}); }

const TABS = ["Daily Attendance","Employee Registry","Monthly Report","Client Links"];

const SAMPLE_EMPLOYEES = [
  { id:"s1",  name:"Diego Alfredo Berumen Ponce",     role:"Project Coordinator",             manager:"Roberto Ibarra",  client:"MasTec",          location:"office", startDate:"2024-01-15" },
  { id:"s2",  name:"Liliana Mendez Andrade",          role:"Project Coordinator",             manager:"Roberto Ibarra",  client:"MasTec",          location:"home",   startDate:"2024-02-01" },
  { id:"s3",  name:"Sofía Alejandra Pérez García",    role:"Talent Acquisition Administrator",manager:"Roberto Ibarra",  client:"MasTec",          location:"office", startDate:"2024-01-15" },
  { id:"s4",  name:"Luis Alfredo Treviño Aguilar",    role:"Data Entry",                      manager:"Patricia Solis",  client:"MasTec",          location:"office", startDate:"2024-03-10" },
  { id:"s5",  name:"Leonardo Carrasco López",         role:"Project Specialist",              manager:"Patricia Solis",  client:"MasTec",          location:"home",   startDate:"2024-01-15" },
  { id:"s6",  name:"Andrés Mejía Mere",               role:"Project Specialist",              manager:"Patricia Solis",  client:"MasTec",          location:"office", startDate:"2024-04-01" },
  { id:"s7",  name:"Gabriela Beatriz López Serna",    role:"Human Resources Generalist",      manager:"Sandra Ellis",    client:"Hope",            location:"office", startDate:"2024-02-15" },
  { id:"s8",  name:"Guadalupe Heva Gallegos Loaeza",  role:"Accounting Clerk",                manager:"Sandra Ellis",    client:"Hope",            location:"home",   startDate:"2024-01-15" },
  { id:"s9",  name:"Alejandra Barahona Neri",         role:"Human Resources Administrator",   manager:"Marcus Webb",     client:"Hope",            location:"office", startDate:"2024-03-01" },
  { id:"s10", name:"Francisco Ramon UC Loria",        role:"Project Manager E-Commerce",      manager:"Claire Nguyen",   client:"Bluetuskr",       location:"home",   startDate:"2024-02-01" },
  { id:"s11", name:"Oscar Daniel Galicia Murillo",    role:"QA Automation Engineer",          manager:"Claire Nguyen",   client:"A1 - Technology", location:"office", startDate:"2024-01-15" },
  { id:"s12", name:"Gerardo Moran Martinez",          role:"Partnership & Training Lead",     manager:"Joel Vargas",     client:"2020 Companies",  location:"office", startDate:"2024-05-01" },
];

const SAMPLE_ATTENDANCE = (() => {
  const att = {};
  const statuses = ["present","present","present","late","present","present","absent","present","vacation","present","present","present"];
  const arrivals = ["08:47","09:34","08:55","09:20","08:30","08:40","","08:50","","09:00","08:55","08:40"];
  const departures= ["17:30","18:00","17:45","17:30","17:30","17:30","","17:30","","17:30","17:30","17:30"];
  const extras   = ["","","1","","","","","","","","2",""];
  const comments = ["","Doctor appointment","","Traffic on Periferico","","","No notice given","","Approved PTO","","",""];
  const dk = todayKey();
  att[dk] = {};
  SAMPLE_EMPLOYEES.forEach((e,i) => {
    att[dk][e.id] = { status:statuses[i], location:e.location, arrival:arrivals[i], departure:departures[i], extraHours:extras[i], comment:comments[i] };
  });
  return att;
})();

export default function App() {
  const [tab, setTab]               = useState(0);
  // ── Detect client mode from URL ──
  const urlParams = new URLSearchParams(window.location.search);
  const urlClient = urlParams.get("client") || null;
  const isClientMode = !!urlClient;

  const [employees, setEmployees]   = useState([]);
  const [attendance, setAttendance] = useState({});
  const [clients, setClients]       = useState([]);
  const [loaded, setLoaded]         = useState(false);
  const [clientFilter, setClientFilter] = useState(urlClient || "all");
  const [sharePopup, setSharePopup]     = useState(null);
  const [search, setSearch]             = useState("");
  const [sortCol, setSortCol]           = useState(null);
  const [sortDir, setSortDir]           = useState("asc");

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

  // Employee form
  const [showEmpForm, setShowEmpForm] = useState(false);
  const [empForm, setEmpForm]         = useState({ name:"",client:"",role:"",manager:"",location:"office",startDate:"",expectedArrival:"" });
  const [empFormError, setEmpFormError] = useState("");
  const [terminateModal, setTerminateModal] = useState(null);
  const [terminateDate, setTerminateDate]   = useState(todayKey());

  // Client form
  const [newClientName, setNewClientName] = useState("");
  const [clientFormError, setClientFormError] = useState("");
  const [deleteClientModal, setDeleteClientModal] = useState(null);

  // Employee profile modal
  const [profileEmp, setProfileEmp] = useState(null);
  const [profileForm, setProfileForm] = useState(null);

  // Monthly report
  const [reportMonth, setReportMonth] = useState(todayKey().slice(0,7));
  const [reportClient, setReportClient] = useState(urlClient || "all");
  const [viewDate, setViewDate] = useState(todayKey());

  // ── Load from storage ──
  useEffect(() => {
    (async () => {
      const emps    = await dbGet("employees");
      const att     = await dbGet("attendance");
      const cls     = await dbGet("clients");
      setEmployees(emps && emps.length ? emps : SAMPLE_EMPLOYEES);
      setAttendance(att && Object.keys(att).length ? att : SAMPLE_ATTENDANCE);
      setClients(cls && cls.length ? cls : DEFAULT_CLIENTS);
      setLoaded(true);
    })();
  }, []);

  // ── Derived ──
  const activeEmps = employees.filter(e => !e.terminatedDate || e.terminatedDate > viewDate);

  const todayAtt = attendance[viewDate] || {};

  function getAtt(empId) {
    return todayAtt[empId] || { status:"pending", location:"office", arrival:"", departure:"", extraHours:"", comment:"" };
  }

  const visibleEmps = activeEmps
    .filter(e => {
      const matchClient = clientFilter === "all" || e.client === clientFilter;
      const matchSearch = !search || [e.name, e.client, e.role].some(v => v.toLowerCase().includes(search.toLowerCase()));
      return matchClient && matchSearch;
    })
    .sort((a, b) => {
      if (!sortCol) return 0;
      let va, vb;
      if (sortCol === "status") {
        va = getAtt(a.id).status || "pending";
        vb = getAtt(b.id).status || "pending";
      } else {
        va = (a[sortCol] || "").toLowerCase();
        vb = (b[sortCol] || "").toLowerCase();
      }
      return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    });

  // ── Save employees ──
  async function saveEmployees(next) { setEmployees(next); await dbSet("employees", next); }
  async function saveAttendance(next) { setAttendance(next); await dbSet("attendance", next); }
  async function saveClients(next) { setClients(next); await dbSet("clients", next); }

  // ── Add client ──
  async function addClient() {
    const name = newClientName.trim();
    if (!name) { setClientFormError("Client name is required."); return; }
    if (clients.some(c => c.toLowerCase() === name.toLowerCase())) { setClientFormError("Client already exists."); return; }
    await saveClients([...clients, name]);
    setNewClientName("");
    setClientFormError("");
  }

  // ── Employee profile ──
  function openProfile(emp) {
    setProfileEmp(emp);
    setProfileForm({ ...emp });
  }
  async function saveProfile() {
    if (!profileForm.name.trim()) return;
    const next = employees.map(e => e.id === profileForm.id ? { ...profileForm, name: profileForm.name.trim(), role: profileForm.role.trim(), manager: profileForm.manager.trim() } : e);
    await saveEmployees(next);
    setProfileEmp(null);
    setProfileForm(null);
  }
  async function deleteClient(clientName) {
    const hasEmps = employees.some(e => e.client === clientName && !e.terminatedDate);
    setDeleteClientModal({ name: clientName, hasEmps, confirmed: false, input: "" });
  }
  async function confirmDeleteClient() {
    await saveClients(clients.filter(c => c !== deleteClientModal.name));
    setDeleteClientModal(null);
  }

  // ── Add employee ──
  async function addEmployee() {
    if (!empForm.name.trim()) { setEmpFormError("Name is required."); return; }
    if (!empForm.client) { setEmpFormError("Client is required."); return; }
    if (!empForm.role.trim()) { setEmpFormError("Role is required."); return; }
    if (!empForm.startDate) { setEmpFormError("Start date is required."); return; }
    const newEmp = { id: Date.now().toString(), ...empForm, name: empForm.name.trim(), role: empForm.role.trim(), manager: empForm.manager.trim() };
    await saveEmployees([...employees, newEmp]);
    setEmpForm({ name:"",client:"",role:"",manager:"",location:"office",startDate:"",expectedArrival:"" });
    setEmpFormError("");
    setShowEmpForm(false);
  }

  // ── Terminate employee ──
  async function terminateEmployee() {
    const next = employees.map(e => e.id === terminateModal.id ? { ...e, terminatedDate: terminateDate } : e);
    await saveEmployees(next);
    setTerminateModal(null);
  }

  // ── Update attendance field ──
  async function updateAtt(empId, field, value) {
    const next = {
      ...attendance,
      [viewDate]: { ...todayAtt, [empId]: { ...getAtt(empId), [field]: value } }
    };
    await saveAttendance(next);
  }

  // ── Monthly report data ──
  function getMonthlyReport() {
    const [y, m] = reportMonth.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const empList = employees.filter(e => {
      if (reportClient !== "all" && e.client !== reportClient) return false;
      const started = e.startDate <= `${reportMonth}-${String(daysInMonth).padStart(2,"0")}`;
      const active  = !e.terminatedDate || e.terminatedDate >= `${reportMonth}-01`;
      return started && active;
    });

    return empList.map(emp => {
      let present=0, late=0, absent=0, vacation=0, dayoff=0, holidayOff=0, holidayWorked=0;
      let totalHours=0, extraHours=0;
      const isTerminatedThisMonth = emp.terminatedDate && emp.terminatedDate.startsWith(reportMonth);

      // Track specific days per status for tooltips
      const days = { present:[], late:[], absent:[], vacation:[], dayoff:[], holidayOff:[], holidayWorked:[] };
      const shortDay = (dk) => new Date(dk+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"});

      for (let d=1; d<=daysInMonth; d++) {
        const dk = `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
        if (emp.startDate > dk) continue;
        if (emp.terminatedDate && emp.terminatedDate < dk) continue;
        const dayOfWeek = new Date(dk+"T12:00:00").getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        if (isWeekend) continue;
        const att = (attendance[dk] || {})[emp.id];
        if (!att || att.status === "pending") { absent++; days.absent.push(shortDay(dk)); continue; }
        if (att.status==="present")        { present++;       days.present.push(shortDay(dk));     if(att.arrival&&att.departure){ totalHours+=calcHours(att.arrival,att.departure); } }
        if (att.status==="late")           { late++;          days.late.push(`${shortDay(dk)}${att.arrival?` (${att.arrival})`:""}`); if(att.arrival&&att.departure){ totalHours+=calcHours(att.arrival,att.departure); } }
        if (att.status==="absent")         { absent++;        days.absent.push(shortDay(dk)); }
        if (att.status==="vacation")       { vacation++;      days.vacation.push(shortDay(dk)); }
        if (att.status==="dayoff")         { dayoff++;        days.dayoff.push(shortDay(dk)); }
        if (att.status==="holiday_off")    { holidayOff++;    days.holidayOff.push(shortDay(dk)); }
        if (att.status==="holiday_worked") { holidayWorked++; days.holidayWorked.push(shortDay(dk)); if(att.arrival&&att.departure){ totalHours+=calcHours(att.arrival,att.departure); } }
        if (att.extraHours)                extraHours += parseFloat(att.extraHours)||0;
      }

      return { emp, present, late, absent, vacation, dayoff, holidayOff, holidayWorked, days, totalHours: Math.round(totalHours*10)/10, extraHours: Math.round(extraHours*10)/10, isTerminatedThisMonth, terminatedDate: emp.terminatedDate };
    });
  }

  function calcHours(arrival, departure) {
    try {
      const [ah,am] = arrival.split(":").map(Number);
      const [dh,dm] = departure.split(":").map(Number);
      return Math.max(0, (dh*60+dm - ah*60-am) / 60);
    } catch { return 0; }
  }

  // ── Available months from attendance ──

  if (!loaded) return (
    <div style={{ minHeight:"100vh",background:"#0f0f13",display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div style={{ color:"#1B4FBE",fontFamily:"monospace",fontSize:14 }}>Loading system…</div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#F0F2F5", fontFamily:"'DM Sans','Segoe UI',sans-serif", color:"#111" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .tab-btn{border:none;cursor:pointer;font-family:inherit;transition:all .15s}
        .tab-btn:hover{background:#e8f0fd!important}
        .tab-btn.active{background:#1B4FBE!important;color:#fff!important;box-shadow:0 1px 3px rgba(27,79,190,.3)}
        .btn{border:none;cursor:pointer;font-family:inherit;font-weight:600;transition:all .15s;display:inline-flex;align-items:center;gap:6px}
        .btn:hover{filter:brightness(.93)}
        .btn-primary{background:#1B4FBE;color:#fff;border-radius:8px;padding:9px 18px;font-size:13px}
        .btn-ghost{background:transparent;color:#1B4FBE;border:1.5px solid #1B4FBE;border-radius:8px;padding:8px 16px;font-size:13px}
        .btn-danger{background:#fee2e2;color:#b91c1c;border-radius:8px;padding:6px 12px;font-size:12px}
        .btn-orange{background:#F47B20;color:#fff;border-radius:8px;padding:9px 18px;font-size:13px}
        .inp{background:#fff;border:1.5px solid #e5e5ea;border-radius:10px;padding:9px 12px;font-family:inherit;font-size:13px;outline:none;color:#111;width:100%;transition:border .15s}
        .inp:focus{border-color:#1B4FBE;box-shadow:0 0 0 3px rgba(27,79,190,.1)}
        select.inp{cursor:pointer}
        .card{background:#fff;border-radius:12px;border:1px solid #e2e6ea;box-shadow:0 1px 3px rgba(0,0,0,.04)}
        .row:hover{background:#fafafa}
        .pill{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:600}
        @keyframes slidein{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        .slide{animation:slidein .2s ease both}
        @keyframes modal-in{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}
        .overlay{position:fixed;inset:0;background:rgba(0,0,0,.3);backdrop-filter:blur(3px);z-index:50;display:flex;align-items:center;justify-content:center}
        .modal{background:#fff;border-radius:20px;box-shadow:0 24px 64px rgba(0,0,0,.15);width:480px;max-width:95vw;animation:modal-in .2s ease;overflow:hidden}
        .form-row{display:flex;flex-direction:column;gap:5px;margin-bottom:14px}
        .form-label{font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.06em}
        ::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-thumb{background:#ddd;border-radius:3px}
        .share-popup{position:absolute;top:calc(100% + 8px);right:0;background:#fff;border:1px solid #ebebef;border-radius:12px;padding:14px 16px;box-shadow:0 8px 24px rgba(0,0,0,.12);z-index:30;width:340px}
        .status-select{border:1.5px solid #e5e5ea;border-radius:8px;padding:4px 8px;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;outline:none;background:#fff}
        .time-inp{border:1.5px solid #e5e5ea;border-radius:8px;padding:4px 8px;font-family:'DM Mono',monospace;font-size:12px;width:120px;outline:none;background:#fff;text-align:center}
        .time-inp:focus{border-color:#1B4FBE}
        .time-inp::-webkit-calendar-picker-indicator{opacity:0;width:0;padding:0;margin:0}
        .extra-inp{border:1.5px solid #e5e5ea;border-radius:8px;padding:4px 8px;font-size:12px;width:60px;outline:none;background:#fff;text-align:center}
        .loc-btn{border:1.5px solid #e5e5ea;border-radius:8px;padding:4px 10px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s;background:#fff}
        .loc-btn.active{border-color:#1B4FBE;background:#e8f0fd;color:#1B4FBE}
        .tip-wrap{position:relative;display:inline-block}
        .tip-box{display:none;position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);background:#1e1e2e;color:#fff;border-radius:10px;padding:10px 12px;font-size:11px;white-space:nowrap;z-index:99;box-shadow:0 8px 24px rgba(0,0,0,.2);pointer-events:none;min-width:120px;max-width:220px;white-space:normal;text-align:left}
        .tip-box::after{content:'';position:absolute;top:100%;left:50%;transform:translateX(-50%);border:5px solid transparent;border-top-color:#1e1e2e}
        .tip-wrap:hover .tip-box{display:block}
      `}</style>

      {/* ── Header ── */}
      <div style={{ background:"#fff",borderBottom:"1px solid #ebebef",padding:"0 32px",display:"flex",alignItems:"center",justifyContent:"space-between",height:60,position:"sticky",top:0,zIndex:20 }}>
        <div style={{ display:"flex",alignItems:"center",gap:12 }}>
          <div style={{ width:34,height:34,borderRadius:8,background:"#1B4FBE",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
            <span style={{ color:"#fff",fontSize:16,fontWeight:900,letterSpacing:"-1px" }}>W</span>
          </div>
          <div>
            <div style={{ fontSize:13,fontWeight:700,color:"#111",letterSpacing:"-0.02em" }}>wexpand</div>
            <div style={{ fontSize:10,color:"#94a3b8",marginTop:-1 }}>Attendance Portal</div>
          </div>
        </div>
        {isClientMode && (
          <div style={{ background:"#e8f0fd",border:"1px solid #b3c8f5",borderRadius:10,padding:"5px 14px",display:"flex",alignItems:"center",gap:8 }}>
            <span>🏢</span>
            <span style={{ fontSize:13,fontWeight:700,color:"#1B4FBE" }}>{urlClient}</span>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display:"flex",gap:2,background:"#e8f0fd",borderRadius:8,padding:3 }}>
          {TABS.filter((_,i) => !isClientMode || i !== 1).map((t,i) => {
            const realIdx = isClientMode && i === 1 ? 2 : i;
            return (
              <button key={t} className={`tab-btn${tab===(isClientMode&&i===1?2:i)?" active":""}`}
                onClick={() => setTab(isClientMode && t==="Monthly Report" ? 2 : TABS.indexOf(t))}
                style={{ padding:"6px 16px",borderRadius:9,fontSize:13,fontWeight:600,color:tab===TABS.indexOf(t)?"#1B4FBE":"#6b7280",background:"transparent" }}>
                {t}
              </button>
            );
          })}
        </div>

        <div style={{ fontFamily:"'DM Mono',monospace",fontSize:13,color:"#F47B20",fontWeight:500,textAlign:"right" }}>
          {new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",timeZone:"America/Mexico_City"})}
          <div style={{ fontSize:9,color:"#94a3b8",fontWeight:400 }}>MX TIME</div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════
          TAB 0 — DAILY ATTENDANCE
      ════════════════════════════════════════════════ */}
      {tab === 0 && (
        <div style={{ padding:"24px 32px" }}>

          {/* Controls row */}
          <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap" }}>
            <div>
              <div style={{ fontSize:22,fontWeight:800,color:"#1B4FBE",letterSpacing:"-0.03em" }}>Daily Attendance</div>
              <div style={{ fontSize:12,color:"#94a3b8",marginTop:1 }}>{new Date(viewDate+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</div>
            </div>
            <div style={{ marginLeft:"auto",display:"flex",gap:10,alignItems:"center",flexWrap:"wrap" }}>
              {/* Date picker */}
              <input type="date" value={viewDate} onChange={e=>setViewDate(e.target.value)}
                className="inp" style={{ width:"auto",fontSize:13 }}/>
              {/* Client filter — hidden in client mode */}
              {!isClientMode && (
                <select className="inp" style={{ width:"auto" }} value={clientFilter} onChange={e=>{setClientFilter(e.target.value);setSharePopup(null);}}>
                  <option value="all">🌐 All Clients</option>
                  {clients.map(c => <option key={c} value={c}>🏢 {c}</option>)}
                </select>
              )}
              {/* Share link — only when a client is selected and in admin mode */}
              {!isClientMode && clientFilter !== "all" && (
                <div style={{ position:"relative" }}>
                  <button className="btn btn-ghost" onClick={() => setSharePopup(sharePopup?null:clientFilter)}>
                    🔗 Share link
                  </button>
                  {sharePopup && (
                    <div className="share-popup">
                      <div style={{ fontSize:12,fontWeight:700,color:"#111",marginBottom:8 }}>Client link for <strong>{clientFilter}</strong></div>
                      <div style={{ background:"#F0F2F5",borderRadius:8,padding:"8px 10px",fontFamily:"'DM Mono',monospace",fontSize:11,color:"#1B4FBE",wordBreak:"break-all",marginBottom:10 }}>
                        {window.location.origin}?client={encodeURIComponent(clientFilter)}
                      </div>
                      <button className="btn btn-primary" style={{ width:"100%",justifyContent:"center",fontSize:12 }}
                        onClick={() => { navigator.clipboard.writeText(`${window.location.origin}?client=${encodeURIComponent(clientFilter)}`); setSharePopup(null); }}>
                        Copy link
                      </button>
                      <div style={{ fontSize:10,color:"#94a3b8",marginTop:8,textAlign:"center" }}>The client will only see their employees</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Summary pills */}
          <div style={{ display:"flex",gap:8,marginBottom:20,flexWrap:"wrap" }}>
            {STATUS_OPTIONS.filter(s=>s.value!=="pending").map(s => {
              const count = visibleEmps.filter(e => getAtt(e.id).status === s.value).length;
              return (
                <div key={s.value} className="pill" style={{ background:s.bg,color:s.color,fontSize:12,padding:"5px 12px" }}>
                  <span style={{ width:7,height:7,borderRadius:"50%",background:s.color,display:"inline-block" }}/>
                  {s.label}: <strong>{count}</strong>
                </div>
              );
            })}
            <div className="pill" style={{ background:"#fee2e2",color:"#dc2626",fontSize:12,padding:"5px 12px" }}>
              <span style={{ width:7,height:7,borderRadius:"50%",background:"#dc2626",display:"inline-block" }}/>
              Pending today: <strong>{visibleEmps.filter(e => (getAtt(e.id).status||"pending")==="pending").length}</strong>
            </div>
          </div>

          {/* Search + sort bar */}
          <div style={{ display:"flex",gap:10,marginBottom:16,alignItems:"center",flexWrap:"wrap" }}>
            <div style={{ position:"relative",flex:1,maxWidth:300 }}>
              <span style={{ position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",color:"#94a3b8",fontSize:14 }}>🔍</span>
              <input className="inp" placeholder="Search by name, client or role…"
                value={search} onChange={e=>setSearch(e.target.value)}
                style={{ paddingLeft:34,fontSize:13 }}/>
            </div>
            {search && (
              <button onClick={()=>setSearch("")}
                style={{ border:"1.5px solid #e5e5ea",background:"#fff",borderRadius:9,padding:"8px 12px",fontSize:12,cursor:"pointer",color:"#64748b",fontFamily:"inherit" }}>
                ✕ Clear
              </button>
            )}
            <div style={{ fontSize:12,color:"#94a3b8",marginLeft:"auto" }}>
              {visibleEmps.length} employee{visibleEmps.length!==1?"s":""} shown
              {sortCol && <span style={{ marginLeft:8,color:"#1B4FBE",fontWeight:600 }}>· sorted by {sortCol} {sortDir==="asc"?"↑":"↓"}</span>}
            </div>
          </div>

          {visibleEmps.length === 0 ? (
            <div className="card" style={{ padding:"48px",textAlign:"center",color:"#94a3b8" }}>
              <div style={{ fontSize:32,marginBottom:12 }}>{search ? "🔍" : "👥"}</div>
              <div style={{ fontWeight:600 }}>{search ? `No results for "${search}"` : `No active employees${clientFilter!=="all"?` for ${clientFilter}`:""}`}</div>
              <div style={{ fontSize:13,marginTop:4 }}>{search ? "Try a different search term" : "Go to Employee Registry to add employees"}</div>
            </div>
          ) : (
            <div className="card" style={{ overflow:"hidden" }}>
              <table style={{ width:"100%",borderCollapse:"collapse",fontSize:13 }}>
                <thead>
                  <tr style={{ background:"#f5f6f8",borderBottom:"1px solid #ebebef" }}>
                    {[
                      { label:"Employee",          col:"name",   align:"left"   },
                      { label:"Client",            col:"client", align:"left"   },
                      { label:"Status",            col:"status", align:"left"   },
                      { label:"Location",          col:null,     align:"center" },
                      { label:"Expected",          col:null,     align:"center" },
                      { label:"Arrival",           col:null,     align:"center" },
                      { label:"Departure",         col:null,     align:"center" },
                      { label:"Extra Hrs",         col:null,     align:"center" },
                      { label:"Comment",           col:null,     align:"left"   },
                    ].map(({ label, col, align }) => (
                      <th key={label}
                        onClick={() => col && handleSort(col)}
                        style={{ padding:"11px 14px",textAlign:align,fontSize:10,fontWeight:700,
                          color: col && sortCol===col ? "#1B4FBE" : "#6b7280",
                          textTransform:"uppercase",letterSpacing:".07em",whiteSpace:"nowrap",
                          cursor: col ? "pointer" : "default",userSelect:"none" }}>
                        {label}
                        {col && (
                          <span style={{ marginLeft:4,opacity:sortCol===col?1:.25 }}>
                            {sortCol===col ? (sortDir==="asc"?"↑":"↓") : "↕"}
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleEmps.map((emp,i) => {
                    const att = getAtt(emp.id);
                    const cfg = statusCfg(att.status);
                    return (
                      <tr key={emp.id} className="row slide" style={{ borderBottom:i<visibleEmps.length-1?"1px solid #f3f3f7":"none",animationDelay:`${i*.02}s` }}>
                        {/* Employee */}
                        <td style={{ padding:"10px 14px" }}>
                          <div style={{ display:"flex",alignItems:"center",gap:9 }}>
                            <div style={{ width:32,height:32,borderRadius:8,background:cfg.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:cfg.color,flexShrink:0 }}>
                              {initials(emp.name)}
                            </div>
                            <div>
                              <div style={{ fontWeight:600,color:"#111" }}>{emp.name}</div>
                              <div style={{ fontSize:11,color:"#94a3b8" }}>{emp.role}</div>
                            </div>
                          </div>
                        </td>
                        {/* Client */}
                        <td style={{ padding:"10px 14px" }}>
                          <span style={{ fontSize:11,fontWeight:600,color:"#1B4FBE",background:"#e8f0fd",padding:"2px 8px",borderRadius:6 }}>{emp.client}</span>
                        </td>
                        {/* Status */}
                        <td style={{ padding:"10px 14px" }}>
                          <select className="status-select" value={att.status||"pending"}
                            style={{ color:cfg.color,background:cfg.bg,borderColor:cfg.color+"40" }}
                            onChange={e => updateAtt(emp.id,"status",e.target.value)}>
                            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </td>
                        {/* Location — read only, edit from Employee Registry */}
                        <td style={{ padding:"10px 14px",textAlign:"center" }}>
                          <span style={{ fontSize:12,fontWeight:600,
                            color: att.location==="home"?"#0284c7":"#059669",
                            background: att.location==="home"?"#e0f2fe":"#dcfce7",
                            padding:"3px 9px",borderRadius:6,display:"inline-flex",alignItems:"center",gap:4 }}>
                            {att.location==="home"?"🏠 Home":"🏢 Office"}
                          </span>
                        </td>
                        {/* Expected Arrival */}
                        <td style={{ padding:"10px 14px",textAlign:"center" }}>
                          {emp.expectedArrival
                            ? <span style={{ fontFamily:"'DM Mono',monospace",fontSize:12,color:"#1B4FBE",fontWeight:600 }}>{emp.expectedArrival}</span>
                            : <span style={{ color:"#e2e8f0",fontSize:12 }}>—</span>}
                        </td>
                        {/* Arrival */}
                        <td style={{ padding:"10px 14px",textAlign:"center" }}>
                          <div style={{ display:"flex",flexDirection:"column",gap:3,alignItems:"center" }}>
                            <input type="text" className="time-inp" value={att.arrival||""}
                              placeholder="08:00"
                              onChange={e => updateAtt(emp.id,"arrival",e.target.value)}/>
                            {emp.expectedArrival && att.arrival && (() => {
                              const toMins = t => { const [h,m]=(t||"").split(":").map(Number); return h*60+(m||0); };
                              const diff = toMins(att.arrival) - toMins(emp.expectedArrival);
                              if (diff <= 0) return <span style={{ fontSize:10,color:"#16a34a",fontWeight:600 }}>✓ On time</span>;
                              return <span style={{ fontSize:10,color:"#d97706",fontWeight:600 }}>+{diff}min late</span>;
                            })()}
                          </div>
                        </td>
                        {/* Departure */}
                        <td style={{ padding:"10px 14px",textAlign:"center" }}>
                          <input type="text" className="time-inp" value={att.departure||""}
                            placeholder="17:30"
                            onChange={e => updateAtt(emp.id,"departure",e.target.value)}/>
                        </td>
                        {/* Extra hours */}
                        <td style={{ padding:"10px 14px",textAlign:"center" }}>
                          <input type="number" min="0" step="0.5" className="extra-inp" value={att.extraHours||""}
                            placeholder="0"
                            onChange={e => updateAtt(emp.id,"extraHours",e.target.value)}/>
                        </td>
                        {/* Comment */}
                        <td style={{ padding:"10px 14px" }}>
                          <input className="inp" style={{ minWidth:160,fontSize:12,padding:"5px 9px" }}
                            placeholder="Add note…" value={att.comment||""}
                            onChange={e => updateAtt(emp.id,"comment",e.target.value)}/>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════
          TAB 1 — EMPLOYEE REGISTRY
      ════════════════════════════════════════════════ */}
      {tab === 1 && (
        <div style={{ padding:"24px 32px" }}>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:10 }}>
            <div>
              <div style={{ fontSize:22,fontWeight:800,color:"#1B4FBE",letterSpacing:"-0.03em" }}>Employee Registry</div>
              <div style={{ fontSize:12,color:"#94a3b8",marginTop:1 }}>{employees.filter(e=>!e.terminatedDate).length} active · {employees.filter(e=>e.terminatedDate).length} terminated</div>
            </div>
            <div style={{ display:"flex",gap:8,alignItems:"center" }}>
              {/* Import from Excel */}
              <label style={{ display:"inline-flex",alignItems:"center",gap:6,background:"#f0fdf4",color:"#16a34a",border:"1.5px solid #bbf7d0",borderRadius:10,padding:"8px 16px",fontSize:13,fontWeight:600,cursor:"pointer" }}>
                📥 Import Excel
                <input type="file" accept=".xlsx,.xls,.csv" style={{ display:"none" }}
                  onChange={async e => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const XLSX = await import("xlsx");
                    const rd = new FileReader();
                    rd.onload = async ev => {
                      try {
                        const wb = XLSX.read(ev.target.result, { type:"array" });
                        const ws = wb.Sheets[wb.SheetNames[0]];
                        const rows = XLSX.utils.sheet_to_json(ws, { defval:"" });
                        if (!rows.length) { alert("The file appears to be empty."); return; }
                        const h = Object.keys(rows[0]);
                        const find = (aliases) => h.find(k => aliases.includes(k.toLowerCase().trim()));
                        const cN = find(["name","nombre","full name","employee name"]);
                        const cC = find(["client","cliente","company","empresa"]);
                        const cR = find(["role","position","posición","puesto","job title"]);
                        const cM = find(["manager","supervisor","jefe"]);
                        const cL = find(["location","ubicación","work location"]);
                        const cS = find(["start date","startdate","fecha ingreso","fecha de ingreso","start"]);
                        const cE = find(["expected arrival","expected","horario","arrival time","hora entrada"]);
                        if (!cN) { alert(`Could not find a Name column. Found: ${h.join(", ")}`); return; }
                        const newEmps = rows
                          .filter(r => r[cN]?.toString().trim())
                          .map((r, i) => ({
                            id: Date.now().toString() + i,
                            name: r[cN]?.toString().trim() || "Unknown",
                            client: cC ? (r[cC]?.toString().trim() || "") : "",
                            role: cR ? (r[cR]?.toString().trim() || "") : "",
                            manager: cM ? (r[cM]?.toString().trim() || "") : "",
                            location: cL ? (r[cL]?.toString().toLowerCase().includes("home") ? "home" : "office") : "office",
                            startDate: cS ? (r[cS]?.toString().trim() || "") : "",
                            expectedArrival: cE ? (r[cE]?.toString().trim() || "") : "",
                          }));
                        const merged = [...employees, ...newEmps];
                        await saveEmployees(merged);
                        alert(`✅ ${newEmps.length} employees imported successfully!`);
                      } catch(err) { alert("Error reading file: " + err.message); }
                    };
                    rd.readAsArrayBuffer(file);
                    e.target.value = "";
                  }}/>
              </label>
              {/* Download template */}
              <button className="btn btn-ghost" style={{ fontSize:13 }}
                onClick={() => {
                  const csv = [
                    "Name,Client,Role,Manager,Location,Start Date,Expected Arrival",
                    "Diego Alfredo Berumen Ponce,MasTec,Project Coordinator,Roberto Ibarra,Office,2024-01-15,09:00",
                    "Liliana Mendez Andrade,MasTec,Project Coordinator,Roberto Ibarra,Home,2024-01-15,09:00",
                  ].join("\n");
                  const blob = new Blob([csv], { type:"text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url; a.download = "employee-template.csv"; a.click();
                  URL.revokeObjectURL(url);
                }}>
                📄 Download Template
              </button>
              <button className="btn btn-primary" onClick={() => setShowEmpForm(true)}>＋ Add Employee</button>
            </div>
          </div>

          {/* ── Client Management ── */}
          <div style={{ marginBottom:28 }}>
            <div style={{ fontSize:11,fontWeight:700,color:"#6b7280",textTransform:"uppercase",letterSpacing:".07em",marginBottom:10 }}>Clients</div>
            <div className="card" style={{ padding:"18px 20px" }}>
              <div style={{ display:"flex",flexWrap:"wrap",gap:8,marginBottom:14 }}>
                {clients.map(c => (
                  <div key={c} style={{ display:"flex",alignItems:"center",gap:6,background:"#e8f0fd",border:"1.5px solid #b3c8f5",borderRadius:10,padding:"6px 12px" }}>
                    <span style={{ fontSize:14 }}>🏢</span>
                    <span style={{ fontSize:13,fontWeight:600,color:"#1B4FBE" }}>{c}</span>
                    <button onClick={() => deleteClient(c)}
                      style={{ border:"none",background:"none",cursor:"pointer",color:"#a5b4fc",fontSize:14,lineHeight:1,padding:"0 0 0 4px",fontWeight:700 }}
                      title="Remove client">×</button>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                <input className="inp" style={{ maxWidth:240 }} placeholder="New client name…"
                  value={newClientName} onChange={e=>{setNewClientName(e.target.value);setClientFormError("");}}
                  onKeyDown={e=>e.key==="Enter"&&addClient()}/>
                <button className="btn btn-primary" style={{ whiteSpace:"nowrap" }} onClick={addClient}>＋ Add Client</button>
              </div>
              {clientFormError && <div style={{ color:"#b91c1c",fontSize:12,marginTop:8 }}>⚠ {clientFormError}</div>}
            </div>
          </div>

          {/* Active employees */}
          <div style={{ marginBottom:8,fontSize:11,fontWeight:700,color:"#6b7280",textTransform:"uppercase",letterSpacing:".07em" }}>Active Employees</div>
          <div className="card" style={{ overflow:"hidden",marginBottom:24 }}>
            {employees.filter(e=>!e.terminatedDate).length === 0 ? (
              <div style={{ padding:"40px",textAlign:"center",color:"#94a3b8" }}>
                <div style={{ fontSize:28,marginBottom:8 }}>👥</div>
                No active employees yet — add your first one!
              </div>
            ) : (
              <table style={{ width:"100%",borderCollapse:"collapse",fontSize:13 }}>
                <thead>
                  <tr style={{ background:"#f5f6f8",borderBottom:"1px solid #ebebef" }}>
                    {["Name","Client","Role","Manager","Location","Start Date",""].map(h => (
                      <th key={h} style={{ padding:"11px 14px",textAlign:"left",fontSize:10,fontWeight:700,color:"#6b7280",textTransform:"uppercase",letterSpacing:".07em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.filter(e=>!e.terminatedDate).map((emp,i,arr) => (
                    <tr key={emp.id} className="row" style={{ borderBottom:i<arr.length-1?"1px solid #f3f3f7":"none" }}>
                      <td style={{ padding:"11px 14px" }}>
                        <div style={{ display:"flex",alignItems:"center",gap:9,cursor:"pointer" }} onClick={()=>openProfile(emp)}>
                          <div style={{ width:30,height:30,borderRadius:8,background:"#e8f0fd",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#1B4FBE" }}>
                            {initials(emp.name)}
                          </div>
                          <span style={{ fontWeight:600,color:"#1B4FBE",textDecoration:"underline",textDecorationStyle:"dotted",textUnderlineOffset:2 }}>{emp.name}</span>
                        </div>
                      </td>
                      <td style={{ padding:"11px 14px" }}>
                        <span style={{ fontSize:11,fontWeight:600,color:"#1B4FBE",background:"#e8f0fd",padding:"2px 8px",borderRadius:6 }}>{emp.client}</span>
                      </td>
                      <td style={{ padding:"11px 14px",color:"#475569" }}>{emp.role}</td>
                      <td style={{ padding:"11px 14px",color:"#475569" }}>{emp.manager||"—"}</td>
                      <td style={{ padding:"11px 14px" }}>
                        <span style={{ fontSize:12,fontWeight:600,
                          color:emp.location==="home"?"#0284c7":"#059669",
                          background:emp.location==="home"?"#e0f2fe":"#dcfce7",
                          padding:"3px 9px",borderRadius:6,display:"inline-flex",alignItems:"center",gap:4 }}>
                          {emp.location==="home"?"🏠 Home Office":"🏢 Office"}
                        </span>
                      </td>
                      <td style={{ padding:"11px 14px",color:"#475569",fontFamily:"'DM Mono',monospace",fontSize:12 }}>{fmtDate(emp.startDate)}</td>
                      <td style={{ padding:"11px 14px",display:"flex",gap:6,alignItems:"center" }}>
                        <button className="btn btn-ghost" style={{ padding:"5px 12px",fontSize:12 }} onClick={()=>openProfile(emp)}>
                          ✎ Edit
                        </button>
                        <button className="btn btn-danger" onClick={() => { setTerminateModal(emp); setTerminateDate(todayKey()); }}>
                          Terminate
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Terminated employees */}
          {employees.filter(e=>e.terminatedDate).length > 0 && (
            <>
              <div style={{ marginBottom:8,fontSize:11,fontWeight:700,color:"#6b7280",textTransform:"uppercase",letterSpacing:".07em" }}>Terminated</div>
              <div className="card" style={{ overflow:"hidden" }}>
                <table style={{ width:"100%",borderCollapse:"collapse",fontSize:13 }}>
                  <thead>
                    <tr style={{ background:"#f5f6f8",borderBottom:"1px solid #ebebef" }}>
                      {["Name","Client","Role","Start Date","Termination Date"].map(h => (
                        <th key={h} style={{ padding:"11px 14px",textAlign:"left",fontSize:10,fontWeight:700,color:"#6b7280",textTransform:"uppercase",letterSpacing:".07em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {employees.filter(e=>e.terminatedDate).map((emp,i,arr) => (
                      <tr key={emp.id} className="row" style={{ borderBottom:i<arr.length-1?"1px solid #f3f3f7":"none",opacity:.6 }}>
                        <td style={{ padding:"11px 14px",fontWeight:600 }}>{emp.name}</td>
                        <td style={{ padding:"11px 14px" }}>{emp.client}</td>
                        <td style={{ padding:"11px 14px",color:"#475569" }}>{emp.role}</td>
                        <td style={{ padding:"11px 14px",fontFamily:"'DM Mono',monospace",fontSize:12 }}>{fmtDate(emp.startDate)}</td>
                        <td style={{ padding:"11px 14px",fontFamily:"'DM Mono',monospace",fontSize:12,color:"#b91c1c" }}>{fmtDate(emp.terminatedDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════
          TAB 2 — MONTHLY REPORT
      ════════════════════════════════════════════════ */}
      {tab === 2 && (
        <div style={{ padding:"24px 32px" }}>
          <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap" }}>
            <div>
              <div style={{ fontSize:22,fontWeight:800,color:"#1B4FBE",letterSpacing:"-0.03em" }}>Monthly Report</div>
              <div style={{ fontSize:12,color:"#94a3b8",marginTop:1 }}>{monthLabel(reportMonth)}</div>
            </div>
            <div style={{ marginLeft:"auto",display:"flex",gap:10,alignItems:"center" }}>
              <input type="month" value={reportMonth} onChange={e=>setReportMonth(e.target.value)}
                className="inp" style={{ width:"auto" }}/>
              {!isClientMode && (
                <select className="inp" style={{ width:"auto" }} value={reportClient} onChange={e=>setReportClient(e.target.value)}>
                  <option value="all">All Clients</option>
                  {clients.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
              <button className="btn btn-primary" onClick={() => {
                const rows = getMonthlyReport();
                if (!rows.length) return;

                // Build CSV
                const headers = ["Employee","Client","Role","Manager","Attendances","Late","Absences","Vacation","Day Off","Holiday Off","Holiday Worked","Total Hours","Extra Hours"];
                const csvRows = [
                  headers.join(","),
                  ...rows.map(({ emp,present,late,absent,vacation,dayoff,holidayOff,holidayWorked,totalHours,extraHours }) =>
                    [
                      `"${emp.name}"`,
                      `"${emp.client}"`,
                      `"${emp.role}"`,
                      `"${emp.manager||""}"`,
                      present, late, absent, vacation, dayoff, holidayOff, holidayWorked,
                      `${totalHours}h`, extraHours>0?`+${extraHours}h`:"0h"
                    ].join(",")
                  ),
                  [
                    `"TOTALS"`, `"${reportClient==="all"?"All Clients":reportClient}"`, `""`, `""`,
                    rows.reduce((a,r)=>a+r.present,0),
                    rows.reduce((a,r)=>a+r.late,0),
                    rows.reduce((a,r)=>a+r.absent,0),
                    rows.reduce((a,r)=>a+r.vacation,0),
                    rows.reduce((a,r)=>a+r.dayoff,0),
                    rows.reduce((a,r)=>a+r.holidayOff,0),
                    rows.reduce((a,r)=>a+r.holidayWorked,0),
                    `${rows.reduce((a,r)=>a+r.totalHours,0)}h`,
                    `+${rows.reduce((a,r)=>a+r.extraHours,0)}h`,
                  ].join(",")
                ];

                const blob = new Blob([csvRows.join("\n")], { type:"text/csv;charset=utf-8;" });
                const url  = URL.createObjectURL(blob);
                const a    = document.createElement("a");
                a.href     = url;
                a.download = `attendance-report-${reportMonth}${reportClient!=="all"?`-${reportClient}`:""}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}>
                ⬇ Download Excel
              </button>
            </div>
          </div>

          {(() => {
            const rows = getMonthlyReport();
            if (rows.length === 0) return (
              <div className="card" style={{ padding:"48px",textAlign:"center",color:"#94a3b8" }}>
                <div style={{ fontSize:32,marginBottom:12 }}>📊</div>
                <div style={{ fontWeight:600 }}>No data for {monthLabel(reportMonth)}</div>
                <div style={{ fontSize:13,marginTop:4 }}>Start capturing daily attendance to see the monthly report</div>
              </div>
            );
            return (
              <div className="card" style={{ overflow:"auto" }}>
                <table style={{ width:"100%",borderCollapse:"collapse",fontSize:12 }}>
                  <thead>
                    <tr style={{ background:"#f5f6f8",borderBottom:"1px solid #ebebef" }}>
                      {["Employee","Client","Attendances","Late","Absences","Vacation","Day Off","Holiday Off","Holiday Worked","Total Hrs","Extra Hrs"].map((h,i) => (
                        <th key={h} style={{ padding:"11px 14px",textAlign:i<2?"left":"center",fontSize:10,fontWeight:700,color:"#6b7280",textTransform:"uppercase",letterSpacing:".06em",whiteSpace:"nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ emp,present,late,absent,vacation,dayoff,holidayOff,holidayWorked,days,totalHours,extraHours,isTerminatedThisMonth,terminatedDate },i) => (
                      <tr key={emp.id} className="row" style={{ borderBottom:i<rows.length-1?"1px solid #f3f3f7":"none", opacity:isTerminatedThisMonth?0.85:1 }}>
                        <td style={{ padding:"11px 14px" }}>
                          <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                            <div style={{ width:28,height:28,borderRadius:7,background:isTerminatedThisMonth?"#fee2e2":"#e8f0fd",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:isTerminatedThisMonth?"#b91c1c":"#1B4FBE",flexShrink:0 }}>
                              {initials(emp.name)}
                            </div>
                            <div>
                              <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                                <span style={{ fontWeight:600,color:"#111" }}>{emp.name}</span>
                                {isTerminatedThisMonth && (
                                  <span style={{ fontSize:10,fontWeight:600,color:"#b91c1c",background:"#fee2e2",padding:"1px 6px",borderRadius:99,whiteSpace:"nowrap" }}>
                                    Left {fmtDate(terminatedDate)}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize:10,color:"#94a3b8" }}>{emp.role}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding:"11px 14px" }}>
                          <span style={{ fontSize:11,fontWeight:600,color:"#1B4FBE",background:"#e8f0fd",padding:"2px 8px",borderRadius:6 }}>{emp.client}</span>
                        </td>
                        {[
                          { count:present,     dayList:days.present,     color:"#16a34a" },
                          { count:late,         dayList:days.late,         color:"#d97706" },
                          { count:absent,       dayList:days.absent,       color:"#7c3aed" },
                          { count:vacation,     dayList:days.vacation,     color:"#0284c7" },
                          { count:dayoff,       dayList:days.dayoff,       color:"#64748b" },
                          { count:holidayOff,   dayList:days.holidayOff,   color:"#db2777" },
                          { count:holidayWorked,dayList:days.holidayWorked,color:"#9d174d" },
                        ].map(({ count, dayList, color }, ci) => (
                          <td key={ci} style={{ padding:"11px 14px",textAlign:"center" }}>
                            <div className="tip-wrap">
                              <span style={{ fontWeight:700,color,fontSize:15,cursor:count>0?"help":"default" }}>{count}</span>
                              {count > 0 && (
                                <div className="tip-box">
                                  <div style={{ fontWeight:700,marginBottom:5,color:color,fontSize:10,textTransform:"uppercase",letterSpacing:".06em" }}>
                                    {["Attendances","Late","Absences","Vacation","Day Off","Holiday Off","Holiday Worked"][ci]} · {count} day{count!==1?"s":""}
                                  </div>
                                  {dayList.map((d,di) => (
                                    <div key={di} style={{ padding:"2px 0",borderBottom:di<dayList.length-1?"1px solid rgba(255,255,255,.1)":"none",fontSize:11 }}>
                                      {d}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        ))}
                        <td style={{ padding:"11px 14px",textAlign:"center",fontFamily:"'DM Mono',monospace",color:"#111",fontWeight:600 }}>{totalHours}h</td>
                        <td style={{ padding:"11px 14px",textAlign:"center",fontFamily:"'DM Mono',monospace",color:extraHours>0?"#d97706":"#94a3b8",fontWeight:600 }}>{extraHours>0?`+${extraHours}h`:"—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}

      {/* ════════════════════════════════════════════════
          TAB 3 — CLIENT LINKS
      ════════════════════════════════════════════════ */}
      {tab === 3 && (
        <div style={{ padding:"24px 32px" }}>
          <div style={{ marginBottom:24 }}>
            <div style={{ fontSize:22,fontWeight:800,color:"#1B4FBE",letterSpacing:"-0.03em" }}>Client Links</div>
            <div style={{ fontSize:12,color:"#94a3b8",marginTop:2 }}>Share these links with your clients — they'll only see their own employees</div>
          </div>

          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:16 }}>
            {clients.map(c => {
              const link = `${window.location.origin}?client=${encodeURIComponent(c)}`;
              const empCount = employees.filter(e => e.client === c && !e.terminatedDate).length;
              return (
                <div key={c} className="card" style={{ padding:"20px 24px" }}>
                  {/* Client header */}
                  <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:16 }}>
                    <div style={{ width:42,height:42,borderRadius:12,background:"#e8f0fd",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20 }}>🏢</div>
                    <div>
                      <div style={{ fontWeight:800,fontSize:16,color:"#111" }}>{c}</div>
                      <div style={{ fontSize:12,color:"#94a3b8",marginTop:1 }}>{empCount} active employee{empCount!==1?"s":""}</div>
                    </div>
                  </div>

                  {/* What the client sees */}
                  <div style={{ background:"#F0F2F5",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#475569" }}>
                    <div style={{ fontWeight:600,color:"#111",marginBottom:4 }}>Client will see:</div>
                    <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                      {["✅ Daily Attendance","📊 Monthly Report","🔒 Read-only"].map(t => (
                        <span key={t} style={{ background:"#fff",border:"1px solid #ebebef",borderRadius:6,padding:"2px 8px",fontSize:11 }}>{t}</span>
                      ))}
                    </div>
                  </div>

                  {/* Link */}
                  <div style={{ background:"#f5f6f8",border:"1.5px solid #ebebef",borderRadius:10,padding:"10px 14px",marginBottom:12,fontFamily:"'DM Mono',monospace",fontSize:11,color:"#1B4FBE",wordBreak:"break-all" }}>
                    {link}
                  </div>

                  {/* Buttons */}
                  <div style={{ display:"flex",gap:8 }}>
                    <button className="btn btn-primary" style={{ flex:1,justifyContent:"center",fontSize:13 }}
                      onClick={() => {
                        navigator.clipboard.writeText(link);
                        // Show copied feedback
                        const btn = document.getElementById(`copy-${c}`);
                        if (btn) { btn.textContent = "✓ Copied!"; setTimeout(() => { btn.textContent = "📋 Copy link"; }, 2000); }
                      }}
                      id={`copy-${c}`}>
                      📋 Copy link
                    </button>
                    <a href={link} target="_blank" rel="noreferrer"
                      style={{ display:"inline-flex",alignItems:"center",gap:6,background:"#f3f3f7",color:"#111",border:"1.5px solid #ebebef",borderRadius:10,padding:"9px 14px",fontSize:13,fontWeight:600,textDecoration:"none" }}>
                      👁 Preview
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ════ MODAL — Add Employee ════ */}
      {showEmpForm && (
        <div className="overlay" onClick={() => setShowEmpForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ padding:"20px 24px 16px",borderBottom:"1px solid #f3f3f7",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <div style={{ fontWeight:800,fontSize:16,color:"#111" }}>Add New Employee</div>
              <button onClick={() => setShowEmpForm(false)} style={{ border:"none",background:"none",cursor:"pointer",fontSize:18,color:"#94a3b8",padding:4 }}>✕</button>
            </div>
            <div style={{ padding:"20px 24px" }}>
              {empFormError && <div style={{ background:"#fee2e2",color:"#b91c1c",borderRadius:8,padding:"8px 12px",fontSize:13,marginBottom:14 }}>⚠ {empFormError}</div>}
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px" }}>
                <div className="form-row" style={{ gridColumn:"1/-1" }}>
                  <label className="form-label">Full Name *</label>
                  <input className="inp" placeholder="e.g. Diego Berumen Ponce" value={empForm.name} onChange={e=>setEmpForm({...empForm,name:e.target.value})}/>
                </div>
                <div className="form-row">
                  <label className="form-label">Client *</label>
                  <select className="inp" value={empForm.client} onChange={e=>setEmpForm({...empForm,client:e.target.value})}>
                    <option value="">Select client…</option>
                    {clients.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <label className="form-label">Position / Role *</label>
                  <input className="inp" placeholder="e.g. Project Coordinator" value={empForm.role} onChange={e=>setEmpForm({...empForm,role:e.target.value})}/>
                </div>
                <div className="form-row">
                  <label className="form-label">Manager</label>
                  <input className="inp" placeholder="e.g. Roberto Ibarra" value={empForm.manager} onChange={e=>setEmpForm({...empForm,manager:e.target.value})}/>
                </div>
                <div className="form-row">
                  <label className="form-label">Start Date *</label>
                  <input type="date" className="inp" value={empForm.startDate} onChange={e=>setEmpForm({...empForm,startDate:e.target.value})}/>
                </div>
                <div className="form-row">
                  <label className="form-label">Expected Arrival Time</label>
                  <input className="inp" placeholder="e.g. 09:00" maxLength={5} value={empForm.expectedArrival} onChange={e=>setEmpForm({...empForm,expectedArrival:e.target.value})}/>
                  <span style={{ fontSize:10,color:"#94a3b8",marginTop:3 }}>Used to compare vs actual arrival time</span>
                </div>
                <div className="form-row" style={{ gridColumn:"1/-1" }}>
                  <label className="form-label">Work Location</label>
                  <div style={{ display:"flex",gap:8,marginTop:2 }}>
                    {LOCATION_OPTIONS.map(o => (
                      <button key={o.value} className={`loc-btn${empForm.location===o.value?" active":""}`}
                        style={{ flex:1,padding:"9px",fontSize:13 }}
                        onClick={()=>setEmpForm({...empForm,location:o.value})}>
                        {o.icon} {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ padding:"0 24px 20px",display:"flex",justifyContent:"flex-end",gap:8 }}>
              <button className="btn btn-ghost" onClick={()=>setShowEmpForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addEmployee}>Add Employee</button>
            </div>
          </div>
        </div>
      )}

      {/* ════ MODAL — Terminate Employee ════ */}
      {terminateModal && (
        <div className="overlay" onClick={()=>setTerminateModal(null)}>
          <div className="modal" style={{ width:400 }} onClick={e=>e.stopPropagation()}>
            <div style={{ padding:"20px 24px 16px",borderBottom:"1px solid #f3f3f7" }}>
              <div style={{ fontWeight:800,fontSize:16,color:"#111" }}>Terminate Employee</div>
            </div>
            <div style={{ padding:"20px 24px" }}>
              <div style={{ background:"#fff5f5",border:"1px solid #fecaca",borderRadius:10,padding:"12px 14px",marginBottom:16 }}>
                <div style={{ fontWeight:700,color:"#111" }}>{terminateModal.name}</div>
                <div style={{ fontSize:12,color:"#94a3b8",marginTop:2 }}>{terminateModal.role} · {terminateModal.client}</div>
              </div>
              <div className="form-row">
                <label className="form-label">Termination Date</label>
                <input type="date" className="inp" value={terminateDate} onChange={e=>setTerminateDate(e.target.value)}/>
              </div>
              <div style={{ fontSize:12,color:"#94a3b8",marginTop:4 }}>
                This employee will not appear in daily attendance from this date onwards.
              </div>
            </div>
            <div style={{ padding:"0 24px 20px",display:"flex",justifyContent:"flex-end",gap:8 }}>
              <button className="btn btn-ghost" onClick={()=>setTerminateModal(null)}>Cancel</button>
              <button className="btn" style={{ background:"#dc2626",color:"#fff",borderRadius:10,padding:"9px 18px",fontSize:13 }} onClick={terminateEmployee}>
                Confirm Termination
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ════ MODAL — Employee Profile ════ */}
      {profileEmp && profileForm && (
        <div className="overlay" onClick={()=>setProfileEmp(null)}>
          <div className="modal" style={{ width:500 }} onClick={e=>e.stopPropagation()}>
            <div style={{ padding:"20px 24px 16px",borderBottom:"1px solid #f3f3f7",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <div style={{ display:"flex",alignItems:"center",gap:12 }}>
                <div style={{ width:42,height:42,borderRadius:12,background:"#e8f0fd",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:"#1B4FBE" }}>
                  {initials(profileForm.name)}
                </div>
                <div>
                  <div style={{ fontWeight:800,fontSize:16,color:"#111" }}>{profileEmp.name}</div>
                  <div style={{ fontSize:12,color:"#94a3b8" }}>{profileEmp.client} · {profileEmp.role}</div>
                </div>
              </div>
              <button onClick={()=>setProfileEmp(null)} style={{ border:"none",background:"none",cursor:"pointer",color:"#94a3b8",fontSize:18,padding:4 }}>✕</button>
            </div>
            <div style={{ padding:"20px 24px" }}>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px" }}>
                <div className="form-row" style={{ gridColumn:"1/-1" }}>
                  <label className="form-label">Full Name</label>
                  <input className="inp" value={profileForm.name} onChange={e=>setProfileForm({...profileForm,name:e.target.value})}/>
                </div>
                <div className="form-row">
                  <label className="form-label">Client</label>
                  <select className="inp" value={profileForm.client} onChange={e=>setProfileForm({...profileForm,client:e.target.value})}>
                    {clients.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <label className="form-label">Position / Role</label>
                  <input className="inp" value={profileForm.role} onChange={e=>setProfileForm({...profileForm,role:e.target.value})}/>
                </div>
                <div className="form-row">
                  <label className="form-label">Manager</label>
                  <input className="inp" value={profileForm.manager} onChange={e=>setProfileForm({...profileForm,manager:e.target.value})}/>
                </div>
                <div className="form-row">
                  <label className="form-label">Start Date</label>
                  <input type="date" className="inp" value={profileForm.startDate} onChange={e=>setProfileForm({...profileForm,startDate:e.target.value})}/>
                </div>
                <div className="form-row">
                  <label className="form-label">Expected Arrival</label>
                  <input className="inp" placeholder="e.g. 09:00" maxLength={5} value={profileForm.expectedArrival||""} onChange={e=>setProfileForm({...profileForm,expectedArrival:e.target.value})}/>
                </div>
                <div className="form-row" style={{ gridColumn:"1/-1" }}>
                  <label className="form-label">Work Location</label>
                  <div style={{ display:"flex",gap:8,marginTop:2 }}>
                    {LOCATION_OPTIONS.map(o=>(
                      <button key={o.value} className={`loc-btn${profileForm.location===o.value?" active":""}`}
                        style={{ flex:1,padding:"10px",fontSize:13,borderRadius:10 }}
                        onClick={()=>setProfileForm({...profileForm,location:o.value})}>
                        {o.icon} {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ marginTop:4,padding:"10px 14px",background:"#F0F2F5",borderRadius:10,fontSize:12,color:"#64748b" }}>
                <strong>Start date:</strong> {fmtDate(profileForm.startDate)}
                {profileEmp.terminatedDate && <span style={{ marginLeft:12,color:"#b91c1c" }}><strong>Terminated:</strong> {fmtDate(profileEmp.terminatedDate)}</span>}
              </div>
            </div>
            <div style={{ padding:"0 24px 20px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <button className="btn btn-danger" onClick={()=>{setProfileEmp(null);setTerminateModal(profileEmp);setTerminateDate(todayKey());}}>
                Terminate employee
              </button>
              <div style={{ display:"flex",gap:8 }}>
                <button className="btn btn-ghost" onClick={()=>setProfileEmp(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={saveProfile}>Save changes</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════ MODAL — Delete Client ════ */}
      {deleteClientModal && (
        <div className="overlay" onClick={()=>setDeleteClientModal(null)}>
          <div className="modal" style={{ width:420 }} onClick={e=>e.stopPropagation()}>
            <div style={{ padding:"20px 24px 16px",borderBottom:"1px solid #f3f3f7",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <div style={{ fontWeight:800,fontSize:16,color:"#111" }}>Remove Client</div>
              <button onClick={()=>setDeleteClientModal(null)} style={{ border:"none",background:"none",cursor:"pointer",color:"#94a3b8",fontSize:18,padding:4 }}>✕</button>
            </div>
            <div style={{ padding:"20px 24px" }}>
              {deleteClientModal.hasEmps ? (
                <div style={{ background:"#fff5f5",border:"1px solid #fecaca",borderRadius:10,padding:"14px" }}>
                  <div style={{ fontWeight:700,color:"#b91c1c",marginBottom:6 }}>⚠ Cannot remove "{deleteClientModal.name}"</div>
                  <div style={{ fontSize:13,color:"#64748b" }}>This client still has active employees. Terminate all their employees first before removing the client.</div>
                </div>
              ) : (
                <>
                  <div style={{ background:"#fff5f5",border:"1px solid #fecaca",borderRadius:10,padding:"14px",marginBottom:18 }}>
                    <div style={{ fontWeight:700,color:"#b91c1c",marginBottom:4 }}>⚠ This action cannot be undone</div>
                    <div style={{ fontSize:13,color:"#64748b" }}>
                      You are about to permanently remove <strong style={{ color:"#111" }}>{deleteClientModal.name}</strong> from the system. Their historical attendance data will be preserved but the client will no longer appear in any lists.
                    </div>
                  </div>
                  <div className="form-row">
                    <label className="form-label">Type the client name to confirm</label>
                    <input className="inp" placeholder={deleteClientModal.name}
                      value={deleteClientModal.input}
                      onChange={e=>setDeleteClientModal(prev=>({...prev,input:e.target.value}))}/>
                    {deleteClientModal.input.length>0 && deleteClientModal.input !== deleteClientModal.name && (
                      <div style={{ fontSize:11,color:"#dc2626",marginTop:4 }}>Name doesn't match — type exactly: "{deleteClientModal.name}"</div>
                    )}
                  </div>
                </>
              )}
            </div>
            <div style={{ padding:"0 24px 20px",display:"flex",justifyContent:"flex-end",gap:8 }}>
              <button className="btn btn-ghost" onClick={()=>setDeleteClientModal(null)}>Cancel</button>
              {!deleteClientModal.hasEmps && (
                <button className="btn"
                  onClick={confirmDeleteClient}
                  disabled={deleteClientModal.input !== deleteClientModal.name}
                  style={{ background:deleteClientModal.input===deleteClientModal.name?"#dc2626":"#e5e5ea",
                    color:deleteClientModal.input===deleteClientModal.name?"#fff":"#94a3b8",
                    borderRadius:10,padding:"9px 18px",fontSize:13,cursor:deleteClientModal.input===deleteClientModal.name?"pointer":"not-allowed" }}>
                  Yes, remove client
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
