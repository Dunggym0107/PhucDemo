#!/usr/bin/env python3
"""
Weekly Activity Report — WorkFlow Portal
Usage: SUPABASE_SERVICE_ROLE_KEY="eyJ..." python weekly_report.py
"""

import os, sys, json, urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta

SVC = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
if not SVC:
    print("ERROR: export SUPABASE_SERVICE_ROLE_KEY first")
    sys.exit(1)

URL = "https://hnnjbnskxzpfkkjgrazh.supabase.co"
HDR = {"apikey": SVC, "Authorization": f"Bearer {SVC}"}

def q(table, params, timeout=30):
    url = f"{URL}/rest/v1/{table}?{params}"
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=HDR), timeout=timeout) as r:
            return json.loads(r.read())
    except Exception as e:
        print(f"[SKIP] {table}: {e}", file=sys.stderr)
        return []

# ─── FETCH ─────────────────────────────────────────────────────────────────────
profiles = q("profiles", "select=id,full_name,role&limit=500")
schedules = q("schedules", "select=id,title,type,status,start_time,end_time,created_by,created_at&order=created_at.desc&limit=2000")
parts = q("schedule_participants", "select=schedule_id,profile_id&limit=5000")
tasks = q("tasks", "select=id,title,status,priority,created_by,assignee_id,created_at,due_date,is_archived&limit=1000")
notifs = q("notifications", "select=id,user_id,type,is_read,created_at&order=created_at.desc&limit=5000")
task_as = q("task_assignees", "select=user_id&limit=5000")
docs = q("documents", "select=id,created_by,created_at&limit=500")

pmap = {p["id"]: p for p in profiles}

# ─── TIME ──────────────────────────────────────────────────────────────────────
VN = timezone(timedelta(hours=7))
now = datetime.now(VN)
today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
week_start = today_start - timedelta(days=today_start.weekday())
month_start = today_start.replace(day=1)

def in_range(ts_str, start):
    if not ts_str: return False
    try:
        d = datetime.fromisoformat(ts_str.replace("Z","+00:00")).astimezone(VN)
        return d >= start
    except:
        return False

# ─── ACTIVE USERS ──────────────────────────────────────────────────────────────
sched_creators = set(s["created_by"] for s in schedules if s.get("created_by"))
task_creators = set(t["created_by"] for t in tasks if t.get("created_by"))
task_assignees = set(t["assignee_id"] for t in tasks if t.get("assignee_id"))
part_users = set(p["profile_id"] for p in parts if p.get("profile_id"))
notif_users = set(n["user_id"] for n in notifs if n.get("user_id"))
tas_users = set(t["user_id"] for t in task_as if t.get("user_id"))
doc_creators = set(d["created_by"] for d in docs if d.get("created_by"))

all_active = set().union(sched_creators, task_creators, task_assignees, part_users, notif_users, tas_users, doc_creators)

# Weekly active
week_scheds = [s for s in schedules if in_range(s.get("created_at"), week_start)]
week_tasks = [t for t in tasks if in_range(t.get("created_at"), week_start)]
week_notifs = [n for n in notifs if in_range(n.get("created_at"), week_start)]
week_parts = [p for p in parts if in_range(p.get("created_at"), week_start)]

week_creators = set(s["created_by"] for s in week_scheds if s.get("created_by"))
week_taskers = set(t["created_by"] for t in week_tasks if t.get("created_by"))
week_notif_users = set(n["user_id"] for n in week_notifs if n.get("user_id"))
week_part_users = set(p["profile_id"] for p in week_parts if p.get("profile_id"))
week_active = set().union(week_creators, week_taskers, week_notif_users, week_part_users)

sched_today = [s for s in schedules if in_range(s.get("start_time"), today_start)]
today_sched_ids = set(s["id"] for s in sched_today)
today_part_ids = set(p["profile_id"] for p in parts if p.get("schedule_id") in today_sched_ids)
tasks_today = [t for t in tasks if in_range(t.get("created_at"), today_start)]
notifs_today = [n for n in notifs if in_range(n.get("created_at"), today_start)]

