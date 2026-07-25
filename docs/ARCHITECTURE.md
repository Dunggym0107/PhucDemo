# TÀI LIỆU QUY CHUẨN KIẾN TRÚC & CODE (ARCHITECTURE.md)

> **Mục đích:** Tài liệu này là **Single Source of Truth** cho mọi developer và AI khi phát triển tính năng mới trong dự án **projectFlow — WorkFlow Portal**. Mọi quy chuẩn về kiến trúc, cấu trúc thư mục, đặt tên, fetch dữ liệu, xử lý lỗi, và quy trình thêm module mới đều quy định ở đây.
>
> **Quan hệ với tài liệu khác:**
> - `docs/PRODUCT_OVERVIEW.md` — bối cảnh nghiệp vụ, role, module, luồng (đọc trước nếu cần hiểu "tại sao").
> - `docs/DATABASE_SCHEMA.md` — entities, RLS, SLA, storage, cronjobs.
> - `ARCHITECTURE.md` (file này) — quy chuẩn **code, kiến trúc, naming, fetch pattern, RPC, UI tokens, RLS rules, business logic**. Bắt buộc tuân thủ.
>
> **Nguyên tắc tối thượng:** Tính đồng bộ > tính sáng tạo cá nhân. Khi không chắc, copy pattern từ module mẫu **`/dashboard/schedule`** và **`/dashboard/handover`** — đây là 2 module được xây đúng chuẩn nhất.

---

## 1. TỔNG QUAN KIẾN TRÚC (ARCHITECTURE OVERVIEW)

### 1.1 Tech stack

| Layer | Công nghệ | Phiên bản | Ghi chú |
|------|-----------|----------|---------|
| Framework | **Next.js** | 15.5.9 | **App Router**, không dùng Pages Router |
| Language | TypeScript | strict mode | Không dùng `any` ở public API |
| UI lib | **shadcn/ui** (Radix primitives) | — | 38 primitive trong `src/components/ui/` |
| Styling | Tailwind CSS + custom utilities | v3 | Config: `tailwind.config.ts` |
| Icons | `lucide-react` | — | Chuẩn duy nhất, cấm Material/FontAwesome |
| Date | `date-fns` | + locale `vi` | Cấm dayjs/moment |
| Form | `react-hook-form` + `zod` | — | Dùng cho form > 4 trường hoặc validation phức tạp; `CreateTaskDialog` đã theo pattern này (xem §5.4) |
| State | React `useState` / `useReducer` | — | **Không** dùng zustand/jotai/redux. Global state qua RSC props + Realtime |
| HTTP | Supabase JS client | `@supabase/ssr` + `@supabase/supabase-js` | **Không** dùng axios/fetch/swr/tanstack-query |
| Image | `browser-image-compression` | 2.0.2 | Client-side compress trước khi upload |
| Charts | `recharts` (qua shadcn chart) | — | |
| Backend | **Supabase** | Postgres + Auth + Storage + Edge Functions | |
| Deploy | Vercel | — | API route `/api/cron/notifications` chạy daily 08:00 ICT (`0 1 * * *` UTC) |

