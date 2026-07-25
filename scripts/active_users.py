import urllib.request, json
from collections import Counter
import sys

SVC = sys.argv[1]
URL = 'https://hnnjbnskxzpfkkjgrazh.supabase.co'
hdr = {'Authorization': f'Bearer {SVC}', 'apikey': SVC}

def q(t, p, timeout=30):
    try:
        with urllib.request.urlopen(urllib.request.Request(f'{URL}/rest/v1/{t}?{p}', headers=hdr), timeout=timeout) as r:
            return json.loads(r.read())
    except Exception as e:
        print(f'  [SKIP {t}] {e}')
        return []

profiles = q('profiles', 'select=id,full_name,role,department_id&limit=500')
depts = q('departments', 'select=id,name,code&limit=50')
pmap = {p['id']: p for p in profiles}
dmap = {d['id']: d for d in depts}

scheds = q('schedules', 'select=created_by&limit=2000')
tasks = q('tasks', 'select=created_by,assignee_id&limit=500')
docs = q('documents', 'select=created_by&limit=500')
notifs = q('notifications', 'select=user_id&limit=3000')
parts = q('schedule_participants', 'select=profile_id&limit=5000')
subs = q('push_subscriptions', 'select=user_id&limit=500')
tas = q('task_assignees', 'select=user_id&limit=5000')

sc = set(s.get('created_by') for s in scheds if s.get('created_by'))
tc = set(t.get('created_by') for t in tasks if t.get('created_by'))
ta_set = set(t.get('assignee_id') for t in tasks if t.get('assignee_id'))
dc = set(d.get('created_by') for d in docs if d.get('created_by'))
nu = set(n.get('user_id') for n in notifs if n.get('user_id'))
pu = set(p.get('profile_id') for p in parts if p.get('profile_id'))
su = set(s.get('user_id') for s in subs if s.get('user_id'))
tau = set(t.get('user_id') for t in tas if t.get('user_id'))

all_active = set()
all_active.update(sc, tc, ta_set, dc, nu, pu, su, tau)
inactive = set(p['id'] for p in profiles) - all_active

print(f'\nTổng profiles DB: {len(profiles)}')
print(f'Người có hoạt động: {len(all_active)}')
print(f'Người KHÔNG có hoạt động: {len(inactive)}')

print(f'\n--- CHI TIẾT TỪNG LOẠI ---')
print(f'  📅 Tạo lịch: {len(sc)}')
print(f'  ✅ Tạo task: {len(tc)}')
print(f'  ✅ Nhận task: {len(ta_set)}')
print(f'  📄 Tạo hồ sơ: {len(dc)}')
print(f'  🔔 Nhận thông báo: {len(nu)}')
print(f'  👥 Tham gia lịch: {len(pu)}')
print(f'  📱 Push sub: {len(su)}')
print(f'  🏷️ Task assignees: {len(tau)}')

print(f'\n--- ROLE CỦA NGƯỜI CÓ HOẠT ĐỘNG ---')
ar = Counter()
for uid in all_active:
    p = pmap.get(uid, {})
    ar[p.get('role', '?')] += 1
for r, c in sorted(ar.items(), key=lambda x: -x[1]):
    total_of_role = sum(1 for p in profiles if p.get('role') == r)
    print(f'  {r:12s}: {c:3d} / {total_of_role:3d} người ({c*100//total_of_role}%)')

print(f'\n--- NGƯỜI KHÔNG CÓ HOẠT ĐỘNG ---')
print(f'  Tổng: {len(inactive)} người')
cnt = 0
for uid in sorted(inactive, key=lambda u: pmap.get(u,{}).get('full_name','?')):
    if cnt >= 30: 
        print(f'  ... và {len(inactive)-30} người khác')
        break
    p = pmap.get(uid, {})
    dn = dmap.get(p.get('department_id'), {}).get('name', '?')
    print(f'  {p.get("full_name","?"):25s} role={p.get("role","?"):12s} dept={dn}')
    cnt += 1
