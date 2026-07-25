#!/usr/bin/env node
// Analyze HAR file v2 - WorkFlow Portal perf analysis
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const HAR_PATH = resolve(__dirname, '..', 'localhost.har');

console.log(`Reading HAR: ${HAR_PATH}`);
const raw = readFileSync(HAR_PATH, 'utf8');
const har = JSON.parse(raw);
const entries = har.log.entries;
console.log(`Loaded ${entries.length} entries\n`);

// --- Session metrics ---
const times = entries.map(e => new Date(e.startedDateTime).getTime());
const sessionStart = Math.min(...times);
const sessionEnd = Math.max(...times.map((t, i) => t + (entries[i].time || 0)));
const sessionMs = sessionEnd - sessionStart;

let totalBytes = 0;
for (const e of entries) {
  const bs = e.response?.bodySize > 0 ? e.response.bodySize : (e.response?.content?.size || 0);
  totalBytes += bs;
}

// --- Helpers ---
const fmt = (n) => {
  if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(2) + ' MB';
  if (n >= 1024) return (n / 1024).toFixed(1) + ' KB';
  return n + ' B';
};
const ms = (n) => n < 1000 ? n.toFixed(0) + 'ms' : (n / 1000).toFixed(2) + 's';
const trimUrl = (u, n = 120) => u.length > n ? u.slice(0, n) + '…' : u;

console.log('='.repeat(80));
console.log('SESSION OVERVIEW');
console.log('='.repeat(80));
console.log(`Total requests : ${entries.length}`);
console.log(`Total bytes    : ${fmt(totalBytes)}`);
console.log(`Session dur    : ${ms(sessionMs)}`);
console.log();

// --- Top by time ---
const byTime = [...entries].sort((a, b) => b.time - a.time).slice(0, 10);
console.log('='.repeat(80));
console.log('TOP 10 SLOWEST (by time)');
console.log('='.repeat(80));
for (const e of byTime) {
  const size = e.response?.bodySize > 0 ? e.response.bodySize : (e.response?.content?.size || 0);
  console.log(`${ms(e.time).padStart(8)} | ${fmt(size).padStart(10)} | ${e.response?.status || '?'} | ${e.request.method} ${trimUrl(e.request.url)}`);
}
console.log();

// --- Top by size ---
const byBytes = [...entries].sort((a, b) => {
  const as = a.response?.bodySize > 0 ? a.response.bodySize : (a.response?.content?.size || 0);
  const bs = b.response?.bodySize > 0 ? b.response.bodySize : (b.response?.content?.size || 0);
  return bs - as;
}).slice(0, 10);
console.log('='.repeat(80));
console.log('TOP 10 LARGEST (by response size)');
console.log('='.repeat(80));
for (const e of byBytes) {
  const size = e.response?.bodySize > 0 ? e.response.bodySize : (e.response?.content?.size || 0);
  console.log(`${fmt(size).padStart(10)} | ${ms(e.time).padStart(8)} | ${e.response?.status || '?'} | ${e.request.method} ${trimUrl(e.request.url)}`);
}
console.log();