### 1.2 Luồng dữ liệu cơ bản

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser (Client)                                                   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ React Server Component (RSC)                                 │   │
│  │  └─ src/app/dashboard/layout.tsx                             │   │
│  │     └─ getProfile() ─────► createClient(cookies) ──► Supabase│   │
│  │                                                         (SSR)│   │
│  │  └─ Pass `profile` props to:                                 │   │
│  └────────┬─────────────────────────────────────────────────────┘   │
│           ▼                                                          │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Client Component ('use client')                              │   │
│  │  └─ useXxx() hook (state + realtime)                         │   │
│  │     └─ createClient() ───► browser client (singleton)        │   │
│  │     │                                                         │   │
│  │     ├─ .from(...).select(...) ───────► Supabase REST + RLS   │   │
│  │     ├─ .rpc(...) ────────────────────► Supabase PL/pgSQL     │   │
│  │     └─ .channel(...).subscribe() ────► Supabase Realtime (WS)│   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Middleware (src/middleware.ts)                                     │
│   ├─ Refresh session                                                │
│   ├─ Redirect chưa login → /login                                   │
│   └─ Redirect is_active=false → /login?pending=1                    │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Edge Functions (Deno) — chỉ cho job nặng/định kỳ                   │
│   ├─ push-notification (trigger qua DB webhook)                     │
│   └─ cleanup-document-images (cron daily 02:00 ICT)                 │
└─────────────────────────────────────────────────────────────────────┘
```

**3 quy tắc luồng dữ liệu:**

1. **Chỉ RSC (Server Component) mới fetch session/profile ban đầu.** Sau đó pass props xuống client. Lý do: tránh flicker, tránh duplicate session check.
2. **Mọi mutation đi từ Client Component qua Supabase JS client.** Không dùng Server Actions. Validation phía DB qua RLS + RPC `SECURITY DEFINER`.
3. **Realtime là kênh đồng bộ chính.** Mỗi page module subscribe channel của riêng nó, refetch toàn bộ list khi có event (debounced 250–600ms).

---

## 2. CẤU TRÚC THƯ MỤC (FOLDER STRUCTURE)

```
WorkFlow/
├── docs/                                 # Tài liệu (PRODUCT_OVERVIEW, ARCHITECTURE, DATABASE_SCHEMA)
├── public/                               # Static assets (logo, icons, manifest)
├── supabase/
│   ├── config.toml                       # Local dev config
│   ├── migration_*.sql                   # 📦 TẤT CẢ ĐÃ GỘP VÀO schema.sql — không tạo file rời
│   └── functions/                        # Deno edge functions
│       ├── push-notification/
│       └── cleanup-document-images/
├── design-system/                        # Mockup, reference (không build vào app)
├── src/
│   ├── middleware.ts                     # Session + guard + redirect
│   ├── app/                              # Next.js App Router
│   │   ├── layout.tsx                    # Root: metadata, Toaster, PWAHandler
│   │   ├── globals.css                   # 765 dòng — design tokens + utilities (xem §2.5)
│   │   ├── page.tsx                      # Redirect '/' → '/login'
│   │   ├── not-found.tsx
│   │   ├── manifest.ts                   # PWA manifest
│   │   ├── icon.png
│   │   ├── login/                        # Public — không guard
│   │   ├── register/
│   │   ├── auth/                         # OAuth callback bounce → redirect '/'
│   │   ├── api/
│   │   │   └── cron/notifications/       # Vercel cron daily 08:00 ICT
│   │   └── dashboard/                    # Protected (qua middleware + dashboard/layout)
│   │       ├── layout.tsx                # RSC: getProfile() + DashboardLayout wrap
│   │       ├── page.tsx                  # Trang dashboard chính
│   │       ├── _components/              # Component dùng chung dashboard root
│   │       ├── tasks/
│   │       ├── schedule/                 # ⭐ MẪU CHUẨN
│   │       ├── handover/                 # ⭐ MẪU CHUẨN
│   │       ├── team/
│   │       ├── profile/
│   │       ├── admin/
│   │       └── settings/
│   ├── components/
│   │   ├── ui/                           # ⛔ KHÔNG SỬA — shadcn primitives (38 file)
│   │   ├── layout/                       # Layout shell: sidebar, bottom-nav, PageHeader
│   │   ├── notifications-dropdown.tsx    # Shared component
│   │   ├── pwa-notification-handler.tsx
│   │   └── ...                           # Shared component dùng > 1 module
│   ├── hooks/                            # Hook dùng toàn cục
│   │   ├── use-toast.ts
│   │   ├── use-mobile.tsx
│   │   └── use-push-subscription.ts
│   ├── lib/                              # Pure helper, không phụ thuộc React
│   │   ├── utils.ts                      # cn(), sortProfilesByHierarchy(), ...
│   │   ├── permissions.ts                # canXxx() helpers (xem §6.4)
│   │   ├── notify.ts                     # ⭐ notifyError / notifySuccess / notifyValidation (xem §7.2)
│   │   └── auth-utils.ts                 # getProfile() — RSC only
│   ├── types/                            # Type chung dùng xuyên dự án
│   │   ├── profile.ts                    # Profile, ProfileLite, Department, UserRole
│   │   └── database.types.ts             # Database<> theo schema Supabase (hand-craft, xem §6.7)
│   └── utils/
│       └── supabase/
│           ├── client.ts                 # Browser client (singleton)
│           └── server.ts                 # Server client (RSC + middleware)
├── tailwind.config.ts                    # ⭐ CHUẨN — chỉ sửa file này
├── tsconfig.json
├── next.config.ts
├── package.json
├── schema.sql                            # Snapshot toàn bộ DB (truth source)
└── vercel.json                           # Cron config
```

### 2.1 Quy định nội dung từng thư mục

| Folder | Được chứa | Cấm chứa |
|--------|-----------|----------|
| `src/app/[route]/page.tsx` | Trang route (mặc định Server Component, thêm `'use client'` nếu cần interactive) | Logic nghiệp vụ phức tạp (>200 dòng) — tách ra `_components` + `_hooks` |
| `src/app/[route]/layout.tsx` | Server Component bọc route, fetch session ban đầu | UI lớn — chuyển sang `src/components/layout/` |
| `src/app/dashboard/[module]/_components/` | Component chỉ dùng trong module này | Component dùng chéo module — đưa lên `src/components/` |
| `src/app/dashboard/[module]/_hooks/` | Hook `useXxx` tập trung state của module | Hook utility chung (toast, mobile…) — đặt ở `src/hooks/` |
| `src/app/dashboard/[module]/_lib/` | Pure function: fetch, action, constants, types, helpers | Component, hook |
| `src/components/ui/` | shadcn primitives, **không sửa** trừ khi thêm primitive shadcn mới | Component nghiệp vụ |
| `src/components/layout/` | Sidebar, BottomNav, PageHeader, AppShell | Component không liên quan layout |
| `src/components/` (root) | Component dùng chéo ≥2 module | Component chỉ dùng 1 module — đẩy vào module |
| `src/hooks/` | Hook dùng toàn cục (useToast, useMobile, ...) | Hook chỉ phục vụ 1 module |
| `src/lib/` | Pure JS/TS helper (không import React, không có hook) | Component, hook, side-effect |
| `src/types/` | Type/interface dùng chéo ≥2 module (Profile, Database, ...) | Type chỉ phục vụ 1 module — để trong `_lib/types.ts` của module |
| `src/utils/supabase/` | Chỉ 2 file — `client.ts` và `server.ts` | Không thêm file khác vào đây |
| `supabase/` | Migration `.sql` flat-file, edge functions | Code app, generated types |

### 2.2 Tiền tố `_` trong App Router

**Quy ước Next.js:** folder bắt đầu bằng `_` (như `_components`, `_hooks`, `_lib`) được Next.js coi là **private folder**, không tạo route. Đây là cách dự án **gom code module-scoped** vào cùng route folder mà không "rò rỉ" thành URL.

### 2.3 Quy tắc giới hạn

- **Mỗi file `.tsx` hoặc `.ts` ≤ 500 dòng vật lý.** Vượt → tách subcomponent (xem `_components` con).
- **Mỗi component file = 1 export default + tối đa 2 sub-component nội bộ.** Sub-component dùng > 1 chỗ → tách file riêng.

### 2.4 Bất đồng bộ hiện tại & chuẩn duy nhất

| Module | Có `_components` | Có `_hooks` | Có `_lib` | Trạng thái |
|--------|:---:|:---:|:---:|---|
| `schedule` | ✅ | ✅ | ✅ | ⭐ Chuẩn mẫu |
| `handover` | ✅ | ✅ | ✅ | ⭐ Chuẩn mẫu |
| `tasks` | ✅ | ✅ | ✅ | ⭐ Chuẩn mẫu (đã refactor: 21 components + analytics/ subfolder, 5 hooks, 9 lib) |
| `team` | ✅ | ✅ | ✅ | ⭐ Chuẩn mẫu (Phase 2 đã refactor — 9 components, 3 hooks, 2 lib) |
| `admin` | ❌ | ✅ | ❌ | Đang lệch — `page.tsx` 461 dòng sát giới hạn 500 |

**Chuẩn duy nhất từ nay:** Mọi module mới **bắt buộc** có đủ 3 folder `_components`, `_hooks`, `_lib` ngay từ đầu, **kể cả khi ban đầu chỉ có 1-2 file**. Code tăng trưởng sẽ luôn có chỗ đặt đúng.

### 2.5 `globals.css` — design tokens (765 dòng)

**Bắt buộc dùng các utility/token sau thay vì hardcode:**

| Nhóm token | Class / Variable | Dùng cho |
|-----------|------------------|----------|
| Font scale | `--app-font-{large-title,title-1,title-2,title-3,headline,body,callout,subhead,footnote,caption}` | Cỡ chữ responsive |
| Page margin | `--app-page-x` (16px mobile / 24px tablet / 24px desktop) | `className="px-[var(--app-page-x)]"` |
| Touch target | `--app-touch-target` (44px) | min-height button/input |
| Card padding | `--app-card-padding` | Padding card chuẩn |
| Radius | `--app-control-radius` (12px), `--app-card-radius` (16-18px), `24px` cho Dialog | |
| Heading | `.heading-page` / `.heading-section` / `.heading-card` | Thay `text-2xl font-bold` thủ công |
| Text | `.text-subtitle` / `.text-label` / `.text-meta` | |
| Stack | `.section-stack` (32px) / `.group-stack` (24px) / `.item-stack` (12px) / `.tight-stack` (8px) | Gap dọc |
| Icon size | `.icon-sm` (14px) / `.icon-md` (16px) / `.icon-lg` (20px) | |
| Avatar size | `.avatar-sm` (32px) / `.avatar-md` (40px) / `.avatar-lg` (44px) | |
| Card | `.premium-card` / `.glass-card` / `.card-base` | |
| Status badge | `.status-{success,warning,danger,info,neutral,focal}-bg` | Tô màu theo nghĩa nghiệp vụ |
| Status badge (legacy) | `.badge-{success,warning,danger,info,neutral,award}` | |
| Safe area | `.pt-safe` / `.pb-safe` / `.top-safe` / `.bottom-safe` / `.bottom-safe-fab` / `.pb-mobile-nav` | iOS notch + home indicator |
| Dialog sheet | `.app-dialog-sheet` + variant `--lg`/`--xl`/`--2xl` + `app-dialog-sheet-{header,body,footer}` | Tất cả popup form/detail |
| Page wrapper | `.page-container` | Wrap mọi dashboard page |

**Cấm hardcode:** `text-2xl font-bold`, `p-6` cho card, `rounded-[24px]` cho dialog, `pt-12` cho safe area, `bg-emerald-50` cho status — dùng token tương ứng ở trên.

---

## 3. QUY CHUẨN ĐẶT TÊN (NAMING CONVENTIONS)

### 3.1 File & Folder

| Loại | Convention | Ví dụ |
|------|-----------|-------|
| Folder route (App Router) | `kebab-case` | `dashboard/handover/`, `tasks/[id]/` |
| Folder private (`_xxx`) | `_kebab-case` | `_components/`, `_hooks/`, `_lib/` |
| Component file | `PascalCase.tsx` | `CreateScheduleDialog.tsx`, `DocumentCard.tsx` |
| Hook file | `camelCase.ts` bắt đầu `use` | `useSchedule.ts`, `useHandover.ts` |
| Helper / action / fetch file | `camelCase.ts` | `fetchHandover.ts`, `transferActions.ts`, `compressImage.ts` |
| Constants file | `constants.ts` (lowercase) | `_lib/constants.ts` |
| Types file | `types.ts` (lowercase) | `_lib/types.ts` |
| Test file | `*.test.ts` / `*.test.tsx` | (dự án chưa có test) |
| SQL migration | `migration_<feature>.sql` | ⛔ **KHÔNG DÙNG** — update `schema.sql` trực tiếp |
| shadcn primitive (ngoại lệ) | `kebab-case.tsx` | `confirm-dialog.tsx`, `alert-dialog.tsx` |

> **Ngoại lệ shadcn:** Folder `src/components/ui/` giữ nguyên `kebab-case` theo convention shadcn-cli. **Không đổi**.

### 3.2 Identifier (code)

| Loại | Convention | Ví dụ |
|------|-----------|-------|
| Component (function/class) | `PascalCase` | `function CreateScheduleDialog() {}` |
| Hook | `camelCase` bắt đầu `use` | `useHandover()`, `useToast()` |
| Function thường | `camelCase` | `fetchAllDocuments()`, `compressDocumentImage()` |
| Permission helper | `camelCase` bắt đầu `can` | `canApproveLeave()`, `canViewAllDocuments()` |
| Variable | `camelCase` | `selectedDocId`, `isCreateOpen` |
| Boolean | `camelCase` bắt đầu `is/has/can/should` | `isLoading`, `hasPermission`, `canEdit` |
| Constants (top-level, không đổi runtime) | `UPPER_SNAKE_CASE` | `MAX_IMAGES_PER_DOCUMENT`, `SLA_WARN_THRESHOLD` |
| Enum-like object (status meta) | `UPPER_SNAKE_CASE` cho object, **string literal value** cho key | `DOCUMENT_STATUS_META.PENDING_RECEIPT` |
| Interface / Type alias | `PascalCase`, không dùng prefix `I` | `interface DocumentRow {}`, `type DeskTab = ...` |
| Generic | 1 chữ in hoa hoặc `PascalCase` mô tả | `<T>`, `<TPayload>` |
| RPC / SQL function | `snake_case` (matching Postgres) | `transfer_document()`, `acknowledge_document()` |
| Bảng + cột Postgres | `snake_case` | `document_handovers`, `current_assignee_id` |
| Enum DB | `snake_case` enum type, **UPPER_CASE** value | `document_status: 'PENDING_RECEIPT'` |

### 3.3 Quy ước đặt tên ngữ nghĩa

- **Dialog/Popup component**: tên kết thúc `Dialog` → `CreateScheduleDialog`, `TransferDialog`.
- **Card / list item**: kết thúc `Card` → `DocumentCard`, `ScheduleCard`.
- **Hook tập trung state module**: `use<ModuleName>` (singular) → `useSchedule`, `useHandover`.
- **Hook detail/sub-state**: `use<Entity>Detail` → `useScheduleDetail`, `useDocumentDetail`.
- **Fetch helper**: bắt đầu `fetch` → `fetchScheduleData`, `fetchAllDocuments`.
- **Action helper** (gọi RPC): bắt đầu động từ → `transferDocument`, `acknowledgeDocument`, `completeDocument`.
- **Realtime channel name**: `<module>_realtime_sync` cho list page, `<entity>_<id>` cho detail page.

### 3.4 Comment & message ngôn ngữ

- **Toàn bộ comment trong code: Tiếng Việt rõ nghĩa.** Cấm tiếng Anh.
- **Toast / error message hiển thị user: Tiếng Việt.** Không tiếng Anh kể cả message từ error.
- **Tên biến / function: Tiếng Anh** (vì lý do tooling, syntax highlight, autocomplete).

---

## 4. QUY TẮC PHÁT TRIỂN COMPONENT (NEXT.JS / REACT)

### 4.1 Server Component vs Client Component

**Quy tắc duy nhất:** Mặc định **Server Component**. Chỉ thêm `'use client'` khi cần một trong:
- React hook (`useState`, `useEffect`, `useMemo`, `useRef`, ...)
- Event handler (`onClick`, `onChange`, `onSubmit`)
- Browser API (`window`, `document`, `localStorage`)
- Subscribe Realtime
- Form interactive

**Phân bố hiện tại của dự án** (xác nhận qua khảo sát):
- **19 Server Component** — chủ yếu `layout.tsx`, `not-found.tsx`, `page.tsx` đơn giản
- **98 Client Component** — pages có interaction, mọi component trong `_components/`

**Server Component mẫu** — `src/app/dashboard/layout.tsx`:
```tsx
// Không có 'use client'
import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth-utils'
import { DashboardLayout } from '@/components/layout/dashboard-layout'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  return <DashboardLayout profile={profile}>{children}</DashboardLayout>
}
```

**Client Component mẫu** — `src/app/dashboard/handover/page.tsx`:
```tsx
"use client";
import { useHandover } from "./_hooks/useHandover";

