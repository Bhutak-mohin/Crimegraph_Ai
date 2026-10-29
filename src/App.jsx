import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import * as d3 from 'd3';
import { cases, forecastSeries, links, nodes, predictedLinks, reports } from './data';

import '../assets/css/global.css';
import '../assets/css/landing.css';
import '../assets/css/dashboard.css';
import '../assets/css/cases.css';
import '../assets/css/reports.css';
import '../assets/css/uploader.css';

const riskColor = (r) => {
  if (r > 70) return '#ef4444';
  if (r > 40) return '#f59e0b';
  return '#10b981';
};

const riskLevel = (r) => (r > 70 ? 'high' : r > 40 ? 'med' : 'low');
const avatarColor = (type) => ({ person: '#3b82f6', location: '#8b5cf6', vehicle: '#0ea5a1', org: '#d99a2b' }[type] || '#3b82f6');
const entityTypeLabel = (type) => type === 'org' ? 'Company' : type[0].toUpperCase() + type.slice(1);
const initials = (name) => name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const AUTH_SESSION_KEY = 'crimegraph-session';
const ROLE_LABELS = { investigator: 'Investigator', analyst: 'Analyst', administrator: 'Administrator' };
const DEMO_USERS = {
  'MH-CYB-2024-001': { role: 'investigator', passphrase: 'crimegraph' },
  'ANALYST-2024-001': { role: 'analyst', passphrase: 'crimegraph' },
  'ADMIN-2024-001': { role: 'administrator', passphrase: 'crimegraph' },
};
const ROLE_PERMISSIONS = {
  investigator: ['dashboard.view', 'cases.view', 'reports.view', 'graph.export', 'case.upload', 'cases.create'],
  analyst: ['dashboard.view', 'cases.view', 'reports.view', 'graph.export', 'reports.generate', 'model.recalculate'],
  administrator: ['dashboard.view', 'cases.view', 'reports.view', 'graph.export', 'case.upload', 'cases.create', 'reports.generate', 'system.manage', 'data.ingest', 'model.recalculate'],
};

function getAuthSession() {
  const stored = sessionStorage.getItem(AUTH_SESSION_KEY);
  if (!stored) return null;
  try {
    const session = JSON.parse(stored);
    if (typeof session.badgeId === 'string' && ROLE_PERMISSIONS[session.role]) return session;
  } catch (error) {
    console.error('Unable to read session:', error);
  }
  return null;
}

function can(role, permission) {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

function ProtectedRoute({ permission, children }) {
  const session = getAuthSession();
  if (!session) return <Navigate to="/" replace />;
  if (!can(session.role, permission)) return <Navigate to="/app/dashboard" replace />;
  return children;
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error.message || 'Something went wrong.' };
  }

  componentDidCatch(error, info) {
    console.error('App error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#06141f', color: '#eef6ff', fontFamily: 'Inter, sans-serif' }}>
          <div style={{ padding: 32, borderRadius: 18, background: '#0f172a', border: '1px solid rgba(148,163,184,0.3)', maxWidth: 520, textAlign: 'center' }}>
            <h2 style={{ marginBottom: 12 }}>Something went wrong</h2>
            <p style={{ marginBottom: 0, color: '#cbd5e1' }}>{this.state.message}</p>
            <button className="btn btn-sm" style={{ marginTop: 20 }} onClick={() => window.location.reload()}>
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = '';
  toast.classList.add('show');
  if (type === 'error') toast.style.borderColor = 'var(--risk-high)';
  else if (type === 'ok') toast.style.borderColor = 'var(--risk-low)';
  else toast.style.borderColor = '';
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function Navbar({ onLogin }) {
  return (
    <nav className="landing-nav">
      <div className="nav-logo">
        <div className="mark">CG</div>
        <span className="name">CrimeGraph AI</span>
      </div>
      <div className="nav-links">
        <a className="nav-link" href="#features">Features</a>
        <a className="nav-link" href="#how">How It Works</a>
        <a className="nav-link" href="#tech">Technology</a>
      </div>
      <button className="btn nav-cta btn-sm" id="login-btn" onClick={onLogin}>Investigator Login →</button>
    </nav>
  );
}

