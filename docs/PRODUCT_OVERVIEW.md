# PRODUCT OVERVIEW — Tài liệu Nghiệp vụ & Tính năng

> Tài liệu này mô tả **bối cảnh, người dùng, và các module nghiệp vụ** của WorkFlow Portal. Không nói về quy chuẩn code (xem [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)) hay schema DB (xem [`DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md)).

## Mục lục

1. [Business Context](#1-business-context-bối-cảnh)
2. [User Roles & Phân quyền](#2-user-roles--ma-trận-phân-quyền)
3. [Core Modules](#3-core-modules-các-phân-hệ-chính)
   - 3.1 [Hồ sơ vật lý (Sổ giao nhận điện tử)](#31-module-hồ-sơ--luân-chuyển--truy-vết-hồ-sơ-vật-lý)
   - 3.2 [Dashboard chính (Home)](#32-module-dashboard-chính-home)
   - 3.3 [Công việc (Tasks)](#33-module-công-việc-tasks)
   - 3.4 [Lịch trình (Schedule)](#34-module-lịch-trình-schedule)
   - 3.5 [Cán bộ (Team)](#35-module-cán-bộ-team)
   - 3.6 [Cá nhân (Profile)](#36-module-cá-nhân-profile)
   - 3.7 [Admin](#37-module-admin)
   - 3.8 [Settings](#38-module-settings)
4. [Auth Flow (Đăng ký → Đăng nhập → Vào dashboard)](#4-auth-flow)
5. [Tính năng xuyên suốt (Cross-cutting)](#5-tính-năng-xuyên-suốt)
6. [Cronjobs & Background jobs](#6-cronjobs--background-jobs)
7. [Roadmap quan sát được trong code](#7-roadmap-quan-sát-được-trong-code)

---

## 1. Business Context (Bối cảnh)

### 1.1 Vấn đề thực tế ở chi nhánh

Chi nhánh ngân hàng đã có **Core Banking** quản lý đầy đủ giao dịch, tài khoản, sổ sách kế toán. Nhưng **vận hành nội bộ hằng ngày** vẫn vướng những "vùng xám" mà Core Banking không chạm tới:

| Pain point | Hiện trạng nếu không có app | Hậu quả |
|------------|----------------------------|---------|
| **Hồ sơ giấy thất lạc** | Một bộ hồ sơ tín dụng đi qua RM → KSV → Trưởng phòng → PGĐ → GĐ → Quỹ. Mỗi chặng có thể nằm trên bàn ai đó 1–3 ngày, **không có log**. | Khi mất, không truy được "đứt mạch" ở đâu. Bị nhắc khách hàng, đẩy trễ tiến độ giải ngân. Có khi mất luôn. |
| **Phòng họp / xe bị "đặt chồng"** | Thư ký không có công cụ điều phối, nhân viên gọi điện đặt chỗ thủ công. | Trùng giờ → cãi nhau → lãnh đạo chờ phòng. |
| **Công việc giao miệng** | Lãnh đạo giao task qua Zalo/họp giao ban, không có nơi tổng hợp deadline. | Quên việc, không theo dõi được SLA, không có dữ liệu đánh giá nhân viên. |
| **Đơn nghỉ phép viết tay** | Trưởng phòng duyệt rồi nhét vào file Excel. | Ban Giám đốc không biết hôm nay phòng nào nghỉ ai. Không tổng hợp được ngày phép. |
| **Danh bạ rời rạc** | Số máy, ảnh, sinh nhật của cán bộ nằm rải rác trong sổ tay/Outlook/group Zalo. | Tân binh mất 1 tháng mới quen được tên các phòng. Quên chúc sinh nhật. |
| **Lái xe không có lịch chạy rõ ràng** | Gọi điện cho thư ký nhận chuyến, ghi tay sổ tay. | Không có lịch sử Km, xăng xe, chuyến đi. |

### 1.2 Triết lý sản phẩm

- **PWA-first**: cán bộ chi nhánh phần lớn dùng điện thoại. App phải cài được như native (iOS/Android), có push notification, chạy được offline-tolerant cho các tác vụ đọc.
- **"Single source of truth" cho vận hành nội bộ**: 1 app duy nhất thay 5–7 group Zalo + 3–4 file Excel chia sẻ qua mail.
- **Truy vết > Tự động hoá**: ưu tiên log đầy đủ "ai làm gì lúc nào" để khi có sự cố lãnh đạo có dữ liệu xử lý — chứ không cố thay thế hoàn toàn quy trình con người.
- **Tôn trọng cấu trúc tổ chức**: phân quyền chi tiết theo Phòng + Role + cờ `is_department_head`, không "ai cũng thấy tất cả".

### 1.3 Mục tiêu chính của bản hiện tại

> Dự án xây **mọi module ngang hàng** (Dashboard, Tasks, Schedule, Handover, Team, Profile, Admin, Settings) — phục vụ vận hành chi nhánh khép kín trong 1 ứng dụng. Không module nào được xem là "phụ trợ" — mỗi module giải quyết một vùng xám riêng và đều cần đầu tư đầy đủ về chất lượng, RLS, realtime, UI.

---

## 2. User Roles — Ma trận phân quyền

Hệ thống có **7 role** khai báo ở enum `user_role` (Postgres) + type `UserRole` (TypeScript trong [`src/types/profile.ts`](src/types/profile.ts)).

> ⚠️ **KHÔNG có role "RM" hay "Kiểm soát viên" riêng**. RM, GDV, KSV, Pháp chế, IT, Kho quỹ… đều thuộc role `staff`, phân biệt nhau qua `department_id` + `title` + `is_department_head`.

### 2.1 Bảng 7 role

| Role enum | Vai trò thực tế | Tóm tắt quyền |
|-----------|----------------|---------------|
| `admin` | Quản trị viên (IT) | Toàn quyền: duyệt account_requests, CRUD `document_categories` (kèm SLA), quản lý phòng họp/xe, reset password, set `is_active`, xem mọi hồ sơ/task/lịch. |
| `director` | Giám đốc / Phó Giám đốc | Xem toàn chi nhánh, tạo/giao công việc, duyệt đơn nghỉ phép của cấp Trưởng phòng / lãnh đạo cùng cấp. Không là người nhận công việc trong module Công việc. Lịch trình của BGĐ public toàn chi nhánh. |
| `manager` | Trưởng phòng / Phó phòng | Trưởng phòng (`is_department_head = true`) quan sát và xử lý toàn bộ công việc của phòng. Manager khác chỉ thấy công việc mình tạo hoặc được giao. Nếu thuộc phòng **Tổ chức Tổng hợp** (code `13602`) → có quyền điều phối phòng họp/xe như `secretary`. |
| `staff` | Nhân viên (RM, GDV, KSV, Kho quỹ, Pháp chế, IT, Tổ chức Tổng hợp…) | Tạo & luân chuyển hồ sơ vật lý, xem task được giao hoặc do mình tạo, đăng ký lịch họp/đặt xe, tạo đơn nghỉ phép. Phân biệt nhau qua `department_id`. |
| `secretary` | Thư ký Ban Giám đốc | Điều phối phòng họp + xe ô tô (CRUD `rooms`, `vehicles`, gán xe/lái xe cho lịch có yêu cầu xe). Không xem lịch không xe nếu không phải creator/participant/cùng phòng/trừ lịch có BGĐ. |
| `hr_officer` | Cán bộ Nhân sự | Workspace riêng (`HRDashboardView`), **read-only** đơn nghỉ phép toàn chi nhánh, xem danh bạ, xem mọi profile (tổng hợp data nhân sự). |
| `driver` | Lái xe | Workspace riêng (`DriverDashboard`) chỉ xem chuyến đi được giao. **Bị chặn** khỏi module Hồ sơ vật lý, Công việc, Cán bộ. Có `start_km`/`end_km` workflow cho mỗi chuyến. |

### 2.2 Bảng 2 flag bổ sung trên `profiles`

| Flag | Kiểu | Tác dụng |
|------|------|----------|
| `is_active` | boolean | Middleware đọc cờ này. Nếu `false` → `signOut` ngay + redirect `/login?pending=1` (chờ admin duyệt). |
| `is_department_head` | boolean | Phân biệt "Trưởng phòng chính thức" với "Phó phòng" trong luồng duyệt nghỉ phép. |
| `must_change_password` | boolean | Khi admin reset password → set `true`. Dùng tại `/dashboard/settings` để yêu cầu user đổi mật khẩu qua `ChangePasswordDialog`. |

### 2.3 Ma trận "ai làm được gì" (rút từ permissions + RLS + navigation `hideFor`)

| Hành động | admin | director | manager | staff | secretary | hr_officer | driver |
|-----------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Xem sidebar **Dashboard** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Xem sidebar **Công việc** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Xem sidebar **Lịch trình** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (workspace lái xe) |
| Xem sidebar **Hồ sơ** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Xem sidebar **Cán bộ** (+ mobile bottom nav) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Tạo hồ sơ vật lý | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Tab "Toàn chi nhánh" (xem mọi hồ sơ) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| CRUD `document_categories` (nhóm hồ sơ + SLA) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| CRUD `rooms` + `vehicles` | ✅ | ❌ | ✅ (manager phòng điều phối) | ❌ | ✅ | ❌ | ❌ |
| Duyệt đơn nghỉ phép | ✅ | ✅ (cấp manager↑) | ✅ (cùng phòng, có điều kiện) | ❌ | ❌ | ❌ (chỉ read) | ❌ |
| Gán tài xế cho chuyến | ✅ | ❌ | ✅ (manager phòng điều phối) | ❌ | ✅ | ❌ | ❌ |
| Duyệt `account_requests` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Gửi `recognitions` (ghi nhận đồng nghiệp) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |

**Module Tasks — phân quyền theo phòng đầu mối (hub):**

| Hành động | admin | director | manager hub | manager non-hub | staff hub | staff non-hub |
|-----------|-------|----------|-------------|-----------------|-----------|---------------|
| Tạo công việc trong phòng mình | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Giao công việc cho phòng ban khác | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Tạo công việc định kỳ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Xem Analytics | ✅ | ✅ | ✅ | ✅ nếu `isCoordinatorDepartment` | ✅ nếu `isCoordinatorDepartment` | ❌ |
| Xem task phòng mình | ✅ | ✅ | ✅ | ✅ | Theo assignee/creator | Theo assignee/creator |
| Xem Analytics toàn chi nhánh | ✅ | ✅ | ✅ (Coordinator) | ❌ | ✅ (Coordinator) | ❌ |

> **Hub department codes:** `13618`, `13601`, `13602`, `13605`, `13609`, `13603` — xem `isHubDepartment(profile)`. Manager non-hub bị siết về phòng mình.

> Helper chính thức: [`src/lib/permissions.ts`](src/lib/permissions.ts). Mọi check role/department phải đi qua helper, **cấm inline `profile.role === 'admin'` trong component** (xem `ARCHITECTURE.md §6.4`).

### 2.4 Phòng ban (`departments`)

Seed mặc định trong `schema.sql`:

| Code | Tên | Đặc biệt |
|------|-----|----------|
| — | Tín dụng | RM tạo hồ sơ tín dụng (loại hồ sơ phổ biến nhất) |
| — | Giao dịch viên | |
| — | Kho quỹ | Là chặng cuối trong nhiều luồng hồ sơ |
| — | Pháp chế | |
| — | Công nghệ thông tin | Admin thường thuộc phòng này |
| `13602` | **Tổ chức Tổng hợp** | ⭐ Phòng đặc biệt (bộ phận điều phối tài nguyên chi nhánh). Manager của phòng này có quyền điều phối phòng họp/xe ngang `secretary` (helper `isCoordinatorDepartment`). |

---

## 3. Core Modules (Các phân hệ chính)

Sidebar (`src/components/layout/dashboard-layout.tsx`) hiện có **5 entry chính**: Dashboard, Công việc, Lịch trình, Hồ sơ, Cán bộ — kèm flag `hideFor` ẩn theo role. Ngoài ra có 3 module phụ truy cập qua menu dropdown / direct URL: Profile, Admin, Settings.

> **Mobile note**: PWA trên mobile **không hiển thị sidebar** — chỉ dùng `MobileBottomNav`. Mảng `navItems` trong `dashboard-layout.tsx` được share cho cả desktop sidebar và mobile bottom nav, nên khi thêm/sửa entry và muốn hiện trên mobile, **bắt buộc** rà lại `hideFor` của entry đó. Ví dụ Cán bộ ban đầu `hideFor: ['driver', 'secretary', 'staff']` khiến cán bộ giao dịch không vào được trên điện thoại — đã sửa thành `hideFor: ['driver']` ở Phase 2.

---

### 3.1 Module Hồ sơ — Luân chuyển & Truy vết Hồ sơ Vật lý

> **Mẫu chuẩn kỹ thuật về RLS + RPC + Realtime + JSONB clean architecture** — khi xây module mới có workflow nhiều bước, copy pattern từ đây.
> URL: `/dashboard/handover` · Migration: gộp trong `schema.sql` · Code: [`src/app/dashboard/handover/`](src/app/dashboard/handover/)

#### 3.1.1 Mô hình "Sổ giao nhận điện tử"

Mỗi bộ hồ sơ giấy được "khai sinh" trên app, **sinh mã ngắn `HS-YYYYMMDD-NNN` viết tay lên bìa**, sau đó chạy theo đời thật qua các bàn. Mỗi lần đổi chủ (chuyển/nhận) được log thành 1 row trong `document_handovers` để vẽ timeline truy vết realtime cho Ban Giám đốc.

#### 3.1.2 Luồng nghiệp vụ end-to-end (6 bước)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  BƯỚC 1 — RM (staff) khởi tạo hồ sơ trên app                           │
│  • Tab "Đang giữ" → nút "Tạo hồ sơ" (CreateDocumentDialog)             │
│  • Nhập: Tiêu đề, Khách hàng, chọn Nhóm hồ sơ (kèm SLA giờ)            │
│  • Đính ảnh tối đa 10 ảnh, đã nén client (≤1MB, ≤1920px)               │
│  • Submit → INSERT vào documents (creator_id = mình)                   │
│  • Trigger `generate_document_short_code()` sinh `HS-YYYYMMDD-NNN`     │
│  • Trạng thái khởi đầu: DRAFT, current_assignee_id = NULL              │
└────────────────────────────┬────────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  BƯỚC 2 — RM ghi tay mã `HS-...` lên bìa hồ sơ giấy                    │
│  • Đây là bước OFFLINE — ý nghĩa: 1 mã trên app ↔ 1 bìa thực           │
│  • Mã ngắn (12 ký tự), có ngày, dễ đọc lại trên kệ                     │
│  • Khi tìm thấy hồ sơ vô chủ → tra mã trong app ra ngay người tạo      │
└────────────────────────────┬────────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  BƯỚC 3 — RM bấm "Chuyển" trên app                                     │
│  • TransferDialog → chọn người nhận (ví dụ Kiểm soát viên)             │
│  • Ghi note (tuỳ chọn — "Hồ sơ vay tiêu dùng KH XYZ, vui lòng KS")     │
│  • Gọi RPC `transfer_document(p_document_id, p_receiver_id, p_note)`   │
│  • RPC SECURITY DEFINER:                                               │
│      - INSERT document_handovers (status = PENDING)                    │
│      - UPDATE documents.status = PENDING_RECEIPT                       │
│      - INSERT notifications cho người nhận                             │
│      - (KHÔNG đổi current_assignee_id ngay — pattern transit state)    │
│  • Webhook DB → edge function push-notification → gửi PWA push        │
│  • Sender mất ngay nút "Chuyển tiếp" (chống 2 người cùng giữ hồ sơ)   │
└────────────────────────────┬────────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  BƯỚC 4 — Người nhận (KSV/TP/PGĐ) cầm bìa hồ sơ, mở app                │
│  • Tab "Đang giữ" → thấy hồ sơ ở Inbox (incoming PENDING)              │
│  • Mở DocumentDetailDialog → đọc note, xem ảnh đính kèm                │
│  • 2 lựa chọn:                                                         │
│    ├─ "Đã nhận" → RPC `acknowledge_document(p_handover_id)`            │
│    │   • UPDATE handover.status = ACCEPTED, received_at = NOW()        │
│    │   • UPDATE documents.current_assignee_id = receiver               │
│    │   • UPDATE documents.status = IN_REVIEW                           │
│    │   • Notification cho sender ("Đã nhận")                           │
│    │   → Hồ sơ chính thức "trên bàn" người nhận, SLA bắt đầu chạy      │
│    │                                                                    │
│    └─ "Trả về" + lý do → RPC `reject_document(p_handover_id, p_reason)`│
│        • UPDATE handover.status = REJECTED, note = reason              │
│        • UPDATE documents.current_assignee_id = sender (revert)        │
│        • UPDATE documents.status = RETURNED                            │
│        • Notification cho sender ("Bị trả về với lý do: …")            │
│        → Sender phải bổ sung & chuyển lại                              │
└────────────────────────────┬────────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  BƯỚC 5 — Người đang giữ tiếp tục "Chuyển" cho người tiếp theo         │
│  • Lặp lại Bước 3-4 qua các bàn (KSV → TP → PGĐ → GĐ → Quỹ)            │
│  • Mỗi chặng tạo thêm 1 row document_handovers                         │
│  • Tab "Đã chuyển" của sender hiển thị outgoing PENDING                 │
│  • Component HandoverTimeline.tsx render dọc đầy đủ chặng              │
└────────────────────────────┬────────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  BƯỚC 6 — Người cuối cùng đóng luồng                                   │
│  • Khi hồ sơ đã hoàn tất nghiệp vụ (hạch toán xong / cất kho quỹ)      │
│  • DocumentDetailDialog → nút "Hoàn thành"                             │
│  • RPC `complete_document(p_document_id)`                              │
│    • Check: chỉ current_assignee mới được đóng                         │
│    • UPDATE status = COMPLETED, completed_at = NOW()                   │
│    • Notification cho creator                                          │
│  • Hồ sơ vẫn còn metadata + timeline cho truy vết                      │
│  • Ảnh đính kèm tự xoá sau 30 ngày qua edge function cleanup           │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 3.1.3 Trạng thái hồ sơ (`documents.status`)

| Status | Ý nghĩa | Hành động cho phép |
|--------|---------|--------------------|
| `DRAFT` | Vừa tạo, chưa chuyển lần nào | Creator: Chuyển / Sửa ảnh / Xoá |
| `PENDING_RECEIPT` | ⭐ **Transit state** — đã chuyển, chờ người nhận xác nhận | Sender: **MẤT** quyền chuyển tiếp (chờ). Receiver: Nhận hoặc Trả về |
| `IN_REVIEW` | Người nhận đã xác nhận, đang xử lý trên bàn họ | Current assignee: Chuyển tiếp / Hoàn thành / Sửa ảnh |
| `RETURNED` | Bị từ chối, trả về sender | Sender: Sửa ảnh, chuyển lại |
| `COMPLETED` | Đã đóng luồng | Read-only. Ảnh sẽ bị cleanup sau 30 ngày |

> Pattern `PENDING_RECEIPT` là **transit state** — quan trọng để tránh 2 người cùng giữ 1 hồ sơ. Xem chi tiết `ARCHITECTURE.md §6.8`.

#### 3.1.4 SLA — "thời gian giữ hồ sơ trên bàn"

Mỗi nhóm hồ sơ (`document_categories`) có cấu hình `sla_hours`:

| Nhóm hồ sơ (seed) | SLA mặc định |
|-------------------|--------------|
| Hồ sơ tín dụng | 24h |
| Hồ sơ kế toán | 8h |
| Hồ sơ tổng hợp | 48h |
| Hồ sơ nhân sự | 24h |

Logic SLA ([`_lib/sla.ts`](src/app/dashboard/handover/_lib/sla.ts)):
- **Reset mỗi lần đổi bàn**: khi người mới `acknowledge_document`, đồng hồ SLA của họ chạy lại từ 0.
- 3 mức màu badge: `safe` (<70%), `warn` (70–100% — amber), `danger` (≥100% — đỏ pulse).
- Áp dụng cho status `IN_REVIEW` và `PENDING_RECEIPT`. `COMPLETED` / `RETURNED` / `DRAFT` không tính.

#### 3.1.5 UI chính (xem `_components/`)

| Component | Vai trò |
|-----------|---------|
| `page.tsx` | 3 tab: **Đang giữ** / **Đã chuyển** / **Toàn chi nhánh** (chỉ admin+director) |
| `MyDeskInbox.tsx` | List hồ sơ tôi đang giữ + incoming PENDING (chờ tôi nhận) |
| `MyDeskOutbox.tsx` | List hồ sơ tôi đã chuyển (outgoing PENDING / ACCEPTED) |
| `AllDocumentsTab.tsx` | View truy vết toàn chi nhánh (chỉ BGĐ + admin) |
| `DocumentCard.tsx` | Card hồ sơ với badge status + SLA + người đang giữ |
| `CreateDocumentDialog.tsx` | Form tạo mới (title, customer, category, ảnh) |
| `DocumentDetailDialog.tsx` | Modal chi tiết — timeline + nút Chuyển/Nhận/Trả về/Hoàn thành |
| `HandoverTimeline.tsx` | Render dọc các chặng handover với dấu thời gian |
| `TransferDialog.tsx` | Chọn receiver + note để chuyển |
| `ReturnReasonDialog.tsx` | Nhập lý do trả về |
| `CategoryManagerDialog.tsx` | **Chỉ admin** — CRUD nhóm hồ sơ + SLA + màu badge |
| `ImageUploader.tsx` | Upload nén client tối đa 10 ảnh, drag-drop |
| `ImageLightbox.tsx` | Xem ảnh fullscreen có zoom |
| `SLABadge.tsx` | Badge SLA: safe/warn/danger với thời gian còn lại |

#### 3.1.6 Notification trigger

Mỗi RPC handover tự INSERT vào bảng `notifications`. Webhook DB → edge function `push-notification` → push PWA tới mọi device đã subscribe của user:

| Sự kiện | Người nhận thông báo | Title |
|---------|---------------------|-------|
| Chuyển hồ sơ | Receiver | "Có hồ sơ mới chờ nhận" |
| Receiver bấm "Đã nhận" | Sender | "Hồ sơ đã được nhận" |
| Receiver bấm "Trả về" | Sender | "Hồ sơ bị trả về" |
| Người cuối "Hoàn thành" | Creator (nếu khác current assignee) | "Hồ sơ đã hoàn thành" |

---

### 3.2 Module Dashboard chính (Home)

> URL: `/dashboard` · Code: [`src/app/dashboard/page.tsx`](src/app/dashboard/page.tsx) + [`_components/`](src/app/dashboard/_components/)

Trang đích sau login. **Hiển thị view khác nhau theo role**:

| Role | View |
|------|------|
| `driver` | `DriverDashboardView` — list chuyến đi sắp tới + lịch sử Km |
| `hr_officer` | `HRDashboardView` — tổng quan nhân sự, danh sách đơn nghỉ phép pending |
| `manager` phòng điều phối | `CoordinatorDashboardView` — bảng điều phối tài nguyên |
| Còn lại | `QuickStats` + `TaskOverview` + Timeline lịch hôm nay |

**Block hiển thị mặc định** (cho staff/manager/admin/director thông thường):

- **QuickStats** — 3 thẻ KPI cá nhân:
  - "Năng suất tuần" (productivity, có TrendingUp/Down so với tuần trước).
  - "Đang xử lý" — số task active + số task khẩn.
  - "Nhiệm vụ" — `completed/assigned` + số quá hạn.
- **Câu trích dẫn động lực** — random từ array 7 câu (`INSPIRATIONAL_QUOTES`).
- **Timeline lịch hôm nay** — block giờ 8h–17h với marker hiện tại.
- **Hồ sơ chờ xử lý** — preview các hồ sơ đang trên bàn / đang chờ nhận.
- **Task gần đây** — recent tasks + comment activity.

**Realtime**: subscribe channel `dashboard_sync` lắng nghe insert/update trên 9 bảng (tasks, recognitions, task_comments, schedules, schedule_participants, vehicles, rooms, documents, document_handovers). Debounce 600ms.

---

### 3.3 Module Công việc (Tasks)

> URL: `/dashboard/tasks` · Detail popup: `?id=<taskId>` · Create popup: `?create=1`
> Analytics: `/dashboard/tasks/analytics` · Recurring: `/dashboard/tasks/recurring`
> Code: [`src/app/dashboard/tasks/`](src/app/dashboard/tasks/)

#### 3.3.1 Luồng nghiệp vụ công việc

**Status enum** (`task_status`): `todo`, `doing`, `submitted`, `done`, `canceled`.

#### 3.3.2 Tính năng cốt lõi

- **Multi-assignee qua bảng N-N `task_assignees`** (junction `task_id × user_id`). RLS check qua `user_can_see_task(p_task_id)` SECURITY DEFINER.
- **Auto-fill người nhận mặc định khi giao qua phòng** — `task_assignees` luôn có người thực hiện. Khi `dept_id` non-null và `assignee_ids` rỗng, RPC `task_create`/`recurring_fire_due` resolve qua `_resolve_default_assignee(p_dept_id)`: ưu tiên Trưởng phòng `is_department_head=true`, fallback manager active đầu tiên, sau đó user active trong phòng.
- **`batch_id`** — gộp nhiều phòng/người trong 1 lần tạo. Counter dashboard đếm theo batch.
- **Comment** — bảng `task_comments`, RLS đi qua `user_can_see_task`.
- **Xin gia hạn** — bảng `task_extension_requests`. Người thực hiện submit `new_due_date` + reason; người có thẩm quyền duyệt cập `tasks.due_date`.
- **Phân công** — Trưởng phòng nhận công việc cấp phòng và phân công cán bộ trong phòng.
- **Sửa nội dung** — creator + Trưởng phòng của creator + admin/director sửa title/description/priority/due_date qua RPC `task_update`.
- **Xóa hẳn** — creator + Trưởng phòng của creator + admin/director có thể xoá công việc khỏi hệ thống.
- **Ghi nhận hoàn thành** — creator, Trưởng phòng và admin/director có thể chủ động ghi nhận hoàn thành (kể cả khi người nhận chưa bấm nhận/bắt đầu công việc, khi đó công việc sẽ có flag `is_force_completed_todo = true` trong metadata và được tính vào thống kê quá hạn của người được giao).
- **Recurring** — bảng `task_recurring_templates`. Admin/Director/Manager + staff hub đặt lịch. Template chỉ người tạo xem/sửa/xoá/bật tắt. Worker `recurring_fire_due()` sinh công việc cho phòng ban hoặc cán bộ được chọn khi `next_run_at <= now()`.
- **Analytics** — RPC `tasks_analytics(p_from, p_to, p_dept_id)` trả counts + daily + by_department + top_people + recurring_active. Trang `/analytics` có export CSV.
- **Hủy** — bảng status `canceled`.
- **Auto-archive**: cron daily 08:00 ICT gọi `auto_archive_and_cleanup()`.

#### 3.3.3 Phân quyền tạo công việc

Phòng đầu mối ("hub") gồm 6 mã: `13618` (Phòng chuyên trách Hub), `13601` (BGĐ), `13602` (Tổ chức Tổng hợp), `13605`, `13609`, `13603`. Helper `isHubDepartment(profile)` + `_is_hub_department(dept_id)` đồng bộ. BGĐ có quyền tạo/giao việc theo vai trò, nhưng không xuất hiện trong danh sách phòng nhận việc.

| Vai trò | Tạo/giao công việc |
|---------|--------------------|
| `admin` | Mọi cán bộ / mọi phòng |
| `director` | Mọi cán bộ / mọi phòng; không là người nhận |
| `manager` | Cán bộ phòng mình; manager hub được giao qua phòng khác; manager non-hub giới hạn phòng mình |
| `staff` | Staff hub được tạo/giao; staff non-hub không tạo |
| `secretary`/`hr_officer`/`driver` | Không tạo trong module Công việc |

#### 3.3.4 Defense-in-depth

Phân quyền Tasks được check lặp ở các layer độc lập:

1. **UI helpers** ([`src/lib/permissions.ts`](src/lib/permissions.ts)) — ẩn nút/toggle/tab dựa trên `canCreateTaskAssignment`, `canTargetCrossDepartment`, `canViewTaskScopeTabs`.
2. **Fetch profiles filter** ([`fetchAssignableProfiles`](src/app/dashboard/tasks/_lib/fetchTasks.ts)) — lọc người nhận theo scope; không list admin/director/driver/secretary/hr_officer.
3. **RPC `task_create`** — kiểm tra quyền tạo, scope người nhận, role người nhận và auto-fill khi giao qua phòng.
4. **RPC `recurring_template_upsert`** — chỉ creator sửa template; reject người nhận ngoài scope hoặc thuộc role không nhận công việc.
5. **Worker `recurring_fire_due`** — sinh công việc theo template đã duyệt; khi giao qua phòng, hệ thống gắn Trưởng phòng của phòng nhận qua `_resolve_default_assignee`.

#### 3.3.5 Phân quyền tầm nhìn task

- `admin`/`director`: thấy toàn chi nhánh.
- Trưởng phòng (`manager` + `is_department_head=true`): thấy công việc thuộc phòng mình.
- Manager khác: chỉ thấy công việc mình tạo hoặc được giao.
- `staff`: thấy công việc mình tạo hoặc được giao.
- `secretary`, `hr_officer`, `driver`: không vào module Công việc.

#### 3.3.6 Action UI

Detail panel hiển thị các action theo quyền:
- Primary CTA: Bắt đầu / Hoàn thành / Gửi kết quả / Duyệt kết quả.
- Secondary: Trả về / Phân công / Xin gia hạn.
- Destructive: Huỷ / Xoá theo quyền.

Mọi assignee picker dùng `<PeoplePicker>` shared (`src/components/ui/people-picker.tsx`) với grouping qua `groupProfilesByDepartment` từ `@/lib/profile-grouping`. Khi `canTargetCrossDepartment` → hiện lựa chọn "Phòng khác" / "Trong phòng".

---

### 3.4 Module Lịch trình (Schedule)

> URL: `/dashboard/schedule` · Code: [`src/app/dashboard/schedule/`](src/app/dashboard/schedule/) — **module chuẩn mẫu** theo `ARCHITECTURE.md §2.4`.

#### 3.4.1 "4-in-1" — Bảng `schedules` lưu cả

| `type` | Mục đích | Resource liên quan |
|--------|----------|--------------------|
| `meeting` | Họp nội bộ | `room_id` (phòng họp) |
| `trip` | Công tác / đi địa bàn | Người tạo bật `use_vehicle`; bộ phận điều phối gán `vehicle_id`, `driver_id` tự lấy từ xe đã gán lái xe trong `vehicles` |
| `leave` | Đơn nghỉ phép | Có luồng duyệt riêng (`LeaveApprovalDashboard`) |
| `event` | Sự kiện chung chi nhánh | — |

#### 3.4.2 Views chính

`page.tsx` hiển thị **adaptive theo role**:

- **Driver** → `DriverDashboard` (workspace lái xe — xem 3.4.4).
- **Còn lại** → `CalendarView` với:
  - **`DateNavigator`** — chọn ngày, hiển thị 7 ngày, chấm màu theo trạng thái (xanh=approved, vàng=pending, đỏ=rejected).
  - **3 phạm vi filter**: "Toàn chi nhánh" / "BGĐ" / "Phòng của tôi"...
  - **Sub-dashboard nhúng**:
    - `ResourcesManagerDashboard` (chỉ bộ phận điều phối/secretary/admin) — bảng điều phối phòng họp + xe, nhưng dữ liệu lịch vẫn bị RLS siết theo quy tắc lịch có xe/BGĐ/phòng.
    - `LeaveApprovalDashboard` (chỉ user có quyền `canApproveLeave`) — list đơn pending + duyệt 1 click.
    - **`DirectorTimeline`** — timeline 07:00-19:00 dành cho BGĐ, refresh 30s. Bar BGĐ kéo dài theo thời gian thực tế: nếu đã quá `start_time` và chưa kết thúc → dùng `now`; nếu completed → dùng `metadata.trip_ended_at`. Không cần legend riêng — tên BGĐ hiển thị trực tiếp trên bar (màu trắng, nền tương phản).

#### 3.4.3 Luồng duyệt nghỉ phép

```
Nhân viên (staff/manager) tạo schedule type='leave'  →  status='pending'
   │
   ▼
Helper canApproveLeave(profile, leave) quyết định ai nhìn thấy đơn này:
   │
   ├─ admin → luôn duyệt được
   ├─ director → duyệt được nếu creator là manager / department_head
   ├─ manager → duyệt được nếu cùng phòng + creator KHÔNG phải lãnh đạo cùng cấp
   │            AND (is_department_head=true HOẶC creator không phải manager/head)
   └─ hr_officer → KHÔNG duyệt, chỉ read-only
   │
   ▼
Người duyệt mở LeaveApprovalDashboard → bấm Approve/Reject
   →  UPDATE schedules.status = 'approved' | 'rejected'
   →  Notification cho creator
```

**Quyền riêng tư**: nội dung đơn nghỉ phép (description, title chi tiết) được bảo vệ bởi RPC helper `can_view_leave_detail()` (gộp trong `schema.sql`). Cán bộ khác phòng chỉ thấy "phòng X có người Y nghỉ" chứ không thấy lý do.

#### 3.4.4 Lifecycle hoàn thành lịch

- **Auto-complete** (không xe + không BGĐ): sau khi `approved` và quá `end_time` **15 phút**, RPC `complete_finished_schedules()` tự chuyển `completed`. Áp dụng cho:
  - `meeting`, `event`, `leave`: không dùng xe (`use_vehicle=false`, `vehicle_id IS NULL`, `driver_id IS NULL`)
  - `trip`: không dùng xe (cùng điều kiện)
  - **KHÔNG auto-complete** nếu có BGĐ tham gia (phải có người bấm kết thúc)
- Lịch có xe / có BGĐ: lái xe hoặc người tham gia bấm kết thúc thủ công. Khi kết thúc, hệ thống ghi `metadata.trip_ended_at` để timeline BGĐ hiển thị thời gian thực tế.
- Cron `/api/cron/notifications` gọi RPC hằng ngày; trang lịch trình cũng gọi fallback khi fetch dữ liệu.

#### 3.4.5 Workspace Lái xe (DriverDashboard)

URL vẫn là `/dashboard/schedule` nhưng auto-detect role `driver` → render `DriverDashboard`:

| Hành động | Implementation |
|-----------|----------------|
| **Xem chuyến được giao** | Filter `schedules WHERE driver_id = auth.uid()` (RLS cho phép) |
| **Bắt đầu chuyến** | `StartTripDialog` → nhập `start_km` → UPDATE `schedules.metadata = {start_km: …}` + status `in_progress` |
| **Xác nhận lịch** | `MyTripCard` → nút "Xác nhận lịch" → ghi `metadata.driver_confirmed_at` + notification cho người gán + coordinator. Sau xác nhận mới hiện nút "Bắt đầu chuyến". |
| **Kết thúc chuyến** | `EndTripDialog` → nhập `end_km` (validate > start_km) → UPDATE metadata `{start_km, end_km, actual_distance}` + status `completed` |
| Stat cá nhân | `DriverStatsGrid` — tổng số chuyến, tổng Km tháng |
| Card từng chuyến | `MyTripCard` — hiển thị Km xuất phát/về, biển số, người yêu cầu |

#### 3.4.5 Gán xe + tài xế (Resource Coordination)

Quy tắc xe:
1. Người tạo lịch công tác chỉ bật "Sử dụng xe cơ quan" để đưa lịch vào hàng chờ điều phối; không tự chọn xe/lái xe.
2. Secretary / admin / manager phòng điều phối mở `ScheduleDetailDialog`, chọn xe → tự gán lái xe mặc định của xe (và ngược lại: chọn lái xe → tự tìm xe của lái đó).
3. Ngay sau khi điều phối gán xe + lái xe, schedule được cập nhật `status='approved'` và notification được gửi cho driver. Không có bước phê duyệt riêng sau điều phối.
4. Lịch không có xe và không có BGĐ tham gia được tự động `approved`, không cần điều phối/phê duyệt.
5. **Cảnh báo overlap xe**: khi chọn xe đang có lịch `approved` / `in_progress` trùng giờ, dialog hiển thị banner cam + nút gán chuyển màu cam — vẫn cho phép gán (không chặn).

#### 3.4.6 Conflict detection

RPC `check_schedule_participant_conflicts(participants, start, end, ignore_id)` — gọi trước khi tạo/sửa lịch:
- Kiểm tra 1 người không tham gia 2 cuộc cùng giờ.
- Trả về list các schedule conflict + người liên quan.
- UI `CreateScheduleDialog` hiển thị warning đỏ nếu có conflict.

---

### 3.5 Module Cán bộ (Team)

> URL: `/dashboard/team` (Detail = Dialog `?id=<uuid>`, KHÔNG còn route `[id]`) · Code: [`src/app/dashboard/team/`](src/app/dashboard/team/)

**Mục tiêu**: thay danh bạ rời rạc (Zalo / Outlook / sổ tay) bằng 1 nguồn dữ liệu duy nhất — mọi cán bộ (trừ lái xe) tra cứu được số máy, phòng ban, vị trí ngồi, OOO, lịch nghỉ.

**Tính năng**

- **Danh bạ toàn chi nhánh**: avatar, số máy, số nội bộ (`extension`), vị trí ngồi (`seat_location`), title, phòng ban, ngày vào ngành. Search-as-you-type theo tên / phone / extension / title / ad_account (no-accent).
- **Filter chip trạng thái** (Đang nghỉ / Đi công tác / Mới vào): compute realtime từ `schedules` (type=`leave`/`trip` đang active bao gồm cả người tạo lịch và `participants`) + `profiles.branch_join_date` (≤30 ngày).
  - *Lưu ý phân quyền badge Đi công tác (Mô hình thác nước)*: Admin, Ban Giám Đốc (director) nhìn thấy trạng thái Đi công tác của toàn bộ cán bộ. Trưởng phòng (manager) và Nhân viên (staff) chỉ nhìn thấy trạng thái Đi công tác của các cán bộ cùng phòng ban với mình. Trạng thái Đang nghỉ phép vẫn hiển thị công khai.
- **Stats hero**: tổng cán bộ, đang vắng mặt, mới gia nhập.
- **2 view qua Tabs**:
  - **Danh bạ** — group theo phòng ban (Accordion, BGĐ + phòng mình mặc định mở).
  - **Sơ đồ tổ chức** — `OrgChartView` cây tổ chức theo phòng, trưởng phòng nổi bật (Crown icon).
- **Detail = Dialog** (`ProfileDetailDialog`) — deep link `?id=<uuid>`:
  - Field công khai: full_name, avatar, phone, extension, seat_location, department, title, branch_join_date, is_department_head.
  - **Field nhạy cảm** (`ProfileSensitiveSection`): birthday, ad_account, employee_code, gender — chỉ self + admin + hr_officer + director thấy.
  - **Stats tháng** (`ProfileStatsSection`): số task tháng này — đếm theo `assignee_id` + `created_at >= startOfMonth` (sửa bug cũ đếm tất cả task).
  - **Recognitions** (`RecognitionsSection`): timeline ghi nhận đồng nghiệp + form gửi inline (great_work 👏 / team_player 🤝 / innovation 💡 / mentor 🎓). Mọi role active trừ driver được gửi. Push notification cho người nhận.
  - **OOO banner**: nếu target có `out_of_office` active → banner amber với message + hạn.
  - **Sticky footer**: Gọi (`tel:`), Mail (`mailto:`), Ghi nhận — touch ≥ 44px.
  - **Sửa hồ sơ** (`EditProfileDialog`): self sửa phone/extension/seat_location/avatar; admin+hr_officer sửa full (kể cả role, nhưng chỉ admin được đổi role).
- **OOO toggle** (`OutOfOfficeToggle`): self bật Out of Office với message + thời hạn → upsert bảng `out_of_office`. Cron `cleanup_expired_ooo` chạy daily dọn record hết hạn.

**Permission matrix mới**

| Action | Helper | admin | director | manager | staff | secretary | hr_officer | driver |
|---|---|---|---|---|---|---|---|---|
| Xem danh bạ | `canViewPeopleDirectory` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Xem field nhạy cảm | `canViewSensitiveProfileFields` | ✅ | ✅ | self | self | self | ✅ | — |
| Sửa hồ sơ người khác | `canEditProfile` | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Gửi recognition | `canRecognize` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
|> Helper cũ `canAccessPeopleDirectory`

**Mobile entry point**: sau Phase 2, Team module đã được bổ sung vào **MobileBottomNav** (đi qua `navItems` ở [`dashboard-layout.tsx`](src/components/layout/dashboard-layout.tsx) — `hideFor: ['driver']`). Trước đó staff/secretary không có cách vào trang Team trên mobile vì mobile chỉ dùng bottom nav, không có sidebar. Khi thêm module mới có entry trong sidebar nhưng muốn hiện trên mobile, **bắt buộc** rà lại mảng `navItems` này.

**Module structure** (chuẩn `_components/_hooks/_lib`):

```
src/app/dashboard/team/
├── page.tsx                            # Wrapper Suspense → <TeamPage/>
├── [id]/page.tsx                       # Redirect stub → /dashboard/team?id=<uuid>
├── _lib/{constants,utils}.ts
├── _hooks/{useTeamDirectory,useProfileDetail,useRecognitions}.ts
└── _components/{TeamPage,ProfileDetailDialog,ProfileSensitiveSection,
                 ProfileStatsSection,RecognitionsSection,EditProfileDialog,
                 OutOfOfficeToggle,OrgChartView}.tsx
```

> Search bar + danh sách thẻ thành viên được render inline trong `TeamPage.tsx` (chưa tách subcomponent riêng vì cùng nằm trong file dưới 500 dòng — đúng quy tắc `ARCHITECTURE.md §2.3`).

Realtime channel: `team_realtime_sync` — subscribe `profiles`, `schedules`, `out_of_office`, `recognitions`.

---

### 3.6 Module Cá nhân (Profile)

> URL: `/dashboard/profile` · Code: [`src/app/dashboard/profile/`](src/app/dashboard/profile/)

Trang hồ sơ cá nhân — đồng bộ pattern với `ProfileDetailDialog` của module Team (xem §3.5), self-mode:

- **Hero card**: avatar (upload bucket `avatars` qua `AvatarCropDialog` — pan + zoom 1:1), tên + chức danh + badge role + badge trạng thái (Đang nghỉ / Đi công tác / Mới gia nhập - trạng thái Đi công tác áp dụng mô hình thác nước giống trang Team).
- **Thông tin liên hệ** (hiển thị trong danh bạ Nhân sự): phòng ban, email, số di động, số nội bộ, vị trí chỗ ngồi, ngày vào chi nhánh.
- **Thông tin nhân sự** (chỉ self + bộ phận Nhân sự thấy): ngày sinh, giới tính, mã CBNV, AD account.
- **OOO banner** + **Hoạt động gần đây** (5 task comment mới nhất).
- **Sửa hồ sơ**: mở `EditProfileDialog` (shared với module Team) — self sửa được phone/extension/seat_location/avatar/birthday/gender.
- **Đăng xuất** ở `PageHeader.action`.

> Đổi mật khẩu **không nằm trên trang này** — đã chuyển sang `/dashboard/settings` (xem §3.8) khớp pattern "Detail = Dialog" của hệ thống. Subscribe push notification cũng nằm ở Settings.

---

### 3.7 Module Admin

> URL: `/dashboard/admin` · Code: [`src/app/dashboard/admin/`](src/app/dashboard/admin/)

**Chỉ role `admin` truy cập được.** Trang có **3 tab**:

| Tab | Nội dung |
|-----|----------|
| **Users** | List toàn bộ profiles, search, filter theo role/department. Hành động: đổi role, bật/tắt `is_active`, reset password (gọi RPC, set `must_change_password = true` để ép user đổi). |
| **Rooms** | CRUD phòng họp (name, capacity, location). |
| **Vehicles** | CRUD xe (name, plate_number, type 4/7/16 chỗ, gán `driver_id` chuyên trách). |

Ngoài 3 tab này, admin còn:
- Duyệt **`account_requests`** (form `/register` của người chưa có account).
- Vào `/dashboard/handover` → mở `CategoryManagerDialog` để CRUD nhóm hồ sơ + SLA.

---

### 3.8 Module Settings

> URL: `/dashboard/settings` + sub `/dashboard/settings/users` · Code: [`src/app/dashboard/settings/`](src/app/dashboard/settings/)

Trang cài đặt tài khoản cá nhân — chỉ 2 nhóm:

- **Thông báo** — Switch bật/tắt push notification PWA (đi qua hook `use-push-subscription.ts`, insert/delete `push_subscriptions`). Tự gợi ý "Thêm vào màn hình chính" + cấp quyền nếu chưa subscribe.
- **Bảo mật — Đổi mật khẩu**: row `min-h-11` với chevron, click mở `ChangePasswordDialog` (`_components/ChangePasswordDialog.tsx` — pattern `app-dialog-sheet`):
  - Nếu `must_change_password = true` → row có badge amber "Cần đổi" + dialog hiển thị banner "Đang dùng mật khẩu mặc định".
  - Validate: tối thiểu 6 ký tự, xác nhận khớp.
  - Submit → `supabase.auth.updateUser({ password })` + UPDATE `profiles.must_change_password = false` + `router.refresh()`.

Sub-page `/dashboard/settings/users` cho admin quản lý user (trùng chức năng với admin module — đang trong quá trình thống nhất, xem `ARCHITECTURE.md §9`).

---

## 4. Auth Flow

```
┌──────────────────────────────────────────────────────────────┐
│  1. Người mới truy cập app                                   │
│     • Mọi route `/dashboard/*` bị middleware redirect /login │
│     • Có thể đăng ký /register (form public)                 │
└──────────────────────────────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                            ▼
   ┌───────────────────┐         ┌───────────────────┐
   │  /register        │         │  /login           │
   │  Email + Pass +   │         │  Email + Pass     │
   │  Full name        │         │                   │
   └─────────┬─────────┘         └─────────┬─────────┘
             │                              │
             ▼                              │
   ┌───────────────────┐                    │
   │ supabase.auth     │                    │
   │   .signUp()       │                    │
   │ → trigger         │                    │
   │ `handle_new_user` │                    │
   │ tự tạo profile    │                    │
   │ (role=staff,      │                    │
   │  is_active=true   │                    │
   │  by default)      │                    │
   └─────────┬─────────┘                    │
             │                              │
             ▼                              ▼
   ┌──────────────────────────────────────────────────┐
   │  Middleware (src/middleware.ts) kiểm tra:        │
   │  ├─ Session hợp lệ? → nếu không → /login         │
   │  ├─ profile.is_active = false?                   │
   │  │   → signOut + redirect /login?pending=1       │
   │  │     (admin chưa duyệt)                         │
   │  └─ Đã login mà vào /login? → /dashboard          │
   └──────────────────────────────────────────────────┘
                            │
                            ▼
   ┌──────────────────────────────────────────────────┐
   │  /dashboard (RSC layout)                         │
   │  ├─ getProfile() qua server client               │
   │  ├─ Render DashboardLayout (sidebar + topnav)    │
   │  └─ Render page con (handover/tasks/schedule…)   │
   └──────────────────────────────────────────────────┘
```

> Note: Form `/register` đang gọi `supabase.auth.signUp` trực tiếp, KHÔNG sử dụng bảng `account_requests` (mặc dù bảng này tồn tại trong schema cho luồng tương lai — admin duyệt rồi mới tạo user). Hiện tại để app dùng được, admin phải mở Supabase chạy SQL set `is_active = true` cho user mới đăng ký, hoặc dùng workflow `account_requests` qua admin module nếu được bật.

---

## 5. Tính năng xuyên suốt

### 5.1 PWA + Push Notification

- **Manifest**: [`src/app/manifest.ts`](src/app/manifest.ts) — `display: 'standalone'`, theme color slate, icon 192/512, maskable.
- **Subscribe**: hook [`src/hooks/use-push-subscription.ts`](src/hooks/use-push-subscription.ts) — đăng ký subscription, lưu JSONB vào `push_subscriptions(user_id, subscription, device_info)`.
- **Server push**: edge function `push-notification` (Deno) — trigger qua DB webhook khi INSERT vào `notifications`. Đọc `push_subscriptions` của user → fire Web Push qua VAPID keys tới mọi device.
- **In-app**: `<NotificationsDropdown />` ở topnav — list 10 notification mới nhất, subscribe realtime channel `notifications_realtime_<user_id>`, toast notify khi có event mới.

### 5.2 Realtime sync

Mỗi page chính subscribe 1 channel Supabase Realtime, refetch toàn list khi có event (debounce 250–600ms). Naming convention từ `ARCHITECTURE.md §6.5`:

| Channel | Sub-tables | Vị trí |
|---------|-----------|--------|
| `dashboard_sync` | tasks, recognitions, task_comments, schedules, schedule_participants, vehicles, rooms, documents, document_handovers | `/dashboard` |
| `handover_realtime_sync` | documents, document_handovers, document_categories, document_comments | `/dashboard/handover` |
| `schedule_realtime_sync` | schedules, schedule_participants, rooms, vehicles | `/dashboard/schedule` |
| `notifications_realtime_<userId>` | notifications (filter user_id) | `<NotificationsDropdown>` |
| `task_<id>` | tasks, task_comments | `/dashboard/tasks/[id]` |

### 5.3 Mobile-first UX

- **Bottom navigation** (`MobileBottomNav`) — 5 tab dưới đáy trên mobile.
- **FAB tạo mới** (`MobileCreateFab`) — contextual theo route, chỉ hiện mobile:
  - `/dashboard/tasks` → push `/dashboard/tasks/new`
  - `/dashboard/schedule` → set `?create` query
  - `/dashboard/team` → set `?create`
  - `/dashboard/handover` → set `?create`
- **Touch target 44pt**, safe area iOS notch + home indicator (xem token `globals.css`).
- **PWA installable** — Add to Home Screen trên iOS/Android.

### 5.4 Search & Filter top-nav

`dashboard-layout.tsx` có `configMap` định nghĩa search bar contextual:

| Route | Placeholder | Có status filter |
|-------|-------------|------------------|
| `/dashboard/team` | "Tìm kiếm cán bộ, phòng ban..." | — |
| `/dashboard/tasks` | "Tìm kiếm công việc..." | ✅ |
| `/dashboard/handover` | "Tìm mã hồ sơ, tiêu đề, khách hàng..." | ✅ |
| `/dashboard/admin` | "Tìm kiếm tài khoản, dữ liệu..." | — |
| `/dashboard/settings/users` | "Tìm kiếm người dùng..." | — |

Query string `?q=...&status=...` đẩy vào URL → mỗi page tự đọc và filter local.

### 5.6 Storage & Image pipeline

- **Bucket `avatars`** (public) — `<userId>/<file>`, RLS chỉ user upload vào folder của mình.
- **Bucket `documents`** (public) — `<documentId>/<ts>-<n>.<ext>`, ai authenticated upload được.
- **Compress client-side** trước upload: `browser-image-compression` → maxSizeMB=1, maxWidthOrHeight=1920, useWebWorker=true. Giới hạn 10 ảnh/hồ sơ.

---

## 6. Cronjobs & Background jobs

| Job | Lịch | Nơi chạy | Tác dụng |
|-----|------|----------|----------|
| `/api/cron/notifications` | `0 1 * * *` daily 08:00 ICT (`vercel.json`, Vercel cron chạy UTC) | Vercel cron — dùng `SUPABASE_SERVICE_ROLE_KEY` | (1) Gọi `auto_archive_and_cleanup()`. (2) Quét task quá hạn → insert notification. (3) Quét task sắp đến hạn trong 24h → insert notification. (4) Gọi RPC `cleanup_expired_ooo()` dọn OOO hết hạn. Bảo vệ bằng `CRON_SECRET` nếu được set. |
| Edge `cleanup-document-images` | `0 19 * * *` UTC = 02:00 ICT | Supabase Edge Function | Quét `documents` `COMPLETED > 30 ngày, attached_image_urls ≠ '{}'` → xoá file storage + clear mảng URLs. Giới hạn 200 hồ sơ/lượt. |
| Edge `push-notification` | Trigger qua DB webhook (không phải cron) | Supabase Edge Function | Mỗi INSERT `notifications` → đọc `push_subscriptions` → fire Web Push VAPID tới mọi device. |

---

## 7. Roadmap quan sát được trong code

(Không phải tính năng đã có — là các "khoảng cách" thấy được giữa code hiện tại và `ARCHITECTURE.md`.)

| Hạng mục | Trạng thái | Hướng |
|----------|-----------|-------|
| Migrate form lớn sang `react-hook-form` + `zod` | Deps có sẵn, một số dialog vẫn dùng `useState` thủ công | Áp dụng cho form > 4 field theo lần đụng vào |
| Refactor `admin/page.tsx` (461 dòng) | Sát giới hạn 500 dòng | Lần đụng tiếp theo phải tách subcomponent |
| `_components/_hooks/_lib` cho `admin` | `tasks`, `team`, `schedule`, `handover` đã đủ 3 folder; `admin` còn lệch (`_components`/`_lib` rỗng) | Lần đụng vào tiếp theo tách subcomponent từ `admin/page.tsx` (461 dòng — sát giới hạn) |
| `database.types.ts` | Đang hand-craft | Gen từ Supabase CLI |
| Bảng `account_requests` | Có schema + RLS nhưng `/register` đang bypass | Hoặc bật luồng admin-duyệt qua bảng này, hoặc xoá bảng để gọn |
| Module KPI cũ | Đã drop | — |
| Tab Settings/Users vs Admin module | Trùng chức năng | Thống nhất 1 nơi |

---

## 8. Tham chiếu nhanh

| Tài liệu | Nội dung |
|----------|----------|
| [`README.md`](README.md) | Setup, env vars, deploy, troubleshooting |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Quy chuẩn code, naming, fetch pattern, RPC, workflow thêm module (đã gộp luôn UI/UX + business rules từ file `TECHNICAL_RULES.md` cũ) |
| [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) | Entities, RLS strategy, SLA logic, storage, cronjobs |
| [`schema.sql`](schema.sql) | Snapshot DB (truth source) |
| [`schema.sql`](schema.sql) | Snapshot DB duy nhất (RLS + RPC + Trigger) |

---

**Phiên bản:** 1.6 — 2026-06-23 (Module Công việc chuẩn hoá naming task, phân biệt Trưởng phòng với manager thường, private recurring templates, Vercel cron 08:00 ICT).
#### 3.4.7 Theo dõi thời gian thực
- `DirectorTimeline` và `ResourcesManagerDashboard` có `now` stateful refresh 30 giây để cập nhật trạng thái xe/người mà không cần reload trang.
- Khi lịch `in_progress` quá giờ dự kiến: card hiển thị giờ hiện tại (không phải "quá giờ"), timeline dừng ở `end_time` đăng ký, nhưng legend/trạng thái xe vẫn hiển thị "Công tác"/"Đang chạy" cho đến khi có người bấm kết thúc.