export default function HandoverPage() {
  const state = useHandover();
  // ...
}
```

### 4.2 Smart vs Dumb Component

| Loại | Trách nhiệm | Đặt ở đâu | Có `'use client'` |
|------|-------------|-----------|---|
| **Smart** (container) | Quản state, gọi action, subscribe realtime | `page.tsx`, `_hooks/use*.ts` | Yes |
| **Dumb** (presentational) | Render UI thuần dựa trên props | `_components/<Name>.tsx`, `src/components/` | Yes nếu có handler/animation |

**Quy tắc:** Smart component **giữ state** + **truyền callback xuống**. Dumb component **không tự fetch**, không tự subscribe realtime, chỉ nhận props + emit event.

Ví dụ chuẩn — `handover/page.tsx` (smart) + `_components/DocumentCard.tsx` (dumb):

```tsx
// Smart: page.tsx
const { documents, setSelectedDocId } = useHandover();
return documents.map(doc => (
  <DocumentCard
    key={doc.id}
    document={doc}
    onClick={() => setSelectedDocId(doc.id)}
  />
));

// Dumb: DocumentCard.tsx — nhận props, emit onClick
export default function DocumentCard({ document, onClick }: Props) {
  return <button onClick={onClick}>...</button>;
}
```

### 4.3 Tái sử dụng UI component

**Cây quyết định khi cần component mới:**

```
Component này có là shadcn primitive cần thiết?
├─ YES → cài qua shadcn CLI vào `src/components/ui/`. Không tự viết.
└─ NO →
   Component dùng ở > 1 module dashboard?
   ├─ YES → đặt ở `src/components/<group>/<Name>.tsx`
   └─ NO → đặt trong module: `src/app/dashboard/<module>/_components/<Name>.tsx`
```

**Đặc biệt:** PageHeader (`src/components/layout/PageHeader.tsx`) là **chuẩn duy nhất** cho header mọi trang dashboard:

```tsx
<PageHeader
  title="Hồ sơ vật lý"
  description="Sổ giao nhận điện tử — theo dõi luồng luân chuyển hồ sơ bản cứng"
  action={<Button onClick={...}><Plus className="w-5 h-5 mr-2" /> Tạo hồ sơ</Button>}
/>
```

**Cấm tự viết heading + description thủ công** — luôn qua `PageHeader`.

### 4.4 Popup / Dialog — chuẩn duy nhất

**Mọi popup form/detail toàn màn hình bắt buộc dùng pattern `app-dialog-sheet`** (định nghĩa trong `globals.css`):

```tsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent className="app-dialog-sheet app-dialog-sheet--lg shadow-2xl">
    <DialogHeader className="app-dialog-sheet-header">
      <DialogTitle>...</DialogTitle>
      <DialogDescription>...</DialogDescription>
    </DialogHeader>

    <div className="app-dialog-sheet-body">
      <div className="space-y-5 px-[var(--app-page-x)] py-4">
        {/* nội dung form */}
      </div>
    </div>

    <DialogFooter className="app-dialog-sheet-footer flex flex-row justify-end gap-2">
      <Button variant="ghost">Huỷ</Button>
      <Button>Xác nhận</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

Variant: `--lg` (32rem), `--xl` (36rem), `--2xl` (42rem). **Cấm tự viết className inline với `calc(100dvh-...)`** — đã centralize trong `globals.css`.

### 4.5 Anti-pattern: ScrollArea lồng trong DropdownMenu / app-dialog-sheet

**Cấm** dùng `ScrollArea` (Radix) bên trong `DropdownMenuContent` hoặc bên trong `app-dialog-sheet-body`. Lý do:

- `DropdownMenuContent` intercept touch events cho keyboard navigation → ScrollArea bên trong không nhận được swipe trên mobile → scroll bị khóa.
- `app-dialog-sheet-body` đã có `overflow-y: auto; overscroll-behavior: contain;` → lồng thêm ScrollArea tạo nested scroll → mobile cũng khóa.

**Pattern đúng** — dùng plain div với utility Tailwind:

```tsx
// Trong DropdownMenu
<div className="max-h-[70vh] sm:max-h-[420px] overflow-y-auto overscroll-contain">
  {items.map(...)}
</div>

// Trong app-dialog-sheet
<div className="app-dialog-sheet-body">
  {/* CONTENT TRỰC TIẾP — không cần wrapper scroll */}
  <div className="space-y-4 px-[var(--app-page-x)] py-4">
    {items.map(...)}
  </div>
</div>
```

