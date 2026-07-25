// Dig deeper: list unique query strings for profiles + getUser
import { readFileSync } from 'node:fs';
const har = JSON.parse(readFileSync('d:/Antigravity/136HUB/WorkFlow/localhost.har', 'utf8'));
const entries = har.log.entries;

const profilesReqs = entries.filter(e => e.request.url.includes('/rest/v1/profiles'));
console.log('=== PROFILES REQUESTS (count=' + profilesReqs.length + ') ===');
// Group by query string
const byQuery = new Map();
for (const e of profilesReqs) {
  const q = e.request.url.split('?')[1] || '(none)';
  const decoded = decodeURIComponent(q);
  if (!byQuery.has(decoded)) byQuery.set(decoded, { count: 0, times: [], starts: [] });
  const o = byQuery.get(decoded);
  o.count++;
  o.times.push(e.time);
  o.starts.push(new Date(e.startedDateTime).getTime());
}
const t0 = Math.min(...entries.map(e => new Date(e.startedDateTime).getTime()));
for (const [q, info] of [...byQuery.entries()].sort((a, b) => b[1].count - a[1].count)) {
  console.log(`\n  ${info.count}× | avg ${(info.times.reduce((s,x)=>s+x,0)/info.times.length).toFixed(0)}ms`);
  console.log(`  query: ${q.slice(0, 200)}`);
  console.log(`  timing (ms from start): ${info.starts.map(t => (t - t0)).join(', ')}`);
}

console.log('\n\n=== AUTH GETUSER TIMING ===');
const authReqs = entries.filter(e => e.request.url.includes('/auth/v1/user'));
console.log(`count=${authReqs.length}`);
for (const e of authReqs) {
  const t = new Date(e.startedDateTime).getTime() - t0;
  console.log(`  +${t}ms | ${e.time.toFixed(0)}ms | referer=${e.request.headers.find(h => h.name.toLowerCase()==='referer')?.value || '?'}`);
}

console.log('\n\n=== PAGE NAV TIMING ===');
const navs = entries.filter(e =>
  /\/dashboard\/[^/]*$/.test(new URL(e.request.url, 'http://x').pathname) &&
  !e.request.url.includes('/_next/') &&
  e.request.method === 'GET' &&
  (e.response?.headers || []).some(h => h.name.toLowerCase() === 'content-type' && h.value.includes('html'))
);
for (const e of navs) {
  const t = new Date(e.startedDateTime).getTime() - t0;
  console.log(`  +${(t/1000).toFixed(2)}s | ${e.time.toFixed(0)}ms | ${e.request.url}`);
}

console.log('\n\n=== SCHEDULES URL VARIANTS ===');
const sched = entries.filter(e => e.request.url.includes('/rest/v1/schedules'));
const schedQ = new Map();
for (const e of sched) {
  const q = decodeURIComponent(e.request.url.split('?')[1] || '(none)');
  schedQ.set(q, (schedQ.get(q) || 0) + 1);
}
for (const [q, c] of schedQ) {
  console.log(`  ${c}× ${q.slice(0, 180)}`);
}

console.log('\n\n=== MANIFEST + ICON-192 ===');
const mani = entries.filter(e => e.request.url.includes('manifest.webmanifest') || e.request.url.includes('icon-192.png'));
for (const e of mani) {
  const t = new Date(e.startedDateTime).getTime() - t0;
  const cc = (e.response?.headers || []).find(h => h.name.toLowerCase() === 'cache-control')?.value || '-';
  console.log(`  +${(t/1000).toFixed(1)}s | ${e.time.toFixed(0)}ms | ${e.response.status} | cc=${cc} | ${e.request.url.split('/').pop()}`);
}