# ─── SCHEDULE STATS ──────────────────────────────────────────────────────────
sched_status = Counter(s["status"] for s in schedules)
sched_type = Counter(s["type"] for s in schedules)
sched_by_day = Counter()
for s in schedules:
    t = s.get("created_at","")[:10]
    sched_by_day[t] += 1

# ─── TASK STATS ──────────────────────────────────────────────────────────────
active_tasks = [t for t in tasks if not t.get("is_archived")]
task_status = Counter(t["status"] for t in active_tasks)
task_priority = Counter(t.get("priority","?") for t in active_tasks)

# ─── NOTIF STATS ─────────────────────────────────────────────────────────────
notif_type = Counter(n.get("type","?") for n in notifs)
notif_read = sum(1 for n in notifs if n.get("is_read"))
notif_unread = len(notifs) - notif_read

# ─── WEEKLY TREND ────────────────────────────────────────────────────────────
day_labels = []
day_sched = []
day_task = []
for i in range(6, -1, -1):
    d = (now - timedelta(days=i)).strftime("%Y-%m-%d")
    day_labels.append((now - timedelta(days=i)).strftime("%a %d/%m"))
    day_sched.append(sum(1 for s in schedules if (s.get("created_at") or "")[:10] == d))
    day_task.append(sum(1 for t in tasks if (t.get("created_at") or "")[:10] == d))

# ─── TOP CREATORS ────────────────────────────────────────────────────────────
creator_count = Counter(s["created_by"] for s in schedules if s.get("created_by"))
top_creators = creator_count.most_common(5)

# ─── HTML ────────────────────────────────────────────────────────────────────
status_lb = {"pending":"Chờ duyệt","approved":"Đã duyệt","rejected":"Từ chối",
             "in_progress":"Đang TH","completed":"Hoàn thành","todo":"Cần làm",
             "doing":"Đang làm","done":"Xong","submitted":"Chờ duyệt",
             "canceled":"Đã huỷ","closed":"Đã đóng","late":"Trễ"}
type_lb = {"trip":"Công tác","meeting":"Họp","event":"Sự kiện","leave":"Nghỉ phép"}
NOTIF_COLORS = {"schedule":"#f97316","task":"#22c55e","document_handover":"#3b82f6","schedule_leave":"#8b5cf6"}
BAR_COLORS = {"todo":"#f59e0b","doing":"#3b82f6","done":"#22c55e",
              "submitted":"#8b5cf6","canceled":"#ef4444","closed":"#6b7280",
              "pending":"#f59e0b","approved":"#22c55e","rejected":"#ef4444",
              "in_progress":"#3b82f6","completed":"#6b7280"}

week_range = f"{week_start.strftime('%d/%m')} - {now.strftime('%d/%m/%Y')}"
max_day = max(max(day_sched), max(day_task), 1)

