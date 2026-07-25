# WorkFlow Portal — Web App Quản trị Vận hành Chi nhánh

> Web App Quản trị Vận hành Nội bộ cho Chi nhánh Ngân hàng. **Số hoá các "vùng xám"** mà Core Banking không quản lý: luân chuyển hồ sơ giấy, điều phối phòng họp/xe, công việc nội bộ, nghỉ phép, danh bạ — chạy như một **PWA** trên iOS/Android/desktop.

![tech](https://img.shields.io/badge/Next.js-15.5.9-black) ![tech](https://img.shields.io/badge/React-19-blue) ![tech](https://img.shields.io/badge/TypeScript-5-blue) ![tech](https://img.shields.io/badge/Supabase-Postgres%20%2B%20RLS-3ECF8E) ![tech](https://img.shields.io/badge/Tailwind-3.4-06B6D4)

---

## Mục lục

1. [Giới thiệu](#1-giới-thiệu)
2. [Tech Stack](#2-tech-stack)
3. [Cấu trúc thư mục](#3-cấu-trúc-thư-mục)
4. [Prerequisites](#4-prerequisites)
5. [Environment Variables](#5-environment-variables)
6. [Setup Supabase (lần đầu)](#6-setup-supabase-lần-đầu)
7. [Run locally](#7-run-locally)
8. [npm scripts](#8-npm-scripts)
9. [Deploy production](#9-deploy-production-vercel)
10. [Quy trình đóng góp code](#10-quy-trình-đóng-góp-code)
11. [Troubleshooting](#11-troubleshooting)
12. [Đọc tiếp](#12-đọc-tiếp)

---

## 1. Giới thiệu

**WorkFlow Portal** sinh ra để giải quyết những vấn đề vận hành chi nhánh ngân hàng **không thuộc phạm vi Core Banking**:

- **Hồ sơ giấy bị thất lạc giữa các bàn** — không ai biết bộ hồ sơ tín dụng KH Nguyễn Văn A đang nằm trên bàn ai.
- **Phòng họp / xe ô tô bị đặt chồng** — không có công cụ điều phối tập trung.
- **Công việc giao miệng không có log** — quên deadline, không theo dõi được SLA.
- **Đơn nghỉ phép viết tay**, danh bạ rời rạc, sinh nhật quên chúc…

App là một **PWA** (cài được như app native), được xây trên Next.js 15 App Router + Supabase (Postgres + RLS + Edge Functions + Realtime + Storage). Module trọng tâm là **Sổ giao nhận điện tử** (truy vết hồ sơ vật lý theo thời gian thực).

→ Đọc [`docs/PRODUCT_OVERVIEW.md`](docs/PRODUCT_OVERVIEW.md) để hiểu nghiệp vụ chi tiết.

## 2. Tech Stack

| Layer | Công nghệ | Phiên bản | Ghi chú |
|------|-----------|-----------|---------|
| Framework | **Next.js (App Router)** | `15.5.9` | Turbopack dev, không dùng Pages Router |
| Runtime | React | `19.2.1` | RSC + Server Components |
| Language | TypeScript | `5.x` strict | Path alias `@/* → src/*` |
| UI primitives | shadcn/ui (Radix) | — | 38 file trong `src/components/ui/`, **không sửa** |
| Styling | Tailwind CSS | `3.4` | + design tokens trong `globals.css` (765 dòng) |
| Icons | `lucide-react` | `0.475` | Chuẩn duy nhất |
| Form | `react-hook-form` + `zod` | `7.54` / `3.24` | Dùng cho form > 4 field |
| Date | `date-fns` (locale `vi`) | `3.6` | Cấm dayjs/moment |
| Charts | `recharts` (qua shadcn chart) | `2.15` | |
| Image | `browser-image-compression` | `2.0` | Nén client trước upload |
| State | React `useState` / `useReducer` | — | Không dùng zustand/redux |
| HTTP | `@supabase/ssr` + `@supabase/supabase-js` | `0.10` / `2.105` | Cấm axios/fetch/swr/tanstack-query |
| Backend | **Supabase** | — | Postgres 15 + Auth + Storage + Edge Functions (Deno) |
| Deploy | **Vercel** | — | Cron daily 8:00 ICT cho `/api/cron/notifications` |
| PWA | Next manifest + Web Push (VAPID) | — | `src/app/manifest.ts`, edge `push-notification` |

## 3. Cấu trúc thư mục

```
WorkFlow/
├── docs/
│   ├── ARCHITECTURE.md          # ⭐ Quy chuẩn code (đọc trước khi commit)
│   ├── DATABASE_SCHEMA.md       # Entities, RLS, RPC, SLA, storage, cronjobs
│   └── PRODUCT_OVERVIEW.md      # Bối cảnh nghiệp vụ + module + role matrix
├── public/                      # Static (icon-192/512, sw.js)
├── supabase/
│   ├── config.toml              # Local dev config (supabase CLI)
│   ├── migration_*.sql          # Migration flat-files (chạy theo thứ tự thời gian)
│   ├── fix_*.sql                # Bản vá ad-hoc
│   └── functions/               # Edge functions (Deno)
│       ├── push-notification/   # Trigger khi insert notifications
│       └── cleanup-document-images/  # Cron daily 02:00 ICT
├── src/
│   ├── middleware.ts            # Auth guard: chặn /dashboard/* nếu chưa login
│   ├── app/                     # Next.js App Router
│   │   ├── layout.tsx           # Root (metadata, Toaster, PWAHandler)
│   │   ├── manifest.ts          # PWA manifest
│   │   ├── globals.css          # Design tokens + utility classes
│   │   ├── login/ register/ auth/   # Public routes
│   │   ├── api/cron/notifications/  # Vercel cron endpoint
│   │   └── dashboard/           # Protected routes
│   │       ├── layout.tsx       # RSC: getProfile() + DashboardLayout
│   │       ├── page.tsx         # Dashboard chính
│   │       ├── handover/        # ⭐ Module hồ sơ vật lý (mẫu chuẩn)
│   │       ├── schedule/        # ⭐ Module lịch (mẫu chuẩn)
│   │       ├── tasks/           # Module công việc
│   │       ├── team/            # Danh bạ
│   │       ├── profile/         # Cá nhân
│   │       ├── admin/           # Admin tools
│   │       └── settings/        # Setting + sub-route users
│   ├── components/
│   │   ├── ui/                  # ⛔ Không sửa — shadcn primitives
│   │   ├── layout/              # Sidebar, BottomNav, PageHeader
│   │   └── *.tsx                # Shared (notifications-dropdown, pwa-handler...)
│   ├── hooks/                   # useToast, useMobile, usePushSubscription
│   ├── lib/                     # Pure helpers (utils, permissions, notify, auth-utils)
│   ├── types/                   # Profile, Department, UserRole, database.types
│   └── utils/
│       └── supabase/            # client.ts (browser) + server.ts (RSC)
├── schema.sql                   # Snapshot toàn bộ DB
├── vercel.json                  # Cron config
├── tailwind.config.ts
├── next.config.ts
├── tsconfig.json
└── package.json
```

→ Chi tiết quy ước folder/naming xem [`docs/ARCHITECTURE.md §2`](docs/ARCHITECTURE.md).

## 4. Prerequisites

| Yêu cầu | Phiên bản | Ghi chú |
|---------|-----------|---------|
| **Node.js** | **≥ 20.x** | Project khai báo `@types/node: ^20`, cũng tương thích Node 22 |
| **Package manager** | **`npm`** (đi kèm Node) | Repo có `package-lock.json`, **không có** `pnpm-lock.yaml`/`yarn.lock` |
| **Git** | bất kỳ | Để clone & contribute |
| **Supabase project** | Free hoặc Pro | Cần Postgres + Auth + Storage + Edge Functions |
| **Supabase CLI** *(optional)* | mới nhất | Để deploy edge functions, gen types |
| **Vercel account** *(production)* | — | Hosting + Cron |

OS: chạy được trên **macOS / Linux / Windows 11** (Powershell hoặc Git Bash). Repo này test trên Windows + bash.

## 5. Environment Variables

Tạo file `.env.local` ở thư mục gốc:

```dotenv
# ========================================================================
# BẮT BUỘC — Dùng ở browser + middleware + server (RSC)
# ========================================================================
NEXT_PUBLIC_SUPABASE_URL="https://<your-project-ref>.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="<supabase anon / publishable key>"

# ========================================================================
# BẮT BUỘC cho cron daily (Vercel)
# Service role key — CHỈ dùng ở /api/cron/notifications (server-side).
# TUYỆT ĐỐI KHÔNG expose ra client / commit vào git.
# ========================================================================
SUPABASE_SERVICE_ROLE_KEY="<supabase service role key>"

# ========================================================================
# TUỲ CHỌN — Bảo vệ endpoint cron khỏi gọi trái phép
# Nếu set, mọi request vào /api/cron/notifications phải có
# header `Authorization: Bearer <CRON_SECRET>` (Vercel cron tự thêm).
# ========================================================================
CRON_SECRET=""
```

### Tên biến chính xác (lưu ý)

Code đang dùng tên biến **`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`** (tên mới Supabase khuyến nghị) — **không phải** `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Bản chất nó là **anon key** trong Supabase Dashboard → Settings → API. Đừng đặt nhầm tên biến hoặc app sẽ không kết nối được.

### Biến phía Edge Function (Supabase)

Các biến dưới đây **được Supabase inject sẵn** vào edge runtime — không khai báo trong `.env.local`. Bạn set qua **Supabase Dashboard → Edge Functions → Secrets**:

```
SUPABASE_URL                  # Tự inject — không cần set
SUPABASE_SERVICE_ROLE_KEY     # Tự inject — không cần set
VAPID_PUBLIC_KEY              # ⚠ Bắt buộc cho push notification
VAPID_PRIVATE_KEY             # ⚠ Bắt buộc cho push notification
VAPID_SUBJECT                 # mailto:<email-admin>
```

Cách sinh VAPID keys:

```bash
npx web-push generate-vapid-keys
# Copy public/private key vào Supabase Edge Functions Secrets
# Đồng thời copy VAPID_PUBLIC_KEY ra thành biến NEXT_PUBLIC_VAPID_PUBLIC_KEY
# nếu code client subscribe đang đọc từ NEXT_PUBLIC_ (kiểm tra usePushSubscription.ts)
```

## 6. Setup Supabase (lần đầu)

### 6.1 Tạo project + chạy migrations

1. Tạo project mới trên [supabase.com](https://supabase.com) (chọn region gần VN nhất, ví dụ Singapore).
2. **SQL Editor → New query**, chạy theo thứ tự:

   ```
   1. schema.sql                                              # Snapshot core (profiles, departments, documents, schedules, leaves, recognitions…)
   2. supabase/migration_handover_module.sql                  # ⭐ Module hồ sơ vật lý (luân chuyển + truy vết)
   3. supabase/migration_dashboard_summary_fix_pending_docs.sql
   4. supabase/migration_dashboard_counters_batch_aware.sql   # KPI counter trang chủ — gộp batch
   5. supabase/migration_tasks_standardize.sql                # ⭐ Tasks: chuẩn hoá 5-state status + Luồng A/B
   6. supabase/migration_tasks_default_assignee.sql           # ⭐ Auto-fill TP làm assignee mặc định
   7. supabase/migration_tasks_edit_delete.sql                # task_edit + cửa sổ xoá nháp 10 phút
   8. supabase/migration_task_scope.sql                       # ⭐ Siết scope quyền giao việc / báo cáo theo phòng đầu mối (hub)
   ```

   > **Lưu ý:** Các migration cũ (security/RLS/leave-privacy/handover fixes/RLS-optimize/reset-passwords/drop-kpi) đã gộp vào `schema.sql` snapshot — không còn file rời.

3. Chạy `NOTIFY pgrst, 'reload schema';` để PostgREST refresh cache.

### 6.2 Storage Buckets

Vào **Storage → New bucket**, tạo:

| Bucket | Public | Mục đích |
|--------|--------|----------|
| `avatars` | ✅ public | Ảnh đại diện user |
| `documents` | ✅ public | Ảnh đính kèm hồ sơ vật lý |

Sau đó vào **Storage → Policies**, dán policies sau (lấy từ comment trong `schema.sql §9`):

```sql
-- Avatars: ai cũng xem, user upload/update vào folder = uuid của mình
CREATE POLICY "Avatar Public Access"
ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.uid() = (storage.foldername(name))[1]::uuid);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND auth.uid() = (storage.foldername(name))[1]::uuid);

-- Documents: ai đã login đều upload + xem được (intranet, dựa vào path UUID khó đoán)
CREATE POLICY "Documents authenticated upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Documents public read"
ON storage.objects FOR SELECT USING (bucket_id = 'documents');
```

### 6.3 Auth providers

**Authentication → Providers → Email**: bật Email + tắt "Confirm email" nếu chi nhánh dùng quy trình admin-duyệt (xem `account_requests`).

**Authentication → URL Configuration**:
- Site URL: `http://localhost:9002` (dev) hoặc `https://yourdomain.com` (prod).
- Redirect URLs: thêm cả 2 origin trên.

### 6.4 Deploy Edge Functions

Cần **Supabase CLI** (`npx supabase --help` để check):

```bash
# Login vào project
npx supabase login
npx supabase link --project-ref <your-project-ref>

# Deploy 2 function
npx supabase functions deploy push-notification
npx supabase functions deploy cleanup-document-images
```

Sau đó:

- **Push notification**: vào **Database → Webhooks → Create**:
  - Table: `notifications`
  - Events: `INSERT`
  - Type: HTTP Request → Supabase Edge Function → `push-notification`.

- **Cleanup images**: vào **Database → Cron Jobs**:
  - Schedule: `0 19 * * *` (UTC, = 02:00 ICT)
  - Command: gọi function `cleanup-document-images` qua HTTP.

### 6.5 Tạo user admin đầu tiên

Trigger `handle_new_user()` mặc định gán role `staff` cho mọi user signup. Để có **admin đầu tiên**:

1. Đăng ký tài khoản qua `/register` hoặc trực tiếp ở Supabase **Authentication → Users → Add user**.
2. Vào **SQL Editor**, chạy:

   ```sql
   UPDATE profiles
   SET role = 'admin', is_active = true
   WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@yourbank.vn');
   ```

3. Login lại → giờ bạn có thể vào `/dashboard/admin` để duyệt user khác.

### 6.6 (Optional) Generate TypeScript types từ schema

```bash
npx supabase gen types typescript --project-id <ref> > src/types/database.types.ts
```

Hiện tại file `database.types.ts` là **hand-craft** (xem `ARCHITECTURE.md §6.7`).

## 7. Run locally

```bash
# 1. Clone & cài deps
git clone <repo-url>
cd WorkFlow
npm install

# 2. Tạo .env.local theo §5 + setup Supabase theo §6

# 3. Chạy dev (Turbopack, port 9002)
npm run dev
#    → http://localhost:9002
#    → tự redirect sang /login

# 4. Đăng ký account đầu tiên qua /register
#    → vào Supabase chạy SQL ở §6.5 để promote thành admin
#    → reload → vào /dashboard
```

## 8. npm scripts

| Script | Tác dụng | Khi nào dùng |
|--------|----------|--------------|
| `npm run dev` | Next dev (Turbopack) port **9002** | Develop hằng ngày |
| `npm run build` | Build production (`NODE_ENV=production next build`) | Trước khi deploy / check production build pass |
| `npm run start` | Start server đã build | Smoke test bản production trên máy local |
| `npm run lint` | Next lint | Trước khi commit |
| `npm run typecheck` | `tsc --noEmit` | Trước khi commit / merge — bắt buộc pass theo `ARCHITECTURE.md` Phase 8 |

## 9. Deploy production (Vercel)

1. Push repo lên GitHub.
2. Vào [vercel.com](https://vercel.com) → **New Project** → import repo.
3. Framework preset: **Next.js** (auto-detect).
4. **Environment Variables** — copy 4 biến từ `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CRON_SECRET` (recommend set random string mạnh)
5. Deploy → Vercel tự pick `vercel.json` → cron `/api/cron/notifications` sẽ chạy mỗi ngày 8:00 ICT.
6. Sau khi có domain production, quay lại Supabase **Auth → URL Configuration** thêm domain mới vào Redirect URLs.

> Vercel free tier: cron chỉ chạy 1 lần/ngày (đúng config). Nếu cần granular hơn → upgrade Pro.

## 10. Quy trình đóng góp code

Đọc kỹ trước khi PR:

- **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)** — quy chuẩn code, naming, fetch pattern, RPC, RLS, realtime, workflow thêm module mới (9 phase), UI/UX (Apple HIG), palette, touch target 44px, business rules.

Checklist tối thiểu trước commit (chi tiết tại `ARCHITECTURE.md §8 Phase 8`):

- [ ] `npm run typecheck` pass.
- [ ] `npm run build` pass.
- [ ] Mỗi file `.tsx`/`.ts` ≤ 500 dòng.
- [ ] Không có màu cấm (`indigo|purple|pink`) trong className mới.
- [ ] Touch target ≥ 44px trên mobile.
- [ ] Comment + toast message **tiếng Việt**.
- [ ] Dùng helper `notifyError` / `notifySuccess` / `notifyValidation` từ `@/lib/notify`, không gọi `toast()` trực tiếp.
- [ ] Dùng `<PageHeader>`, `app-dialog-sheet`, design tokens trong `globals.css` — không hardcode `text-2xl font-bold`, `rounded-[24px]`, v.v.

Quy ước:

- Branch: `feat/<slug>`, `fix/<slug>`, `chore/<slug>`.
- Commit message: tiếng Việt, ngắn gọn, mô tả "why" (theo style commit hiện có — xem `git log`).
- Module mới: bắt buộc đủ 3 folder `_components/`, `_hooks/`, `_lib/` (theo `ARCHITECTURE.md §2.4`).

## 11. Troubleshooting

| Hiện tượng | Nguyên nhân thường gặp | Cách xử lý |
|------------|------------------------|------------|
| `Invalid API key` / `Failed to fetch` khi load `/dashboard` | Sai tên biến — đặt `NEXT_PUBLIC_SUPABASE_ANON_KEY` thay vì `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Sửa `.env.local` đúng tên biến ở §5 |
| Login OK nhưng cứ bị đẩy về `/login?pending=1` | `profiles.is_active = false` (middleware tự signOut) | Vào SQL: `UPDATE profiles SET is_active = true WHERE id = '<uuid>';` |
| Tạo hồ sơ báo `duplicate key value violates unique constraint "documents_short_code_key"` | Trigger `generate_document_short_code` thiếu `SECURITY DEFINER` | Chạy `supabase/migration_handover_short_code_fix_2.sql` |
| RLS lỗi `42P17 infinite recursion detected in policy for relation "documents"` | Policy gọi EXISTS qua `document_handovers` trực tiếp | Chạy `supabase/migration_handover_rls_fix.sql` (tạo helper `user_is_in_document_handovers` SECURITY DEFINER) |
| Push notification không tới | Thiếu `VAPID_*` secret ở edge function, hoặc webhook chưa trỏ vào `push-notification` | Set 3 secret + tạo Database Webhook trỏ table `notifications` |
| Ảnh upload báo lỗi `new row violates row-level security policy` | Chưa tạo policy `Documents authenticated upload` cho bucket `documents` | Chạy SQL policy ở §6.2 |
| `next build` báo lỗi `process.env.NEXT_PUBLIC_SUPABASE_URL is undefined` | Build trên Vercel mà chưa set env vars | Project Settings → Environment Variables → add 4 biến §5 |
| Realtime không tự refresh khi người khác chuyển hồ sơ | Realtime chưa enable cho table | Vào **Database → Replication**, bật Realtime cho `documents`, `document_handovers`, `notifications` |
| Đổi mã ngắn nhưng port 9002 đã bị app khác chiếm | — | Đổi script `dev` trong `package.json` thành port khác, hoặc kill process đang giữ port |

## 12. Đọc tiếp

| File | Nội dung |
|------|----------|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Quy chuẩn code: folder, naming, fetch pattern, RSC vs Client, RPC, RLS, realtime, 9 phase thêm module mới, UI/UX (Apple HIG), palette, RLS business rules |
| [`docs/PRODUCT_OVERVIEW.md`](docs/PRODUCT_OVERVIEW.md) | Bối cảnh nghiệp vụ + chi tiết các module (đặc biệt luồng luân chuyển hồ sơ + Tasks 2 luồng A/B) |
| [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) | Sơ đồ entities, RLS strategy, RPC, SLA logic, storage, cronjobs |
| [`schema.sql`](schema.sql) | Snapshot DB (truth source) |

---

**Liên hệ kỹ thuật:** Tech Lead — xem `docs/ARCHITECTURE.md` "Người duyệt".
**Phiên bản README:** 1.2 — 2026-05-26 — refresh migration list (7 file thực tế trong `supabase/`), gộp tham chiếu `TECHNICAL_RULES.md` vào `ARCHITECTURE.md`, sửa path docs/.
