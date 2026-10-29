import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import * as d3 from 'd3';
import { cases, forecastSeries, links, nodes, predictedLinks, reports } from './data';

import '../assets/css/global.css';
import '../assets/css/landing.css';
import '../assets/css/dashboard.css';
import '../assets/css/cases.css';
import '../assets/css/reports.css';
import '../assets/css/modules.css';
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

async function extractDocumentText(file, extension) {
  if (extension === 'txt') return { text: await file.text(), note: '' };
  if (extension === 'json') {
    const parsed = JSON.parse(await file.text());
    return { text: JSON.stringify(parsed, null, 2), note: '' };
  }
  if (extension === 'docx') {
    const mammoth = (await import('mammoth/mammoth.browser')).default;
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return { text: result.value.trim(), note: '' };
  }
  if (extension === 'pdf') {
    const [pdfjsLib, worker] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]);
    pdfjsLib.GlobalWorkerOptions.workerSrc = worker.default;
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = [];
    const pageLimit = Math.min(pdf.numPages, 250);
    for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
    }
    const text = pages.join('\n').trim();
    return {
      text,
      note: text ? (pdf.numPages > pageLimit ? `Read first ${pageLimit} of ${pdf.numPages} pages.` : '') : 'No selectable text found. Scanned PDFs require OCR service.',
    };
  }
  return { text: '', note: 'This file type cannot be analyzed in the browser.' };
}

function parseEntityRegister(text) {
  const section = text.match(/(?:^|\r?\n)\s*\d*\.?\s*PERSONS? AND KEY ENTITIES\s*\r?\n([\s\S]*?)(?=\r?\n\s*\d*\.?\s*(?:EVENT TIMELINE|EVIDENCE REGISTER|CASE NARRATIVE)\b|$)/i)?.[1] ?? '';
  const lines = section.split(/\r?\n/);
  return lines.flatMap((line, index) => {
    const match = line.match(/^\s*([A-Z]-\d{2})\s*[—–-]\s*(.+?)\s*$/);
    if (!match) return [];
    const prefix = match[1][0];
    const type = ({ P: 'person', A: 'service account', D: 'device', F: 'digital file', L: 'location', S: 'system', V: 'vehicle', C: 'company', O: 'company' })[prefix] ?? 'entity';
    const description = lines.slice(index + 1, index + 3).map((part) => part.trim()).filter((part) => part && !/^(?:ROLE OR DESCRIPTION|CURRENT STATUS)$/i.test(part)).join(' · ');
    return [{ reference: match[1], name: match[2].trim(), type, description }];
  });
}