html = f"""<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>📊 WorkFlow — Báo cáo hoạt động</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  *{{margin:0;padding:0;box-sizing:border-box}}
  body{{font-family:'Inter',sans-serif;background:#f1f5f9;color:#1e293b;padding:32px}}
  .container{{max-width:900px;margin:0 auto}}
  .header{{background:linear-gradient(135deg,#1e3a5f,#2563eb);color:#fff;border-radius:24px;padding:36px 40px;margin-bottom:28px;position:relative;overflow:hidden}}
  .header::after{{content:'';position:absolute;top:-60%;right:-20%;width:400px;height:400px;background:rgba(255,255,255,.03);border-radius:50%}}
  .header h1{{font-size:30px;font-weight:800;margin-bottom:2px}}
  .header .sub{{font-size:14px;opacity:.75}}
  .header .date{{font-size:13px;opacity:.5;margin-top:10px}}
  .card{{background:#fff;border-radius:16px;padding:24px;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,.05)}}
  .card h2{{font-size:14px;font-weight:700;color:#1e293b;margin-bottom:16px;display:flex;align-items:center;gap:8px}}
  .kpi-grid{{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px}}
  .kpi{{background:#fff;border-radius:14px;padding:20px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.05)}}
  .kpi .num{{font-size:34px;font-weight:800;line-height:1}}
  .kpi .lbl{{font-size:11px;color:#64748b;font-weight:500;margin-top:4px}}
  .kpi .sub{{font-size:11px;font-weight:600;margin-top:4px}}
  .stat-row{{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f1f5f9}}
  .stat-row:last-child{{border:none}}
  .stat-label{{font-size:13px;font-weight:500;color:#475569}}
  .stat-count{{font-size:18px;font-weight:700}}
  .bar{{display:flex;gap:3px;align-items:flex-end;height:60px;margin-top:12px}}
  .bar-col{{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px}}
  .bar-fill{{width:100%;border-radius:4px 4px 0 0;min-height:4px;transition:height .4s}}
  .bar-val{{font-size:11px;font-weight:700;color:#475569}}
  .bar-day{{font-size:10px;color:#94a3b8;font-weight:500}}
  .two-col{{display:grid;grid-template-columns:1fr 1fr;gap:20px}}
  .badge{{display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:600;color:#fff}}
  .flex{{display:flex;align-items:center;gap:8px;flex-wrap:wrap}}
  .gap{{gap:8px}}
  .mt-4{{margin-top:4px}}
  .mt-8{{margin-top:8px}}
  .text-muted{{color:#94a3b8;font-size:12px}}
  @media(max-width:640px){{
    body{{padding:16px}}
    .header{{padding:24px}}
    .header h1{{font-size:24px}}
    .kpi-grid{{grid-template-columns:repeat(2,1fr)}}
    .two-col{{grid-template-columns:1fr}}
    .kpi .num{{font-size:28px}}
  }}
</style>
</head>
<body>
<div class="container">

<!-- HEADER -->
<div class="header">
  <h1>📊 WorkFlow Portal</h1>
  <div class="sub">Báo cáo hoạt động ứng dụng</div>
  <div class="date">Tuần {week_range}</div>
</div>

<!-- KPI QUICK VIEW -->
<div class="kpi-grid">
  <div class="kpi">
    <div class="num" style="color:#2563eb">{len(all_active)}</div>
    <div class="lbl">Người dùng có hoạt động</div>
    <div class="sub" style="color:#2563ab">{len(week_active)} người/tuần này</div>
  </div>
  <div class="kpi">
    <div class="num" style="color:#f97316">{len(schedules)}</div>
    <div class="lbl">Lịch trình đã tạo</div>
    <div class="sub" style="color:#f97316">{len(week_scheds)} lịch/tuần này</div>
  </div>
  <div class="kpi">
    <div class="num" style="color:#22c55e">{len(active_tasks)}</div>
    <div class="lbl">Công việc đang mở</div>
    <div class="sub" style="color:#22c55e">{sum(1 for t in tasks if not t.get('is_archived') and t['status'] in ('doing','todo'))} việc chưa xong</div>
  </div>
  <div class="kpi">
    <div class="num" style="color:#8b5cf6">{len(notifs)}</div>
    <div class="lbl">Thông báo đã gửi</div>
    <div class="sub" style="color:#8b5cf6">{notif_unread} chưa đọc</div>
  </div>
</div>

<!-- TWO-COL: HOẠT ĐỘNG HÔM NAY + XU HƯỚNG TUẦN -->
<div class="two-col">
  <!-- TODAY -->
  <div class="card">
    <h2>⚡ Hoạt động hôm nay ({now.strftime('%d/%m')})</h2>
    <div class="stat-row"><span class="stat-label">📅 Lịch trình</span><span class="stat-count" style="color:#f97316">{len(sched_today)}</span></div>
    <div class="stat-row"><span class="stat-label">👥 Người tham gia</span><span class="stat-count" style="color:#3b82f6">{len(today_part_ids)}</span></div>
    <div class="stat-row"><span class="stat-label">✅ Công việc tạo mới</span><span class="stat-count" style="color:#22c55e">{len(tasks_today)}</span></div>
    <div class="stat-row"><span class="stat-label">🔔 Thông báo gửi đi</span><span class="stat-count" style="color:#8b5cf6">{len(notifs_today)}</span></div>
  </div>

  <!-- WEEKLY TREND -->
  <div class="card">
    <h2>📈 Xu hướng 7 ngày</h2>
    <div class="bar">
"""
for i in range(7):
    sh = day_sched[i]
    tk = day_task[i]
    sh_h = max(sh / max_day * 56, 4) if max_day else 4
    tk_h = max(tk / max_day * 56, 4) if max_day else 4
    html += f"""
      <div class="bar-col">
        <div class="bar-val">{sh}</div>
        <div class="bar-fill" style="height:{sh_h:.0f}px;background:#f97316"></div>
        <div class="bar-fill" style="height:{tk_h:.0f}px;background:#22c55e"></div>
        <div class="bar-day">{day_labels[i][:2]}</div>
      </div>"""

