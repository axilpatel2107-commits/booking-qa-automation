#!/usr/bin/env node
// Reads a JMeter CSV results file (.jtl) and fails the build if the run broke
// the agreed thresholds. JMeter itself exits 0 even when assertions fail,
// so CI needs something like this to act as the quality gate.
//
// Usage: node scripts/check-jmeter-results.js performance/results/results.jtl
// Thresholds (env): MAX_ERROR_PCT (default 1), MAX_P95_MS (default 500)

const fs = require('node:fs');

const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.error(`Results file not found: ${file}`);
  process.exit(2);
}

const MAX_ERROR_PCT = Number(process.env.MAX_ERROR_PCT ?? 1);
const MAX_P95_MS = Number(process.env.MAX_P95_MS ?? 500);

// Minimal CSV parser that copes with quoted fields (JMeter quotes messages containing commas).
function parseLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

const [header, ...rows] = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/);
const cols = parseLine(header);
const idx = (name) => {
  const i = cols.indexOf(name);
  if (i === -1) throw new Error(`Column "${name}" missing from ${file}. Is it a CSV .jtl with a header row?`);
  return i;
};
const [iLabel, iElapsed, iSuccess, iCode] = ['label', 'elapsed', 'success', 'responseCode'].map(idx);

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];

const byLabel = new Map();
const all = { times: [], errors: 0 };
const failures = new Map();

for (const line of rows) {
  if (!line) continue;
  const r = parseLine(line);
  const label = r[iLabel];
  const elapsed = Number(r[iElapsed]);
  const ok = r[iSuccess] === 'true';
  if (!byLabel.has(label)) byLabel.set(label, { times: [], errors: 0 });
  const s = byLabel.get(label);
  s.times.push(elapsed);
  all.times.push(elapsed);
  if (!ok) {
    s.errors++;
    all.errors++;
    const key = `${label} -> ${r[iCode]}`;
    failures.set(key, (failures.get(key) || 0) + 1);
  }
}

if (!all.times.length) {
  console.error('No samples found in results file.');
  process.exit(2);
}

const summarise = (s) => {
  const sorted = [...s.times].sort((a, b) => a - b);
  return {
    samples: sorted.length,
    'error %': +((s.errors / sorted.length) * 100).toFixed(2),
    'avg ms': Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length),
    'p90 ms': percentile(sorted, 90),
    'p95 ms': percentile(sorted, 95),
    'max ms': sorted[sorted.length - 1],
  };
};

const table = {};
for (const [label, s] of byLabel) table[label] = summarise(s);
const total = summarise(all);
table.TOTAL = total;
console.table(table);

if (failures.size) {
  console.log('\nFailed samples by request and status code:');
  for (const [k, n] of failures) console.log(`  ${k}: ${n}`);
}

const problems = [];
if (total['error %'] > MAX_ERROR_PCT) problems.push(`error rate ${total['error %']}% > ${MAX_ERROR_PCT}%`);
if (total['p95 ms'] > MAX_P95_MS) problems.push(`p95 ${total['p95 ms']}ms > ${MAX_P95_MS}ms`);

if (problems.length) {
  console.error(`\n❌ Performance gate failed: ${problems.join('; ')}`);
  process.exit(1);
}
console.log(`\n✅ Performance gate passed (error rate <= ${MAX_ERROR_PCT}%, p95 <= ${MAX_P95_MS}ms)`);
