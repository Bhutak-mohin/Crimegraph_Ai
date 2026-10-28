/* ============================================================
   CrimeGraph AI — Shared Data Store
   ============================================================ */

const CG = (() => {

/* ── Knowledge Graph Nodes ────────────────────────────────── */
const nodes = [
  // Cluster 0 — Maharashtra
  {id:"Rohan K.",        alias:"Circuit",  type:"person",   risk:82, cluster:0, cases:4, associates:7, lastActivity:"3 days ago",  jurisdiction:"2 states",   lat:19.08, lng:72.88},
  {id:"Vikram S.",       alias:"Bhaiya",   type:"person",   risk:91, cluster:0, cases:6, associates:9, lastActivity:"1 day ago",   jurisdiction:"Maharashtra", lat:19.22, lng:72.97},
  {id:"Ajay M.",         alias:"Tinku",    type:"person",   risk:58, cluster:0, cases:2, associates:4, lastActivity:"9 days ago",  jurisdiction:"Maharashtra", lat:19.18, lng:72.95},
  {id:"Priya D.",        alias:"—",        type:"person",   risk:34, cluster:0, cases:1, associates:3, lastActivity:"21 days ago", jurisdiction:"Maharashtra", lat:19.05, lng:72.92},
  {id:"Warehouse B-12",  alias:"—",        type:"location", risk:66, cluster:0, cases:3, associates:5, lastActivity:"3 days ago",  jurisdiction:"Thane",       lat:19.21, lng:72.98},
  {id:"MH-04 AB 7791",   alias:"—",        type:"vehicle",  risk:47, cluster:0, cases:2, associates:2, lastActivity:"6 days ago",  jurisdiction:"Maharashtra", lat:19.10, lng:72.85},
  {id:"Ravi B.",         alias:"—",        type:"person",   risk:22, cluster:0, cases:1, associates:1, lastActivity:"40 days ago", jurisdiction:"Maharashtra", lat:19.06, lng:72.90},
  {id:"Kiran V.",        alias:"—",        type:"person",   risk:37, cluster:0, cases:1, associates:2, lastActivity:"16 days ago", jurisdiction:"Maharashtra", lat:19.15, lng:72.88},
  // Cluster 1 — Delhi NCR
  {id:"Sameer Q.",              alias:"Q",     type:"person",   risk:88, cluster:1, cases:5, associates:8, lastActivity:"2 days ago",  jurisdiction:"Delhi NCR",  lat:28.63, lng:77.22},
  {id:"Farhan T.",              alias:"Chotu", type:"person",   risk:73, cluster:1, cases:3, associates:6, lastActivity:"4 days ago",  jurisdiction:"Delhi NCR",  lat:28.65, lng:77.20},
  {id:"Naveen R.",              alias:"—",     type:"person",   risk:41, cluster:1, cases:1, associates:3, lastActivity:"14 days ago", jurisdiction:"Delhi NCR",  lat:28.61, lng:77.25},
  {id:"Kavita J.",              alias:"—",     type:"person",   risk:29, cluster:1, cases:1, associates:2, lastActivity:"30 days ago", jurisdiction:"Delhi NCR",  lat:28.58, lng:77.18},
  {id:"Orbit Traders Pvt Ltd",  alias:"—",     type:"org",      risk:69, cluster:1, cases:2, associates:4, lastActivity:"5 days ago",  jurisdiction:"Delhi NCR",  lat:28.67, lng:77.23},
  {id:"DL-8C XQ 2210",          alias:"—",     type:"vehicle",  risk:38, cluster:1, cases:1, associates:2, lastActivity:"11 days ago", jurisdiction:"Delhi NCR",  lat:28.62, lng:77.21},
  {id:"Transit Hub 9",          alias:"—",     type:"location", risk:52, cluster:1, cases:2, associates:3, lastActivity:"7 days ago",  jurisdiction:"Delhi NCR",  lat:28.69, lng:77.15},
  {id:"Anjali S.",              alias:"—",     type:"person",   risk:18, cluster:1, cases:1, associates:1, lastActivity:"55 days ago", jurisdiction:"Delhi NCR",  lat:28.56, lng:77.19},
  // Cluster 2 — Karnataka
  {id:"Imran W.",        alias:"Wolf",   type:"person",   risk:95, cluster:2, cases:7, associates:11, lastActivity:"Today",       jurisdiction:"3 states",   lat:12.97, lng:77.59},
  {id:"Suresh N.",       alias:"Pandit", type:"person",   risk:77, cluster:2, cases:4, associates:7,  lastActivity:"1 day ago",   jurisdiction:"Karnataka",  lat:12.95, lng:77.57},
  {id:"Deepak L.",       alias:"—",      type:"person",   risk:63, cluster:2, cases:3, associates:5,  lastActivity:"5 days ago",  jurisdiction:"Karnataka",  lat:12.98, lng:77.61},
  {id:"Meena P.",        alias:"—",      type:"person",   risk:45, cluster:2, cases:2, associates:3,  lastActivity:"12 days ago", jurisdiction:"Karnataka",  lat:12.93, lng:77.55},
  {id:"Nexus Logistics", alias:"—",      type:"org",      risk:71, cluster:2, cases:3, associates:6,  lastActivity:"2 days ago",  jurisdiction:"Karnataka",  lat:12.99, lng:77.60},
  {id:"KA-05 MN 4432",   alias:"—",      type:"vehicle",  risk:56, cluster:2, cases:2, associates:2,  lastActivity:"8 days ago",  jurisdiction:"Karnataka",  lat:12.96, lng:77.58},
  {id:"Dockyard Gate 3", alias:"—",      type:"location", risk:74, cluster:2, cases:4, associates:6,  lastActivity:"1 day ago",   jurisdiction:"Karnataka",  lat:12.91, lng:77.54},
  {id:"Old Mill Road",   alias:"—",      type:"location", risk:31, cluster:2, cases:1, associates:2,  lastActivity:"18 days ago", jurisdiction:"Karnataka",  lat:12.94, lng:77.62},
];

/* ── Links ────────────────────────────────────────────────── */
const links = [
  {source:"Rohan K.",       target:"Vikram S.",      weak:false},
  {source:"Rohan K.",       target:"Ajay M.",         weak:false},
  {source:"Rohan K.",       target:"Warehouse B-12",  weak:false},
  {source:"Vikram S.",      target:"Warehouse B-12",  weak:false},
  {source:"Vikram S.",      target:"MH-04 AB 7791",   weak:false},
  {source:"Ajay M.",        target:"Priya D.",         weak:true},
  {source:"Ajay M.",        target:"MH-04 AB 7791",   weak:true},
  {source:"Priya D.",       target:"Ravi B.",          weak:true},
  {source:"Rohan K.",       target:"Kiran V.",         weak:true},
  {source:"Vikram S.",      target:"Sameer Q.",        weak:true},
  {source:"Sameer Q.",      target:"Farhan T.",        weak:false},
  {source:"Sameer Q.",      target:"Orbit Traders Pvt Ltd", weak:false},
  {source:"Farhan T.",      target:"Naveen R.",        weak:false},
  {source:"Farhan T.",      target:"Transit Hub 9",    weak:false},
  {source:"Naveen R.",      target:"Kavita J.",        weak:true},
  {source:"Orbit Traders Pvt Ltd", target:"DL-8C XQ 2210", weak:true},
  {source:"Transit Hub 9",  target:"DL-8C XQ 2210",   weak:true},
  {source:"Kavita J.",      target:"Anjali S.",        weak:true},
  {source:"Sameer Q.",      target:"Imran W.",         weak:true},
  {source:"Imran W.",       target:"Suresh N.",        weak:false},
  {source:"Imran W.",       target:"Deepak L.",        weak:false},
  {source:"Imran W.",       target:"Dockyard Gate 3",  weak:false},
  {source:"Suresh N.",      target:"Nexus Logistics",  weak:false},
  {source:"Suresh N.",      target:"KA-05 MN 4432",    weak:true},
  {source:"Deepak L.",      target:"Meena P.",         weak:true},
  {source:"Nexus Logistics",target:"Dockyard Gate 3",  weak:false},
  {source:"Meena P.",       target:"Old Mill Road",    weak:true},
  {source:"Deepak L.",      target:"KA-05 MN 4432",    weak:true},
];

/* ── Predicted Links (AI) ─────────────────────────────────── */
const predictedLinks = [
  {source:"Rohan K.",       target:"Sameer Q.",            score:0.91, status:"Pending",
   reasons:["2-hop bridge across Maharashtra ↔ Delhi NCR","Shared weak-link via Vikram S.","Similar case/associate structure (degree=7 vs 8)"]},
  {source:"Vikram S.",      target:"Imran W.",             score:0.88, status:"Pending",
   reasons:["Cross-cluster centrality similarity","Shared high-risk connector pattern","Recent activity overlap — both active within 24 hrs"]},
  {source:"Ajay M.",        target:"Orbit Traders Pvt Ltd",score:0.82, status:"Pending",
   reasons:["Common vehicle-linked pathway","2-hop proximity through active cluster","Organisation appears in parallel network structure"]},
  {source:"Warehouse B-12", target:"MH-04 AB 7791",       score:0.79, status:"Pending",
   reasons:["Repeated co-location pattern (3 incidents)","Vehicle proximity in observed transit paths","Temporal activity similarity — same 6-day window"]},
  {source:"Farhan T.",      target:"Nexus Logistics",      score:0.76, status:"Pending",
   reasons:["Role similarity across clusters","Comparable degree/centrality profile","Cross-jurisdiction pathway via Sameer Q. bridge"]},
  {source:"Transit Hub 9",  target:"Dockyard Gate 3",      score:0.71, status:"Pending",
   reasons:["Location-to-location structural similarity","Transport-node role similarity in separate clusters","Emerging cross-cluster path identified in 14-day window"]},
];

/* ── Cases ────────────────────────────────────────────────── */
const cases = [
  {
    id:"MH-2024-0047", title:"Operation Chain Link", status:"Active",
    risk:91, riskLevel:"high", cluster:0, jurisdiction:"Maharashtra",
    type:"Organised Crime", opened:"12 Sep 2024", lastUpdate:"3 days ago",
    desc:"Multi-state drug trafficking network centred around Thane warehouse complex. 6 FIRs consolidated.",
    suspects:["Rohan K.","Vikram S.","Ajay M.","Warehouse B-12","MH-04 AB 7791"],
    entities:9, linkedCases:3,
    icon:"🔗",
    timeline:[
      {date:"Oct 24, 2024", text:"Surveillance confirms vehicle MH-04 AB 7791 at B-12 warehouse. CDR cross-match positive."},
      {date:"Oct 18, 2024", text:"FIR #0284/24 linked via NLP entity resolution — Vikram S. alias 'Bhaiya' confirmed."},
      {date:"Oct 10, 2024", text:"New associate Kiran V. added to network after call record analysis."},
      {date:"Sep 28, 2024", text:"Inter-state flag raised — Vikram S. linked to Delhi NCR cluster via Sameer Q."},
      {date:"Sep 12, 2024", text:"Case opened. Initial FIR #MH-2024-0047 filed at Thane Cyber Cell."},
    ],
    findings:["Rohan K. ('Circuit') identified as network orchestrator with 4 active FIRs","Warehouse B-12 confirmed as primary transit point for 3 clusters","Vehicle MH-04 AB 7791 linked to 2 drop-off events in past 30 days"],
    recommendations:["Priority surveillance on Vikram S. — highest risk score (91)","Monitor Warehouse B-12 — cross-cluster transit hub","Request CDR analysis for MH-04 AB 7791 past 90 days"],
  },
  {
    id:"DL-2024-0091", title:"Operation Dark Transit", status:"Active",
    risk:88, riskLevel:"high", cluster:1, jurisdiction:"Delhi NCR",
    type:"Financial Crime", opened:"5 Oct 2024", lastUpdate:"2 days ago",
    desc:"Shell company linked to hawala network operating through Orbit Traders Pvt Ltd. Cross-state money movement detected.",
    suspects:["Sameer Q.","Farhan T.","Orbit Traders Pvt Ltd","Transit Hub 9","DL-8C XQ 2210"],
    entities:7, linkedCases:2,
    icon:"🏦",
    timeline:[
      {date:"Oct 25, 2024", text:"Financial transaction pattern analysis reveals ₹2.4Cr movement through Orbit Traders Pvt Ltd."},
      {date:"Oct 20, 2024", text:"Transit Hub 9 identified as physical coordination point via CCTV cross-reference."},
      {date:"Oct 14, 2024", text:"Sameer Q. linked to Maharashtra cluster — inter-state flag raised."},
      {date:"Oct 5, 2024",  text:"Case opened following suspicious import-export filing at MHA."},
    ],
    findings:["Orbit Traders Pvt Ltd used as a financial intermediary — 3 hawala transactions detected","DL-8C XQ 2210 sighted at Transit Hub 9 on 4 occasions in 30 days","Sameer Q. communicates with Maharashtra cluster via encrypted channels"],
    recommendations:["Freeze Orbit Traders financial accounts pending investigation","Place Transit Hub 9 under surveillance","Request I4C trace on digital transaction IDs"],
  },
  {
    id:"KA-2024-0033", title:"Operation Dockside Wolf", status:"Active",
    risk:95, riskLevel:"high", cluster:2, jurisdiction:"Karnataka",
    type:"Smuggling", opened:"2 Aug 2024", lastUpdate:"Today",
    desc:"Imran W. ('Wolf') leads Karnataka-based smuggling ring using Nexus Logistics as a front. Dockyard Gate 3 is the primary point of entry.",
    suspects:["Imran W.","Suresh N.","Deepak L.","Nexus Logistics","Dockyard Gate 3","KA-05 MN 4432"],
    entities:8, linkedCases:4,
    icon:"⚓",
    timeline:[
      {date:"Oct 27, 2024", text:"Imran W. spotted near Dockyard Gate 3. Nexus Logistics vehicle KA-05 MN 4432 present."},
      {date:"Oct 22, 2024", text:"Intercepted communication links Suresh N. ('Pandit') to incoming shipment."},
      {date:"Oct 15, 2024", text:"Meena P. contact established — peripheral node with access to Old Mill Road safe house."},
      {date:"Sep 10, 2024", text:"Nexus Logistics flagged by GSTIN audit — irregular consignment patterns."},
      {date:"Aug 2, 2024",  text:"Case opened after port authority report of unregistered consignments."},
    ],
    findings:["Imran W. ('Wolf') is the highest-risk entity in the entire network (risk score: 95)","Nexus Logistics is the front company — 3 suspicious consignments in 90 days","Dockyard Gate 3 is the primary entry point confirmed on 4 separate occasions"],
    recommendations:["Immediate interception — Imran W. is active today","Coordinate with port authority and customs for Dockyard Gate 3 lockdown","Freeze Nexus Logistics GST and import licences"],
  },
  {
    id:"MH-2024-0061", title:"Vehicle Nexus Probe", status:"Under Review",
    risk:54, riskLevel:"med", cluster:0, jurisdiction:"Maharashtra",
    type:"Vehicle Crime", opened:"20 Sep 2024", lastUpdate:"6 days ago",
    desc:"Probe into vehicle MH-04 AB 7791 linked to 2 case clusters. Pattern of movement matches known transit routes.",
    suspects:["MH-04 AB 7791","Ajay M.","Vikram S."],
    entities:3, linkedCases:2, icon:"🚗",
    timeline:[
      {date:"Oct 21, 2024", text:"GPS analysis shows vehicle visited Warehouse B-12 on 3 nights in past 30 days."},
      {date:"Oct 8, 2024",  text:"Vehicle linked to Ajay M. via CCTNS record cross-reference."},
      {date:"Sep 20, 2024", text:"Vehicle flagged after appearing in two unrelated FIRs."},
    ],
    findings:["MH-04 AB 7791 appears in FIRs from 2 different clusters","Vehicle registered to a shell address — ownership unclear","Movement pattern consistent with known transit routes in Thane district"],
    recommendations:["Conduct ownership verification through RTO","Request location history for past 90 days","Check vehicle at all known cluster locations"],
  },
  {
    id:"DL-2024-0105", title:"Peripheral Contact Sweep", status:"Closed",
    risk:28, riskLevel:"low", cluster:1, jurisdiction:"Delhi NCR",
    type:"Surveillance", opened:"1 Sep 2024", lastUpdate:"30 days ago",
    desc:"Surveillance on Kavita J. and Anjali S. — peripheral contacts of Delhi NCR cluster. No direct criminal involvement found.",
    suspects:["Kavita J.","Anjali S.","Naveen R."],
    entities:3, linkedCases:1, icon:"👁️",
    timeline:[
      {date:"Sep 27, 2024", text:"Surveillance concluded. No criminal activity observed for Kavita J. or Anjali S."},
      {date:"Sep 15, 2024", text:"Naveen R. confirmed as low-risk indirect contact."},
      {date:"Sep 1, 2024",  text:"Surveillance initiated based on network proximity to Farhan T."},
    ],
    findings:["No direct criminal activity identified for Kavita J. or Anjali S.","Naveen R. confirmed as peripheral contact — no further escalation required"],
    recommendations:["Maintain passive monitoring on Naveen R. as indirect network contact","Close active surveillance on Kavita J. and Anjali S."],
  },
  {
    id:"KA-2024-0051", title:"Logistics Front Audit", status:"Under Review",
    risk:71, riskLevel:"high", cluster:2, jurisdiction:"Karnataka",
    type:"Financial Crime", opened:"15 Sep 2024", lastUpdate:"2 days ago",
    desc:"Nexus Logistics flagged for suspicious GSTIN activity and irregular consignment patterns. Linked to Imran W. network.",
    suspects:["Nexus Logistics","Suresh N.","Dockyard Gate 3"],
    entities:4, linkedCases:3, icon:"📦",
    timeline:[
      {date:"Oct 25, 2024", text:"GSTIN audit confirms 3 consignments with no matching import documentation."},
      {date:"Oct 12, 2024", text:"Nexus Logistics vehicles sighted at Dockyard Gate 3."},
      {date:"Sep 15, 2024", text:"Audit initiated after anomalous filing patterns flagged by NCRB."},
    ],
    findings:["3 consignments with no matching import documentation","Nexus Logistics address linked to Suresh N. via CCTNS record","Company registered 6 months before first criminal activity flag"],
    recommendations:["File MHA report for GST fraud investigation","Cross-reference with ED for FEMA violations","Seize company records and vehicle logs"],
  },
];

/* ── Reports ──────────────────────────────────────────────── */
const reports = [
  {id:"RPT-2024-001", name:"Forensic Report — Rohan K. (Circuit)", case:"MH-2024-0047", date:"Oct 24, 2024", analyst:"Inspector Mehra", status:"final",   entityId:"Rohan K."},
  {id:"RPT-2024-002", name:"Network Analysis — Operation Chain Link", case:"MH-2024-0047", date:"Oct 22, 2024", analyst:"Inspector Mehra", status:"final",   entityId:null},
  {id:"RPT-2024-003", name:"Forensic Report — Imran W. (Wolf)",      case:"KA-2024-0033", date:"Oct 26, 2024", analyst:"Insp. Sharma",  status:"final",   entityId:"Imran W."},
  {id:"RPT-2024-004", name:"Predictive Forecast — 14-Day Horizon",   case:null,           date:"Oct 25, 2024", analyst:"System",        status:"pending",  entityId:null},
  {id:"RPT-2024-005", name:"Network Disruption Simulation Report",    case:"KA-2024-0033", date:"Oct 23, 2024", analyst:"Inspector Mehra", status:"final",   entityId:null},
  {id:"RPT-2024-006", name:"Forensic Report — Sameer Q.",            case:"DL-2024-0091", date:"Oct 21, 2024", analyst:"Insp. Kapoor",  status:"draft",    entityId:"Sameer Q."},
  {id:"RPT-2024-007", name:"Orbit Traders Financial Trace",           case:"DL-2024-0091", date:"Oct 18, 2024", analyst:"Insp. Kapoor",  status:"draft",    entityId:"Orbit Traders Pvt Ltd"},
  {id:"RPT-2024-008", name:"Logistics Front Audit Summary",           case:"KA-2024-0051", date:"Oct 15, 2024", analyst:"Insp. Sharma",  status:"pending",  entityId:"Nexus Logistics"},
];

/* ── Forecast Series ──────────────────────────────────────── */
const forecastSeries = [34,38,39,43,45,48,52,55,58,61,65,68,72,75];

/* ── Utility helpers ──────────────────────────────────────── */
function riskColor(r) {
  try {
    const s = getComputedStyle(document.documentElement);
    if (r > 70) return s.getPropertyValue('--risk-high').trim() || '#ef4444';
    if (r > 40) return s.getPropertyValue('--risk-med').trim() || '#f59e0b';
    return s.getPropertyValue('--risk-low').trim() || '#10b981';
  } catch (e) {
    return r > 70 ? '#ef4444' : r > 40 ? '#f59e0b' : '#10b981';
  }
}
function riskLevel(r) { return r > 70 ? 'high' : r > 40 ? 'med' : 'low'; }
function riskLabel(r) { return r > 70 ? 'HIGH' : r > 40 ? 'MED' : 'LOW'; }
function avatarColor(type) {
  return {person:'#3b82f6', location:'#8b5cf6', vehicle:'#0ea5a1', org:'#d99a2b'}[type] || '#3b82f6';
}
function initials(name) { return name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase(); }
function esc(s) {
  return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function findAssociates(id) {
  const out = [];
  links.forEach(l => {
    const s = l.source.id||l.source, t = l.target.id||l.target;
    if (s===id) out.push(t); else if (t===id) out.push(s);
  });
  return out;
}

/* ── State Persistence & Ingestion Engine ───────────────── */
const STORAGE_KEY = 'crimegraph_ai_state_v1';

function saveState() {
  try {
    const dataToSave = {
      cases,
      reports,
      forecastSeries,
      predictedLinks: predictedLinks.map(p => ({
        source: typeof p.source === 'object' ? p.source.id : p.source,
        target: typeof p.target === 'object' ? p.target.id : p.target,
        score: p.score,
        status: p.status,
        reasons: p.reasons
      })),
      nodes: nodes.map(n => ({
        id: n.id, alias: n.alias, type: n.type, risk: n.risk,
        cluster: n.cluster, cases: n.cases, associates: n.associates,
        lastActivity: n.lastActivity, jurisdiction: n.jurisdiction,
        lat: n.lat, lng: n.lng
      })),
      links: links.map(l => ({
        source: typeof l.source === 'object' ? l.source.id : l.source,
        target: typeof l.target === 'object' ? l.target.id : l.target,
        weak: !!l.weak
      }))
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
  } catch (err) {
    console.warn('Could not persist CrimeGraph state to localStorage:', err);
  }
}

function loadSavedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed.cases && Array.isArray(parsed.cases)) {
      cases.length = 0; parsed.cases.forEach(c => cases.push(c));
    }
    if (parsed.nodes && Array.isArray(parsed.nodes)) {
      nodes.length = 0; parsed.nodes.forEach(n => nodes.push(n));
    }
    if (parsed.links && Array.isArray(parsed.links)) {
      links.length = 0; parsed.links.forEach(l => links.push(l));
    }
    if (parsed.predictedLinks && Array.isArray(parsed.predictedLinks)) {
      predictedLinks.length = 0; parsed.predictedLinks.forEach(p => predictedLinks.push(p));
    }
    if (parsed.reports && Array.isArray(parsed.reports)) {
      reports.length = 0; parsed.reports.forEach(r => reports.push(r));
    }
  } catch (err) {
    console.warn('Could not restore CrimeGraph state:', err);
  }
}

// Hydrate saved state on load
loadSavedState();

function ingestCaseDossier(dossier) {
  if (!dossier) return false;
  
  // 1. Ingest Case
  if (dossier.caseData) {
    const existingIdx = cases.findIndex(c => c.id === dossier.caseData.id);
    if (existingIdx >= 0) {
      cases[existingIdx] = dossier.caseData;
    } else {
      cases.unshift(dossier.caseData);
    }
  }

  // 2. Ingest Nodes / Entities
  if (Array.isArray(dossier.entities)) {
    dossier.entities.forEach(newEnt => {
      const match = nodes.find(n => n.id.toLowerCase() === newEnt.id.toLowerCase());
      if (match) {
        Object.assign(match, newEnt);
      } else {
        nodes.push(newEnt);
      }
    });
  }

  // 3. Ingest Links / Connections
  if (Array.isArray(dossier.links)) {
    dossier.links.forEach(nl => {
      const sId = typeof nl.source === 'object' ? nl.source.id : nl.source;
      const tId = typeof nl.target === 'object' ? nl.target.id : nl.target;
      const exists = links.some(l => {
        const curS = typeof l.source === 'object' ? l.source.id : l.source;
        const curT = typeof l.target === 'object' ? l.target.id : l.target;
        return (curS === sId && curT === tId) || (curS === tId && curT === sId);
      });
      if (!exists) {
        links.push({ source: sId, target: tId, weak: !!nl.weak });
      }
    });
  }

  // 4. Ingest Predicted Links
  if (Array.isArray(dossier.predictions)) {
    dossier.predictions.forEach(np => {
      const sId = typeof np.source === 'object' ? np.source.id : np.source;
      const tId = typeof np.target === 'object' ? np.target.id : np.target;
      const exists = predictedLinks.some(p => {
        const curS = typeof p.source === 'object' ? p.source.id : p.source;
        const curT = typeof p.target === 'object' ? p.target.id : p.target;
        return (curS === sId && curT === tId) || (curS === tId && curT === sId);
      });
      if (!exists) {
        predictedLinks.unshift(np);
      }
    });
  }

  // 5. Ingest Forensic Report
  if (dossier.report) {
    const rIdx = reports.findIndex(r => r.id === dossier.report.id);
    if (rIdx >= 0) {
      reports[rIdx] = dossier.report;
    } else {
      reports.unshift(dossier.report);
    }
  }

  saveState();
  return true;
}

function resetToDefault() {
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

return { nodes, links, predictedLinks, cases, reports, forecastSeries,
         riskColor, riskLevel, riskLabel, avatarColor, initials, esc, findAssociates,
         ingestCaseDossier, resetToDefault, saveState };
})();