html += """
    </div>
    <div class="flex mt-8" style="justify-content:center;gap:16px">
      <span class="flex gap"><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#f97316"></span> Lịch</span>
      <span class="flex gap"><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#22c55e"></span> Task</span>
    </div>
  </div>
</div>

<!-- LỊCH TRÌNH -->
<div class="card">
  <h2>📅 Lịch trình</h2>
  <div class="two-col">
    <div>
      <div style="font-size:13px;font-weight:600;color:#64748b;margin-bottom:8px">Theo trạng thái</div>
"""
for st, cnt in sorted(sched_status.items(), key=lambda x: -x[1]):
    lb = status_lb.get(st, st)
    c = BAR_COLORS.get(st, "#6b7280")
    pct = cnt/len(schedules)*100 if schedules else 0
    html += f'<div class="stat-row" style="padding:6px 0"><span class="stat-label"><span class="badge" style="background:{c}">{lb}</span></span><span class="stat-count" style="font-size:15px">{cnt}</span></div>'

html += """
    </div>
    <div>
      <div style="font-size:13px;font-weight:600;color:#64748b;margin-bottom:8px">Theo loại</div>
"""
for t, cnt in sorted(sched_type.items(), key=lambda x: -x[1]):
    lb = type_lb.get(t, t)
    html += f'<div class="stat-row" style="padding:6px 0"><span class="stat-label">{lb}</span><span class="stat-count" style="font-size:15px">{cnt}</span></div>'

html += """
    </div>
  </div>
  <!-- Top creators -->
  <div style="margin-top:16px;padding-top:16px;border-top:1px solid #f1f5f9">
    <div style="font-size:13px;font-weight:600;color:#64748b;margin-bottom:8px">👤 Người tạo nhiều nhất</div>
"""
for uid, cnt in top_creators:
    name = pmap.get(uid, {}).get("full_name", "?")
    html += f'<div class="stat-row" style="padding:4px 0"><span class="stat-label">{name}</span><span class="stat-count" style="font-size:14px;color:#f97316">{cnt} lịch</span></div>'
html += """
  </div>
</div>

<!-- CÔNG VIỆC & THÔNG BÁO -->
<div class="two-col">
  <!-- TASKS -->
  <div class="card">
    <h2>✅ Công việc</h2>
    <div style="font-size:13px;font-weight:600;color:#64748b;margin-bottom:8px">Phân bổ trạng thái</div>
"""
for st, cnt in sorted(task_status.items(), key=lambda x: -x[1]):
    lb = status_lb.get(st, st)
    c = BAR_COLORS.get(st, "#6b7280")
    html += f'<div class="stat-row" style="padding:6px 0"><span class="stat-label"><span class="badge" style="background:{c}">{lb}</span></span><span class="stat-count" style="font-size:15px">{cnt}</span></div>'