function LandingPage() {
  const navigate = useNavigate();
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginId, setLoginId] = useState('MH-CYB-2024-001');
  const [loginPass, setLoginPass] = useState('crimegraph');

  const handleLogin = () => {
    if (!loginId.trim() || !loginPass.trim()) {
      showToast('Enter your Badge ID and passphrase', 'error');
      return;
    }
    const account = DEMO_USERS[loginId.trim().toUpperCase()];
    if (!account || account.passphrase !== loginPass) {
      showToast('Badge ID or passphrase is not valid', 'error');
      return;
    }
    const session = { badgeId: loginId.trim().toUpperCase(), role: account.role, signedInAt: new Date().toISOString() };
    sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    sessionStorage.setItem('crimegraph-user', session.badgeId);
    setLoginOpen(false);
    navigate('/app/dashboard');
  };

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const statNodes = document.getElementById('stat-entities');
          const statCases = document.getElementById('stat-cases');
          const statAccuracy = document.getElementById('stat-accuracy');
          const statClusters = document.getElementById('stat-clusters');
          if (statNodes) { statNodes.textContent = '24'; }
          if (statCases) { statCases.textContent = '6'; }
          if (statAccuracy) { statAccuracy.textContent = '87%'; }
          if (statClusters) { statClusters.textContent = '3'; }
          observer.disconnect();
        }
      });
    }, { threshold: 0.3 });

    const hero = document.getElementById('hero');
    if (hero) observer.observe(hero);
  }, []);

  useEffect(() => {
    const heroGraph = document.getElementById('hero-graph');
    if (!heroGraph) return;

    try {
      const graph = d3.select('#hero-graph');
      graph.selectAll('*').remove();
      const width = heroGraph.parentElement.clientWidth || 900;
      const height = 420;
      const svg = graph.attr('viewBox', `0 0 ${width} ${height}`);
      const container = svg.append('g');
      const linkData = links.map((l) => ({ ...l }));
      const nodeData = nodes.map((n) => ({ ...n }));
      const simulation = d3.forceSimulation(nodeData)
        .force('link', d3.forceLink(linkData).id((d) => d.id).distance(72).strength(0.32))
        .force('charge', d3.forceManyBody().strength(-180))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius((d) => 18 + d.associates));

      const linkSelection = container.append('g').selectAll('line')
        .data(linkData)
        .join('line')
        .attr('stroke', (d) => d.weak ? '#263047' : '#2a3a54')
        .attr('stroke-width', (d) => d.weak ? 1 : 1.5)
        .attr('stroke-dasharray', (d) => d.weak ? '3 4' : null)
        .attr('stroke-opacity', (d) => d.weak ? 0.4 : 0.7);

      const nodeSelection = container.append('g').selectAll('g')
        .data(nodeData)
        .join('g')
        .attr('class', 'node');

      nodeSelection.append('circle')
        .attr('r', (d) => 7 + d.associates * 0.9)
        .attr('fill', (d) => riskColor(d.risk))
        .attr('stroke', '#0d1117')
        .attr('stroke-width', 1.5);

      nodeSelection.append('text')
        .attr('dy', (d) => -(11 + d.associates * 0.9))
        .attr('text-anchor', 'middle')
        .attr('font-size', '9px')
        .attr('fill', '#8a93a8')
        .text((d) => d.id);

      simulation.on('tick', () => {
        linkSelection
          .attr('x1', (d) => d.source.x)
          .attr('y1', (d) => d.source.y)
          .attr('x2', (d) => d.target.x)
          .attr('y2', (d) => d.target.y);

        nodeSelection.attr('transform', (d) => `translate(${d.x},${d.y})`);
      });
    } catch (error) {
      console.error('Hero graph rendering failed:', error);
    }
  }, []);

  return (
    <>
      <div className="scanline" />
      <div className="landing-page">
        <Navbar onLogin={() => setLoginOpen(true)} />

        <section className="hero" id="hero">
          <div className="hero-badge">
            <span className="dot dot-live" />
            Next-Gen Intelligence Platform · CyberCrew
          </div>
          <h1>AI-Powered Criminal<br />Network Analysis</h1>
          <p className="subtitle">Reveal hidden gang hierarchies, predict emerging criminal associations, and identify optimal network disruption targets — all in one unified investigator console.</p>
          <div className="hero-actions">
            <button className="btn btn-lg" onClick={() => setLoginOpen(true)}>Enter Console →</button>
            <a href="#features" className="btn ghost btn-lg">Explore Features</a>
          </div>
          <div className="hero-stats">
            <div className="hero-stat"><div className="n" id="stat-entities">0</div><div className="l">Entities Tracked</div></div>
            <div className="hero-stat"><div className="n" id="stat-cases">0</div><div className="l">Active Cases</div></div>
            <div className="hero-stat"><div className="n" id="stat-accuracy">0%</div><div className="l">Model Accuracy</div></div>
            <div className="hero-stat"><div className="n" id="stat-clusters">0</div><div className="l">Clusters Detected</div></div>
          </div>

          <div className="hero-preview">
            <div className="preview-topbar">
              <div className="preview-dots">
                <div className="preview-dot" /><div className="preview-dot" /><div className="preview-dot" />
              </div>
              <span className="preview-title">crimegraph-ai · investigator-console · network-graph</span>
              <div className="badge badge-live" style={{ marginLeft: 'auto' }}>
                <span className="dot dot-live" /> 24 entities · 3 clusters
              </div>
            </div>
            <div className="preview-body">
              <svg id="hero-graph" />
            </div>
          </div>
        </section>

        <section className="features" id="features">
          <div className="section-label">Core Capabilities</div>
          <h2 className="section-title">Everything Investigators Need</h2>
          <p className="section-sub">Built on Graph Neural Networks, NLP entity resolution, and real-time multi-source data ingestion.</p>
          <div className="features-grid">
            <FeatureCard icon="🕸️" title="Criminal Network Graph" text="Interactive D3.js force-directed graph surfaces hidden relationships between persons, locations, vehicles, and organisations across multiple FIRs and case diaries." tag="D3.js · Force Layout" />
            <FeatureCard icon="🧠" title="Predictive Association AI" text="GraphSAGE graph neural network predicts emerging criminal associations with explainable evidence paths — every lead comes with a court-admissible rationale." tag="GraphSAGE · NetworkX" />
            <FeatureCard icon="💥" title="Network Disruption Simulator" text="Simulate the removal of key nodes and instantly see how the criminal network fragments. Identify which targets maximally reduce network cohesion." tag="Centrality Analysis" />
            <FeatureCard icon="📡" title="Multi-Source Data Fusion" text="Ingests FIRs, CCTNS records, CDRs, financial transactions, and open-source intelligence into one unified knowledge graph via Apache Kafka pipelines." tag="Kafka · Neo4j" />
            <FeatureCard icon="🔍" title="NLP Entity Resolution" text="spaCy / BERT-based extraction resolves aliases, cross-case person references, and disambiguates locations and organisations from unstructured case text." tag="spaCy · BERT" />
            <FeatureCard icon="📁" title="Digital Case File Ingestion" text="Upload digital copies of FIRs, case diaries, or interrogation transcripts. The system automatically OCR-scans, resolves suspects and shell fronts, and maps cross-jurisdictional syndicate paths." tag="OCR · Automated Ingestion" />
            <FeatureCard icon="📄" title="Forensic Report Generation" text="Auto-generates structured forensic reports per entity or per case — including risk scores, evidence chains, associate maps, and analyst-validated leads for prosecution." tag="Evidence-Backed" />
          </div>
        </section>

        <section className="how-it-works" id="how">
          <div className="section-label">Methodology</div>
          <h2 className="section-title">How CrimeGraph AI Works</h2>
          <p className="section-sub" style={{ marginBottom: 40 }}>A modular intelligence pipeline built on top of existing CCTNS infrastructure.</p>
          <div className="steps-grid">
            <StepCard number="1" title="Data Ingestion" text="Aggregates FIRs, CCTNS, CDRs, financial records, and OSINT into a unified knowledge graph via Kafka pipelines." />
            <StepCard number="2" title="Entity Resolution" text="NLP models extract and disambiguate persons, aliases, locations, vehicles, and organisations from unstructured text." />
            <StepCard number="3" title="Graph Analysis" text="Community detection, centrality algorithms, and link prediction reveal hidden connections and gang hierarchies." />
            <StepCard number="4" title="Analyst Validation" text="Mandatory human-in-the-loop before any lead is escalated — every prediction is a lead, not an attribution." />
          </div>
        </section>

        <section className="features" id="tech" style={{ paddingTop: 60 }}>
          <div className="section-label">Technology Stack</div>
          <h2 className="section-title">Built on Proven Open Infrastructure</h2>
          <p className="section-sub">Runs on existing CCTNS infrastructure at 14,000+ police stations — no new hardware required.</p>
          <div className="features-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
            <TechCard emoji="🗄️" title="Neo4j Graph DB" text="Native graph storage for criminal network data" />
            <TechCard emoji="🐍" title="Python + NetworkX" text="Graph algorithms, centrality, community detection" />
            <TechCard emoji="⚡" title="Apache Kafka" text="Real-time multi-source data ingestion pipeline" />
            <TechCard emoji="🔐" title="OAuth2 + RBAC" text="Role-based secure access with full audit trail" />
            <TechCard emoji="📊" title="D3.js Visualisation" text="Interactive force-directed criminal network graphs" />
            <TechCard emoji="🤖" title="GraphSAGE GNN" text="Graph neural network for link prediction & forecasting" />
          </div>
        </section>

        <section className="cta-section">
          <h2>Ready to Map the Network?</h2>
          <p>Access the live investigator console with 24 sample entities across 3 criminal clusters.</p>
          <button className="btn btn-lg" onClick={() => setLoginOpen(true)}>Launch Investigator Console →</button>
          <div style={{ marginTop: 20, fontSize: 12.5, color: 'var(--text-muted)' }}>Sample dataset only. No real criminal records are stored or processed.</div>
        </section>

        <footer className="landing-footer">
          <div className="footer-brand">
            <div className="mark" style={{ width: 22, height: 22, borderRadius: 6, background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff' }}>CG</div>
            CrimeGraph AI · CyberCrew
          </div>
          <div className="footer-links">
            <a className="footer-link" href="#">CCTNS Reference</a>
            <a className="footer-link" href="#">Research Papers</a>
            <a className="footer-link" href="#">MHA Guidelines</a>
            <a className="footer-link" href="#">Privacy Policy</a>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Enterprise Intelligence Platform · Theme: Blockchain & Cybersecurity</div>
        </footer>

        {loginOpen && (
          <div className="modal-overlay show" id="modal-overlay" onClick={(e) => e.target === e.currentTarget && setLoginOpen(false)}>
            <div className="modal">
              <div className="modal-logo">
                <div className="mark" style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff' }}>CG</div>
                <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Outfit,sans-serif' }}>CrimeGraph AI</span>
              </div>
              <h2>Investigator Login</h2>
              <p className="modal-sub">Authorised personnel only · Role-based access enforced</p>
              <div className="form-group">
                <label className="form-label">Badge / Employee ID</label>
                <input className="field" type="text" id="login-id" value={loginId} onChange={(e) => setLoginId(e.target.value)} placeholder="MH-CYB-2024-001" />
              </div>
              <div className="form-group" style={{ marginBottom: 8 }}>
                <label className="form-label">Passphrase</label>
                <input className="field" type="password" id="login-pass" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} placeholder="••••••••" />
              </div>
              <button className="btn w-full" style={{ marginTop: 16, padding: 11 }} id="do-login-btn" onClick={handleLogin}>Access Console →</button>
              <p className="form-hint">
                Demo accounts (all use <span className="cred-chip">crimegraph</span>):<br />
                <span className="cred-chip">MH-CYB-2024-001</span> Investigator · <span className="cred-chip">ANALYST-2024-001</span> Analyst · <span className="cred-chip">ADMIN-2024-001</span> Administrator<br />
                <span style={{ color: 'var(--text-muted)' }}>Demo credentials only. Production access requires server-side identity verification and authorization.</span>
              </p>
            </div>
          </div>
        )}
      </div>
      <div id="toast" />
    </>
  );
}