`ScrollArea` chỉ dùng khi cần scroll trong container ĐỘC LẬP (không phải Dialog/Dropdown) và muốn có scrollbar tuỳ chỉnh — ví dụ sidebar nội dung dài, card scroll horizontal.

---

## 5. GIAO TIẾP DỮ LIỆU & TRẠNG THÁI (DATA FETCHING & STATE)

### 5.1 Khi nào gọi Supabase ở đâu

| Tình huống | Gọi ở | Client | Lý do |
|-----------|-------|--------|-------|
| Lấy session/profile ban đầu khi page load | RSC (`layout.tsx`) | server (`@/utils/supabase/server`) | Tránh flicker, sẵn cookie |
| Fetch list cho trang dashboard | Client hook `useXxx` | browser (`@/utils/supabase/client`) | Cần subscribe realtime cùng nguồn |
| Mutation (insert/update/delete) | Action helper trong `_lib/*Actions.ts` | browser | RLS + RPC server validate |
| Job định kỳ / batch nặng | Edge Function (Deno) | service-role | Bypass RLS hợp pháp |
| Cron daily | Vercel cron `api/cron/*` | server | Đã có sẵn pattern |

**KHÔNG dùng Server Actions** (`'use server'`) trong dự án này — pattern chuẩn là **Client Component + Supabase JS client + RPC**.

### 5.2 Pattern fetch trong `_lib/fetchXxx.ts`

**Quy chuẩn từ `_lib/fetchHandover.ts`:**

```ts
import { createClient } from "@/utils/supabase/client";
import type { DocumentRow } from "./types";

const supabase = createClient();

// Khai báo SELECT string riêng — dùng được nhiều nơi (list + detail)
const FULL_SELECT = `
  *,
  category:document_categories ( id, name, sla_hours, color ),
  creator:profiles!documents_creator_id_fkey ( id, full_name, avatar_url, ... ),
  handovers:document_handovers ( ..., sender:profiles!...(...), receiver:profiles!...(...) )
`;

export async function fetchAllDocuments(): Promise<DocumentRow[]> {
  const { data, error } = await supabase
    .from("documents")
    .select(FULL_SELECT)
    .order("updated_at", { ascending: false });
  if (error) {
    console.error("fetchAllDocuments error:", error);
    return [];
  }
  return (data || []) as unknown as DocumentRow[];
}
```

**6 nguyên tắc fetch:**

1. **1 query lấy đầy đủ join** thay vì N+1 — dùng `.select('*, foo:foreign_table(...)')` với foreign key hint khi có nhiều FK trỏ cùng bảng (như `creator:profiles!documents_creator_id_fkey`).
2. **`Promise.all([…])`** khi 2+ query độc lập (xem `useSchedule.ts:58-65`).
3. **Return mảng rỗng khi lỗi**, log `console.error`. Không throw từ fetch helper — để UI tự render empty state, không vỡ trang.
4. **Type assertion `as unknown as DocumentRow[]`** vì Supabase JS không tự suy luận nested join (chưa gen `database.types.ts`).
5. **Khai báo `FULL_SELECT` ở top file**, không inline trong function — tái sử dụng giữa list + detail.
6. **(Mới) Cursor pagination — fetch có giới hạn (PAGE_SIZE=50)** thay vì load toàn bộ. Dùng
   `.limit(N+1)` để phát hiện `hasMore`, cursor là `updated_at` của item cuối.
   Realtime chỉ refetch page 1, "Xem thêm" append các page sau (xem `fetchHandover.ts`).
   **Không dùng offset-based pagination** vì không ổn định khi có insert/delete ở page đầu.

### 5.3 Pattern hook tập trung `useXxx`

**Quy chuẩn từ `_hooks/useHandover.ts` + `_hooks/useSchedule.ts`:**

```ts
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useHandover() {
  const supabase = useMemo(() => createClient(), []);   // ⭐ memoize 1 lần
  const { toast } = useToast();
  const searchParams = useSearchParams();

  // 1. State (gom liên quan thành object nếu > 4 field)
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);

  // 2. Debounced refetch
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refetch = useCallback(async () => {
    const docs = await fetchAllDocuments();
    setDocuments(docs);
  }, []);
  const scheduleRefetch = useCallback(() => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(refetch, 250);
  }, [refetch]);

  // 3. Initial load — Promise.all song song
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const [profileRes, docs] = await Promise.all([
        supabase.from("profiles").select("*, departments(...)").eq("id", userId).single(),
        fetchAllDocuments(),
      ]);
      if (!active) return;
      setProfile(profileRes.data);
      setDocuments(docs);
      setLoading(false);
    })();
    return () => { active = false };
  }, [supabase]);

  // 4. Realtime subscribe (xem §6.5 cho channel naming)
  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel("handover_realtime_sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "documents" }, scheduleRefetch)
      .subscribe();
    return () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      supabase.removeChannel(channel);
    };
  }, [supabase, profile, scheduleRefetch]);

  // 5. Computed derive — useMemo
  const inboxDocs = useMemo(() => documents.filter(...), [documents, profile]);

  return { loading, profile, documents, inboxDocs, refetch /* ... */ };
}
```

**5 nguyên tắc:**

1. **`useMemo(() => createClient(), [])`** — tránh tạo client mới mỗi render.
2. **`active = false` flag** trong cleanup để chặn `setState` sau unmount.
3. **Debounce realtime** 250–600ms để gộp event burst (insert + update đồng thời).
4. **Computed list dùng `useMemo`**, không tính lại mỗi render.
5. **Return object đặt tên rõ ràng**, không return array vị trí. Caller destructure theo tên.

### 5.4 Form state pattern

**Hiện tại:** form nhỏ vẫn dùng `useState` riêng lẻ + validate inline. Form lớn mới hoặc khi đụng sửa phải dùng `react-hook-form` + `zod`; `CreateTaskDialog` của module Công việc đã migrate theo pattern này.

**Chuẩn duy nhất từ nay:**

| Trường hợp | Pattern |
|-----------|---------|
| Form ≤ 4 field, đơn giản | `useState` riêng + validate inline trước submit (như `CreateDocumentDialog.tsx`) |
| Form > 4 field hoặc có validation phức tạp | `react-hook-form` + `zod` schema |

**Mẫu form đơn giản:**
```tsx
const [title, setTitle] = useState("");
const [categoryId, setCategoryId] = useState("");

const handleSubmit = async () => {
  if (!title.trim()) {
    toast({ variant: "destructive", title: "Thiếu thông tin", description: "Vui lòng nhập tiêu đề" });
    return;
  }
  // submit...
};
```

### 5.5 Loading state & Error state

| State | Hiển thị | Component |
|-------|---------|-----------|
| Loading initial | `<ListSkeleton variant="card" rows={6} />` | `@/components/ui/list-skeleton` |
| Loading inline (button đang submit) | Button disabled + text "Đang xử lý..." | inline |
| Empty | `<EmptyState icon={...} title="..." description="..." />` | `@/components/ui/empty-state` |
| Error fetch | Return mảng rỗng → render Empty + log console | (không hiện full-page error) |
| Error mutation | `toast({ variant: "destructive", title, description })` | `useToast` |

**Quy tắc đồng nhất Skeleton (Unified Loading Skeleton Pattern):**
- **Cấm sử dụng `loading.tsx` ở cấp thư mục con (subroute)** nếu trang đó thực hiện client-side fetching qua Supabase client. Việc lồng ghép Next.js `loading.tsx` với client component loading sẽ gây ra lỗi hiển thị skeleton 2 lần (double loading) và giật lag layout.
- **Trang chủ Dashboard**: Sử dụng một `<Suspense>` boundary bọc `DashboardContent` kèm theo `<DashboardLoading />` fallback để hiển thị skeleton khớp chính xác cấu trúc Home Dashboard.
- **Các trang con khác**: Sử dụng cấu trúc thủ công `<Suspense>` trong `page.tsx` để bao bọc client component (bắt buộc do sử dụng `useSearchParams()`), với tham số `fallback` phải chứa cấu trúc đầy đủ của trang (ví dụ: `<PageHeader>` kèm `<ListSkeleton />` bên dưới) để giao diện không bị giật hay thay đổi bố cục khi chuyển trang.
- **Tối ưu hóa bằng Cache (SWR)**: Đối với các dữ liệu đã được lưu trữ trong `AppDataProvider` (ví dụ: thông tin profile cá nhân), các client page phải sử dụng dữ liệu này để hiển thị ngay lập tức (0ms) trên render đầu tiên, sau đó chỉ cập nhật ngầm (SWR) nhằm loại bỏ hoàn toàn skeleton loading cho người dùng đã đăng nhập.