html += f"""
    <div style="margin-top:12px;padding-top:12px;border-top:1px solid #f1f5f9">
      <div class="stat-row"><span class="stat-label">📝 Tổng công việc đã tạo</span><span class="stat-count" style="font-size:15px">{len(tasks)}</span></div>
      <div class="stat-row"><span class="stat-label">🔄 Đang active</span><span class="stat-count" style="font-size:15px">{len(active_tasks)}</span></div>
      <div class="stat-row"><span class="stat-label">👥 Người được giao việc</span><span class="stat-count" style="font-size:15px">{len(task_assignees | tas_users)}</span></div>
    </div>
  </div>

  <!-- NOTIFICATIONS -->
  <div class="card">
    <h2>🔔 Thông báo</h2>
    <div style="display:flex;gap:16px;margin-bottom:12px">
      <div><span style="font-size:24px;font-weight:800;color:#22c55e">{notif_read}</span><div style="font-size:11px;color:#64748b">Đã đọc</div></div>
      <div><span style="font-size:24px;font-weight:800;color:#ef4444">{notif_unread}</span><div style="font-size:11px;color:#64748b">Chưa đọc</div></div>
    </div>
    <div style="font-size:13px;font-weight:600;color:#64748b;margin-bottom:8px">Theo loại</div>
"""
for nt, cnt in sorted(notif_type.items(), key=lambda x: -x[1])[:6]:
    c = NOTIF_COLORS.get(nt, "#6b7280")
    lb = nt if nt else "Khác"
    html += f'<div class="stat-row" style="padding:5px 0"><span class="stat-label"><span class="badge" style="background:{c}">{lb}</span></span><span class="stat-count" style="font-size:14px">{cnt}</span></div>'

html += f"""
  </div>
</div>

<!-- HÔM NAY -->
<div class="card">
  <h2>⏰ Lịch trình hôm nay ({now.strftime('%d/%m/%Y')})</h2>
"""
today_sorted = sorted(sched_today, key=lambda s: s.get("start_time",""))
if today_sorted:
    for s in today_sorted[:8]:
        st = s.get("start_time","")[11:16]
        et = s.get("end_time","")[11:16]
        lb = status_lb.get(s["status"], s["status"])
        c = BAR_COLORS.get(s["status"], "#6b7280")
        creator = pmap.get(s.get("created_by"), {}).get("full_name", "?")
        html += f'<div class="stat-row" style="padding:8px 0"><span class="stat-label" style="width:90px;flex-shrink:0;font-weight:600;color:#64748b;font-size:12px">{st}→{et}</span><span class="stat-label" style="flex:1">{s.get("title","?")[:50]}</span><span class="stat-label" style="width:80px;font-size:11px;color:#94a3b8">{creator[:15]}</span><span class="badge" style="background:{c};font-size:10px">{lb}</span></div>'
    if len(today_sorted) > 8:
        html += f'<div class="text-muted" style="text-align:center;padding-top:8px">+ {len(today_sorted)-8} lịch khác</div>'
else:
    html += '<div style="text-align:center;padding:24px;color:#94a3b8;font-size:14px">Không có lịch trình hôm nay</div>'

html += """
</div>

<!-- FOOTER -->
<div style="text-align:center;padding:24px 0;font-size:11px;color:#94a3b8">
  WorkFlow Portal · Báo cáo hoạt động · Tự động cập nhật mỗi lần chạy<br>
  Lần cuối: """ + now.strftime("%d/%m/%Y %H:%M") + """ (UTC+7)
</div>

</div>
</body>
</html>
"""

out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public")
os.makedirs(out_dir, exist_ok=True)
out_path = os.path.join(out_dir, "weekly-report.html")
with open(out_path, "w", encoding="utf-8") as f:
    f.write(html)

print(f"✅ Report: {out_path}")
print(f"   file://{out_path.replace(chr(92),'/')}")