function FeatureCard({ icon, title, text, tag }) {
  return (
    <div className="feature-card">
      <div className="feature-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      <span className="feature-tag">{tag}</span>
    </div>
  );
}

function StepCard({ number, title, text }) {
  return (
    <div className="step">
      <div className="step-num">{number}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function TechCard({ emoji, title, text }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '22px 16px' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>{emoji}</div>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{text}</div>
    </div>
  );
}

function DashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = getAuthSession();
  const [selectedNode, setSelectedNode] = useState(null);
  const [activeTab, setActiveTab] = useState('graph');
  const [searchValue, setSearchValue] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [riskValue, setRiskValue] = useState(0);
  const [selectedCluster, setSelectedCluster] = useState('all');
  const [selectedGraphCase, setSelectedGraphCase] = useState('all');
  const [entityTypes, setEntityTypes] = useState(['person', 'location', 'vehicle', 'org']);
  const [appliedFilters, setAppliedFilters] = useState({ types: ['person', 'location', 'vehicle', 'org'], risk: 0, cluster: 'all' });
  const graphRef = useRef({});
  const searchResults = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (query.length < 2) return [];
    return nodes.filter((node) => [node.id, node.alias, node.type, entityTypeLabel(node.type), node.jurisdiction]
      .some((value) => value && value.toLowerCase().includes(query)))
      .slice(0, 6);
  }, [searchValue]);

  const focusEntity = (entity) => {
    setSelectedGraphCase('all');
    setSelectedCluster('all');
    setEntityTypes(['person', 'location', 'vehicle', 'org']);
    setAppliedFilters({ types: ['person', 'location', 'vehicle', 'org'], risk: 0, cluster: 'all' });
    setSelectedNode(entity);
    setSearchValue(entity.id);
    setSearchOpen(false);
  };

  useEffect(() => {
    if (!getAuthSession()) {
      navigate('/');
    }
  }, [navigate]);

  useEffect(() => {
    const graphWrap = document.getElementById('graph-wrap');
    const svg = document.getElementById('graph');
    if (!graphWrap || !svg) return;

    try {
      const d3svg = d3.select(svg);
      d3svg.selectAll('*').remove();
      const bounds = graphWrap.getBoundingClientRect();
      let width = Math.max(bounds.width, 320);
      let height = Math.max(bounds.height, 360);
      d3svg.attr('viewBox', `0 0 ${width} ${height}`).attr('preserveAspectRatio', 'xMidYMid meet');
      const container = d3svg.append('g');

      const zoom = d3.zoom().scaleExtent([0.3, 4]).on('zoom', (event) => {
        container.attr('transform', event.transform);
      });
      d3svg.call(zoom);

      const graphCase = cases.find((item) => item.id === selectedGraphCase);
      const caseNodeIds = graphCase ? new Set(graphCase.suspects) : null;
      const sourceNodes = caseNodeIds ? nodes.filter((node) => caseNodeIds.has(node.id)) : nodes;
      const sourceLinks = caseNodeIds
        ? links.filter((link) => caseNodeIds.has(link.source) && caseNodeIds.has(link.target))
        : links;
      const cloneLinks = sourceLinks.map((l) => ({ ...l }));
      const cloneNodes = sourceNodes.map((n) => ({ ...n }));
      const simulation = d3.forceSimulation(cloneNodes)
        .force('link', d3.forceLink(cloneLinks).id((d) => d.id).distance(graphCase ? 58 : 72).strength(0.35))
        .force('charge', d3.forceManyBody().strength(graphCase ? -150 : -200))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius((d) => 18 + d.associates).iterations(2));

      const linkSel = container.append('g').selectAll('line').data(cloneLinks).join('line')
        .attr('stroke-width', (d) => (d.weak ? 1 : 1.7))
        .attr('stroke', (d) => (d.weak ? '#37415c' : '#2a3a54'))
        .attr('stroke-dasharray', (d) => (d.weak ? '3 4' : null));

      const nodeSel = container.append('g').selectAll('g').data(cloneNodes).join('g').attr('class', 'node')
        .call(d3.drag()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.25).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }));

      nodeSel.append('circle')
        .attr('r', (d) => 7 + d.associates * 0.9)
        .attr('fill', (d) => riskColor(d.risk));

      nodeSel.append('text')
        .attr('dy', (d) => -(11 + d.associates * 0.9))
        .attr('text-anchor', 'middle')
        .style('font-size', '10px')
        .style('fill', '#dfe7f9')
        .text((d) => d.id);

      const updateGraph = () => {
        linkSel
          .attr('x1', (d) => d.source.x)
          .attr('y1', (d) => d.source.y)
          .attr('x2', (d) => d.target.x)
          .attr('y2', (d) => d.target.y);

        nodeSel.attr('transform', (d) => `translate(${d.x},${d.y})`);
      };
      const fitGraph = () => {
        const minX = d3.min(cloneNodes, (node) => node.x - 18 - node.associates);
        const maxX = d3.max(cloneNodes, (node) => node.x + 18 + node.associates);
        const minY = d3.min(cloneNodes, (node) => node.y - 18 - node.associates);
        const maxY = d3.max(cloneNodes, (node) => node.y + 18 + node.associates);
        const graphWidth = Math.max(maxX - minX, 1);
        const graphHeight = Math.max(maxY - minY, 1);
        const topClearance = 72;
        const bottomClearance = 28;
        const scale = Math.max(0.3, Math.min(1.5, (width - 40) / graphWidth, (height - topClearance - bottomClearance) / graphHeight));
        const graphCenterX = (minX + maxX) / 2;
        const graphCenterY = (minY + maxY) / 2;
        const targetCenterY = (topClearance + height - bottomClearance) / 2;
        const transform = d3.zoomIdentity
          .translate(width / 2 - graphCenterX * scale, targetCenterY - graphCenterY * scale)
          .scale(scale);
        d3svg.call(zoom.transform, transform);
      };
      simulation.tick(120);
      updateGraph();
      fitGraph();
      simulation.on('tick', updateGraph);

      nodeSel.on('click', (event, d) => {
        event.stopPropagation();
        setSelectedNode(d);
      });
      d3svg.on('click', () => setSelectedNode(null));
      const resizeObserver = new ResizeObserver(([entry]) => {
        width = Math.max(entry.contentRect.width, 320);
        height = Math.max(entry.contentRect.height, 360);
        d3svg.attr('viewBox', `0 0 ${width} ${height}`);
        simulation.force('center', d3.forceCenter(width / 2, height / 2)).alpha(0.25);
        simulation.tick(24);
        updateGraph();
        fitGraph();
        simulation.restart();
      });
      resizeObserver.observe(graphWrap);
      graphRef.current = { d3svg, nodeSel, linkSel, simulation, zoom, resizeObserver, fitGraph };
    } catch (error) {
      console.error('Dashboard graph failed to render:', error);
      showToast('The network graph could not be rendered. Please refresh the page.', 'error');
    }

    return () => {
      graphRef.current.resizeObserver?.disconnect();
      graphRef.current.simulation?.stop();
      graphRef.current.d3svg?.on('.zoom', null).on('click', null);
      graphRef.current = {};
    };
  }, [location.pathname, activeTab, selectedGraphCase]);

  useEffect(() => {
    const { nodeSel, linkSel } = graphRef.current;
    if (!nodeSel || !linkSel) return;

    const graphCase = cases.find((item) => item.id === selectedGraphCase);
    const caseNodeIds = graphCase ? new Set(graphCase.suspects) : null;
    const visible = (node) => (!caseNodeIds || caseNodeIds.has(node.id))
      && appliedFilters.types.includes(node.type)
      && node.risk >= Number(appliedFilters.risk)
      && (appliedFilters.cluster === 'all' || node.cluster === Number(appliedFilters.cluster));

    nodeSel.style('display', (node) => visible(node) ? null : 'none');
    linkSel.style('display', (link) => visible(link.source) && visible(link.target) ? null : 'none');

    const focusNode = selectedNode;

    if (focusNode) {
      const neighborhood = new Set([focusNode.id]);
      links.forEach((link) => {
        if (link.source === focusNode.id) neighborhood.add(link.target);
        if (link.target === focusNode.id) neighborhood.add(link.source);
      });
      nodeSel.classed('selected', (node) => node.id === focusNode.id)
        .classed('dim', (node) => !neighborhood.has(node.id));
      linkSel.style('opacity', (link) => neighborhood.has(link.source.id || link.source) && neighborhood.has(link.target.id || link.target) ? 1 : 0.05);
    } else {
      nodeSel.classed('selected', false).classed('dim', false);
      linkSel.style('opacity', 1);
    }

    const visibleNodes = nodes.filter(visible);
    const summary = document.querySelector('#graph-wrap .graph-stats .stat-pill b');
    if (summary) summary.textContent = String(visibleNodes.length);
    if (selectedNode && !visible(selectedNode)) setSelectedNode(null);
  }, [activeTab, appliedFilters, selectedGraphCase, selectedNode]);

  const selectedEntity = useMemo(() => selectedNode ?? null, [selectedNode]);
  const selectedConnections = selectedEntity
    ? links.flatMap((link) => {
      const connectedId = link.source === selectedEntity.id
        ? link.target
        : link.target === selectedEntity.id ? link.source : null;
      const connectedEntity = connectedId && nodes.find((node) => node.id === connectedId);
      return connectedEntity ? [{ entity: connectedEntity, weak: link.weak }] : [];
    })
    : [];

  const submitEntitySearch = (event) => {
    event.preventDefault();
    if (searchResults.length === 0) {
      showToast('No matching person, company, vehicle, or location found', 'error');
      return;
    }
    const query = searchValue.trim().toLowerCase();
    const exactMatch = nodes.find((node) => node.id.toLowerCase() === query || node.alias.toLowerCase() === query);
    if (exactMatch) {
      focusEntity(exactMatch);
      return;
    }
    if (searchResults.length === 1) {
      focusEntity(searchResults[0]);
      return;
    }
    showToast('Choose an entity from the search results', 'info');
  };

  const graphCase = cases.find((item) => item.id === selectedGraphCase);
  const visibleGraphNodes = nodes.filter((node) => (!graphCase || graphCase.suspects.includes(node.id))
    && appliedFilters.types.includes(node.type)
    && node.risk >= Number(appliedFilters.risk)
    && (appliedFilters.cluster === 'all' || node.cluster === Number(appliedFilters.cluster)));
  const visibleGraphNodeIds = new Set(visibleGraphNodes.map((node) => node.id));
  const summaryCards = [
    { label: 'Entities', value: visibleGraphNodes.length },
    { label: 'Connections', value: links.filter((link) => visibleGraphNodeIds.has(link.source) && visibleGraphNodeIds.has(link.target)).length },
    { label: 'Clusters', value: new Set(visibleGraphNodes.map((node) => node.cluster)).size },
  ];

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="mark">CG</div>
          <div className="brand-text">
            <div className="brand-name">CrimeGraph AI</div>
            <div className="brand-sub">Investigator Console</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section-label">Investigation</div>
          <Link to="/app/dashboard" className={`nav-item active`}><span>Live Console</span></Link>
          <Link to="/app/cases" className="nav-item"><span>Cases</span><span className="nav-badge">6</span></Link>
          {can(session?.role, 'reports.view') && <Link to="/app/reports" className="nav-item"><span>Reports</span></Link>}
          {can(session?.role, 'case.upload') && <button className="nav-item" onClick={() => showToast('Case upload is available in the demo flow', 'ok')}>Upload Case File <span className="nav-badge" style={{ background: 'var(--accent)', color: '#fff' }}>AI</span></button>}
          {can(session?.role, 'system.manage') && <>
            <div className="nav-section-label" style={{ marginTop: 10 }}>System</div>
            <button className="nav-item" onClick={() => showToast('Settings are available in the demo app', 'ok')}>Settings &amp; Diagnostics</button>
          </>}
          {can(session?.role, 'data.ingest') && <button className="nav-item" onClick={() => showToast('Data ingestion is enabled', 'ok')}>Ingest Case Data</button>}
          <button className="nav-item" onClick={() => { sessionStorage.removeItem(AUTH_SESSION_KEY); sessionStorage.removeItem('crimegraph-user'); navigate('/'); }}>Sign Out</button>
        </nav>
      </aside>

      <main className="main">
        <div className="topbar">
          <span className="topbar-title">Live Investigator Console</span>
          <form className="topbar-search entity-search" onSubmit={submitEntitySearch}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input
              value={searchValue}
              onChange={(e) => {
                setSearchValue(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(e) => e.key === 'Escape' && setSearchOpen(false)}
              type="search"
              placeholder="Search person, company, vehicle, location..."
              aria-label="Search people, companies, vehicles, and locations"
              aria-autocomplete="list"
              aria-controls="entity-search-results"
            />
            <button type="submit" className="entity-search-submit" aria-label="Search network">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            </button>
            {searchOpen && searchValue.trim().length >= 2 && (
              <div className="entity-search-results" id="entity-search-results" role="listbox" aria-label="Matching entities">
                {searchResults.length ? searchResults.map((entity) => (
                  <button
                    type="button"
                    className="entity-search-result"
                    key={entity.id}
                    role="option"
                    aria-selected={selectedEntity?.id === entity.id}
                    onClick={() => focusEntity(entity)}
                  >
                    <span className="entity-search-result-main">
                      <strong>{entity.id}</strong>
                      <span>{entity.alias !== '—' ? `Alias: ${entity.alias}` : entity.jurisdiction}</span>
                    </span>
                    <span className="entity-search-result-type">{entityTypeLabel(entity.type)}</span>
                  </button>
                )) : <div className="entity-search-empty">No matching entities</div>}
              </div>
            )}
          </form>
          <div className="topbar-right">
            <div className="badge badge-live" style={{ padding: '5px 10px' }}><span className="dot dot-live" /> Live</div>
            <div className="badge badge-muted">Sample Dataset · 24 Entities</div>
            <div className="badge badge-muted" title={session?.badgeId}>{ROLE_LABELS[session?.role]} · {session?.badgeId}</div>
            {can(session?.role, 'case.upload') && <button className="btn btn-sm" onClick={() => showToast('Upload case file feature is ready', 'ok')}>Upload Case File</button>}
          </div>
        </div>

        <div className="tab-bar">
          <button className={`tab-btn ${activeTab === 'graph' ? 'active' : ''}`} onClick={() => setActiveTab('graph')}>Network Graph</button>
          <button className={`tab-btn ${activeTab === 'predictive' ? 'active' : ''}`} onClick={() => setActiveTab('predictive')}>Predictive Intelligence <span className="pulse" /></button>
        </div>

        {activeTab === 'graph' ? (
          <div className="view active" id="view-graph">
            <div className="toolbar">
              <span>Network Graph View</span>
              <select aria-label="Graph scope" value={selectedGraphCase} onChange={(e) => {
                setSelectedGraphCase(e.target.value);
                setSelectedNode(null);
                setSearchValue('');
              }}>
                <option value="all">Complete Graph · All Cases</option>
                {cases.map((caseItem) => <option value={caseItem.id} key={caseItem.id}>{caseItem.id} · {caseItem.title}</option>)}
              </select>
              <select value={selectedCluster} onChange={(e) => {
                const cluster = e.target.value;
                setSelectedCluster(cluster);
                setAppliedFilters((current) => ({ ...current, cluster }));
              }}>
                <option value="all">All Clusters</option>
                <option value="0">Cluster 0 — Maharashtra</option>
                <option value="1">Cluster 1 — Delhi NCR</option>
                <option value="2">Cluster 2 — Karnataka</option>
              </select>
              <div className="spacer" />
              <button className="btn ghost btn-sm" onClick={() => {
                setSearchValue('');
                setRiskValue(0);
                setSelectedCluster('all');
                setSelectedGraphCase('all');
                setEntityTypes(['person', 'location', 'vehicle', 'org']);
                setAppliedFilters({ types: ['person', 'location', 'vehicle', 'org'], risk: 0, cluster: 'all' });
                setSelectedNode(null);
                const { fitGraph, simulation } = graphRef.current;
                if (fitGraph) fitGraph();
                if (simulation) simulation.alpha(0.5).restart();
              }}>Reset View</button>
              {can(session?.role, 'graph.export') && <button className="btn btn-sm" onClick={() => showToast('Network snapshot exported for the evidence log', 'ok')}>Export as Evidence</button>}
            </div>

            <div className="layout">
              <aside id="filters-panel">
                <div className="panel-head">FILTERS</div>
                <div className="filter-group">
                  <label className="title">Entity Type</label>
                  <div className="chip-row">
                    {[
                      ['person', 'Person'],
                      ['location', 'Location'],
                      ['vehicle', 'Vehicle'],
                      ['org', 'Organisation'],
                    ].map(([type, label]) => (
                      <button
                        type="button"
                        className={`chip ${entityTypes.includes(type) ? 'active' : ''}`}
                        key={type}
                        aria-pressed={entityTypes.includes(type)}
                        onClick={() => setEntityTypes((current) => current.includes(type)
                          ? current.filter((item) => item !== type)
                          : [...current, type])}
                      >{label}</button>
                    ))}
                  </div>
                </div>
                <div className="filter-group">
                  <label className="title">Minimum Risk Score</label>
                  <div className="range-row">
                    <input type="range" min="0" max="100" value={riskValue} onChange={(e) => setRiskValue(e.target.value)} />
                    <span className="range-val">{riskValue}</span>
                  </div>
                </div>
                <div className="filter-group">
                  <label className="title">Date Range</label>
                  <select className="field"><option>Last 90 days</option></select>
                </div>
                <div className="filter-group" style={{ borderBottom: 'none' }}>
                  <button className="btn apply-btn btn-sm" onClick={() => {
                    setAppliedFilters({ types: entityTypes, risk: Number(riskValue), cluster: selectedCluster });
                    setSelectedNode(null);
                    showToast('Graph filters applied', 'ok');
                  }}>Apply Filters</button>
                </div>
              </aside>

              <div id="graph-wrap">
                <div className="graph-stats">
                  {summaryCards.map((card) => (
                    <div className="stat-pill" key={card.label}><b>{card.value}</b>{card.label}</div>
                  ))}
                </div>
                <svg id="graph" />
                <div className="graph-caption">Click node to inspect · Drag to reposition · Scroll to zoom</div>
              </div>

              <aside id="details-panel">
                <div className="panel-head">ENTITY DETAILS</div>
                <div id="details-body">
                  {selectedEntity ? (
                    <div className="entity-card">
                      <div className="entity-top">
                        <div className="avatar" style={{ background: avatarColor(selectedEntity.type) }}>{initials(selectedEntity.id)}</div>
                        <div>
                          <div className="entity-name">{selectedEntity.id}</div>
                          <div className="entity-alias">{selectedEntity.alias !== '—' ? `Alias: "${selectedEntity.alias}"` : entityTypeLabel(selectedEntity.type)}</div>
                        </div>
                      </div>
                      <div className="risk-block">
                        <div className="risk-label"><span>Risk Score</span><span style={{ color: riskColor(selectedEntity.risk), fontWeight: 700 }}>{selectedEntity.risk} / 100</span></div>
                        <div className="risk-bar-wrap"><div className="risk-bar-fill" style={{ width: `${selectedEntity.risk}%`, background: riskColor(selectedEntity.risk) }} /></div>
                      </div>
                      <div className="stat-grid">
                        <div className="stat-box"><div className="n">{selectedEntity.cases}</div><div className="l">Linked Cases</div></div>
                        <div className="stat-box"><div className="n">{selectedEntity.associates}</div><div className="l">Associates</div></div>
                      </div>
                      <div className="kv"><span>Last Activity</span><span>{selectedEntity.lastActivity}</span></div>
                      <div className="kv"><span>Jurisdiction</span><span>{selectedEntity.jurisdiction}</span></div>
                      <div className="kv"><span>Entity Type</span><span>{entityTypeLabel(selectedEntity.type)}</span></div>
                      <div className="kv" style={{ borderBottom: 'none' }}><span>Cluster</span><span>{['Maharashtra', 'Delhi NCR', 'Karnataka'][selectedEntity.cluster]}</span></div>
                      <div className="assoc-list">
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Direct Connections ({selectedConnections.length})</label>
                        {selectedConnections.length ? selectedConnections.map(({ entity, weak }) => (
                          <button
                            type="button"
                            className="assoc-item"
                            key={entity.id}
                            onClick={() => focusEntity(entity)}
                            title={`Show links connected to ${entity.id}`}
                          >
                            <span className="assoc-dot" style={{ background: riskColor(entity.risk) }} />
                            <span className="assoc-entity-name">{entity.id}</span>
                            <span className="badge badge-muted assoc-entity-type">{entityTypeLabel(entity.type)}</span>
                            {weak && <span className="assoc-weak-label">Weak</span>}
                          </button>
                        )) : <div className="entity-search-empty">No direct connections in the sample graph</div>}
                      </div>
                    </div>
                  ) : (
                    <div className="empty-state">
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                      Select a node in the network graph to view case-linked details, risk score, and associate history.
                    </div>
                  )}
                </div>
              </aside>
            </div>
          </div>
        ) : (
          <div className="view active" id="view-predictive">
            <div className="toolbar">
              <span>Predictive Intelligence — Explainable Network Forecasting</span>
              <div className="toolbar-status"><span className="dot dot-live" /> Model: GraphSAGE + NetworkX · Analyst-in-the-loop</div>
              <div className="spacer" />
              {can(session?.role, 'model.recalculate') && <button className="btn ghost btn-sm" onClick={() => showToast('Model recalculated', 'ok')}>Recalculate</button>}
            </div>
            <div className="pred-summary">
              <div className="pred-summary-card"><div className="summary-label">EMERGING SIGNAL</div><div className="summary-value" style={{ color: 'var(--risk-high)' }}>HIGH</div><div className="summary-sub">3 clusters show increasing connectivity</div></div>
              <div className="pred-summary-card"><div className="summary-label">PREDICTED LINKS</div><div className="summary-value">6</div><div className="summary-sub">candidate links above model threshold</div></div>
              <div className="pred-summary-card"><div className="summary-label">MODEL CONFIDENCE</div><div className="summary-value">87%</div><div className="summary-sub">aggregate across active signals</div></div>
              <div className="pred-summary-card"><div className="summary-label">ANALYST REVIEW</div><div className="summary-value">6</div><div className="summary-sub">leads awaiting human validation</div></div>
            </div>
            <div style={{ display: 'flex', minHeight: 0, gap: 18 }}>
              <aside id="predictions-panel" style={{ width: 420 }}>
                <div className="panel-head">PREDICTED ASSOCIATIONS</div>
                <div id="predictions-list">
                  {predictedLinks.map((pred) => (
                    <div className="pred-item" key={`${pred.source}-${pred.target}`}>
                      <div className="pred-pair"><span>{pred.source}</span><span className="arrow">→</span><span>{pred.target}</span><span className="pred-score-badge">{Math.round(pred.score * 100)}%</span></div>
                      <div className="pred-evidence"><strong>Why:</strong> {pred.reasons[0]}</div>
                    </div>
                  ))}
                </div>
              </aside>
              <div id="disruption-wrap" style={{ flex: 1 }}>
                <div className="pred-section-title"><div><b>Network Evolution &amp; Intervention Simulator</b><span>Click a node to simulate removal and measure structural impact.</span></div></div>
                <div className="disrupt-stats">
                  <div className="dstat"><b>100%</b>Network Cohesion</div>
                  <div className="dstat"><b>3</b>Active Fragments</div>
                  <div className="dstat"><b>21</b>Largest Cluster</div>
                  <div className="dstat warn"><b>0</b>Simulated Removed</div>
                </div>
                <div className="forecast-strip">
                  <div className="forecast-title">ACTIVITY TRAJECTORY</div>
                  <div className="forecast-chart">
                    <svg viewBox="0 0 400 110" width="100%" height="100%">
                      <path d={forecastSeries.map((value, index) => `${index === 0 ? 'M' : 'L'} ${index * 28} ${110 - value}`).join(' ')} stroke="#5ea0ff" fill="none" strokeWidth="3" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <div id="toast" />
    </div>
  );
}

function CasesPage() {
  const navigate = useNavigate();
  const session = getAuthSession();
  const [selectedCase, setSelectedCase] = useState(cases[0]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!getAuthSession()) {
      navigate('/');
    }
  }, [navigate]);

  const filteredCases = cases.filter((item) => {
    if (!search) return true;
    return item.title.toLowerCase().includes(search.toLowerCase()) || item.id.toLowerCase().includes(search.toLowerCase()) || item.desc.toLowerCase().includes(search.toLowerCase());
  });

  const openCaseDrawer = (caseItem) => setSelectedCase(caseItem);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-logo"><div className="mark">CG</div><div className="brand-text"><div className="brand-name">CrimeGraph AI</div><div className="brand-sub">Investigator Console</div></div></div>
        <nav className="sidebar-nav">
          <div className="nav-section-label">Investigation</div>
          <Link to="/app/dashboard" className="nav-item"><span>Live Console</span></Link>
          <Link to="/app/cases" className="nav-item active"><span>Cases</span><span className="nav-badge">6</span></Link>
          <Link to="/app/reports" className="nav-item"><span>Reports</span></Link>
          <button className="nav-item" onClick={() => { sessionStorage.removeItem(AUTH_SESSION_KEY); sessionStorage.removeItem('crimegraph-user'); navigate('/'); }}>Sign Out</button>
        </nav>
      </aside>

      <main className="main">
        <div className="topbar">
          <span className="topbar-title">Case Management</span>
          <div className="topbar-search">
            <input value={search} onChange={(e) => setSearch(e.target.value)} type="text" placeholder="Search case or FIR number" />
          </div>
          <div className="topbar-right">
            <div className="badge badge-muted" title={session?.badgeId}>{ROLE_LABELS[session?.role]} · {session?.badgeId}</div>
            {can(session?.role, 'cases.create') && <button className="btn btn-sm" onClick={() => showToast('Manual case creation is available in the demo flow', 'ok')}>+ New Manual Case</button>}
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', gap: 18, padding: 14 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredCases.map((item) => (
              <div className="case-card" key={item.id} onClick={() => openCaseDrawer(item)} style={{ cursor: 'pointer' }}>
                <div className="case-icon">{item.icon}</div>
                <div className="case-meta">
                  <div className="case-fir">{item.id}</div>
                  <div className="case-title">{item.title}</div>
                  <div className="case-desc">{item.desc}</div>
                  <div className="case-tags">
                    <span className="case-tag type-person">{item.jurisdiction}</span>
                    <span className="case-tag type-org">{item.type}</span>
                    <span className="case-tag">{item.entities} entities</span>
                  </div>
                </div>
                <div className="case-right">
                  <div className="case-risk-num" style={{ color: riskColor(item.risk) }}>{item.risk}</div>
                  <div className="case-risk-label">Risk Score</div>
                  <div className="case-date">Updated: {item.lastUpdate}</div>
                </div>
              </div>
            ))}
          </div>

          <aside className="drawer" style={{ width: 380, maxHeight: '80vh', overflowY: 'auto' }}>
            <div className="drawer-header">
              <div style={{ fontSize: 22 }}>{selectedCase.icon}</div>
              <div style={{ minWidth: 0 }}>
                <div className="drawer-title">{selectedCase.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{selectedCase.id} · {selectedCase.jurisdiction}</div>
              </div>
            </div>
            <div className="drawer-body">
              <div className="drawer-section-title">Overview</div>
              <div className="card" style={{ padding: 14 }}>
                <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-dim)' }}>{selectedCase.desc}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 14 }}>
                  <div className="stat-box"><div className="n" style={{ color: riskColor(selectedCase.risk) }}>{selectedCase.risk}</div><div className="l">Risk Score</div></div>
                  <div className="stat-box"><div className="n">{selectedCase.entities}</div><div className="l">Entities</div></div>
                  <div className="stat-box"><div className="n">{selectedCase.linkedCases}</div><div className="l">Linked Cases</div></div>
                </div>
              </div>

              <div className="drawer-section-title">Suspects &amp; Entities ({selectedCase.suspects.length})</div>
              {selectedCase.suspects.map((suspect) => {
                const target = nodes.find((n) => n.id === suspect);
                return (
                  <div key={suspect} className="suspect-row" style={{ cursor: 'pointer' }} onClick={() => navigate('/app/dashboard')}>
                    <div className="suspect-avatar" style={{ background: target ? avatarColor(target.type) : '#37415c' }}>{target ? initials(target.id) : '?'}</div>
                    <div style={{ flex: 1 }}>
                      <div className="suspect-name">{suspect}</div>
                      <div className="suspect-alias">{target ? `${target.type[0].toUpperCase() + target.type.slice(1)} · ${target.jurisdiction}` : 'Case entity'}</div>
                    </div>
                    {target && <span className="suspect-risk" style={{ color: riskColor(target.risk) }}>{target.risk}</span>}
                  </div>
                );
              })}

              <div className="drawer-section-title">Key Findings</div>
              <div className="findings-list">
                {selectedCase.findings.map((finding, index) => (
                  <div className="finding" key={`${selectedCase.id}-finding-${index}`}>
                    <div className="finding-title">🔍 Finding</div>
                    <div className="finding-text">{finding}</div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>
      <div id="toast" />
    </div>
  );
}

function ReportsPage() {
  const navigate = useNavigate();
  const session = getAuthSession();
  const [selectedReportId, setSelectedReportId] = useState(reports[0]?.id ?? null);

  useEffect(() => {
    if (!getAuthSession()) {
      navigate('/');
    }
  }, [navigate]);

  const selectedReport = reports.find((report) => report.id === selectedReportId) ?? reports[0];

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-logo"><div className="mark">CG</div><div className="brand-text"><div className="brand-name">CrimeGraph AI</div><div className="brand-sub">Investigator Console</div></div></div>
        <nav className="sidebar-nav">
          <div className="nav-section-label">Investigation</div>
          <Link to="/app/dashboard" className="nav-item"><span>Live Console</span></Link>
          <Link to="/app/cases" className="nav-item"><span>Cases</span></Link>
          <Link to="/app/reports" className="nav-item active"><span>Reports</span></Link>
          <button className="nav-item" onClick={() => { sessionStorage.removeItem(AUTH_SESSION_KEY); sessionStorage.removeItem('crimegraph-user'); navigate('/'); }}>Sign Out</button>
        </nav>
      </aside>

      <main className="main">
        <div className="topbar">
          <span className="topbar-title">Forensic Reports</span>
          <div className="topbar-search"><input type="text" placeholder="Search reports" /></div>
          <div className="topbar-right">
            <div className="badge badge-muted" title={session?.badgeId}>{ROLE_LABELS[session?.role]} · {session?.badgeId}</div>
            {can(session?.role, 'reports.generate') && <button className="btn btn-sm" onClick={() => showToast('Report generation ready', 'ok')}>+ Generate Report</button>}
          </div>
        </div>

        <div className="reports-layout">
          <div className="reports-list-panel">
            <div className="reports-list-head">
              <h3>Reports</h3>
              <span className="badge badge-muted">{reports.length}</span>
            </div>
            <div className="reports-list">
              {reports.map((report) => (
                <div key={report.id} className={`report-item ${selectedReport?.id === report.id ? 'active' : ''}`} onClick={() => setSelectedReportId(report.id)} style={{ cursor: 'pointer' }}>
                  <div className="report-item-head">
                    <span className="report-icon">{report.status === 'final' ? '📄' : report.status === 'draft' ? '✏️' : '⏳'}</span>
                    <span className="report-id">{report.id}</span>
                  </div>
                  <div className="report-name">{report.name}</div>
                  <div className="report-meta"><span className="report-date">{report.date}</span><span className="report-status">{report.status}</span></div>
                </div>
              ))}
            </div>
          </div>

          <div className="reports-preview">
            {selectedReport && (
              <div className="report-doc">
                <div className="report-doc-header">
                  <div className="report-doc-logo">
                    <div className="mark">CG</div>
                    <div>
                      <div className="title">CrimeGraph AI</div>
                      <div className="sub">Forensic Intelligence Report</div>
                    </div>
                  </div>
                  <div className="report-doc-meta">
                    <div className="report-num">{selectedReport.id}</div>
                    <div className="report-date">{selectedReport.date} · {selectedReport.analyst}</div>
                  </div>
                </div>
                <div className="report-section">
                  <h3>Executive Summary</h3>
                  <p>{selectedReport.name}</p>
                </div>
                <div className="report-section">
                  <h3>Case Linkage</h3>
                  <p>{selectedReport.case || 'Independent intelligence dossier'}</p>
                </div>
                <div className="report-section">
                  <h3>Analyst Recommendation</h3>
                  <div className="recommendations">
                    <div className="rec-item"><div className="rec-num">1</div><div className="rec-text">Validate all associated network leads against source records.</div></div>
                    <div className="rec-item"><div className="rec-num">2</div><div className="rec-text">Ensure evidence chain documentation meets legal admissibility requirements.</div></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <div id="toast" />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/app/dashboard" element={<ProtectedRoute permission="dashboard.view"><DashboardPage /></ProtectedRoute>} />
        <Route path="/app/cases" element={<ProtectedRoute permission="cases.view"><CasesPage /></ProtectedRoute>} />
        <Route path="/app/reports" element={<ProtectedRoute permission="reports.view"><ReportsPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