// --- Group by pattern ---
function classify(url) {
  if (url.includes('/realtime/v1/websocket')) return 'realtime:ws';
  if (url.includes('/auth/v1/user')) return 'auth:getUser';
  if (url.includes('/auth/v1/token')) return 'auth:token';
  if (url.includes('/auth/v1/')) return 'auth:other';
  if (url.includes('/rest/v1/profiles')) return 'rest:profiles';
  if (url.includes('/rest/v1/schedules')) return 'rest:schedules';
  if (url.includes('/rest/v1/tasks')) return 'rest:tasks';
  if (url.includes('/rest/v1/task_')) return 'rest:task_*';
  if (url.includes('/rest/v1/notifications')) return 'rest:notifications';
  if (url.includes('/rest/v1/announcements')) return 'rest:announcements';
  if (url.includes('/rest/v1/departments')) return 'rest:departments';
  if (url.includes('/rest/v1/rpc/')) {
    const m = url.match(/\/rpc\/([^?]+)/);
    return 'rpc:' + (m ? m[1] : 'unknown');
  }
  if (url.includes('/rest/v1/')) {
    const m = url.match(/\/rest\/v1\/([^?]+)/);
    return 'rest:' + (m ? m[1] : 'other');
  }
  if (url.includes('/storage/v1/render/image/public/avatars/')) return 'storage:avatar-transform';
  if (url.includes('/storage/v1/object/public/avatars/')) return 'storage:avatar-raw';
  if (url.includes('/storage/v1/render/image/')) return 'storage:render-other';
  if (url.includes('/storage/v1/object/public/')) return 'storage:object-public';
  if (url.includes('/storage/v1/')) return 'storage:other';
  if (url.includes('/_next/static/chunks/')) return 'next:chunks';
  if (url.includes('/_next/static/css/')) return 'next:css';
  if (url.includes('/_next/static/media/')) return 'next:media';
  if (url.includes('/_next/static/')) return 'next:static-other';
  if (url.includes('/_next/image')) return 'next:image';
  if (url.includes('/_next/data/')) return 'next:data';
  if (url.match(/\/(dashboard|login|tasks|schedule|profile|home)/)) return 'page:nav';
  if (url.startsWith('data:')) return 'data:url';
  if (url.match(/\.(png|jpg|jpeg|webp|svg|ico)(\?|$)/)) return 'asset:image';
  if (url.match(/\.(woff2?|ttf|otf)(\?|$)/)) return 'asset:font';
  return 'other';
}

const groups = new Map();
for (const e of entries) {
  const key = classify(e.request.url);
  if (!groups.has(key)) groups.set(key, { count: 0, bytes: 0, totalTime: 0, urls: new Map() });
  const g = groups.get(key);
  const size = e.response?.bodySize > 0 ? e.response.bodySize : (e.response?.content?.size || 0);
  g.count++;
  g.bytes += size;
  g.totalTime += (e.time || 0);
  // strip query for url-level dedup
  const stripped = e.request.url.split('?')[0];
  g.urls.set(stripped, (g.urls.get(stripped) || 0) + 1);
}

const groupArr = [...groups.entries()].sort((a, b) => b[1].bytes - a[1].bytes);
console.log('='.repeat(80));
console.log('REQUESTS GROUPED BY PATTERN (sorted by bytes)');
console.log('='.repeat(80));
console.log(`${'GROUP'.padEnd(28)} ${'COUNT'.padStart(6)} ${'BYTES'.padStart(11)} ${'TOTAL_TIME'.padStart(11)} UNIQ_URLS`);
for (const [k, v] of groupArr) {
  console.log(`${k.padEnd(28)} ${String(v.count).padStart(6)} ${fmt(v.bytes).padStart(11)} ${ms(v.totalTime).padStart(11)} ${v.urls.size}`);
}
console.log();

// --- Repeated URLs >3 ---
console.log('='.repeat(80));
console.log('SUSPICIOUS REPEATED URLS (same URL stripped of query, count > 3)');
console.log('='.repeat(80));
const urlCount = new Map();
const urlBytes = new Map();
const urlTime = new Map();
for (const e of entries) {
  const u = e.request.url.split('?')[0];
  urlCount.set(u, (urlCount.get(u) || 0) + 1);
  const size = e.response?.bodySize > 0 ? e.response.bodySize : (e.response?.content?.size || 0);
  urlBytes.set(u, (urlBytes.get(u) || 0) + size);
  urlTime.set(u, (urlTime.get(u) || 0) + (e.time || 0));
}
const repeated = [...urlCount.entries()]
  .filter(([, c]) => c > 3)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 30);
for (const [u, c] of repeated) {
  console.log(`${String(c).padStart(4)}× | ${fmt(urlBytes.get(u)).padStart(10)} | ${ms(urlTime.get(u)).padStart(8)} | ${trimUrl(u, 140)}`);
}
console.log();