**Cấm hiển thị page-level error UI cho lỗi fetch list** — luôn fallback về empty state. Lý do: lỗi fetch tạm thời thường tự khỏi qua realtime.

### 5.6 Bộ nhớ đệm dữ liệu dùng chung (AppDataProvider) & Tối ưu hóa Middleware cache

Để tối ưu hóa hiệu năng, giảm số lượng truy vấn dư thừa lên cơ sở dữ liệu và đảm bảo tốc độ phản hồi tức thì cho người dùng:

1. **Bộ nhớ đệm dữ liệu dùng chung (`AppDataProvider`)**:
   - Cung cấp cơ chế lưu trữ đệm client-side (Stale-While-Revalidate) cho các dữ liệu ít biến động hoặc dùng chung ở nhiều trang: `profiles`, `departments`, `out_of_office` (vắng mặt tạm thời), cùng với **`vehicles`** (xe) và **`rooms`** (phòng họp).
   - **Danh mục tài nguyên public-read**: `rooms` được dùng khi cán bộ đặt phòng họp; `vehicles` dùng cho bộ phận điều phối gán xe/lái xe. Hai danh mục này được tải và subscribe realtime cho dashboard, nhưng quyền xem từng `schedule` vẫn do RLS của `schedules` quyết định; quyền ghi/sửa danh mục vẫn chỉ dành cho admin/secretary/manager phòng điều phối.
   - **Thời gian sống (TTL)**:
     - `profiles`: 1 giờ (1h)
     - `departments`: 24 giờ (24h)
     - `ooo` (Out of Office): 30 phút (30m)
     - `vehicles`: 24 giờ (24h) - Invalidated realtime
     - `rooms`: 24 giờ (24h) - Invalidated realtime
   - **Cơ chế hoạt động**:
     - *Bước 1*: Đọc đồng bộ dữ liệu từ `localStorage` khi mount (tránh hydration mismatch) để render ngay lập tức (0ms delay).
     - *Bước 2*: Thực hiện background fetch profiles/depts/ooo/vehicles/rooms để cập nhật state.
     - *Bước 3*: Subscribe realtime channel `app_data_sync` duy nhất cho profiles/depts/ooo/vehicles/rooms (gộp 2 channel thành 1 để giảm subscription).
     - *Bước 4*: Phân quyền ghi/sửa tài nguyên không nằm ở cache provider mà nằm ở helper UI + RLS policy backend.
   - **Tối ưu payload**: Đối với user không phải admin, fetching profiles được filter ngay tại DB với `role != 'admin'` thay vì tải toàn bộ rồi lọc client-side, giúp giảm đáng kể dung lượng tải về (admin/director thường chiếm <5% tổng user). Admin vẫn fetch toàn bộ profiles không filter.
   - **Quy tắc sử dụng**: Tuyệt đối không tự fetch lại danh sách phòng ban (`departments`), xe (`vehicles`), hay phòng (`rooms`) trong các dialog/component con mà bắt buộc phải đọc trực tiếp từ `useAppData()` để tối ưu hóa hiệu năng.

2. **Cơ chế Cookie Cache trong Middleware**:
   - Để tối ưu hóa hot path và giảm tải cho DB trên mọi navigation, Middleware sử dụng một signed cookie (`wf_active_v1`) để cache trạng thái kích hoạt `is_active` của user với thời gian TTL là 60 giây (60s).

3. **In-memory cache dashboard_summary (30s TTL)**:
   - Hook `useDashboardSummary` duy trì một module-level cache (`cachedData`) với TTL 30 giây để tránh gọi lại RPC `dashboard_summary()` khi người dùng chuyển tab/quay lại trong khoảng thời gian ngắn.
   - Cache tự động invalidate mỗi khi có realtime event từ dashboard channel hoặc khi user gọi `refetch()` thủ công.
   - Cơ chế stale-while-revalidate: cache cũ vẫn được dùng để render ngay, background fetch cập nhật sau.
   - **Nguyên lý hoạt động**:
     - *Cache hit*: Nếu cookie cache hợp lệ và khớp với trạng thái hiện tại (`id:1` cho active, `id:0` cho inactive), bypass truy vấn profile từ DB.
     - *Cache miss*: Nếu cookie hết hạn hoặc chưa có, Middleware sẽ truy cập Supabase SELECT để kiểm tra `is_active` thực tế, sau đó ghi đè cookie cache với thời hạn 60 giây.
     - *Bảo mật*: Mặc dù user bị vô hiệu hóa có thể truy cập dashboard trễ tối đa 60 giây do cookie cache, mọi thao tác ghi/sửa dữ liệu (mutation) đều đi qua RPC/RLS ở backend và sẽ bị chặn ngay lập tức, đảm bảo an toàn tuyệt đối.

---

## 6. QUY CHUẨN TÍCH HỢP SUPABASE

### 6.1 Hai client — không bao giờ trộn

**Browser client** (`src/utils/supabase/client.ts`):
```ts
import { createClient } from "@/utils/supabase/client";
const supabase = createClient();   // singleton trong tab browser
```
Dùng trong **Client Component** + hook.

**Server client** (`src/utils/supabase/server.ts`):
```ts
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

const cookieStore = await cookies();
const supabase = createClient(cookieStore);
```
Dùng trong **RSC** + **`middleware.ts`**.

**Cấm:**
- ❌ Import `@/utils/supabase/server` từ Client Component.
- ❌ Import `@/utils/supabase/client` từ RSC.
- ❌ Dùng service-role key ở client. Service role chỉ tồn tại trong Edge Function (đọc từ `Deno.env`).

### 6.2 Đặt tên bảng/cột

- **Bảng**: `snake_case` số nhiều — `documents`, `document_handovers`, `schedule_participants`.
- **Cột**: `snake_case` — `current_assignee_id`, `attached_image_urls`, `created_at`, `updated_at`.
- **FK**: tên cột = `<table_singular>_id` — `category_id`, `creator_id`, `receiver_id`.
- **Timestamp**: luôn dùng `TIMESTAMPTZ` (with timezone), `DEFAULT NOW()`.
- **Enum**: tên `snake_case`, value `UPPER_CASE` — `document_status: 'PENDING_RECEIPT' | 'IN_REVIEW' | ...`.
- **Index**: `idx_<table>_<column(s)>` — `idx_documents_current_assignee`.
- **Trigger function**: động từ tiếng Anh + `_<entity>` — `generate_document_short_code()`, `touch_documents_updated_at()`.

### 6.3 RPC pattern (PL/pgSQL)

**Khi nào dùng RPC `SECURITY DEFINER` thay vì update trực tiếp:**

- Cần validate trạng thái phức tạp trước khi update (ví dụ: chỉ cho transfer khi status IN (...))
- Cần update **nhiều bảng** atomically (insert handover + update document + insert notification)
- Cần bypass RLS hợp pháp (ví dụ: insert notification cho người khác)

**Mẫu chuẩn** từ `schema.sql`:
```sql
CREATE OR REPLACE FUNCTION transfer_document(
    p_document_id UUID,
    p_receiver_id UUID,
    p_note TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_doc documents%ROWTYPE;
BEGIN
    -- 1. Check auth
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Phiên đăng nhập đã hết hạn';
    END IF;

    -- 2. Lock + validate
    SELECT * INTO v_doc FROM documents WHERE id = p_document_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy hồ sơ';
    END IF;
    -- ... business validation ...

    -- 3. Multi-table update
    INSERT INTO document_handovers (...) VALUES (...);
    UPDATE documents SET status = 'PENDING_RECEIPT' WHERE id = p_document_id;
    INSERT INTO notifications (...) VALUES (...);

    RETURN v_handover_id;
END;
$$;
```

**5 nguyên tắc RPC:**

1. **Tên RPC: `snake_case` động từ** — `transfer_document`, `acknowledge_document`.
2. **Tham số có prefix `p_`** — `p_document_id`, `p_receiver_id`. Tránh nhầm với column.
3. **Luôn `SECURITY DEFINER` + `SET search_path = public`** — chặn search_path injection.
4. **Lock row bằng `FOR UPDATE`** trong nghiệp vụ tranh chấp.
5. **Throw exception tiếng Việt** — `RAISE EXCEPTION 'Bạn không có quyền chuyển hồ sơ này'`. Client sẽ nhận về `error.message` tiếng Việt.