function analyzeCaseDocuments(documents) {
  const text = documents.map((document) => document.text).filter(Boolean).join('\n\n');
  const normalizedText = text.toLowerCase();
  const registeredEntities = parseEntityRegister(text);
  const matchedEntities = nodes.filter((entity) => {
    const names = [entity.id, entity.alias].filter((value) => value && value !== '—' && value.length > 2);
    return names.some((name) => normalizedText.includes(name.toLowerCase()));
  });
  const matchedIds = new Set(matchedEntities.map((entity) => entity.id));
  const knownLinks = links.flatMap((link) => {
    const matchedSource = matchedIds.has(link.source);
    const matchedTarget = matchedIds.has(link.target);
    if (!matchedSource && !matchedTarget) return [];
    const source = nodes.find((entity) => entity.id === link.source);
    const target = nodes.find((entity) => entity.id === link.target);
    return source && target ? [{ source, target, weak: link.weak }] : [];
  });
  const firNumbers = [...new Set(text.match(/\b(?:[A-Z]{2,3}[-/]\d{4}[-/]\d+|DEMO-\d{4}-\d+)\b/gi) || [])];
  const vehicles = [...new Set(text.match(/\b(?:AN|AP|AR|AS|BR|CH|CG|DD|DL|DN|GA|GJ|HR|HP|JK|JH|KA|KL|LA|LD|MH|ML|MN|MP|MZ|NL|OD|PB|PY|RJ|SK|TN|TS|TR|UP|UK|WB)[ -]?\d{1,2}[ -]?[A-Z]{1,3}[ -]?\d{1,4}\b/gi) || [])];
  const legalSections = [...new Set(text.match(/\b(?:(?:BNS|BNSS|IPC|CrPC|PMLA)(?:\s+Act)?|NDPS\s+Act|IT\s+Act(?:\s+2000)?|Customs\s+Act(?:\s+1962)?)\s*(?:(?:Section|Sec\.?)\s*)?\d+[A-Z]?(?:\([^)]+\))?/gi) || [])];
  const locations = [...new Set(text.match(/\b(?:[A-Z][a-z]+(?:[ \t]+[A-Z][a-z]+){0,3}[ \t]+)?(?:Warehouse|Vault|Berth|Depot|Port|Server Farm|Safehouse|Transit Hub|Sector|Street|Road|Anchorage)[ \t]+[A-Z0-9][A-Za-z0-9.'-]*(?:[ \t]+[A-Z0-9][A-Za-z0-9.'-]*){0,3}\b/g) || [])];
  const namedPersons = new Set(registeredEntities.filter((entity) => entity.type === 'person').map((entity) => entity.name));
  const personSection = /(?:ACCUSED(?:\s*\/\s*PERSONS OF INTEREST)?|PERSONS OF INTEREST|SUSPECTS?|POI)\s*:?\s*([\s\S]{0,700}?)(?=\r?\n[ \t]*(?:CORPORATE|ORGANIZATIONS?|ORGANISATIONS?|VEHICLES?|LOGISTICS|CASE NARRATIVE|EVIDENCE|FIR NUMBER)\b|$)/gi;
  for (const match of text.matchAll(personSection)) {
    for (const person of match[1].matchAll(/(?:^|\r?\n)[ \t]*(?:\d+[.)][ \t]*)?([A-Z][a-z]+(?:[-'][A-Z][a-z]+)?(?:[ \t]+[A-Z](?:[a-z]+)?\.?){1,2})(?=[ \t]*[,(:;]|[ \t]*$)/gm)) {
      namedPersons.add(person[1].trim());
    }
  }
  const organizations = [...new Set(text.match(/\b[A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z][A-Za-z0-9&.'-]*){0,5}\s+(?:Private Limited|Pvt\.?\s+Ltd\.?|Limited|Ltd\.?|Logistics|Traders|Solutions|Enterprises|Corporation)\b/g) || [])];
  registeredEntities.forEach((entity) => {
    if (entity.type === 'company' && !organizations.includes(entity.name)) organizations.push(entity.name);
    if (entity.type === 'vehicle' && !vehicles.includes(entity.name)) vehicles.push(entity.name);
    if (entity.type === 'location' && !locations.includes(entity.name)) locations.push(entity.name);
  });
  const caseMatches = cases.filter((caseItem) => firNumbers.some((fir) => fir.toLowerCase() === caseItem.id.toLowerCase())
    || caseItem.suspects.some((suspect) => matchedIds.has(suspect)));
  const relatedPredictions = predictedLinks.filter((prediction) => matchedIds.has(prediction.source) || matchedIds.has(prediction.target));
  const caseTitle = text.match(/CASE FILE[^\r\n]*\r?\n+([^\r\n]+)/i)?.[1]?.trim() ?? '';
  const syntheticNotice = text.match(/SYNTHETIC[^\r\n]*(?:\r?\n|$)/i)?.[0]?.trim() ?? '';

  return {
    analyzedAt: new Date().toISOString(),
    files: documents.map(({ name, extension }) => ({ name, extension })),
    caseTitle,
    textCharacters: text.length,
    firNumbers,
    legalSections,
    extractedPersons: [...namedPersons],
    extractedOrganizations: organizations,
    extractedVehicles: vehicles,
    extractedLocations: locations,
    registeredEntities,
    matchedEntities,
    knownLinks,
    relatedCases: caseMatches,
    relatedPredictions,
    syntheticNotice,
    warnings: documents.filter((document) => document.note).map((document) => `${document.name}: ${document.note}`),
  };
}
const AUTH_SESSION_KEY = 'crimegraph-session';
const GRAPH_INGESTIONS_KEY = 'crimegraph-local-graph-ingestions-v1';
const LOCAL_CASES_KEY = 'crimegraph-local-cases-v1';
const LOCAL_REPORTS_KEY = 'crimegraph-local-reports-v1';
const PREDICTION_REVIEWS_KEY = 'crimegraph-prediction-reviews-v1';
const ROLE_LABELS = { investigator: 'Investigator', analyst: 'Analyst', administrator: 'Administrator' };
const DEMO_USERS = {
  'MH-CYB-2024-001': { role: 'investigator', passphrase: 'crimegraph' },
  'ANALYST-2024-001': { role: 'analyst', passphrase: 'crimegraph' },
  'ADMIN-2024-001': { role: 'administrator', passphrase: 'crimegraph' },
};
const ROLE_PERMISSIONS = {
  investigator: ['dashboard.view', 'cases.view', 'reports.view', 'graph.export', 'case.upload', 'cases.create'],
  analyst: ['dashboard.view', 'cases.view', 'reports.view', 'graph.export', 'reports.generate', 'model.recalculate', 'prediction.review'],
  administrator: ['dashboard.view', 'cases.view', 'reports.view', 'graph.export', 'case.upload', 'cases.create', 'reports.generate', 'system.manage', 'data.ingest', 'model.recalculate', 'prediction.review'],
};

function loadGraphIngestions() {
  try {
    const stored = JSON.parse(localStorage.getItem(GRAPH_INGESTIONS_KEY) || '[]');
    return Array.isArray(stored) ? stored.filter((entry) => Array.isArray(entry.nodes) && Array.isArray(entry.links)) : [];
  } catch (error) {
    console.error('Unable to read locally ingested graph data:', error);
    return [];
  }
}

function loadLocalRecords(key) {
  try {
    const stored = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch (error) {
    console.error(`Unable to read local records for ${key}:`, error);
    return [];
  }
}

function saveLocalRecords(key, records) {
  localStorage.setItem(key, JSON.stringify(records));
}

const CASE_OVERRIDES_KEY = 'crimegraph-case-overrides-v1';
const CASE_STATUSES = ['Open', 'Active', 'Under Review', 'Solved', 'Closed'];
const DELETABLE_STATUSES = ['Solved', 'Closed'];

function loadCaseOverrides() {
  try {
    const stored = JSON.parse(localStorage.getItem(CASE_OVERRIDES_KEY) || '{}');
    return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
  } catch (error) {
    console.error('Unable to read case updates:', error);
    return {};
  }
}

const LEAD_SOURCES = ['Informant', 'Witness statement', 'CCTV / surveillance', 'Call records (CDR)', 'Field observation', 'Other'];
const LEAD_RELIABILITY = ['Unverified', 'Probable', 'Confirmed'];

function applyCaseOverride(item, update) {
  if (!update) return item;
  return {
    ...item,
    status: update.status ?? item.status,
    suspects: [...new Set([...item.suspects, ...(update.suspects ?? [])])],
    timeline: [...(update.notes ?? []), ...(item.timeline ?? [])],
    leads: [...(update.leads ?? []), ...(item.leads ?? [])],
    lastUpdate: update.updatedAt ? 'Edited locally' : item.lastUpdate,
  };
}

function getAllEntities() {
  const seen = new Map();
  [...nodes, ...loadGraphIngestions().flatMap((ingestion) => ingestion.nodes)].forEach((node) => {
    if (!seen.has(node.id.toLowerCase())) seen.set(node.id.toLowerCase(), node);
  });
  return [...seen.values()];
}

function getAllLinks() {
  return [...links, ...loadGraphIngestions().flatMap((ingestion) => ingestion.links)];
}

function downloadFile(filename, mime, content) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Neutralises spreadsheet formula injection and quotes every cell.
const csvCell = (value) => {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};

// ---- Predictive intelligence: transparent structural evidence for each lead ----
function buildAdjacency(graphNodes, graphLinks) {
  const adjacency = new Map(graphNodes.map((node) => [node.id, new Map()]));
  graphLinks.forEach((link) => {
    const source = typeof link.source === 'object' ? link.source.id : link.source;
    const target = typeof link.target === 'object' ? link.target.id : link.target;
    if (!adjacency.has(source) || !adjacency.has(target)) return;
    adjacency.get(source).set(target, Boolean(link.weak));
    adjacency.get(target).set(source, Boolean(link.weak));
  });
  return adjacency;
}

function shortestPath(adjacency, from, to) {
  if (!adjacency.has(from) || !adjacency.has(to)) return null;
  const previous = new Map([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const current = queue.shift();
    if (current === to) {
      const path = [];
      for (let step = to; step !== null; step = previous.get(step)) path.unshift(step);
      return path;
    }
    for (const next of adjacency.get(current).keys()) {
      if (!previous.has(next)) {
        previous.set(next, current);
        queue.push(next);
      }
    }
  }
  return null;
}

const leadTier = (score) => (score >= 0.85 ? 'High' : score >= 0.75 ? 'Medium' : 'Low');

function enrichLeads(leads, adjacency) {
  return leads.map((lead) => {
    const a = adjacency.get(lead.source) ?? new Map();
    const b = adjacency.get(lead.target) ?? new Map();
    const common = [...a.keys()].filter((id) => b.has(id));
    const union = new Set([...a.keys(), ...b.keys()]);
    const jaccard = union.size ? common.length / union.size : 0;
    const path = shortestPath(adjacency, lead.source, lead.target);
    return { ...lead, common, jaccard, path, hops: path ? path.length - 1 : null, tier: leadTier(lead.score) };
  });
}

// ---- Predictive intelligence: suggested risk + questioning priority for a lead ----
function activityDays(text = '') {
  if (/today/i.test(text)) return 0;
  const match = text.match(/(\d+)\s*day/i);
  return match ? Number(match[1]) : null;
}
const recencyScore = (text) => {
  const days = activityDays(text);
  return days == null ? 40 : Math.max(0, 100 - days * 4);
};

function assessLead(lead, entities, adjacency) {
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  const ends = [byId.get(lead.source), byId.get(lead.target)].filter(Boolean);
  const knownRisks = ends.map((entity) => entity.risk).filter((risk) => risk != null);
  const average = (values) => (values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0);

  const components = [
    { label: 'Model score', value: Math.round(lead.score * 100), weight: 0.4 },
    { label: 'Entity risk (average)', value: Math.round(knownRisks.length ? average(knownRisks) : lead.score * 100), weight: 0.3 },
    { label: 'Graph proximity', value: lead.hops == null ? 20 : lead.hops <= 2 ? 100 : lead.hops === 3 ? 70 : lead.hops === 4 ? 45 : 25, weight: 0.15 },
    { label: 'Recent activity', value: Math.round(average(ends.map((entity) => recencyScore(entity.lastActivity)))), weight: 0.15 },
  ];
  const linkRisk = Math.round(components.reduce((total, part) => total + part.value * part.weight, 0));
  const level = linkRisk >= 75 ? 'High' : linkRisk >= 55 ? 'Elevated' : 'Low';

  const involved = [...new Set([lead.source, lead.target, ...lead.common, ...(lead.path ?? [])])];
  const endpointIds = new Set([lead.source, lead.target]);
  const people = involved.map((id) => byId.get(id)).filter((entity) => entity?.type === 'person');
  const questionOrder = people.map((entity) => {
    const neighbours = [...(adjacency.get(entity.id)?.keys() ?? [])].map((id) => byId.get(id)).filter(Boolean);
    const crossCluster = neighbours.some((other) => other.cluster != null && entity.cluster != null && other.cluster !== entity.cluster);
    const connector = !endpointIds.has(entity.id);
    const roleScore = connector ? 100 : crossCluster ? 80 : 60;
    const risk = entity.risk ?? 50;
    const recency = recencyScore(entity.lastActivity);
    const score = Math.round(
      risk * 0.35
      + (Math.min(entity.cases || 0, 7) / 7) * 100 * 0.15
      + (Math.min(entity.associates || 0, 11) / 11) * 100 * 0.15
      + recency * 0.2
      + roleScore * 0.15,
    );
    const reasons = [];
    if (connector) reasons.push('Connector between both entities');
    else if (crossCluster) reasons.push('Bridges clusters');
    if (entity.risk == null) reasons.push('Risk unassessed');
    else if (entity.risk > 70) reasons.push(`High risk (${entity.risk})`);
    if ((activityDays(entity.lastActivity) ?? 99) <= 3) reasons.push(`Active ${entity.lastActivity.toLowerCase()}`);
    if ((entity.cases || 0) >= 4) reasons.push(`${entity.cases} linked cases`);
    if ((entity.associates || 0) >= 7) reasons.push(`${entity.associates} associates`);
    return { entity, score, reasons: reasons.length ? reasons : ['Lower relative priority'] };
  }).sort((a, b) => b.score - a.score || (b.entity.risk ?? 0) - (a.entity.risk ?? 0));

  const recordsToVerify = involved.map((id) => byId.get(id)).filter((entity) => entity && !['person', 'document'].includes(entity.type));
  return { linkRisk, level, components, questionOrder, recordsToVerify };
}

// ---- Reports: build real content from case / entity / graph data ----
function buildReportContent(report, { caseList, entities, graphLinks, reviews }) {
  const caseItem = caseList.find((item) => item.id === report.case);
  const entity = entities.find((item) => item.id === report.entityId);
  const adjacency = buildAdjacency(entities, graphLinks);
  const leads = enrichLeads(predictedLinks, adjacency).map((lead) => ({
    ...lead,
    status: reviews[`${lead.source}->${lead.target}`] || lead.status,
  }));
  const scopeIds = new Set([...(caseItem?.suspects ?? []), ...(entity ? [entity.id] : [])]);
  const relatedLeads = scopeIds.size
    ? leads.filter((lead) => scopeIds.has(lead.source) || scopeIds.has(lead.target))
    : [...leads].sort((x, y) => y.score - x.score).slice(0, 3);

  const sections = [];
  const summary = [];
  if (caseItem) {
    summary.push(`${caseItem.title} (${caseItem.id}) is a ${caseItem.type} matter in ${caseItem.jurisdiction}, currently ${caseItem.status}. ${caseItem.desc}`);
  }
  if (entity) {
    summary.push(`${entity.id}${entity.alias && entity.alias !== '—' ? ` (alias "${entity.alias}")` : ''} is a ${entityTypeLabel(entity.type).toLowerCase()} in ${entity.jurisdiction}, risk ${entity.risk ?? 'unassessed'}${entity.risk != null ? '/100' : ''}, linked to ${entity.cases || 0} case(s). Last activity: ${entity.lastActivity}.`);
  }
  if (!caseItem && !entity) {
    const highRisk = entities.filter((item) => (item.risk ?? 0) > 70).length;
    const first = forecastSeries[0];
    const last = forecastSeries[forecastSeries.length - 1];
    summary.push(`Network-wide view of ${entities.length} entities and ${graphLinks.length} links; ${highRisk} entities score above 70. The sample activity index moves from ${first} to ${last} (${Math.round(((last - first) / first) * 100)}%) across the ${forecastSeries.length}-point series.`);
  }
  sections.push({ title: 'Executive Summary', paragraphs: summary.length ? summary : [report.name] });

  if (caseItem) {
    sections.push({
      title: 'Suspects & Entities',
      table: {
        head: ['Entity', 'Type', 'Jurisdiction', 'Risk'],
        rows: caseItem.suspects.map((id) => {
          const match = entities.find((item) => item.id === id);
          return [id, match ? entityTypeLabel(match.type) : 'Case entity', match?.jurisdiction ?? '—', match?.risk ?? '—'];
        }),
      },
    });
    if (caseItem.findings?.length) sections.push({ title: 'Key Findings', bullets: caseItem.findings });
    if (caseItem.leads?.length) {
      sections.push({
        title: 'Field Lead Information (unverified unless marked)',
        table: {
          head: ['Date', 'Source', 'Reliability', 'Information', 'Linked entities'],
          rows: caseItem.leads.map((lead) => [lead.date, lead.source, lead.reliability, lead.text, lead.entities?.join(', ') || '—']),
        },
      });
    }
    if (caseItem.timeline?.length) {
      sections.push({ title: 'Case Timeline', bullets: caseItem.timeline.map((entry) => `${entry.date} — ${entry.text}`) });
    }
  }

  if (entity) {
    const connections = [...(adjacency.get(entity.id) ?? new Map()).entries()];
    sections.push({
      title: 'Subject Profile',
      table: {
        head: ['Attribute', 'Value'],
        rows: [
          ['Entity type', entityTypeLabel(entity.type)],
          ['Jurisdiction', entity.jurisdiction],
          ['Risk score', entity.risk ?? 'Unassessed'],
          ['Linked cases', entity.cases || 0],
          ['Last activity', entity.lastActivity],
        ],
      },
    });
    sections.push({
      title: `Direct Associates (${connections.length})`,
      table: {
        head: ['Associate', 'Type', 'Risk', 'Link strength'],
        rows: connections.map(([id, weak]) => {
          const match = entities.find((item) => item.id === id);
          return [id, match ? entityTypeLabel(match.type) : '—', match?.risk ?? '—', weak ? 'Weak' : 'Strong'];
        }),
      },
    });
  }

  if (relatedLeads.length) {
    sections.push({
      title: 'Predicted Associations (sample model output)',
      table: {
        head: ['Pair', 'Score', 'Evidence path', 'Review'],
        rows: relatedLeads.map((lead) => [
          `${lead.source} ↔ ${lead.target}`,
          `${Math.round(lead.score * 100)}%`,
          lead.path ? lead.path.join(' → ') : 'No existing path',
          lead.status,
        ]),
      },
    });
  }

  const recommendations = [
    ...(caseItem?.recommendations ?? []),
    'Validate every associated lead against source records before operational action.',
    'Document the evidence chain so it can be certified for legal admissibility.',
  ];
  sections.push({ title: 'Analyst Recommendations', numbered: recommendations });
  sections.push({
    title: 'Provenance & Limitations',
    paragraphs: ['Generated from sample and browser-stored data. Predicted associations are leads, not findings. This draft is not a verified forensic or court report and must be reviewed and certified by the investigating officer before any legal use.'],
  });
  return sections;
}

function reportToHtml(report, sections) {
  const body = sections.map((section) => {
    let inner = '';
    if (section.paragraphs) inner += section.paragraphs.map((text) => `<p>${esc(text)}</p>`).join('');
    if (section.bullets) inner += `<ul>${section.bullets.map((text) => `<li>${esc(text)}</li>`).join('')}</ul>`;
    if (section.numbered) inner += `<ol>${section.numbered.map((text) => `<li>${esc(text)}</li>`).join('')}</ol>`;
    if (section.table) {
      inner += `<table><thead><tr>${section.table.head.map((cell) => `<th>${esc(cell)}</th>`).join('')}</tr></thead><tbody>${section.table.rows.map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    }
    return `<h2>${esc(section.title)}</h2>${inner}`;
  }).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(report.id)}</title><style>
body{font-family:Arial,sans-serif;max-width:820px;margin:32px auto;color:#111;line-height:1.5;padding:0 16px}
h1{font-size:22px;margin:0}h2{font-size:15px;border-bottom:1px solid #ccc;padding-bottom:4px;margin-top:24px}
.meta{color:#555;font-size:12px;margin-bottom:12px}table{width:100%;border-collapse:collapse;font-size:12px}
th,td{border:1px solid #ccc;padding:5px 8px;text-align:left}th{background:#f1f3f5}</style></head><body>
<h1>CrimeGraph AI — Forensic Intelligence Report</h1>
<div class="meta">${esc(report.id)} · ${esc(report.name)} · ${esc(report.date)} · ${esc(report.analyst)} · Status: ${esc(report.status)}</div>${body}</body></html>`;
}

function getGraphFragmentation(graphNodes, graphLinks, removedIds = new Set()) {
  const remainingNodes = graphNodes.filter((node) => !removedIds.has(node.id));
  const remainingIds = new Set(remainingNodes.map((node) => node.id));
  const adjacency = new Map(remainingNodes.map((node) => [node.id, []]));
  const remainingLinks = graphLinks.filter((link) => remainingIds.has(link.source) && remainingIds.has(link.target));
  remainingLinks.forEach(({ source, target }) => {
    adjacency.get(source)?.push(target);
    adjacency.get(target)?.push(source);
  });

  const visited = new Set();
  const componentSizes = [];
  remainingNodes.forEach((node) => {
    if (visited.has(node.id)) return;
    const stack = [node.id];
    let size = 0;
    visited.add(node.id);
    while (stack.length) {
      const current = stack.pop();
      size += 1;
      adjacency.get(current)?.forEach((neighbor) => {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          stack.push(neighbor);
        }
      });
    }
    componentSizes.push(size);
  });

  return {
    remainingEntities: remainingNodes.length,
    remainingConnections: remainingLinks.length,
    fragments: componentSizes.length,
    largestFragment: Math.max(0, ...componentSizes),
    retainedLinksPercent: graphLinks.length ? Math.round((remainingLinks.length / graphLinks.length) * 100) : 0,
  };
}

const CLUSTER_NAMES = ['Maharashtra', 'Delhi NCR', 'Karnataka'];

function getClusterName(cluster, ingestions = []) {
  if (cluster == null) return 'Unassigned';
  if (CLUSTER_NAMES[cluster]) return CLUSTER_NAMES[cluster];
  const named = ingestions.flatMap((ingestion) => ingestion.nodes).find((node) => node.cluster === cluster && node.clusterName);
  return named?.clusterName ?? `Cluster ${cluster}`;
}

// Uploaded documents get their own cluster unless one of their entities already exists
// in the graph, in which case everything new joins the existing cluster.
function createGraphIngestion(analysis, priorIngestions = []) {
  const fileNames = analysis.files.map((file) => file.name);
  const sourceCaseId = analysis.firNumbers[0] ?? '';
  const ingestionId = `${sourceCaseId || 'document'}:${fileNames.join('|')}`.toLowerCase();
  const sourceNodeId = `Source document: ${sourceCaseId || fileNames.join(', ')}`;
  const mentions = [
    ...analysis.registeredEntities.map((entity) => ({ id: entity.name, alias: entity.reference, type: entity.type })),
    ...analysis.extractedPersons.map((id) => ({ id, type: 'person' })),
    ...analysis.extractedOrganizations.map((id) => ({ id, type: 'org' })),
    ...analysis.extractedVehicles.map((id) => ({ id, type: 'vehicle' })),
    ...analysis.extractedLocations.map((id) => ({ id, type: 'location' })),
  ];
  const uniqueMentions = [...new Map(mentions.map((mention) => [mention.id.toLowerCase(), mention])).values()];

  const existingNodes = [...nodes, ...priorIngestions.flatMap((ingestion) => ingestion.nodes)]
    .filter((node) => node.type !== 'document');
  const findExisting = (mention) => existingNodes.find((node) => node.id.toLowerCase() === mention.id.toLowerCase()
    || (node.alias && node.alias !== '—' && node.alias.toLowerCase() === mention.id.toLowerCase()));
  const matches = uniqueMentions.map((mention) => ({ mention, existing: findExisting(mention) }));
  const matchedNodes = matches.filter((match) => match.existing).map((match) => match.existing);

  // Pick the existing cluster with the most matched entities (ties: higher combined risk, then lower id).
  const tally = new Map();
  matchedNodes.filter((node) => node.cluster != null).forEach((node) => {
    const entry = tally.get(node.cluster) ?? { count: 0, risk: 0, jurisdictions: new Map() };
    entry.count += 1;
    entry.risk += node.risk ?? 0;
    entry.jurisdictions.set(node.jurisdiction, (entry.jurisdictions.get(node.jurisdiction) ?? 0) + 1);
    tally.set(node.cluster, entry);
  });
  const ranked = [...tally.entries()].sort((a, b) => b[1].count - a[1].count || b[1].risk - a[1].risk || a[0] - b[0]);
  const joined = ranked.length > 0;
  const highestCluster = Math.max(2, ...existingNodes.map((node) => (typeof node.cluster === 'number' ? node.cluster : -1)));
  const cluster = joined ? ranked[0][0] : highestCluster + 1;
  const clusterName = joined
    ? getClusterName(cluster, priorIngestions)
    : `Uploaded · ${sourceCaseId || fileNames[0]}`;
  const jurisdiction = joined
    ? [...ranked[0][1].jurisdictions.entries()].sort((a, b) => b[1] - a[1])[0][0]
    : 'Unassigned';
  const clusterInfo = {
    cluster,
    clusterName,
    joined,
    via: matchedNodes.filter((node) => node.cluster === cluster).map((node) => node.id),
    bridgedClusters: ranked.slice(1).map(([id]) => id),
  };

  const sourceNode = {
    id: sourceNodeId,
    alias: 'Uploaded document',
    type: 'document',
    risk: null,
    cluster,
    clusterName,
    cases: sourceCaseId ? 1 : 0,
    associates: uniqueMentions.length,
    lastActivity: 'Added locally',
    jurisdiction,
    sourceFile: fileNames.join(', '),
    sourceCaseId,
    reviewStatus: 'source',
  };
  const graphNodes = matches.filter((match) => !match.existing).map(({ mention }) => ({
    id: mention.id,
    alias: mention.alias || '—',
    type: ['person', 'org', 'vehicle', 'location'].includes(mention.type) ? mention.type : 'other',
    risk: null,
    cluster,
    clusterName,
    cases: sourceCaseId ? 1 : 0,
    associates: 1,
    lastActivity: 'Extracted from document',
    jurisdiction,
    sourceFile: fileNames.join(', '),
    sourceCaseId,
    reviewStatus: 'unassessed',
  }));
  const sourceLinks = matches.map(({ mention, existing }) => ({
    source: sourceNodeId,
    target: existing?.id ?? mention.id,
    weak: true,
    relationship: 'source document',
    sourceFile: fileNames.join(', '),
    reviewStatus: 'document provenance only',
  }));

  return { id: ingestionId, sourceNode, nodes: [sourceNode, ...graphNodes], links: sourceLinks, clusterInfo };
}

// Registers an uploaded case file in Case Management (or merges it into the case it belongs to).
function registerUploadedCase(analysis, ingestion) {
  const files = analysis.files.map((file) => file.name);
  const fir = (analysis.firNumbers[0] ?? '').toUpperCase();
  const hash = [...ingestion.id].reduce((total, char) => (total * 31 + char.charCodeAt(0)) >>> 0, 7).toString(36).toUpperCase();
  const caseId = fir || `UPLOAD-${hash}`;
  const entityIds = [...new Set(ingestion.links.map((link) => link.target))];
  const known = getAllEntities().filter((entity) => entityIds.includes(entity.id) && entity.risk != null);
  const risk = known.length ? Math.max(...known.map((entity) => entity.risk)) : null;
  const { clusterInfo } = ingestion;
  const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const note = { date, text: `Case file uploaded: ${files.join(', ')}. ${clusterInfo.joined ? `Linked to existing cluster "${clusterInfo.clusterName}" via ${clusterInfo.via.join(', ')}.` : `No existing links found; new cluster "${clusterInfo.clusterName}" created.`}` };

  const localCases = loadLocalRecords(LOCAL_CASES_KEY);
  const existing = [...localCases, ...cases].find((item) => item.id.toLowerCase() === caseId.toLowerCase());
  if (existing) {
    const overrides = loadCaseOverrides();
    const previous = overrides[existing.id] ?? {};
    overrides[existing.id] = {
      ...previous,
      deleted: false,
      suspects: [...new Set([...(previous.suspects ?? []), ...entityIds])],
      notes: [note, ...(previous.notes ?? [])],
      updatedAt: new Date().toISOString(),
    };
    saveLocalRecords(CASE_OVERRIDES_KEY, overrides);
    return { caseId: existing.id, merged: true };
  }

  const caseItem = {
    id: caseId,
    title: analysis.caseTitle || `Uploaded case ${caseId}`,
    desc: `Created from uploaded file${files.length > 1 ? 's' : ''} ${files.join(', ')}.${analysis.legalSections.length ? ` Legal sections cited: ${analysis.legalSections.slice(0, 5).join(', ')}.` : ''}`,
    status: 'Open',
    risk,
    riskLevel: risk == null ? 'low' : riskLevel(risk),
    cluster: clusterInfo.cluster,
    clusterName: clusterInfo.clusterName,
    jurisdiction: ingestion.sourceNode.jurisdiction,
    type: 'Uploaded Case File',
    opened: date,
    lastUpdate: 'Just now',
    suspects: entityIds,
    entities: entityIds.length,
    linkedCases: analysis.relatedCases.length,
    icon: '📄',
    timeline: [note],
    findings: [
      clusterInfo.joined
        ? `Entities matched the existing "${clusterInfo.clusterName}" cluster (${clusterInfo.via.join(', ')}).`
        : 'No entity in this file matched the existing graph, so it forms its own cluster.',
      ...(analysis.legalSections.length ? [`Legal sections cited: ${analysis.legalSections.slice(0, 5).join(', ')}`] : []),
    ],
    recommendations: ['Verify extracted entities against the source file before operational use.'],
    storage: 'local',
    source: 'upload',
    sourceFiles: files,
    ingestionId: ingestion.id,
  };
  saveLocalRecords(LOCAL_CASES_KEY, [caseItem, ...localCases]);
  return { caseId, merged: false };
}

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

function CaseUploadModal({ onClose, onViewEntity, onAddToGraph }) {
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [graphAdded, setGraphAdded] = useState(false);
  const maxFileSize = 20 * 1024 * 1024;

  const addFiles = async (fileList) => {
    setError('');
    setAnalysis(null);
    setGraphAdded(false);
    const incoming = Array.from(fileList);
    const accepted = [];
    const errors = [];

    for (const file of incoming) {
      const extension = file.name.split('.').pop().toLowerCase();
      if (!['pdf', 'docx', 'json', 'txt'].includes(extension)) {
        errors.push(`${file.name}: unsupported file type.`);
        continue;
      }
      if (file.size > maxFileSize) {
        errors.push(`${file.name}: files must be 20 MB or smaller.`);
        continue;
      }

      try {
        const { text, note } = await extractDocumentText(file, extension);
        accepted.push({
          id: `${file.name}-${file.lastModified}-${file.size}`,
          file,
          extension,
          text,
          textPreview: text.slice(0, 1200),
          note,
        });
      } catch (readError) {
        errors.push(`${file.name}: ${readError.message || 'could not extract document text.'}`);
      }
    }

    setFiles((current) => [...current, ...accepted].slice(0, 5));
    if (incoming.length + files.length > 5) errors.push('You can review up to 5 files at a time.');
    setError(errors.join(' '));
  };

  const removeFile = (fileId) => {
    setFiles((current) => current.filter((entry) => entry.id !== fileId));
    setAnalysis(null);
    setGraphAdded(false);
  };

  const runAnalysis = () => {
    const analyzableFiles = files.filter((entry) => entry.text.trim());
    if (!analyzableFiles.length) {
      setError('No document text is available. Scanned PDFs need OCR before they can be analyzed.');
      return;
    }
    setError('');
    setAnalyzing(true);
    window.setTimeout(() => {
      setAnalysis(analyzeCaseDocuments(analyzableFiles));
      setGraphAdded(false);
      setAnalyzing(false);
    }, 250);
  };

  const addAnalysisToGraph = () => {
    if (!analysis || graphAdded) return;
    onAddToGraph(analysis);
    setGraphAdded(true);
  };

  const downloadAnalysis = () => {
    if (!analysis) return;
    const blob = new Blob([JSON.stringify(analysis, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'crimegraph-case-analysis.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const analysisMentions = analysis ? [
    ...analysis.registeredEntities.map((entity) => ({
      name: entity.name,
      type: entityTypeLabel(entity.type),
      detail: [entity.reference, entity.description].filter(Boolean).join(' · '),
    })),
    ...analysis.extractedPersons.map((name) => ({ name, type: 'Person' })),
    ...analysis.extractedOrganizations.map((name) => ({ name, type: 'Company' })),
    ...analysis.extractedVehicles.map((name) => ({ name, type: 'Vehicle' })),
    ...analysis.extractedLocations.map((name) => ({ name, type: 'Location' })),
  ].filter((mention, index, mentions) => mentions.findIndex((candidate) => candidate.name.toLowerCase() === mention.name.toLowerCase()) === index) : [];

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="uploader-modal-overlay show" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <section className="uploader-modal case-intake-modal" role="dialog" aria-modal="true" aria-labelledby="case-upload-title">
        <header className="uploader-head">
          <div className="uploader-head-title">
            <div className="uploader-icon-badge" aria-hidden="true">↑</div>
            <div className="uploader-title-text">
              <h2 id="case-upload-title">Case File Intake</h2>
              <p>Select documents for local review</p>
            </div>
          </div>
          <button type="button" className="icon-btn" aria-label="Close upload dialog" onClick={onClose}>×</button>
        </header>

        <div className="uploader-body">
          <label
            className={`dropzone-container ${dragging ? 'dragover' : ''}`}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              addFiles(event.dataTransfer.files);
            }}
          >
            <input
              className="case-upload-input"
              type="file"
              accept=".pdf,.docx,.json,.txt"
              multiple
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = '';
              }}
            />
            <div className="dropzone-icon" aria-hidden="true">↑</div>
            <div className="dropzone-prompt">Drop case files here or browse</div>
            <div className="dropzone-sub">Up to 5 files, 20 MB each</div>
            <div className="dropzone-pills">
              <span className="file-pill">PDF</span>
              <span className="file-pill">DOCX</span>
              <span className="file-pill">JSON</span>
              <span className="file-pill">TXT</span>
            </div>
          </label>

          {error && <div className="case-upload-error" role="alert">{error}</div>}

          {files.length > 0 && (
            <div className="case-upload-files" aria-live="polite">
              <div className="case-upload-section-title">Selected files ({files.length})</div>
              {files.map(({ id, file, extension, textPreview, note }) => (
                <div className="case-upload-file" key={id}>
                  <div className="case-upload-file-heading">
                    <span className="case-upload-file-name" title={file.name}>{file.name}</span>
                    <span className="file-pill">{extension.toUpperCase()}</span>
                    <span className="case-upload-file-size">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                    <button type="button" className="case-upload-remove" onClick={() => removeFile(id)} aria-label={`Remove ${file.name}`}>Remove</button>
                  </div>
                  {textPreview
                    ? <pre className="case-upload-preview">{textPreview}{file.size > 1200 ? '\n… preview truncated' : ''}</pre>
                    : <div className="case-upload-limitation">{note || 'No document text was extracted.'}</div>}
                </div>
              ))}
            </div>
          )}

          {analysis && (
            <section className="case-analysis-results" aria-live="polite" aria-labelledby="case-analysis-heading">
              <div className="case-analysis-header">
                <div>
                  <h3 id="case-analysis-heading">Document analysis</h3>
                  <p>{analysis.caseTitle ? `${analysis.caseTitle} · ` : ''}{analysis.files.length} file{analysis.files.length === 1 ? '' : 's'} · {analysis.textCharacters.toLocaleString()} text characters</p>
                </div>
                <div className="case-analysis-header-actions">
                  <button type="button" className="btn ghost btn-sm" onClick={downloadAnalysis}>Download JSON</button>
                  <button type="button" className="btn btn-sm" disabled={graphAdded} onClick={addAnalysisToGraph}>{graphAdded ? 'Added to graph' : 'Add to graph'}</button>
                </div>
              </div>
              <div className="case-analysis-counts">
                <div><strong>{analysis.firNumbers.length}</strong><span>Case/FIR IDs</span></div>
                <div><strong>{analysis.extractedPersons.length}</strong><span>Person mentions</span></div>
                <div><strong>{analysis.extractedOrganizations.length}</strong><span>Companies</span></div>
                <div><strong>{analysis.extractedVehicles.length}</strong><span>Vehicles</span></div>
                <div><strong>{analysis.extractedLocations.length}</strong><span>Locations</span></div>
              </div>
              {analysis.firNumbers.length > 0 && <div className="case-analysis-line"><b>Case/FIR IDs:</b> {analysis.firNumbers.join(', ')}</div>}
              {analysis.legalSections.length > 0 && <div className="case-analysis-line"><b>Legal references:</b> {analysis.legalSections.join(', ')}</div>}
              {analysis.syntheticNotice && <div className="case-analysis-notice">{analysis.syntheticNotice}</div>}
              <div className="case-analysis-section">
                <b>Extracted mentions ({analysisMentions.length})</b>
                {analysisMentions.length ? analysisMentions.map(({ name, type }) => (
                  <div className="case-analysis-entity" key={`${type}-${name}`}>
                    <span><strong>{name}</strong><small>{type}{analysisMentions.find((item) => item.name === name)?.detail ? ` · ${analysisMentions.find((item) => item.name === name).detail}` : ' · extracted from document text'}</small></span>
                  </div>
                )) : <p className="case-analysis-empty">No person, company, vehicle, or location mentions matched the supported text patterns.</p>}
              </div>
              {analysis.warnings.map((warning) => <div className="case-upload-error" role="note" key={warning}>{warning}</div>)}
              <div className="case-analysis-section">
                <b>Entities matched to the sample graph ({analysis.matchedEntities.length})</b>
                {analysis.matchedEntities.length ? analysis.matchedEntities.map((entity) => (
                  <div className="case-analysis-entity" key={entity.id}>
                    <span><strong>{entity.id}</strong><small>{entityTypeLabel(entity.type)} · {entity.jurisdiction}</small></span>
                    <button type="button" className="btn ghost btn-sm" onClick={() => onViewEntity(entity)}>View links</button>
                  </div>
                )) : <p className="case-analysis-empty">No names matched the sample entities. Unmatched text is not added as a verified graph node.</p>}
              </div>
              <div className="case-analysis-section">
                <b>Known links in sample graph ({analysis.knownLinks.length})</b>
                {analysis.knownLinks.length ? analysis.knownLinks.map((link, index) => (
                  <div className="case-analysis-link" key={`${link.source.id}-${link.target.id}-${index}`}>
                    <span>{link.source.id}</span><span>{link.weak ? '···' : '→'}</span><span>{link.target.id}</span>
                    <small>{link.weak ? 'Weak sample link' : 'Sample link'}</small>
                  </div>
                )) : <p className="case-analysis-empty">No matching links exist in the current sample graph.</p>}
              </div>
              {analysis.relatedCases.length > 0 && (
                <div className="case-analysis-section">
                  <b>Related sample cases ({analysis.relatedCases.length})</b>
                  {analysis.relatedCases.map((caseItem) => <div className="case-analysis-line" key={caseItem.id}>{caseItem.id} · {caseItem.title}</div>)}
                </div>
              )}
              {analysis.relatedPredictions.length > 0 && (
                <div className="case-analysis-section">
                  <b>Existing sample predictions ({analysis.relatedPredictions.length})</b>
                  <p className="case-analysis-empty">These are already in the demo dataset; they were not generated from this upload.</p>
                  {analysis.relatedPredictions.map((prediction) => (
                    <div className="case-analysis-link" key={`${prediction.source}-${prediction.target}`}>
                      <span>{prediction.source}</span><span>→</span><span>{prediction.target}</span>
                      <small>{Math.round(prediction.score * 100)}% sample</small>
                    </div>
                  ))}
                </div>
              )}
              {graphAdded && <div className="case-upload-reviewed" role="status">Added to this browser’s complete graph. New extracted entities are unassessed and linked only to their source document.</div>}
              <div className="case-upload-notice">Rule-based local extraction only. This does not verify identities, determine culpability, assign risk, generate AI predictions, or write case records.</div>
            </section>
          )}

          <div className="case-upload-notice">
            Files and graph additions stay in this browser. Text-based PDF/DOCX files can be read locally; scanned PDFs need an OCR service. No case database or backend upload is configured.
          </div>
        </div>

        <footer className="case-upload-footer">
          <button type="button" className="btn ghost btn-sm" onClick={onClose}>Close</button>
          <button type="button" className="btn btn-sm" disabled={!files.some((entry) => entry.text.trim()) || analyzing} onClick={runAnalysis}>{analyzing ? 'Analyzing…' : 'Analyze selected files'}</button>
        </footer>
      </section>
    </div>
  );
}

function LeadAssessment({ assessment, title, onClose }) {
  const color = assessment.level === 'High' ? '#ef4444' : assessment.level === 'Elevated' ? '#f59e0b' : '#10b981';
  const [first] = assessment.questionOrder;
  return (
    <div className="lead-assess lead-assess-wide" id="lead-assess-panel">
      <div className="lead-assess-head">
        <div>
          <div className="lead-assess-title">Lead assessment</div>
          <div className="lead-assess-pair">{title}</div>
        </div>
        <button type="button" className="mini-btn" onClick={onClose}>Close</button>
      </div>
      <div className="lead-assess-grid">
        <div className="lead-assess-col">
          <div className="lead-assess-title">Suggested link risk</div>
          <div className="lead-assess-risk">
            <b style={{ color }}>{assessment.linkRisk}</b><span>/ 100 · {assessment.level}</span>
          </div>
          <div className="risk-bar-wrap"><div className="risk-bar-fill" style={{ width: `${assessment.linkRisk}%`, background: color }} /></div>
          <div className="lead-assess-parts">
            {assessment.components.map((part) => (
              <div key={part.label}><span>{part.label} ({Math.round(part.weight * 100)}%)</span><b>{part.value}</b></div>
            ))}
          </div>
          {assessment.recordsToVerify.length > 0 && (
            <div className="lead-assess-records"><strong>Records to verify:</strong> {assessment.recordsToVerify.map((entity) => `${entity.id} (${entityTypeLabel(entity.type)})`).join(', ')}</div>
          )}
        </div>
        <div className="lead-assess-col">
          <div className="lead-assess-title">Who to question first</div>
          {first ? (
            <>
              <div className="lead-assess-first">Suggested starting point: <b>{first.entity.id}</b></div>
              <ol className="lead-assess-list">
                {assessment.questionOrder.map(({ entity, score, reasons }) => (
                  <li key={entity.id}>
                    <div><b>{entity.id}</b><span className="lead-assess-score">priority {score}</span></div>
                    <small>{reasons.join(' · ')}</small>
                  </li>
                ))}
              </ol>
            </>
          ) : <div className="entity-search-empty">No persons are involved in this lead, so nobody to question — review the records instead.</div>}
        </div>
      </div>
      <div className="lead-assess-warning" role="note">
        ⚠ <strong>Predictive indication only.</strong> This is not an actual analysis, finding or verdict. The risk figure and questioning order are model-assisted suggestions from sample/stored data and show where to look first, not who is guilty. Verify against source records and obtain analyst review before any action.
      </div>
    </div>
  );
}

function DashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = getAuthSession();
  const [selectedNode, setSelectedNode] = useState(null);
  const [predictionReviews, setPredictionReviews] = useState(() => Object.fromEntries(
    loadLocalRecords(PREDICTION_REVIEWS_KEY).map((review) => [review.id, review.status])
  ));
  const [removedNodeIds, setRemovedNodeIds] = useState([]);
  const [graphIngestions, setGraphIngestions] = useState(loadGraphIngestions);
  const [activeTab, setActiveTab] = useState('graph');
  const [searchValue, setSearchValue] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [predStatusFilter, setPredStatusFilter] = useState('all');
  const [predTierFilter, setPredTierFilter] = useState('all');
  const [predSort, setPredSort] = useState('score');
  const [openLeadKey, setOpenLeadKey] = useState(null);
  const [riskValue, setRiskValue] = useState(0);
  const [selectedCluster, setSelectedCluster] = useState('all');
  const [selectedGraphCase, setSelectedGraphCase] = useState('all');
  const graphCaseList = useMemo(() => {
    const overrides = loadCaseOverrides();
    return [...loadLocalRecords(LOCAL_CASES_KEY), ...cases].filter((item) => !overrides[item.id]?.deleted).map((item) => applyCaseOverride(item, overrides[item.id]));
  }, [graphIngestions]);
  const [entityTypes, setEntityTypes] = useState(['person', 'location', 'vehicle', 'org']);
  const [appliedFilters, setAppliedFilters] = useState({ types: ['person', 'location', 'vehicle', 'org'], risk: 0, cluster: 'all' });
  const graphRef = useRef({});
  const graphNodes = useMemo(() => {
    const sampleIds = new Set(nodes.map((node) => node.id.toLowerCase()));
    const importedNodes = graphIngestions.flatMap((ingestion) => ingestion.nodes)
      .filter((node) => !sampleIds.has(node.id.toLowerCase()));
    const uniqueNodes = new Map();
    [...nodes, ...importedNodes].forEach((node) => uniqueNodes.set(node.id.toLowerCase(), node));
    return [...uniqueNodes.values()];
  }, [graphIngestions]);
  const uploadedClusters = useMemo(() => {
    const found = new Map();
    graphIngestions.flatMap((ingestion) => ingestion.nodes).forEach((node) => {
      if (typeof node.cluster === 'number' && node.cluster > 2 && !found.has(node.cluster)) found.set(node.cluster, node.clusterName ?? `Cluster ${node.cluster}`);
    });
    return [...found.entries()].map(([cluster, name]) => ({ cluster, name }));
  }, [graphIngestions]);
  const graphLinks = useMemo(() => [
    ...links,
    ...graphIngestions.flatMap((ingestion) => ingestion.links),
  ], [graphIngestions]);

  const addAnalysisToGraph = (analysis) => {
    const ingestion = createGraphIngestion(analysis, graphIngestions);
    if (graphIngestions.some((entry) => entry.id === ingestion.id)) {
      showToast('This document is already in the local graph', 'info');
      return;
    }
    const updatedIngestions = [...graphIngestions, ingestion];
    try {
      localStorage.setItem(GRAPH_INGESTIONS_KEY, JSON.stringify(updatedIngestions));
      setGraphIngestions(updatedIngestions);
      const registered = registerUploadedCase(analysis, ingestion);
      setSelectedGraphCase('all');
      setSelectedCluster('all');
      setSelectedNode(ingestion.sourceNode);
      const { clusterInfo } = ingestion;
      showToast(clusterInfo.joined
        ? `Joined existing cluster "${clusterInfo.clusterName}" via ${clusterInfo.via.slice(0, 2).join(', ')}${clusterInfo.bridgedClusters.length ? ' (also bridges other clusters)' : ''}. ${ingestion.nodes.length - 1} entities added. ${registered.merged ? `Merged into case ${registered.caseId}` : `Case ${registered.caseId} added to Cases`}.`
        : `No existing links found — created new cluster "${clusterInfo.clusterName}" with ${ingestion.nodes.length - 1} entities. ${registered.merged ? `Merged into case ${registered.caseId}` : `Case ${registered.caseId} added to Cases`}.`, 'ok');
    } catch (error) {
      console.error('Unable to persist graph ingestion:', error);
      showToast('Could not save this analysis in browser storage', 'error');
    }
  };

  const searchResults = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (query.length < 2) return [];
    return graphNodes.filter((node) => [node.id, node.alias, node.type, entityTypeLabel(node.type), node.jurisdiction]
      .some((value) => value && value.toLowerCase().includes(query)))
      .slice(0, 6);
  }, [graphNodes, searchValue]);

  const focusEntity = (entity) => {
    setSelectedGraphCase('all');
    setSelectedCluster('all');
    const allTypes = [...new Set(graphNodes.map((node) => node.type))];
    setEntityTypes(allTypes.filter((type) => ['person', 'location', 'vehicle', 'org'].includes(type)));
    setAppliedFilters({ types: allTypes, risk: 0, cluster: 'all' });
    setSelectedNode(entity);
    setSearchValue(entity.id);
    setSearchOpen(false);
  };

  const enrichedLeads = useMemo(
    () => enrichLeads(predictedLinks, buildAdjacency(graphNodes, graphLinks)),
    [graphNodes, graphLinks],
  );
  const visibleLeads = useMemo(() => {
    const filtered = enrichedLeads.filter((lead) => {
      const status = predictionReviews[`${lead.source}->${lead.target}`] || lead.status;
      return (predStatusFilter === 'all' || status === predStatusFilter) && (predTierFilter === 'all' || lead.tier === predTierFilter);
    });
    const sorters = {
      score: (a, b) => b.score - a.score,
      shared: (a, b) => b.common.length - a.common.length || b.score - a.score,
      hops: (a, b) => (a.hops ?? 99) - (b.hops ?? 99) || b.score - a.score,
    };
    return filtered.sort(sorters[predSort]);
  }, [enrichedLeads, predictionReviews, predStatusFilter, predTierFilter, predSort]);

  useEffect(() => {
    if (openLeadKey) document.getElementById('lead-assess-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [openLeadKey]);

  const openAssessment = useMemo(() => {
    if (!openLeadKey) return null;
    const lead = enrichedLeads.find((item) => `${item.source}->${item.target}` === openLeadKey);
    return lead ? assessLead(lead, graphNodes, buildAdjacency(graphNodes, graphLinks)) : null;
  }, [openLeadKey, enrichedLeads, graphNodes, graphLinks]);

  const inspectLeadEntity = (entityId) => {
    const entity = graphNodes.find((node) => node.id === entityId);
    if (entity) {
      setActiveTab('graph');
      focusEntity(entity);
    }
  };

  const exportLeads = () => {
    const rows = [['Source', 'Target', 'Model score', 'Priority', 'Review status', 'Existing path', 'Shared connections']]
      .concat(visibleLeads.map((lead) => [
        lead.source, lead.target, lead.score, lead.tier,
        predictionReviews[`${lead.source}->${lead.target}`] || lead.status,
        lead.path ? lead.path.join(' > ') : 'none', lead.common.join('; '),
      ]));
    downloadFile('crimegraph-predicted-leads.csv', 'text/csv;charset=utf-8', rows.map((row) => row.map(csvCell).join(',')).join('\n'));
  };

  const reviewPrediction = (prediction, status) => {
    const id = `${prediction.source}->${prediction.target}`;
    const updated = { ...predictionReviews, [id]: status };
    try {
      saveLocalRecords(PREDICTION_REVIEWS_KEY, Object.entries(updated).map(([reviewId, reviewStatus]) => ({
        id: reviewId,
        status: reviewStatus,
        updatedAt: new Date().toISOString(),
      })));
      setPredictionReviews(updated);
      showToast(`Prediction marked ${status.toLowerCase()}`, 'ok');
    } catch (error) {
      console.error('Unable to save prediction review:', error);
      showToast('Could not save this review in browser storage', 'error');
    }
  };

  const toggleDisruptionTarget = (nodeId) => {
    setRemovedNodeIds((current) => current.includes(nodeId)
      ? current.filter((id) => id !== nodeId)
      : [...current, nodeId]);
  };

  useEffect(() => {
    if (!getAuthSession()) {
      navigate('/');
    }
  }, [navigate]);

  useEffect(() => {
    const caseParam = new URLSearchParams(location.search).get('case');
    if (caseParam && graphCaseList.some((item) => item.id === caseParam)) {
      setActiveTab('graph');
      setSelectedCluster('all');
      setSelectedGraphCase(caseParam);
      setSelectedNode(null);
      return;
    }
    const entityId = new URLSearchParams(location.search).get('entity');
    if (!entityId) return;
    const entity = graphNodes.find((node) => node.id.toLowerCase() === entityId.toLowerCase());
    if (entity) {
      setActiveTab('graph');
      focusEntity(entity);
    }
  }, [location.search, graphNodes]);

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

      const graphCase = graphCaseList.find((item) => item.id === selectedGraphCase);
      const caseNodeIds = graphCase ? new Set(graphCase.suspects) : null;
      const sourceNodes = caseNodeIds ? graphNodes.filter((node) => caseNodeIds.has(node.id)) : graphNodes;
      const sourceLinks = caseNodeIds
        ? graphLinks.filter((link) => caseNodeIds.has(link.source) && caseNodeIds.has(link.target))
        : graphLinks;
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
        .attr('fill', (d) => d.risk == null ? '#7b8794' : riskColor(d.risk));

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
  }, [graphLinks, graphNodes, location.pathname, activeTab, selectedGraphCase]);

  useEffect(() => {
    const { nodeSel, linkSel } = graphRef.current;
    if (!nodeSel || !linkSel) return;

    const graphCase = graphCaseList.find((item) => item.id === selectedGraphCase);
    const caseNodeIds = graphCase ? new Set(graphCase.suspects) : null;
    const graphEntityTypes = ['person', 'location', 'vehicle', 'org'];
    const visible = (node) => (!caseNodeIds || caseNodeIds.has(node.id))
      && (appliedFilters.types.includes(node.type) || !graphEntityTypes.includes(node.type))
      && (node.risk == null || node.risk >= Number(appliedFilters.risk))
      && (appliedFilters.cluster === 'all' || node.cluster === Number(appliedFilters.cluster));

    nodeSel.style('display', (node) => visible(node) ? null : 'none');
    linkSel.style('display', (link) => visible(link.source) && visible(link.target) ? null : 'none');

    const focusNode = selectedNode;

    if (focusNode) {
      const neighborhood = new Set([focusNode.id]);
      graphLinks.forEach((link) => {
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

    const visibleNodes = graphNodes.filter(visible);
    const summary = document.querySelector('#graph-wrap .graph-stats .stat-pill b');
    if (summary) summary.textContent = String(visibleNodes.length);
    if (selectedNode && !visible(selectedNode)) setSelectedNode(null);
  }, [activeTab, appliedFilters, graphLinks, graphNodes, selectedGraphCase, selectedNode]);

  const selectedEntity = useMemo(() => selectedNode ?? null, [selectedNode]);
  const selectedConnections = selectedEntity
    ? graphLinks.flatMap((link) => {
      const connectedId = link.source === selectedEntity.id
        ? link.target
        : link.target === selectedEntity.id ? link.source : null;
      const connectedEntity = connectedId && graphNodes.find((node) => node.id === connectedId);
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
    const exactMatch = graphNodes.find((node) => node.id.toLowerCase() === query || (node.alias && node.alias.toLowerCase() === query));
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

  const graphCase = graphCaseList.find((item) => item.id === selectedGraphCase);
  const graphEntityTypes = ['person', 'location', 'vehicle', 'org'];
  const visibleGraphNodes = graphNodes.filter((node) => (!graphCase || graphCase.suspects.includes(node.id))
    && (appliedFilters.types.includes(node.type) || !graphEntityTypes.includes(node.type))
    && (node.risk == null || node.risk >= Number(appliedFilters.risk))
    && (appliedFilters.cluster === 'all' || node.cluster === Number(appliedFilters.cluster)));
  const visibleGraphNodeIds = new Set(visibleGraphNodes.map((node) => node.id));
  const summaryCards = [
    { label: 'Entities', value: visibleGraphNodes.length },
    { label: 'Connections', value: graphLinks.filter((link) => visibleGraphNodeIds.has(link.source) && visibleGraphNodeIds.has(link.target)).length },
    { label: 'Clusters', value: new Set(visibleGraphNodes.map((node) => node.cluster).filter((cluster) => cluster != null)).size },
  ];
  const simulationNodes = graphNodes.filter((node) => !node.reviewStatus);
  const simulationLinks = graphLinks.filter((link) => !link.relationship);
  const simulationDegree = new Map(simulationNodes.map((node) => [node.id, 0]));
  simulationLinks.forEach(({ source, target }) => {
    simulationDegree.set(source, (simulationDegree.get(source) || 0) + 1);
    simulationDegree.set(target, (simulationDegree.get(target) || 0) + 1);
  });
  const disruptionTargets = [...simulationNodes]
    .sort((left, right) => simulationDegree.get(right.id) - simulationDegree.get(left.id))
    .slice(0, 8);
  const disruptionMetrics = getGraphFragmentation(simulationNodes, simulationLinks, new Set(removedNodeIds));

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
          {can(session?.role, 'case.upload') && <button className="nav-item" onClick={() => setUploadOpen(true)}>Upload Case File <span className="nav-badge" style={{ background: 'var(--accent)', color: '#fff' }}>AI</span></button>}
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
            <div className="badge badge-muted">Graph · {graphNodes.length} Entities</div>
            <div className="badge badge-muted" title={session?.badgeId}>{ROLE_LABELS[session?.role]} · {session?.badgeId}</div>
            {can(session?.role, 'case.upload') && <button className="btn btn-sm" onClick={() => setUploadOpen(true)}>Upload Case File</button>}
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
                {graphCaseList.map((caseItem) => <option value={caseItem.id} key={caseItem.id}>{caseItem.id} · {caseItem.title}</option>)}
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
                {uploadedClusters.map((entry) => <option value={String(entry.cluster)} key={entry.cluster}>Cluster {entry.cluster} — {entry.name}</option>)}
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
                        <div className="risk-label"><span>Risk Score</span><span style={{ color: selectedEntity.risk == null ? 'var(--text-muted)' : riskColor(selectedEntity.risk), fontWeight: 700 }}>{selectedEntity.risk == null ? 'Unassessed' : `${selectedEntity.risk} / 100`}</span></div>
                        {selectedEntity.risk != null && <div className="risk-bar-wrap"><div className="risk-bar-fill" style={{ width: `${selectedEntity.risk}%`, background: riskColor(selectedEntity.risk) }} /></div>}
                      </div>
                      <div className="stat-grid">
                        <div className="stat-box"><div className="n">{selectedEntity.cases || 0}</div><div className="l">Linked Cases</div></div>
                        <div className="stat-box"><div className="n">{selectedEntity.associates || selectedConnections.length}</div><div className="l">Connections</div></div>
                      </div>
                      <div className="kv"><span>Last Activity</span><span>{selectedEntity.lastActivity}</span></div>
                      <div className="kv"><span>Jurisdiction</span><span>{selectedEntity.jurisdiction}</span></div>
                      <div className="kv"><span>Entity Type</span><span>{entityTypeLabel(selectedEntity.type)}</span></div>
                      <div className="kv"><span>Cluster</span><span>{selectedEntity.cluster == null ? 'Unassigned' : getClusterName(selectedEntity.cluster, graphIngestions)}</span></div>
                      {selectedEntity.sourceFile && <div className="kv"><span>Source</span><span>{selectedEntity.sourceFile}</span></div>}
                      {selectedEntity.reviewStatus && <div className="kv" style={{ borderBottom: 'none' }}><span>Status</span><span>{selectedEntity.reviewStatus}</span></div>}
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
                            <span className="assoc-dot" style={{ background: entity.risk == null ? '#7b8794' : riskColor(entity.risk) }} />
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
              {can(session?.role, 'model.recalculate') && <button className="btn ghost btn-sm" onClick={() => showToast('Showing saved sample leads; a prediction service is not configured.', 'info')}>Recalculate</button>}
            </div>
            <div className="pred-summary">
              <div className="pred-summary-card"><div className="summary-label">DATASET</div><div className="summary-value">SAMPLE</div><div className="summary-sub">Illustrative leads, not live model output</div></div>
              <div className="pred-summary-card"><div className="summary-label">CANDIDATE LINKS</div><div className="summary-value">{predictedLinks.length}</div><div className="summary-sub">saved sample associations</div></div>
              <div className="pred-summary-card"><div className="summary-label">MEAN SAMPLE SCORE</div><div className="summary-value">{Math.round(predictedLinks.reduce((total, prediction) => total + prediction.score, 0) / Math.max(predictedLinks.length, 1) * 100)}%</div><div className="summary-sub">not a validated probability</div></div>
              <div className="pred-summary-card"><div className="summary-label">PENDING REVIEW</div><div className="summary-value">{predictedLinks.filter((prediction) => !['Accepted', 'Dismissed'].includes(predictionReviews[`${prediction.source}->${prediction.target}`])).length}</div><div className="summary-sub">human review decisions saved locally</div></div>
            </div>
            <div style={{ display: 'flex', minHeight: 0, gap: 18 }}>
              <aside id="predictions-panel" style={{ width: 420 }}>
                <div className="panel-head">PREDICTED ASSOCIATIONS</div>
                <div className="pred-filters">
                  <select className="field" aria-label="Filter by review status" value={predStatusFilter} onChange={(e) => setPredStatusFilter(e.target.value)}>
                    <option value="all">All statuses</option><option>Pending</option><option>Accepted</option><option>Dismissed</option>
                  </select>
                  <select className="field" aria-label="Filter by priority" value={predTierFilter} onChange={(e) => setPredTierFilter(e.target.value)}>
                    <option value="all">All priorities</option><option>High</option><option>Medium</option><option>Low</option>
                  </select>
                  <select className="field" aria-label="Sort leads" value={predSort} onChange={(e) => setPredSort(e.target.value)}>
                    <option value="score">Sort: model score</option><option value="shared">Sort: shared connections</option><option value="hops">Sort: path length</option>
                  </select>
                  <button type="button" className="mini-btn" onClick={exportLeads}>Export CSV</button>
                </div>
                <div id="predictions-list">
                  {visibleLeads.length === 0 && <div className="entity-search-empty">No leads match these filters.</div>}
                  {visibleLeads.map((pred) => {
                    const leadKey = `${pred.source}->${pred.target}`;
                    const status = predictionReviews[leadKey] || pred.status;
                    return (
                      <div className={`pred-item pred-clickable ${openLeadKey === leadKey ? 'selected' : ''}`} key={`${pred.source}-${pred.target}`} onClick={() => setOpenLeadKey((current) => (current === leadKey ? null : leadKey))} role="button" tabIndex={0} aria-expanded={openLeadKey === leadKey} onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setOpenLeadKey((current) => (current === leadKey ? null : leadKey)); } }}>
                        <div className="pred-pair"><span>{pred.source}</span><span className="arrow">→</span><span>{pred.target}</span><span className="pred-score-badge">{Math.round(pred.score * 100)}% · {pred.tier}</span></div>
                        <div className="pred-evidence"><strong>Review status:</strong> {status}</div>
                        <div className="pred-evidence"><strong>Existing graph path:</strong> {pred.path ? `${pred.path.join(' → ')} (${pred.hops} hop${pred.hops === 1 ? '' : 's'})` : 'No connecting path in the current graph'}</div>
                        <div className="pred-evidence"><strong>Shared connections:</strong> {pred.common.length ? pred.common.join(', ') : 'None'} · Jaccard {pred.jaccard.toFixed(2)}</div>
                        {pred.reasons.map((reason) => <div className="pred-evidence" key={reason}><strong>Sample basis:</strong> {reason}</div>)}
                        <div className="pred-evidence lead-toggle-hint">{openLeadKey === leadKey ? '▲ Assessment shown below the activity trajectory' : '▼ Click for suggested risk & who to question first'}</div>
                        <div className="pred-actions" onClick={(e) => e.stopPropagation()}>
                          <button className="mini-btn" onClick={() => inspectLeadEntity(pred.source)}>Inspect source</button>
                          <button className="mini-btn" onClick={() => inspectLeadEntity(pred.target)}>Inspect target</button>
                          {can(session?.role, 'prediction.review') && <>
                            <button className="mini-btn" onClick={() => reviewPrediction(pred, 'Accepted')}>Accept</button>
                            <button className="mini-btn" onClick={() => reviewPrediction(pred, 'Dismissed')}>Dismiss</button>
                            {status !== 'Pending' && <button className="mini-btn" onClick={() => reviewPrediction(pred, 'Pending')}>Reset</button>}
                          </>}
                          {can(session?.role, 'reports.generate') && <button className="mini-btn" onClick={() => navigate(`/app/reports?entity=${encodeURIComponent(pred.source)}`)}>Report</button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </aside>
              <div id="disruption-wrap" style={{ flex: 1 }}>
                <div className="pred-section-title"><div><b>Network Evolution &amp; Intervention Simulator</b><span>Click a node to simulate removal and measure structural impact.</span></div></div>
                <div className="disrupt-stats">
                  <div className="dstat"><b>{disruptionMetrics.retainedLinksPercent}%</b>Links Retained</div>
                  <div className="dstat"><b>{disruptionMetrics.fragments}</b>Connected Fragments</div>
                  <div className="dstat"><b>{disruptionMetrics.largestFragment}</b>Largest Fragment</div>
                  <div className="dstat warn"><b>{removedNodeIds.length}</b>Entities Removed</div>
                </div>
                <div className="disruption-targets">
                  <div className="case-upload-section-title">Simulate removing a sample-graph entity</div>
                  <div className="disruption-target-list">
                    {disruptionTargets.map((node) => (
                      <button type="button" className={`chip ${removedNodeIds.includes(node.id) ? 'active' : ''}`} key={node.id} aria-pressed={removedNodeIds.includes(node.id)} onClick={() => toggleDisruptionTarget(node.id)}>
                        {node.id} · {simulationDegree.get(node.id)} links
                      </button>
                    ))}
                    {removedNodeIds.length > 0 && <button type="button" className="btn ghost btn-sm" onClick={() => setRemovedNodeIds([])}>Clear simulation</button>}
                  </div>
                  <div className="case-upload-limitation">Fragmentation is calculated from stored sample links only. It is not an operational recommendation.</div>
                </div>
                <div className="forecast-strip">
                  <div className="forecast-title">ACTIVITY TRAJECTORY</div>
                  <div className="forecast-chart">
                    <svg viewBox="0 0 400 110" width="100%" height="100%">
                      <path d={forecastSeries.map((value, index) => `${index === 0 ? 'M' : 'L'} ${index * 28} ${110 - value}`).join(' ')} stroke="#5ea0ff" fill="none" strokeWidth="3" />
                    </svg>
                  </div>
                </div>
                {openAssessment && (
                  <LeadAssessment
                    assessment={openAssessment}
                    title={openLeadKey.replace('->', ' ↔ ')}
                    onClose={() => setOpenLeadKey(null)}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <div id="toast" />
      {uploadOpen && (
        <CaseUploadModal
          onClose={() => setUploadOpen(false)}
          onAddToGraph={addAnalysisToGraph}
          onViewEntity={(entity) => {
            setUploadOpen(false);
            focusEntity(entity);
          }}
        />
      )}
    </div>
  );
}

function CaseCreationModal({ entities, onClose, onCreate }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [jurisdiction, setJurisdiction] = useState('Unassigned');
  const [type, setType] = useState('Investigation');
  const [entityIds, setEntityIds] = useState([]);
  const [error, setError] = useState('');

  const submit = (event) => {
    event.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError('Enter a case title and summary.');
      return;
    }
    onCreate({ title: title.trim(), desc: description.trim(), jurisdiction, type, suspects: entityIds });
  };

  useEffect(() => {
    const handleKeyDown = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-overlay show" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal new-case-modal" role="dialog" aria-modal="true" aria-labelledby="new-case-title">
        <div className="modal-head">
          <h2 id="new-case-title">Create Local Case</h2>
          <button type="button" className="icon-btn" aria-label="Close case form" onClick={onClose}>×</button>
        </div>
        <form className="modal-body" onSubmit={submit}>
          <div className="form-group">
            <label htmlFor="new-case-title-input">Case title</label>
            <input id="new-case-title-input" className="field" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={100} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="new-case-type">Case type</label>
              <select id="new-case-type" className="field" value={type} onChange={(event) => setType(event.target.value)}>
                <option>Investigation</option><option>Financial Crime</option><option>Cybercrime</option><option>Vehicle Crime</option><option>Other</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="new-case-jurisdiction">Jurisdiction</label>
              <select id="new-case-jurisdiction" className="field" value={jurisdiction} onChange={(event) => setJurisdiction(event.target.value)}>
                <option>Unassigned</option><option>Maharashtra</option><option>Delhi NCR</option><option>Karnataka</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="new-case-description">Summary</label>
            <textarea id="new-case-description" className="field case-description-input" value={description} onChange={(event) => setDescription(event.target.value)} required maxLength={1000} rows={4} />
          </div>
          <div className="form-group">
            <label>Link existing graph entities (optional)</label>
            <div className="case-entity-picker">
              {entities.map((entity) => (
                <label className="case-entity-option" key={entity.id}>
                  <input type="checkbox" checked={entityIds.includes(entity.id)} onChange={(event) => setEntityIds((current) => event.target.checked ? [...current, entity.id] : current.filter((id) => id !== entity.id))} />
                  <span>{entity.id}</span><small>{entityTypeLabel(entity.type)}</small>
                </label>
              ))}
            </div>
          </div>
          {error && <div className="case-upload-error" role="alert">{error}</div>}
          <div className="case-upload-notice">This demo case is saved in this browser only. Its risk score is unassessed.</div>
          <div className="case-upload-footer">
            <button type="button" className="btn ghost btn-sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-sm">Create case</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function CasesPage() {
  const navigate = useNavigate();
  const session = getAuthSession();
  const [localCases, setLocalCases] = useState(() => loadLocalRecords(LOCAL_CASES_KEY));
  const [overrides, setOverrides] = useState(loadCaseOverrides);
  const [selectedCaseId, setSelectedCaseId] = useState(() => loadLocalRecords(LOCAL_CASES_KEY)[0]?.id ?? cases[0].id);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [caseDialogOpen, setCaseDialogOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [expandedCaseId, setExpandedCaseId] = useState(null);
  const [leadText, setLeadText] = useState('');
  const [leadSource, setLeadSource] = useState(LEAD_SOURCES[0]);
  const [leadReliability, setLeadReliability] = useState(LEAD_RELIABILITY[0]);
  const [leadEntities, setLeadEntities] = useState([]);
  const canEdit = can(session?.role, 'cases.create');

  const allCases = useMemo(
    () => [...localCases, ...cases].filter((item) => !overrides[item.id]?.deleted).map((item) => applyCaseOverride(item, overrides[item.id])),
    [localCases, overrides],
  );
  const selectedCase = allCases.find((item) => item.id === selectedCaseId) ?? allCases[0];
  const caseEntities = getAllEntities();
  const relatedReports = selectedCase ? [...loadLocalRecords(LOCAL_REPORTS_KEY), ...reports].filter((report) => report.case === selectedCase.id) : [];
  const deletable = Boolean(selectedCase) && DELETABLE_STATUSES.includes(selectedCase.status);

  useEffect(() => {
    if (!getAuthSession()) {
      navigate('/');
    }
  }, [navigate]);

  const statusCounts = CASE_STATUSES.reduce((counts, status) => ({ ...counts, [status]: allCases.filter((item) => item.status === status).length }), {});
  const assessed = allCases.filter((item) => item.risk != null);
  const averageRisk = assessed.length ? Math.round(assessed.reduce((total, item) => total + item.risk, 0) / assessed.length) : null;

  const filteredCases = allCases.filter((item) => {
    if (statusFilter !== 'All' && item.status !== statusFilter) return false;
    if (!search) return true;
    const query = search.toLowerCase();
    return [item.title, item.id, item.desc, item.jurisdiction, item.type].some((value) => value?.toLowerCase().includes(query));
  });

  const saveOverride = (caseId, patch, message) => {
    const updated = { ...overrides, [caseId]: { ...overrides[caseId], ...patch, updatedAt: new Date().toISOString() } };
    try {
      saveLocalRecords(CASE_OVERRIDES_KEY, updated);
      setOverrides(updated);
      showToast(message, 'ok');
    } catch (error) {
      console.error('Unable to save case update:', error);
      showToast('Could not save this update in browser storage', 'error');
    }
  };

  const changeStatus = (status) => saveOverride(selectedCase.id, { status }, `Case marked ${status}`);
  const addNote = () => {
    const text = noteText.trim();
    if (!text) return;
    const note = { date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }), text, by: session?.badgeId };
    saveOverride(selectedCase.id, { notes: [note, ...(overrides[selectedCase.id]?.notes ?? [])] }, 'Diary entry added');
    setNoteText('');
  };

  const deleteCase = () => {
    if (!selectedCase || !DELETABLE_STATUSES.includes(selectedCase.status)) return;
    if (!window.confirm(`Delete case ${selectedCase.id} (${selectedCase.title})?\n\nOnly the case record is removed. Graph entities and existing reports are kept. This cannot be undone.`)) return;
    const isLocal = selectedCase.storage === 'local';
    const updatedLocal = isLocal ? localCases.filter((item) => item.id !== selectedCase.id) : localCases;
    const updatedOverrides = { ...overrides };
    if (isLocal) delete updatedOverrides[selectedCase.id];
    else updatedOverrides[selectedCase.id] = { ...overrides[selectedCase.id], deleted: true, deletedAt: new Date().toISOString(), deletedBy: session?.badgeId };
    try {
      saveLocalRecords(LOCAL_CASES_KEY, updatedLocal);
      saveLocalRecords(CASE_OVERRIDES_KEY, updatedOverrides);
      const remaining = allCases.filter((item) => item.id !== selectedCase.id);
      setLocalCases(updatedLocal);
      setOverrides(updatedOverrides);
      setSelectedCaseId(remaining[0]?.id ?? null);
      setExpandedCaseId(null);
      showToast(`Case ${selectedCase.id} deleted`, 'ok');
    } catch (error) {
      console.error('Unable to delete case:', error);
      showToast('Could not delete this case', 'error');
    }
  };

  const addLead = () => {
    const text = leadText.trim();
    if (!text || !selectedCase) return;
    const lead = {
      id: `LEAD-${Date.now().toString(36).toUpperCase()}`,
      date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      text,
      source: leadSource,
      reliability: leadReliability,
      entities: leadEntities,
      by: session?.badgeId,
    };
    const previous = overrides[selectedCase.id] ?? {};
    saveOverride(selectedCase.id, {
      leads: [lead, ...(previous.leads ?? [])],
      suspects: [...new Set([...(previous.suspects ?? []), ...leadEntities.filter((id) => !selectedCase.suspects.includes(id))])],
    }, 'Lead information added to the case');
    setLeadText('');
    setLeadEntities([]);
    setLeadReliability(LEAD_RELIABILITY[0]);
  };

  const deleteLead = (leadId) => {
    if (!window.confirm('Remove this lead entry from the case?')) return;
    const previous = overrides[selectedCase.id] ?? {};
    saveOverride(selectedCase.id, { leads: (previous.leads ?? []).filter((lead) => lead.id !== leadId) }, 'Lead entry removed');
  };

  const exportCases = () => {
    const rows = [['Case ID', 'Title', 'Status', 'Type', 'Jurisdiction', 'Risk', 'Suspects']]
      .concat(filteredCases.map((item) => [item.id, item.title, item.status, item.type, item.jurisdiction, item.risk ?? 'Unassessed', item.suspects.join('; ')]));
    downloadFile('crimegraph-cases.csv', 'text/csv;charset=utf-8', rows.map((row) => row.map(csvCell).join(',')).join('\n'));
  };

  const openCaseDrawer = (caseItem) => {
    setSelectedCaseId(caseItem.id);
    setExpandedCaseId((current) => (current === caseItem.id ? null : caseItem.id));
  };
  const createCase = (draft) => {
    const now = new Date();
    const caseItem = {
      ...draft,
      id: `LOCAL-${now.toISOString().slice(0, 10).replaceAll('-', '')}-${now.getTime().toString().slice(-5)}`,
      status: 'Open',
      risk: null,
      riskLevel: 'low',
      cluster: null,
      opened: now.toLocaleDateString(),
      lastUpdate: 'Just now',
      entities: draft.suspects.length,
      linkedCases: 0,
      icon: '📁',
      timeline: [],
      findings: [],
      recommendations: [],
      storage: 'local',
    };
    const updatedCases = [caseItem, ...localCases];
    try {
      saveLocalRecords(LOCAL_CASES_KEY, updatedCases);
      setLocalCases(updatedCases);
      setSelectedCaseId(caseItem.id);
      setCaseDialogOpen(false);
      showToast('Case saved in this browser', 'ok');
    } catch (error) {
      console.error('Unable to save local case:', error);
      showToast('Could not save this case in browser storage', 'error');
    }
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-logo"><div className="mark">CG</div><div className="brand-text"><div className="brand-name">CrimeGraph AI</div><div className="brand-sub">Investigator Console</div></div></div>
        <nav className="sidebar-nav">
          <div className="nav-section-label">Investigation</div>
          <Link to="/app/dashboard" className="nav-item"><span>Live Console</span></Link>
          <Link to="/app/cases" className="nav-item active"><span>Cases</span><span className="nav-badge">{allCases.length}</span></Link>
          <Link to="/app/reports" className="nav-item"><span>Reports</span></Link>
          <button className="nav-item" onClick={() => { sessionStorage.removeItem(AUTH_SESSION_KEY); sessionStorage.removeItem('crimegraph-user'); navigate('/'); }}>Sign Out</button>
        </nav>
      </aside>

      <main className="main">
        <div className="topbar">
          <span className="topbar-title">Case Management</span>
          <div className="topbar-search">
            <input value={search} onChange={(e) => setSearch(e.target.value)} type="text" placeholder="Search case, FIR number, jurisdiction" />
          </div>
          <div className="topbar-right">
            <div className="badge badge-muted" title={session?.badgeId}>{ROLE_LABELS[session?.role]} · {session?.badgeId}</div>
            <button className="btn ghost btn-sm" onClick={exportCases}>Export CSV</button>
            {canEdit && <button className="btn btn-sm" onClick={() => setCaseDialogOpen(true)}>+ New Manual Case</button>}
          </div>
        </div>

        <div className="cases-layout">
          <div className="cases-scroll" tabIndex={0} aria-label="Case list">
            <div className="mod-stats">
              <div className="stat-box"><div className="n">{allCases.length}</div><div className="l">Total Cases</div></div>
              <div className="stat-box"><div className="n">{statusCounts.Active}</div><div className="l">Active</div></div>
              <div className="stat-box"><div className="n">{allCases.filter((item) => (item.risk ?? 0) > 70).length}</div><div className="l">High Risk</div></div>
              <div className="stat-box"><div className="n">{averageRisk ?? '—'}</div><div className="l">Avg Risk</div></div>
            </div>
            <div className="mod-chips">
              {['All', ...CASE_STATUSES].map((status) => (
                <button type="button" key={status} className={`chip ${statusFilter === status ? 'active' : ''}`} aria-pressed={statusFilter === status} onClick={() => setStatusFilter(status)}>
                  {status}{status !== 'All' ? ` · ${statusCounts[status]}` : ''}
                </button>
              ))}
            </div>
            {filteredCases.length === 0 && <div className="entity-search-empty">No cases match this search or filter.</div>}
            {filteredCases.map((item) => {
              const expanded = expandedCaseId === item.id;
              return (
                <div className="case-group" key={item.id}>
                  <div className={`case-card ${item.riskLevel || 'low'} ${item.id === selectedCase?.id ? 'selected' : ''}`} onClick={() => openCaseDrawer(item)} style={{ cursor: 'pointer' }} role="button" tabIndex={0} aria-expanded={expanded} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCaseDrawer(item); } }}>
                    <div className="case-icon">{item.icon}</div>
                    <div className="case-meta">
                      <div className="case-fir">{item.id} · {item.status}</div>
                      <div className="case-title">{item.title}</div>
                      <div className="case-desc">{item.desc}</div>
                      <div className="case-tags">
                        <span className="case-tag type-person">{item.jurisdiction}</span>
                        <span className="case-tag type-org">{item.type}</span>
                        <span className="case-tag">{item.suspects.length} entities</span>
                        {item.source === 'upload' && <span className="case-tag">📎 Uploaded</span>}
                        {item.clusterName && <span className="case-tag">{item.clusterName}</span>}
                        {item.leads?.length > 0 && <span className="case-tag">🕵️ {item.leads.length} lead{item.leads.length > 1 ? 's' : ''}</span>}
                      </div>
                    </div>
                    <div className="case-right">
                      <div className="case-risk-num" style={{ color: item.risk == null ? 'var(--text-muted)' : riskColor(item.risk) }}>{item.risk == null ? '—' : item.risk}</div>
                      <div className="case-risk-label">{item.risk == null ? 'Unassessed' : 'Risk Score'}</div>
                      <div className="case-date">Updated: {item.lastUpdate}</div>
                      <div className="case-chevron">{expanded ? '▲ Hide entities' : '▼ Show entities'}</div>
                    </div>
                  </div>
                  {expanded && (
                    <div className="case-dropdown">
                      <div className="case-dropdown-head">
                        <span>Entities in this case ({item.suspects.length})</span>
                        <button type="button" className="btn btn-sm" disabled={item.suspects.length === 0} onClick={() => navigate(`/app/dashboard?case=${encodeURIComponent(item.id)}`)}>View case in graph →</button>
                      </div>
                      {item.suspects.length === 0 && <div className="entity-search-empty">No entities linked to this case yet.</div>}
                      {item.suspects.map((suspect) => {
                        const target = caseEntities.find((n) => n.id === suspect);
                        return (
                          <div key={suspect} className="suspect-row case-dropdown-row">
                            <div className="suspect-avatar" style={{ background: target ? avatarColor(target.type) : '#37415c' }}>{target ? initials(target.id) : '?'}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="suspect-name">{suspect}</div>
                              <div className="suspect-alias">{target ? `${entityTypeLabel(target.type)} · ${target.jurisdiction}${target.alias && target.alias !== '—' ? ` · "${target.alias}"` : ''}` : 'Case entity'}</div>
                            </div>
                            {target?.risk != null && <span className="suspect-risk" style={{ color: riskColor(target.risk) }}>{target.risk}</span>}
                            <button type="button" className="mini-btn" onClick={() => navigate(`/app/dashboard?entity=${encodeURIComponent(suspect)}`)}>Open in graph</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {selectedCase && <aside className="drawer cases-drawer">
            <div className="drawer-header">
              <div style={{ fontSize: 22 }}>{selectedCase.icon}</div>
              <div style={{ minWidth: 0 }}>
                <div className="drawer-title">{selectedCase.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{selectedCase.id} · {selectedCase.jurisdiction} · Opened {selectedCase.opened}</div>
              </div>
            </div>
            <div className="drawer-body">
              <div className="drawer-section-title">Overview</div>
              <div className="card" style={{ padding: 14 }}>
                <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-dim)' }}>{selectedCase.desc}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 14 }}>
                  <div className="stat-box"><div className="n" style={{ color: selectedCase.risk == null ? 'var(--text-muted)' : riskColor(selectedCase.risk) }}>{selectedCase.risk == null ? '—' : selectedCase.risk}</div><div className="l">{selectedCase.risk == null ? 'Unassessed' : 'Risk Score'}</div></div>
                  <div className="stat-box"><div className="n">{selectedCase.suspects.length}</div><div className="l">Entities</div></div>
                  <div className="stat-box"><div className="n">{selectedCase.linkedCases}</div><div className="l">Linked Cases</div></div>
                </div>
                {selectedCase.sourceFiles && <div className="mod-row"><span>Source file{selectedCase.sourceFiles.length > 1 ? 's' : ''}</span><span>{selectedCase.sourceFiles.join(', ')}</span></div>}
                <div className="mod-row">
                  <label htmlFor="case-status-select">Status</label>
                  {canEdit ? (
                    <select id="case-status-select" className="field" value={selectedCase.status} onChange={(e) => changeStatus(e.target.value)}>
                      {[...new Set([...CASE_STATUSES, selectedCase.status])].map((status) => <option key={status}>{status}</option>)}
                    </select>
                  ) : <span className="badge badge-muted">{selectedCase.status}</span>}
                </div>
              </div>

              <div className="drawer-section-title">Suspects &amp; Entities ({selectedCase.suspects.length})</div>
              {selectedCase.suspects.map((suspect) => {
                const target = caseEntities.find((n) => n.id === suspect);
                return (
                  <div key={suspect} className="suspect-row" style={{ cursor: 'pointer' }} onClick={() => navigate(`/app/dashboard?entity=${encodeURIComponent(suspect)}`)}>
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
                {selectedCase.findings.length === 0 && <div className="entity-search-empty">No findings recorded yet.</div>}
                {selectedCase.findings.map((finding, index) => (
                  <div className="finding" key={`${selectedCase.id}-finding-${index}`}>
                    <div className="finding-title">🔍 Finding</div>
                    <div className="finding-text">{finding}</div>
                  </div>
                ))}
              </div>

              <div className="drawer-section-title">Recommendations</div>
              <div className="findings-list">
                {selectedCase.recommendations.length === 0 && <div className="entity-search-empty">No recommendations recorded yet.</div>}
                {selectedCase.recommendations.map((item, index) => (
                  <div className="finding" key={`${selectedCase.id}-rec-${index}`}>
                    <div className="finding-title">✅ Action</div>
                    <div className="finding-text">{item}</div>
                  </div>
                ))}
              </div>

              <div className="drawer-section-title">Lead Information ({selectedCase.leads?.length ?? 0})</div>
              {canEdit && (
                <div className="lead-form">
                  <textarea className="field" rows={3} maxLength={1000} placeholder="New information received, e.g. informant reports Rohan K. seen near Warehouse B-12 on Tuesday night" value={leadText} onChange={(e) => setLeadText(e.target.value)} />
                  <div className="lead-form-row">
                    <select className="field" aria-label="Lead source" value={leadSource} onChange={(e) => setLeadSource(e.target.value)}>
                      {LEAD_SOURCES.map((source) => <option key={source}>{source}</option>)}
                    </select>
                    <select className="field" aria-label="Lead reliability" value={leadReliability} onChange={(e) => setLeadReliability(e.target.value)}>
                      {LEAD_RELIABILITY.map((level) => <option key={level}>{level}</option>)}
                    </select>
                  </div>
                  <select className="field" aria-label="Link an entity" value="" onChange={(e) => e.target.value && setLeadEntities((current) => [...new Set([...current, e.target.value])])}>
                    <option value="">Link an entity (optional)…</option>
                    {caseEntities.filter((entity) => entity.type !== 'document' && !leadEntities.includes(entity.id)).map((entity) => <option key={entity.id} value={entity.id}>{entity.id} · {entityTypeLabel(entity.type)}</option>)}
                  </select>
                  {leadEntities.length > 0 && (
                    <div className="lead-chips">
                      {leadEntities.map((id) => (
                        <button type="button" key={id} className="chip active" title="Remove" onClick={() => setLeadEntities((current) => current.filter((value) => value !== id))}>{id} ×</button>
                      ))}
                    </div>
                  )}
                  <small className="lead-form-note">Leads are unverified field information, not evidence, until validated. Linked entities are added to this case.</small>
                  <button type="button" className="btn btn-sm" disabled={!leadText.trim()} onClick={addLead}>Add lead to case</button>
                </div>
              )}
              <div className="lead-list">
                {(selectedCase.leads?.length ?? 0) === 0 && <div className="entity-search-empty">No lead information added yet.</div>}
                {selectedCase.leads?.map((lead) => (
                  <div className="lead-entry" key={lead.id}>
                    <div className="lead-entry-head">
                      <span className={`lead-badge lead-${lead.reliability.toLowerCase()}`}>{lead.reliability}</span>
                      <span>{lead.source}</span>
                      <span className="lead-entry-date">{lead.date}{lead.by ? ` · ${lead.by}` : ''}</span>
                    </div>
                    <div className="lead-entry-text">{lead.text}</div>
                    {lead.entities?.length > 0 && (
                      <div className="lead-chips">
                        {lead.entities.map((id) => <button type="button" key={id} className="chip" onClick={() => navigate(`/app/dashboard?entity=${encodeURIComponent(id)}`)}>{id}</button>)}
                      </div>
                    )}
                    {canEdit && <button type="button" className="mini-btn" onClick={() => deleteLead(lead.id)}>Remove</button>}
                  </div>
                ))}
              </div>

              <div className="drawer-section-title">Case Diary</div>
              {canEdit && (
                <div className="mod-note">
                  <textarea className="field" rows={2} maxLength={500} placeholder="Add a diary entry" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
                  <button type="button" className="btn btn-sm" disabled={!noteText.trim()} onClick={addNote}>Add entry</button>
                </div>
              )}
              <div className="mod-timeline">
                {selectedCase.timeline.length === 0 && <div className="entity-search-empty">No diary entries yet.</div>}
                {selectedCase.timeline.map((entry, index) => (
                  <div className="mod-timeline-item" key={`${selectedCase.id}-tl-${index}`}>
                    <div className="mod-timeline-date">{entry.date}{entry.by ? ` · ${entry.by}` : ''}</div>
                    <div>{entry.text}</div>
                  </div>
                ))}
              </div>

              <div className="drawer-section-title">Reports ({relatedReports.length})</div>
              {relatedReports.map((report) => (
                <Link key={report.id} className="suspect-row" to={`/app/reports?report=${encodeURIComponent(report.id)}`}>
                  <div style={{ flex: 1 }}>
                    <div className="suspect-name">{report.name}</div>
                    <div className="suspect-alias">{report.id} · {report.status}</div>
                  </div>
                </Link>
              ))}
              {can(session?.role, 'reports.generate') && (
                <button type="button" className="btn ghost btn-sm" style={{ marginTop: 10 }} onClick={() => navigate(`/app/reports?case=${encodeURIComponent(selectedCase.id)}`)}>+ Generate report for this case</button>
              )}

              {canEdit && (
                <div className="case-delete-zone">
                  <div className="drawer-section-title">Remove case</div>
                  <button type="button" className="btn ghost btn-sm btn-danger" disabled={!deletable} onClick={deleteCase}>🗑 Delete case</button>
                  <small>{deletable ? 'Solved cases can be deleted. Graph entities and reports are kept.' : 'Mark the case Solved or Closed to enable deletion.'}</small>
                </div>
              )}
            </div>
          </aside>}
        </div>
      </main>
      <div id="toast" />
      {caseDialogOpen && <CaseCreationModal entities={caseEntities} onClose={() => setCaseDialogOpen(false)} onCreate={createCase} />}
    </div>
  );
}

function ReportCreationModal({ cases: availableCases, entities, initialCaseId = '', initialEntityId = '', onClose, onCreate }) {
  const [title, setTitle] = useState(() => {
    const caseItem = availableCases.find((item) => item.id === initialCaseId);
    if (caseItem) return `Case Report — ${caseItem.title}`;
    return initialEntityId ? `Forensic Report — ${initialEntityId}` : '';
  });
  const [caseId, setCaseId] = useState(initialCaseId);
  const [entityId, setEntityId] = useState(initialEntityId);
  const [error, setError] = useState('');

  const submit = (event) => {
    event.preventDefault();
    if (!title.trim() || (!caseId && !entityId)) {
      setError('Enter a report title and select a case or entity.');
      return;
    }
    onCreate({ title: title.trim(), caseId, entityId });
  };

  useEffect(() => {
    const handleKeyDown = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-overlay show" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="new-report-title">
        <div className="modal-head">
          <h2 id="new-report-title">Generate Local Report</h2>
          <button type="button" className="icon-btn" aria-label="Close report form" onClick={onClose}>×</button>
        </div>
        <form className="modal-body" onSubmit={submit}>
          <div className="form-group">
            <label htmlFor="report-title-input">Report title</label>
            <input id="report-title-input" className="field" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={120} />
          </div>
          <div className="form-group">
            <label htmlFor="report-case-select">Related case</label>
            <select id="report-case-select" className="field" value={caseId} onChange={(event) => setCaseId(event.target.value)}>
              <option value="">No case selected</option>
              {availableCases.map((caseItem) => <option value={caseItem.id} key={caseItem.id}>{caseItem.id} · {caseItem.title}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="report-entity-select">Related entity</label>
            <select id="report-entity-select" className="field" value={entityId} onChange={(event) => setEntityId(event.target.value)}>
              <option value="">No entity selected</option>
              {entities.map((entity) => <option value={entity.id} key={entity.id}>{entity.id} · {entityTypeLabel(entity.type)}</option>)}
            </select>
          </div>
          {error && <div className="case-upload-error" role="alert">{error}</div>}
          <div className="case-upload-notice">This creates a draft from local sample data. It is not a verified forensic or court report.</div>
          <div className="case-upload-footer">
            <button type="button" className="btn ghost btn-sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-sm">Create draft report</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ReportsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = getAuthSession();
  const canGenerate = can(session?.role, 'reports.generate');
  const [localReports, setLocalReports] = useState(() => loadLocalRecords(LOCAL_REPORTS_KEY));
  const [selectedReportId, setSelectedReportId] = useState(() => loadLocalRecords(LOCAL_REPORTS_KEY)[0]?.id ?? reports[0]?.id ?? null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialog, setDialog] = useState(null);

  const entities = useMemo(getAllEntities, []);
  const graphLinks = useMemo(getAllLinks, []);
  const caseList = useMemo(() => {
    const overrides = loadCaseOverrides();
    return [...loadLocalRecords(LOCAL_CASES_KEY), ...cases].filter((item) => !overrides[item.id]?.deleted).map((item) => applyCaseOverride(item, overrides[item.id]));
  }, []);
  const reviews = useMemo(() => Object.fromEntries(loadLocalRecords(PREDICTION_REVIEWS_KEY).map((review) => [review.id, review.status])), []);

  const allReports = useMemo(() => [...localReports, ...reports], [localReports]);
  const filteredReports = allReports.filter((report) => {
    if (statusFilter !== 'all' && report.status !== statusFilter) return false;
    const query = search.trim().toLowerCase();
    return !query || [report.id, report.name, report.case, report.entityId, report.analyst].some((value) => value?.toLowerCase().includes(query));
  });
  const selectedReport = allReports.find((report) => report.id === selectedReportId) ?? allReports[0];
  const sections = useMemo(
    () => (selectedReport ? buildReportContent(selectedReport, { caseList, entities, graphLinks, reviews }) : []),
    [selectedReport, caseList, entities, graphLinks, reviews],
  );

  useEffect(() => {
    if (!getAuthSession()) {
      navigate('/');
    }
  }, [navigate]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const reportId = params.get('report');
    if (reportId) setSelectedReportId(reportId);
    const caseId = params.get('case') ?? '';
    const entityId = params.get('entity') ?? '';
    if ((caseId || entityId) && can(getAuthSession()?.role, 'reports.generate')) setDialog({ caseId, entityId });
  }, [location.search]);

  const createReport = ({ title, caseId, entityId }) => {
    const now = new Date();
    const report = {
      id: `RPT-LOCAL-${now.getTime().toString().slice(-6)}`,
      name: title,
      case: caseId || null,
      entityId: entityId || null,
      date: now.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }),
      analyst: session?.badgeId ?? 'Unknown',
      status: 'draft',
      storage: 'local',
    };
    const updated = [report, ...localReports];
    try {
      saveLocalRecords(LOCAL_REPORTS_KEY, updated);
      setLocalReports(updated);
      setSelectedReportId(report.id);
      setDialog(null);
      navigate('/app/reports', { replace: true });
      showToast('Draft report created in this browser', 'ok');
    } catch (error) {
      console.error('Unable to save local report:', error);
      showToast('Could not save this report in browser storage', 'error');
    }
  };

  const markFinal = () => {
    const updated = localReports.map((report) => (report.id === selectedReport.id ? { ...report, status: 'final' } : report));
    try {
      saveLocalRecords(LOCAL_REPORTS_KEY, updated);
      setLocalReports(updated);
      showToast('Report marked final', 'ok');
    } catch (error) {
      console.error('Unable to update report:', error);
      showToast('Could not update this report', 'error');
    }
  };

  const deleteReport = () => {
    if (!window.confirm(`Delete ${selectedReport.id}? This cannot be undone.`)) return;
    const updated = localReports.filter((report) => report.id !== selectedReport.id);
    try {
      saveLocalRecords(LOCAL_REPORTS_KEY, updated);
      setLocalReports(updated);
      setSelectedReportId(updated[0]?.id ?? reports[0]?.id ?? null);
      showToast('Report deleted', 'ok');
    } catch (error) {
      console.error('Unable to delete report:', error);
      showToast('Could not delete this report', 'error');
    }
  };

  const isLocal = selectedReport?.storage === 'local';

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
          <div className="topbar-search"><input type="text" placeholder="Search reports, cases, entities" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <div className="topbar-right">
            <div className="badge badge-muted" title={session?.badgeId}>{ROLE_LABELS[session?.role]} · {session?.badgeId}</div>
            {canGenerate && <button className="btn btn-sm" onClick={() => setDialog({ caseId: '', entityId: '' })}>+ Generate Report</button>}
          </div>
        </div>

        <div className="reports-layout">
          <div className="reports-list-panel">
            <div className="reports-list-head">
              <h3>Reports</h3>
              <span className="badge badge-muted">{filteredReports.length}</span>
            </div>
            <div className="mod-chips" style={{ padding: '0 12px 10px' }}>
              {['all', 'final', 'draft', 'pending'].map((status) => (
                <button type="button" key={status} className={`chip ${statusFilter === status ? 'active' : ''}`} aria-pressed={statusFilter === status} onClick={() => setStatusFilter(status)}>{status}</button>
              ))}
            </div>
            <div className="reports-list">
              {filteredReports.length === 0 && <div className="entity-search-empty">No reports match.</div>}
              {filteredReports.map((report) => (
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
              <>
                <div className="report-actions">
                  <button type="button" className="btn ghost btn-sm" onClick={() => window.print()}>Print / Save as PDF</button>
                  <button type="button" className="btn ghost btn-sm" onClick={() => downloadFile(`${selectedReport.id}.html`, 'text/html;charset=utf-8', reportToHtml(selectedReport, sections))}>Download HTML</button>
                  {selectedReport.case && <button type="button" className="btn ghost btn-sm" onClick={() => navigate('/app/cases')}>Open cases</button>}
                  {selectedReport.entityId && <button type="button" className="btn ghost btn-sm" onClick={() => navigate(`/app/dashboard?entity=${encodeURIComponent(selectedReport.entityId)}`)}>View in graph</button>}
                  {isLocal && canGenerate && selectedReport.status !== 'final' && <button type="button" className="btn btn-sm" onClick={markFinal}>Mark final</button>}
                  {isLocal && canGenerate && <button type="button" className="btn ghost btn-sm" onClick={deleteReport}>Delete</button>}
                </div>
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
                      <div className="report-date">{selectedReport.date} · {selectedReport.analyst} · {selectedReport.status}</div>
                    </div>
                  </div>
                  <div className="report-section"><h3>{selectedReport.name}</h3></div>
                  {sections.map((section) => (
                    <div className="report-section" key={section.title}>
                      <h3>{section.title}</h3>
                      {section.paragraphs?.map((text) => <p key={text}>{text}</p>)}
                      {section.bullets && <ul className="report-list">{section.bullets.map((text) => <li key={text}>{text}</li>)}</ul>}
                      {section.table && (
                        <div className="report-table-wrap">
                          <table className="report-table">
                            <thead><tr>{section.table.head.map((cell) => <th key={cell}>{cell}</th>)}</tr></thead>
                            <tbody>{section.table.rows.map((row, rowIndex) => <tr key={`${section.title}-${rowIndex}`}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody>
                          </table>
                        </div>
                      )}
                      {section.numbered && (
                        <div className="recommendations">
                          {section.numbered.map((text, index) => <div className="rec-item" key={text}><div className="rec-num">{index + 1}</div><div className="rec-text">{text}</div></div>)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
      <div id="toast" />
      {dialog && (
        <ReportCreationModal
          cases={caseList}
          entities={entities}
          initialCaseId={dialog.caseId}
          initialEntityId={dialog.entityId}
          onClose={() => { setDialog(null); navigate('/app/reports', { replace: true }); }}
          onCreate={createReport}
        />
      )}
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
