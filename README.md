# CrimeGraph AI — AI-Powered Criminal Network Analysis System

**Project:** AI-Powered Criminal Network Analysis System  
**Theme:** Blockchain & Cybersecurity  
**Team:** CyberCrew  

---

## 🎯 Overview

**CrimeGraph AI** is an advanced criminal intelligence and link-analysis platform developed for law enforcement agencies (State Police Cyber Cells, CID, NCRB, and MHA). The platform replaces traditional, manual, and siloed record checks with automated cross-case and cross-jurisdictional correlation using **Graph Neural Networks (GraphSAGE)**, **NLP-driven entity resolution**, and **dynamic network disruption simulation**.

---

## 🌟 Core Features

### 1. Interactive Criminal Knowledge Graph
- **Multi-Modal Entity Mapping:** Person of Interest (POI), aliases, physical locations, transit hubs, registered vehicles, and shell corporate entities.
- **Multiple Layout Perspectives:**
  - **Force-Directed:** Dynamic physics simulation surfacing natural clustering and bridges.
  - **Concentric Radial:** Arranges nodes into concentric risk rings (High-Risk core $\rightarrow$ Low-Risk perimeter).
  - **Hierarchical:** Tier-based layout highlighting criminal command structures and network centrality.
- **Neighborhood & Sub-network Isolation:** Instant 1-hop and 2-hop neighborhood isolation to trace influence paths.

### 2. Predictive Intelligence & Explainable AI (XAI)
- **GraphSAGE Link Prediction:** Detects emerging criminal associations and hidden gang affiliations before operational escalation.
- **Court-Admissible Evidence Paths:** Every predicted association features an explainable step-by-step evidentiary trail (e.g., shared shell companies, co-location in transit hubs, CDR timing correlation).
- **Analyst-in-the-Loop Validation:** Leads are categorized with confidence scores and require explicit human-analyst review before operational action.

### 3. Network Disruption & Intervention Simulator
- **Structural Resilience Analysis:** Measures overall network cohesion, fragment count, and size of the largest connected cluster.
- **Node Neutralization Impact:** Simulates the effect of arresting or intercepting key targets to identify interventions that maximally shatter criminal syndicates.
- **Activity Trajectory Forecasting:** Historical trend projection combined with 7-day, 14-day, and 30-day forecast horizons.

### 4. Cross-Jurisdictional Case Management
- **Multi-State Dossiers:** Tracks FIRs, chargesheets, suspect rosters, and chronological case diaries across Maharashtra, Delhi NCR, and Karnataka.
- **Bidirectional Graph Linkage:** Click any case to isolate its suspect roster directly in the network graph; inspect any node to see all related FIRs.
- **Dynamic Case Registration:** Add new cases with instant assignment into the knowledge graph.

### 5. Digital Case File Ingestion & Multi-Source AI Extraction
- **Drag-and-Drop Digital Case Upload:** Officers can upload PDF, DOCX, CCTNS JSON, TXT, or scanned case files.
- **Automated Document OCR & Entity Resolution:** Identifies FIR numbers, penal codes (BNS, NDPS, PMLA), Persons of Interest (POIs), aliases, shell corporations, vehicles, and transit nodes.
- **Cross-Jurisdiction Bridge Detection:** Automatically highlights inter-state syndicate links (e.g., Maharashtra contraband routed via Karnataka maritime gates).
- **Instant Cross-Feature Activation:** Ingested files instantly update the live knowledge graph, register into case management, feed GraphSAGE predictive intelligence, enable network disruption simulations, and generate court-admissible forensic dossiers.

### 6. Forensic Intelligence Reports & Evidence Export
- **Subject Forensic Dossiers:** Comprehensive criminal history, associate risk distribution, and intelligence recommendations.
- **One-Click PDF / Court Export:** Styled print stylesheets (`@media print`) conformant with legal evidence packaging under Bharatiya Nagarik Suraksha Sanhita (BNSS).
- **Direct Inter-Module Navigation:** Deep-links between Cases $\leftrightarrow$ Network Graph $\leftrightarrow$ Forensic Reports via URL query parameters.

---

## Repository Structure

```
Crimegraph_Ai/
├── index.html
├── package.json
├── src/
│   ├── App.jsx                  # React routes, role-aware UI, graph and page behavior
│   ├── data.js                  # Sample graph, case, and report data
│   └── main.jsx                 # React entry point
├── assets/css/                  # Shared application styles
└── README.md
```

## Run Locally

Install dependencies and start the Vite development server:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Create a production build with `npm run build`; preview it with `npm run preview`.

## Deployment

Build the React application with `npm run build` and publish the generated `dist/` directory. Vercel and Netlify configuration files are included; both rewrite application routes to the React entry point. For GitHub Pages, build the app and publish `dist/` using a GitHub Actions workflow.

---

## �🔒 Security & Privacy Compliance

- **Demo role-based access:** Badge IDs map to Investigator, Analyst, and Administrator roles. Investigators can view investigations and manage demo cases; Analysts can recalculate predictions and generate reports; Administrators additionally access system and ingestion controls.
- **Authentication limitation:** The React prototype stores a demo session in browser `sessionStorage`. Badge mappings and permissions run in client code and are not security controls. Do not use this flow with real records or deploy it as production authentication.
- **Production requirement:** Enforce identity, role assignment, and every permission on a trusted backend/API using an identity provider (for example OIDC/OAuth2), server-side session/token validation, least-privilege policies, and audit logging. Frontend route guards are only for presentation and usability.
- **DPDP & BNSS Data Safeguards:** Integrated privacy anonymisation filter masks personally identifiable records (Aadhaar, contact digits) during evidence exports.
- **Traceable Evidentiary Standards:** Mandatory provenance tracking for all AI predictions ensuring legal defensibility under judicial review.

---

## 👥 Team CyberCrew
- **Theme:** Blockchain & Cybersecurity
- **Platform:** CrimeGraph AI