**Gọi RPC từ client** (wrapper trong `_lib/<action>Actions.ts`):
```ts
export async function transferDocument(documentId: string, receiverId: string, note: string | null) {
  const { data, error } = await supabase.rpc("transfer_document", {
    p_document_id: documentId,
    p_receiver_id: receiverId,
    p_note: note,
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, handoverId: data as string };
}
```

**Convention: return `{ ok: true, … } | { ok: false, error }`** — caller `if (!res.ok) toast(...)`. Tuyệt đối không throw từ wrapper.

### 6.4 Permission helper

**Định nghĩa tập trung** tại `src/lib/permissions.ts`. Mọi check role/department phải đi qua helper, **cấm inline `profile.role === 'admin'` trong component**.

```ts
// ✅ Đúng
import { canViewAllDocuments } from "@/lib/permissions";
const showAllTab = canViewAllDocuments(profile);

// ❌ Sai
const showAllTab = profile?.role === "admin" || profile?.role === "director";
```

**Helper hiện có** (xem `src/lib/permissions.ts`):

**People / Profiles / Leaves:**
- `isCoordinatorDepartment(profile)` — phòng điều phối Tổ chức Tổng hợp (code `'13602'`)
- `canCoordinateSharedResources(profile)` — điều phối phòng họp/xe
- `canManageResourceCatalog(profile)` — admin/secretary
- `canUseDriverWorkspace(profile)` — `driver` role
- `canUseHumanResourcesWorkspace(profile)` — `hr_officer`
- `canAccessPeopleDirectory(profile)` — ⚠️ **DEPRECATED** (giữ lại tương thích), dùng `canViewPeopleDirectory` thay
- `canViewPeopleDirectory(profile)` — xem danh bạ (mọi role active trừ `driver`)
- `canViewSensitiveProfileFields(viewer, target)` — birthday/ad_account/employee_code/gender (self + admin + hr_officer + director)
- `canEditProfile(viewer, target)` — sửa hồ sơ (self field hạn chế; admin + hr_officer full)
- `canRecognize(profile)` — gửi ghi nhận đồng nghiệp (mọi role active trừ `driver`)
- `canApproveLeave(profile, leave?)` — duyệt đơn nghỉ

**Documents (luân chuyển hồ sơ vật lý):**
- `canManageDocumentCategories(profile)` — admin manage nhóm hồ sơ
- `canViewAllDocuments(profile)` — admin/director xem toàn chi nhánh
- `canCreateDocument(profile)` — không phải driver

**Tasks module — phân quyền chi tiết theo phòng đầu mối (hub):**
- `getProfileDepartmentCode(profile)` — trích code phòng từ profile (xử lý cả object lẫn array shape của Supabase select)
- `isHubDepartment(profile)` — true nếu phòng thuộc mã hub: `13618 / 13601 / 13602 / 13605 / 13609 / 13603`
- `canAccessTasksModule(profile)` — mọi role trừ `driver`/`secretary`/`hr_officer`
- `getDefaultTaskScope(profile)` — scope mặc định của trang Công việc (`branch` cho admin/director, `dept` cho Trưởng phòng, `mine` cho manager thường/staff)
- `canViewTaskScopeTabs(profile)` — hiển thị tabs scope cho admin/director/Trưởng phòng
- `canAssignTaskToOthers(profile)` — quyền tạo task cho người khác (admin/director/manager)
- `canCreateTaskAssignment(profile)` — tạo công việc: `admin / director / manager` + `staff` thuộc phòng đầu mối
- `canTargetCrossDepartment(profile)` — bật lựa chọn "Phòng khác" cho `admin / director` + `manager / staff` thuộc hub. Manager non-hub bị siết về phòng mình; BGĐ không nằm trong danh sách phòng nhận việc
- `canDelegateTask(profile, task)` — phân công lại task cấp phòng (admin/director + Trưởng phòng cùng phòng)
- `canApproveTaskResult(profile, task)` — duyệt `submitted → done` (cùng quyền delegate)
- `canRejectSubmission(profile, task)` — trả `submitted → doing` kèm lý do (cùng quyền delegate)
- `canReopenDone(profile, task)` — mở lại `done → doing` (người tạo + manager phòng người tạo/phòng nhận + admin/director)
- `canEditTask(profile, task)` — sửa title/description/priority/due_date (creator + Trưởng phòng của creator + admin/director, không cho khi `canceled/archived`)
- `canDeleteTask(profile, task)` — Xóa hẳn task khỏi hệ thống (creator + Trưởng phòng của creator + admin/director)
- `canForceCompleteTask(profile, task)` — Cho phép creator/manager/admin chủ động Ghi nhận hoàn thành dù assignee chưa nộp
- `canCreateRecurringTemplate(profile)` — tạo template định kỳ (cùng quyền `canCreateTaskAssignment`)
- `canViewTaskAnalytics(profile)` — vào Analytics (admin/director/manager + staff Coordinator)
- `canViewBranchAnalytics(profile)` — Analytics phạm vi toàn chi nhánh (admin/director + Coordinator)

> **Defense-in-depth** cho Tasks: helper UI chỉ là **layer 1**. Backend (RPC `task_create`, `task_delegate`, `recurring_template_upsert`, `recurring_fire_due`) check lại độc lập — xem `docs/PRODUCT_OVERVIEW.md §3.3` để biết đủ 5 layer.

**Khi thêm module mới**: thêm helper `can<Action><Entity>()` vào `permissions.ts` cùng comment tiếng Việt giải thích quy tắc.

### 6.5 Realtime channel — naming convention

Khảo sát cho thấy 4 pattern đang dùng:

| Mục đích | Pattern channel name | Ví dụ |
|---------|---------------------|-------|
| List page (subscribe nhiều bảng) | `<module>_realtime_sync` | `schedule_realtime_sync`, `handover_realtime_sync` |
| List page (legacy, vẫn chấp nhận) | `<module>_sync` | `dashboard_sync` |
| Detail page 1 entity | `<entity>_<id>` | `task_${id}`, `report_${id}` |
| Per-user inbox | `<scope>_realtime_<userId>` | `notifications_realtime_${user.id}` |

**Chuẩn duy nhất từ nay** cho module mới:
- List page → **`<module>_realtime_sync`**
- Detail page → **`<entity>_<id>`**

**Cleanup bắt buộc:**
```ts
return () => {
  if (refetchTimer.current) clearTimeout(refetchTimer.current);
  supabase.removeChannel(channel);
};
```

### 6.6 Storage

- Bucket name: `snake_case_plural` — `avatars`, `documents`.
- Path convention: `{owner_or_parent_id}/{timestamp}-{n}.{ext}` — ví dụ `${documentId}/${ts}-${i}.jpg`.
- Trước upload: **nén client-side** qua `browser-image-compression` (xem `_lib/compressImage.ts`).
- Sau upload: `getPublicUrl(path)` → lưu URL đầy đủ vào DB.
- Cleanup file: dùng Edge Function chạy theo lịch (xem `cleanup-document-images`).

### 6.7 Database types

File `src/types/database.types.ts` là **hand-craft** theo schema + migrations hiện tại. Khi nào cài được Supabase CLI, thay bằng auto-gen:

```bash
npx supabase login                                        # browser auth 1 lần
npx supabase gen types typescript --project-id <ref> > src/types/database.types.ts
```

**Cách dùng các shortcut type**:

```ts
import type { Tables, TablesInsert, TablesUpdate } from "@/types/database.types";

type Document = Tables<"documents">;
type DocumentInsert = TablesInsert<"documents">;
// → autocomplete cho mọi cột trong bảng
```

**Quy tắc bảo trì**: mỗi lần thêm bảng/cột mới vào migration, **bắt buộc** cập nhật `database.types.ts` tương ứng (hoặc chạy lại CLI gen). Để file lệch khỏi schema = mất type safety toàn dự án.

### 6.8 Workflow status với transit state (PENDING_RECEIPT pattern)

Module `handover` (luân chuyển hồ sơ) có **trạng thái trung gian** — bài học từ implementation:

- `transfer_document` RPC chỉ đổi `status = PENDING_RECEIPT`, **KHÔNG** đổi `current_assignee_id` ngay.
- Ownership chỉ thực sự sang receiver khi họ `acknowledge_document` (status `IN_REVIEW`, current_assignee_id mới được update).
- Nếu receiver `reject_document` → status `RETURNED`, current_assignee_id revert về sender.

**Hệ quả với UI** — quy tắc bắt buộc cho mọi workflow status có transit state:

1. **Ẩn nút action của sender khi đang chờ receiver**:
   ```ts
   const canSenderAct = isHolder
     && !outgoingPending           // không có handover PENDING từ tôi
     && doc.status !== "PENDING_RECEIPT"
     && doc.status !== "COMPLETED";
   ```

2. **Hiển thị "người đang chờ nhận" thay vì "người đang giữ" khi PENDING_RECEIPT**:
   ```ts
   const displayPerson = doc.status === "PENDING_RECEIPT"
     ? outgoingPending?.receiver       // người tiếp theo
     : doc.current_assignee;           // người đang giữ thực sự
   ```

3. **Phân loại Inbox/Outbox theo handover thay vì current_assignee_id**: doc có `outgoing PENDING` từ user → Outbox (dù `current_assignee_id` vẫn là user). Doc có `incoming PENDING` cho user → Inbox.

Áp dụng pattern này cho mọi feature có handover/approval flow trong tương lai.

---

## 7. XỬ LÝ LỖI & GHI LOG (ERROR HANDLING & LOGGING)

### 7.1 Phân loại lỗi

| Loại lỗi | Hành động |
|---------|-----------|
| Lỗi fetch list (Supabase select) | `console.error` + return `[]` → UI render empty state |
| Lỗi mutation (insert/update/RPC) | `toast({ variant: "destructive", title, description: error.message })` |
| Validation phía client | `toast({ variant: "destructive", title: "Thiếu thông tin", description: "..." })` — không submit |
| Lỗi unexpected (parse, network) | `console.error` + toast generic "Có lỗi xảy ra, vui lòng thử lại" |
| Lỗi auth (session hết hạn) | Middleware tự redirect `/login` — không cần xử lý ở component |

### 7.2 Format chuẩn lời nhắn

| Tình huống | Title | Description |
|-----------|-------|-------------|
| Validation thiếu field | `"Thiếu thông tin"` | "Vui lòng nhập <tên field>" |
| Validation sai định dạng | `"Giá trị không hợp lệ"` | mô tả cụ thể |
| RPC reject | `"Không <hành động> được"` | `error.message` (đã tiếng Việt từ RPC) |
| Upload fail | `"Lỗi upload ảnh"` | `error.message` |
| Mutation thành công | `"Đã <hành động>"` | mô tả ngắn ("Đợi người nhận xác nhận") |

**3 mẫu chuẩn — dùng helper `@/lib/notify`** (centralize, không gọi `toast()` inline):

```ts
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";

// Thành công
notifySuccess("Đã chuyển hồ sơ", "Đợi người nhận xác nhận \"Đã nhận\".");

// Lỗi nghiệp vụ — tự trích message từ error (PostgrestError, Error, string đều OK)
notifyError(res.error, "Không chuyển được");

// Validation phía client
notifyValidation("Vui lòng nhập tiêu đề hồ sơ");
```

**Chỉ gọi `toast()` trực tiếp** khi cần variant đặc biệt (action button, undo…). Các trường hợp thông thường bắt buộc đi qua helper.

### 7.3 Confirm dialog (thay confirm() native)

```ts
import { confirmDialog } from "@/components/ui/confirm-dialog";

const ok = await confirmDialog({
  title: "Xoá nhóm hồ sơ?",
  description: `Nhóm "${c.name}" sẽ bị xoá.`,
  confirmText: "Xoá",
  danger: true,   // ⚠️ field tên là `danger`, không phải `destructive`
});
if (!ok) return;
```

**Cấm dùng `window.confirm()` native** — luôn qua `confirmDialog`.

### 7.4 Logging

- **Client**: `console.error` cho dev debug. Không gửi log lên service ngoài (chưa setup Sentry).
- **Server (RPC)**: `RAISE EXCEPTION` tiếng Việt — sẽ hiện cho user.
- **Edge Function**: `console.log`/`console.error` → xem qua Supabase Dashboard → Edge Functions → Logs.

---

## 8. HƯỚNG DẪN THÊM TÍNH NĂNG MỚI (FEATURE WORKFLOW)

Checklist **bắt buộc** theo thứ tự. Áp dụng cho mọi module mới (ví dụ minh hoạ: module **"Quản lý hợp đồng"**).

### Phase 1 — Database