// --- Avatar requests detail ---
console.log('='.repeat(80));
console.log('AVATAR REQUESTS (all)');
console.log('='.repeat(80));
const avatarEntries = entries.filter(e => /\/avatars\//.test(e.request.url) || e.request.url.includes('render/image'));
let avatarTransformCount = 0, avatarRawCount = 0;
let avatarTransformBytes = 0, avatarRawBytes = 0;
for (const e of avatarEntries) {
  const size = e.response?.bodySize > 0 ? e.response.bodySize : (e.response?.content?.size || 0);
  const isTransform = e.request.url.includes('/storage/v1/render/image/');
  const isRaw = e.request.url.includes('/storage/v1/object/public/avatars/');
  if (isTransform) { avatarTransformCount++; avatarTransformBytes += size; }
  if (isRaw) { avatarRawCount++; avatarRawBytes += size; }
}
console.log(`avatar via /render/image/  : ${avatarTransformCount} req, ${fmt(avatarTransformBytes)}`);
console.log(`avatar via /object/public/ : ${avatarRawCount} req, ${fmt(avatarRawBytes)} ${avatarRawCount > 0 ? '<-- STILL RAW!' : ''}`);
console.log();
console.log('Detail (sorted by size desc, top 20):');
const avatarSorted = [...avatarEntries].sort((a, b) => {
  const as = a.response?.bodySize > 0 ? a.response.bodySize : (a.response?.content?.size || 0);
  const bs = b.response?.bodySize > 0 ? b.response.bodySize : (b.response?.content?.size || 0);
  return bs - as;
}).slice(0, 20);
for (const e of avatarSorted) {
  const size = e.response?.bodySize > 0 ? e.response.bodySize : (e.response?.content?.size || 0);
  const route = e.request.url.includes('/storage/v1/render/image/') ? 'TRANSFORM'
              : e.request.url.includes('/storage/v1/object/public/') ? 'RAW'
              : 'OTHER';
  console.log(`${route.padEnd(10)} ${fmt(size).padStart(10)} ${ms(e.time).padStart(8)} ${trimUrl(e.request.url, 130)}`);
}
console.log();

// --- Realtime WebSocket ---
console.log('='.repeat(80));
console.log('REALTIME WEBSOCKET');
console.log('='.repeat(80));
const wsEntries = entries.filter(e => /\/realtime\/v1\/websocket/.test(e.request.url));
console.log(`WS connection requests: ${wsEntries.length}`);
for (const e of wsEntries) {
  console.log(`  status=${e.response?.status} time=${ms(e.time)} url=${trimUrl(e.request.url, 140)}`);
}
console.log();

// --- Auth / profiles fetch comparison vs baseline ---
console.log('='.repeat(80));
console.log('BASELINE COMPARISON (HAR đợt 1: 16MB / 245 req)');
console.log('='.repeat(80));
const profilesGroup = groups.get('rest:profiles');
const authGetUser = groups.get('auth:getUser');
console.log(`profiles fetch : ${profilesGroup?.count || 0}× (baseline đợt 1: 23×)`);
console.log(`auth.getUser   : ${authGetUser?.count || 0}× (baseline đợt 1: 15×)`);
console.log(`avatar raw     : ${avatarRawCount}× ${fmt(avatarRawBytes)} (baseline: 1× 10MB)`);
console.log(`total bytes    : ${fmt(totalBytes)} (baseline: 16MB)`);
console.log(`total req      : ${entries.length} (baseline: 245)`);
console.log();

// --- Status code distribution ---
console.log('='.repeat(80));
console.log('STATUS CODE DISTRIBUTION');
console.log('='.repeat(80));
const statusMap = new Map();
for (const e of entries) {
  const s = e.response?.status || 0;
  statusMap.set(s, (statusMap.get(s) || 0) + 1);
}
for (const [s, c] of [...statusMap.entries()].sort((a, b) => a[0] - b[0])) {
  console.log(`  ${s}: ${c}`);
}
console.log();

console.log('Analysis complete.');