- [ ] Update `schema.sql` (không tạo file migration rời).
- [ ] Định nghĩa enum nếu cần — `DO $$ BEGIN CREATE TYPE ... AS ENUM (...); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`.
- [ ] Tạo bảng theo §6.2: tên `snake_case` plural, `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `created_at`/`updated_at TIMESTAMPTZ DEFAULT NOW()`.
- [ ] Thêm index cho cột thường query (`creator_id`, `assignee_id`, `status`).
- [ ] Trigger `BEFORE UPDATE` set `updated_at = NOW()`.
- [ ] Viết RPC `SECURITY DEFINER` cho mọi mutation phức tạp (§6.3).
- [ ] **RLS**: SELECT theo quan hệ + role; INSERT/UPDATE deny direct, qua RPC (xem `schema.sql`).
- [ ] Seed dữ liệu mặc định nếu cần.
- [ ] Chạy migration trên Supabase Dashboard → SQL Editor → verify.

### Phase 2 — Permission

- [ ] Thêm helper `canXxxYyy()` vào `src/lib/permissions.ts` với comment tiếng Việt.
- [ ] Verify role hiện tại: `admin | director | manager | staff | secretary | hr_officer | driver`.

### Phase 3 — Module skeleton

- [ ] Tạo folder `src/app/dashboard/<module-kebab>/` với đủ 3 subfolder `_components/`, `_hooks/`, `_lib/`.
- [ ] Tạo file `_lib/constants.ts` — status meta, labels, color map theo §2.5 status tokens.
- [ ] Tạo file `_lib/types.ts` — interface DB row, tránh `any`.
- [ ] Tạo file `_lib/fetch<Module>.ts` — `FULL_SELECT` const + 1-2 fetch function.
- [ ] Tạo file `_lib/<action>Actions.ts` — wrapper RPC, return `{ ok, ... } | { ok: false, error }`.
- [ ] Tạo file `_hooks/use<Module>.ts` — theo pattern §5.3 (memoize client, debounce, realtime, Promise.all, computed memo).
- [ ] Tạo `page.tsx` — Client Component, dùng `<PageHeader>`, dùng `<Tabs>` nếu có nhiều view.

### Phase 4 — Navigation

- [ ] Thêm icon Lucide phù hợp (xem palette: `LayoutDashboard | ListTodo | Target | CalendarDays | FolderOpen | Users | ...`).
- [ ] Sửa `src/components/layout/dashboard-layout.tsx` → mảng `navItems` thêm `{ name, href, icon, hideFor }`.
- [ ] Nếu page có search → thêm vào `configMap` cùng file để hiện search bar trên top nav.

### Phase 5 — Components

- [ ] List item: `_components/<Entity>Card.tsx` (dumb, nhận `onClick` callback).
- [ ] Empty state: dùng `<EmptyState>` từ `@/components/ui/empty-state`.
- [ ] Dialog tạo mới: `_components/Create<Entity>Dialog.tsx`, dùng pattern `app-dialog-sheet` (§4.4).
- [ ] Dialog chi tiết: `_components/<Entity>DetailDialog.tsx`, dùng pattern `app-dialog-sheet` size `--xl`.
- [ ] Mọi popup form/detail bắt buộc dùng class `app-dialog-sheet`. Không hardcode max-h/safe-area.

### Phase 6 — Realtime

- [ ] Channel name: `<module>_realtime_sync` cho list, `<entity>_<id>` cho detail (§6.5).
- [ ] Subscribe trong `useEffect` của hook chính, cleanup `removeChannel` + `clearTimeout`.
- [ ] Trigger toast riêng nếu event quan trọng cá nhân (inbox mới).

### Phase 7 — Notifications

- [ ] Insert row `notifications (user_id, title, content, type, link)` từ trong RPC `SECURITY DEFINER`.
- [ ] Webhook đã setup sẵn cho table `notifications` → push-notification edge function tự fire.
- [ ] **Cấm gọi push từ client** — luôn qua DB.
- [ ] **Loại trừ tài xế** khỏi thông báo nghiệp vụ thông thường (driver chỉ nhận noti liên quan chuyến đi của mình — xem ma trận role ở `PRODUCT_OVERVIEW.md §2.3`).

### Phase 8 — Verify

- [ ] `npx tsc --noEmit` pass — không error TypeScript.
- [ ] `npx next build` compile thành công, route mới xuất hiện trong build output.
- [ ] Mỗi file `.tsx`/`.ts` mới ≤ 500 dòng.
- [ ] Tuân thủ palette: không có `indigo|purple|pink` trong className mới.
- [ ] Touch target ≥ 44px trên mobile (token `min-h-11` hoặc `--app-touch-target`).
- [ ] Comment trong code: tiếng Việt rõ nghĩa.
- [ ] Toast message: tiếng Việt, format chuẩn §7.2.
- [ ] Test thủ công trên mobile real device hoặc DevTools mobile mode — input không bị iOS zoom (đã fix global).
- [ ] Thêm route mới vào CREATE_ACTIONS của src/components/layout/MobileCreateFab.tsx nếu module có dialog "Tạo mới".

### Phase 9 — Documentation

- [ ] Cập nhật `schema.sql` (snapshot) nếu thêm bảng — chỉ thêm phần CREATE TABLE + RLS, không ghi đè bảng cũ.
- [ ] Nếu introduce pattern mới chưa có trong tài liệu này → bổ sung mục tương ứng vào `ARCHITECTURE.md`.

---

## 9. BẤT ĐỒNG BỘ ĐÃ BIẾT — DỌN DẦN

Mục này theo dõi các điểm lệch chuẩn của codebase. Trạng thái cập nhật mỗi đợt cleanup. Mục tiêu: làm sạch dần đến khi bảng dưới đây trống.


| Khu vực | Vấn đề | Hướng giải |
|--------|--------|------------|
| `profile: any` trong code cũ | Mất type safety | Từ nay code mới dùng `Profile`/`ProfileLite` từ `@/types/profile`. Code cũ migrate dần khi đụng vào — KHÔNG mass-replace để tránh regression. |
| Form lớn dùng `useState` thủ công | `CreateTaskDialog` đã migrate sang `react-hook-form` + `zod`; một số dialog cũ còn dùng `useState` | Form > 4 field từ nay dùng `react-hook-form` + `zod` schema. Form cũ giữ nguyên cho đến khi đụng vào để sửa. |
| `admin/page.tsx` (461 dòng) | Sát giới hạn 500 dòng | Lần đụng vào tiếp theo phải tách subcomponent vào `_components/` (chưa có folder — cần tạo) |

---

## 9.1 Shared component đã chuẩn hoá (bắt buộc dùng lại)

Các pattern UI sau đã trích vào `src/components/ui/` — **mọi module mới phải dùng lại**, không tự viết:

| Component | Vai trò | Path |
|---|---|---|
| `<PeoplePicker>` | Chọn người (single/multi) với Accordion grouping theo phòng ban | `src/components/ui/people-picker.tsx` |
| `<AvatarStack>` | Hiển thị stack avatar overlap + "+N" khi nhiều người | cùng file |
| `<SelectionPill>` | Pill h-10 hiển thị tóm tắt selection (avatar stack + count + X) — `onClear` optional cho mode display | cùng file |
| `<DepartmentPicker>` | Chọn phòng ban (Collapsible + "Chọn tất cả") | `src/components/ui/department-picker.tsx` |

**Helper**:
- `src/lib/profile-grouping.ts` → `groupProfilesByDepartment(profiles, opts)` — gom BGĐ → Phòng tôi → Phòng khác theo code.
- `src/lib/utils.ts` → `compareProfilesByHierarchy / sortProfilesByHierarchy` — sort TP→PP→NV→alphabet.

**Cấm**:
- Tự render flat `<DropdownMenuCheckboxItem>` cho list profiles → dùng PeoplePicker.
- Tự render `flex -space-x-2 ...` cho avatar overlap → dùng AvatarStack.
- Chip name hàng loạt khi selected > 3 người → dùng SelectionPill.

**Pattern phân quyền fetch**: `src/app/dashboard/tasks/_lib/fetchTasks.ts` → `fetchAssignableProfiles({ context, caller, taskDepartmentId? })` filter ở DB theo role (staff=self, manager=own-dept, admin/director=branch, exclude admin/director/driver/secretary/hr_officer). Module khác cần fetch tương tự → reuse hoặc viết ở `_lib/`.

---

## 10. CRITICAL FILES — ĐỌC TRƯỚC KHI CODE

| File | Vai trò |
|------|---------|
| `docs/PRODUCT_OVERVIEW.md` | Bối cảnh nghiệp vụ, role, module, luồng |
| `docs/DATABASE_SCHEMA.md` | Entities, RLS strategy, SLA, storage, cronjobs |
| `docs/ARCHITECTURE.md` | File này |
| `schema.sql` | Snapshot DB hiện tại |
| `src/app/globals.css` | Design tokens + utility classes |
| `src/app/dashboard/layout.tsx` | RSC pattern + DashboardLayout mount |
| `src/middleware.ts` | Session guard logic |
| `src/lib/permissions.ts` | Tất cả role helper |
| `src/lib/utils.ts` | `cn()`, profile sort, leave permissions |
| `src/lib/notify.ts` | ⭐ `notifyError` / `notifySuccess` / `notifyValidation` — toast chuẩn |
| `src/lib/auth-utils.ts` | `getProfile()` server-side |
| `src/types/profile.ts` | ⭐ `Profile`, `ProfileLite`, `Department`, `UserRole` |
| `src/types/database.types.ts` | Stub — chờ gen từ Supabase CLI |
| `src/utils/supabase/client.ts` + `server.ts` | 2 client patterns |
| `src/app/dashboard/schedule/_hooks/useSchedule.ts` | ⭐ Mẫu hook chuẩn (realtime + Promise.all) |
| `src/app/dashboard/handover/_hooks/useHandover.ts` | ⭐ Mẫu hook gọn (state object + memoized client) |
| `src/app/dashboard/handover/_lib/fetchHandover.ts` | ⭐ Mẫu fetch + FULL_SELECT |
| `src/app/dashboard/handover/_lib/transferActions.ts` | ⭐ Mẫu RPC wrapper |
| `schema.sql` | ⭐ Snapshot toàn bộ DB (truth source duy nhất) |
| `supabase/functions/cleanup-document-images/index.ts` | ⭐ Mẫu Edge Function |

---

**Phiên bản:** 1.4 — 2026-05-27 (bổ sung `canDeleteTask` hard delete, `canForceCompleteTask` ghi nhận hoàn thành; fix lỗi tự ghi chú).
**Người duyệt:** Tech Lead
**Tần suất cập nhật:** Mỗi quý hoặc khi có pattern kiến trúc mới được chấp nhận.
### 7.5 Radix UI Dialog pointer-events cleanup

Khi đóng 2 Dialog cùng lúc (VD: ConfirmDialog trên DetailDialog), Radix UI đôi khi quên xoá `pointer-events: none` trên body → page bị đơ.

**Fix**: [`src/components/pointer-events-cleanup.tsx`](src/components/pointer-events-cleanup.tsx) — global client component, tự động kiểm tra mỗi khi click/transition kết thúc. Nếu body đang `pointer-events: none` mà không có Dialog nào mở (`[data-state="open"][role="dialog"]`), thì tự xoá.

Đã gắn trong `src/app/layout.tsx` — áp dụng toàn app.

### 7.6 Stateful `now` refresh 30s cho component thời gian thực

Các component hiển thị trạng thái phụ thuộc thời gian hiện tại (DirectorTimeline, ResourcesManagerDashboard) cần `now` là state thay vì `new Date()` để tự cập nhật:

```tsx
const [now, setNow] = React.useState(new Date());
React.useEffect(() => {
  const timer = setInterval(() => setNow(new Date()), 30000);
  return () => clearInterval(timer);
}, []);
```

- `now` dùng cho so sánh `start_time <= now`, `end_time >= now`, và làm `rawEnd` cho bar timeline.
- Refresh 30s đủ nhanh để cập nhật trạng thái xe/người, không quá nặng cho performance.
