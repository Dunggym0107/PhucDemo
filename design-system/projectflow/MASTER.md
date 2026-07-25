# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.
>
> 📋 **Quy tắc phát triển chung:** Xem [`RULES.md`](../../RULES.md) — giới hạn file size, cấu trúc thư mục, coding standards.

---

**Project:** projectFlow — WorkFlow Portal
**Updated:** 2026-05-18
**Category:** Banking/Traditional Finance

---

## Global Rules

### Color Palette

| Role | Hex | Tailwind | CSS Variable |
|------|-----|----------|--------------|
| Primary | `#0F172A` | `slate-900` | `--color-primary` |
| Secondary | `#1E3A8A` | `blue-900` | `--color-secondary` |
| CTA/Accent | `#CA8A04` | `amber-600` | `--color-cta` |
| Background | `#F8FAFC` | `slate-50` | `--color-background` |
| Text | `#020617` | `slate-950` | `--color-text` |
| Muted Text | `#64748B` | `slate-500` | — |
| Border | `#E2E8F0` | `slate-200` | — |

**Color Notes:** Trust navy + premium gold. Accent dùng `amber-600/700` (gold) cho CTA và highlight quan trọng. Tuyệt đối không dùng purple/pink/indigo gradient.

---

### Typography

- **Font:** System Font Stack theo Apple (`-apple-system`, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial). Không dùng Google Fonts.
- **Mood:** financial, trustworthy, professional, corporate, banking, serious.
- **Tracking:** Không dùng letter-spacing âm. Global CSS triệt tiêu `tracking-tight/tighter/wider/widest` để chữ rõ ở mọi breakpoint.
- **Capitalization:** Không dùng all-caps cho heading, label, tab, button, badge hoặc section title. Dùng sentence case; chỉ giữ chữ hoa cho mã, biển số, viết tắt chính thức như KPI.

**Apple HIG Typography Scale responsive bắt buộc:**
| Level | CSS token | Desktop web | iPad/tablet | Mobile | Usage |
|-------|-----------|-------------|-------------|--------|-------|
| Body | `text-base` | `16px` | `17px` | `17px` | Nội dung chính, mô tả, thông tin đọc |
| Callout / Control | `text-sm` | `15px` | `16px` | `16px` | Button, input, select, menu item |
| Subhead | `text-[13px]`/`text-[14px]` | `14px` | `15px` | `15px` | Metadata quan trọng |
| Footnote | `text-xs`/`text-[12px]` | `13px` | `13px` | `13px` | Label, badge, trạng thái |
| Caption | `text-[7px]`–`text-[11px]` | `12px` tối thiểu | `12px` tối thiểu | `12px` tối thiểu | Chỉ dùng cho phụ chú rất ngắn |

> Global CSS tại `src/app/globals.css` map các class text nhỏ qua token responsive. Khi viết UI mới, vẫn phải chọn class có ý nghĩa đúng; không dựa vào global CSS để hợp thức hóa text quá nhỏ.

---

### Spacing Variables

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| `--space-xs` | `4px` | `gap-1`, `p-1` | Icon gap nội tuyến |
| `--space-sm` | `8px` | `gap-2`, `p-2` | Gap trong badge/chip |
| `--space-md` | `16px` | `gap-4`, `p-4` | Padding nội dung card |
| `--space-lg` | `24px` | `gap-6`, `p-6` | **Padding chuẩn card** |
| `--space-xl` | `32px` | `gap-8`, `p-8` | Khoảng cách section |
| `--space-2xl` | `48px` | `gap-12` | Section margin lớn |

**Apple HIG Touch & Spacing Rules:**
| Rule | Value | Usage |
|------|-------|-------|
| Touch target desktop web | `40px` tối thiểu | Button, icon button, menu item, input, select, textarea |
| Touch target iPad/mobile | `44px` tối thiểu | Button, icon button, menu item, input, select, textarea |
| Page margin mobile | `16px` | Outer wrapper của mọi trang dashboard |
| Page margin iPad/tablet | `24px` | Outer wrapper từ `641px` đến `1024px` |
| Page margin desktop web | `32px` | Outer wrapper từ `1025px` trở lên |
| Card padding mobile | `20px` | `.premium-card:not(.p-0)` trên mobile |
| Card padding iPad/desktop | `24px` | `.premium-card:not(.p-0)` trên tablet/desktop |
| Control radius | `12px` | Button, input, select |
| Card radius | `18px` mobile, `22px` iPad, `24px` desktop | Premium cards |

> Không dùng `h-7`, `h-8`, `py-0.5`, `p-1` cho phần tử tương tác ở bất kỳ breakpoint nào. Nếu cần giao diện gọn, ưu tiên ẩn bớt secondary action hoặc đưa vào menu.

---

### Shadow Depths

| Level | Tailwind | Usage |
|-------|----------|-------|
| Subtle | `shadow-sm` | Card nền nhạt |
| Card | `shadow` | `.premium-card` chuẩn |
| Hover | `shadow-xl` | Card khi hover |
| Modal | `shadow-2xl` | Dialog, popover |

---

## Layout System

### Shell Structure

```
DashboardShell
└── <aside>   Sidebar (w-64, hidden trên mobile)
└── <main>    py-6 md:py-8 w-full overflow-x-hidden
    └── {children}  ← mỗi trang tự quản lý padding ngang
```

> ⚠️ **Quan trọng:** Shell `<main>` CHỈ cung cấp `padding-top/bottom`. 
> Mỗi trang tự khai báo padding ngang trên outer wrapper của mình.

### Page Outer Wrapper (CHUẨN BẮT BUỘC)

```jsx
// Tất cả trang đều dùng pattern này
<div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6 md:space-y-10 animate-fade-in-up pb-20">
```

| Class | Mục đích |
|-------|----------|
| `max-w-6xl mx-auto` | Giới hạn chiều rộng 1152px, căn giữa |
| `px-4 sm:px-6` | Lề ngang: 16px mobile, 24px tablet+ |
| `space-y-6 md:space-y-10` | Khoảng cách dọc giữa các section |
| `pb-20` | Padding dưới cùng tránh nội dung bị cắt |

### Header Row Của Trang

```jsx
// Dòng tiêu đề + nút CTA trên cùng mỗi trang
<div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-4 sm:pt-0">
  <div className="space-y-1">
    <h1 className="text-2xl font-semibold text-slate-900">Tên trang</h1>
    <p className="text-[13px] text-slate-500 font-medium">Mô tả ngắn</p>
  </div>
  <Button className="bg-primary min-h-11 px-5 rounded-xl font-medium text-sm">CTA</Button>
</div>
```

> ❌ **Không** dùng `px-4 sm:px-0` hay `px-0 sm:px-6` trong header row — padding đã được cung cấp bởi outer wrapper.

### Detail Page Navigation (Quay lại)

```jsx
// Hàng nav quay lại + nút hành động ở trang chi tiết
<div className="flex items-center justify-between pt-4 sm:pt-0">
  <Button variant="ghost" asChild>
    <Link href="..." className="flex items-center gap-2">
      <ChevronLeft className="w-4 h-4" />
      <span className="text-sm font-medium">Quay lại danh sách</span>
    </Link>
  </Button>
  {/* Nút xóa hoặc hành động phụ */}
</div>
```

---

## Component Specs

### Cards — `.premium-card`

```css
.premium-card {
  background: white;
  border-radius: 18px;    /* mobile */
  padding: 20px;          /* mobile */
  box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
  transition: box-shadow 300ms ease, transform 300ms ease;
}

@media (min-width: 641px) {
  .premium-card {
    border-radius: 24px;
    padding: 24px;
  }
}

.premium-card:hover {
  box-shadow: 0 10px 40px rgba(15,23,42,0.08);
}
```

**Tailwind equivalent:**
```jsx
<div className="premium-card p-6 border-none space-y-6">
```

> ❌ Không dùng `p-4`, `p-8` trực tiếp trong `.premium-card` — dùng `.premium-card`; global CSS tự chuẩn hóa mobile/desktop.
> ❌ Không lồng `.premium-card` bên trong `.premium-card`.

### Stat Cards (KPI mini widget)

```jsx
<div className="p-4 md:p-5 bg-slate-50 rounded-2xl space-y-1 border border-slate-100 shadow-sm
                transition-all hover:bg-white hover:shadow-md group">
  <p className="text-sm font-medium text-slate-500">Label</p>
  <p className="text-2xl font-bold text-slate-900 tabular-nums">Value</p>
</div>
```

### Buttons

```jsx
// Primary CTA
<Button className="bg-primary hover:bg-primary/90 min-h-11 px-5 rounded-xl font-medium">

// Destructive
<Button variant="ghost" className="text-red-500 hover:bg-red-50 hover:text-red-600 rounded-xl">

// Icon button
<Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl">
```

> ❌ Button primary KHÔNG dùng `amber/gold` màu nền — chỉ dùng cho highlight accent.
> ✅ `active:scale-95 transition-all` trên mọi button có action.
> ✅ Trên mobile, mọi button/icon button phải đạt vùng chạm tối thiểu `44px`.

### Badges

```jsx
// Status badges
const statusStyles = {
  todo:   "bg-slate-100 text-slate-600",
  doing:  "bg-primary/10 text-primary",
  done:   "bg-emerald-50 text-emerald-700",
  late:   "bg-red-50 text-red-600",
  closed: "bg-slate-100 text-slate-500",
};

<Badge className={cn("text-xs font-semibold px-2.5 py-1 rounded-full border-none", style)}>
```

### Inputs

```jsx
<Input className="min-h-11 bg-slate-50 border-none rounded-xl font-medium text-sm
                  focus-visible:ring-1 focus-visible:ring-primary/30" />
```

### Modals / Dialogs

```jsx
<DialogContent className="rounded-2xl border-none shadow-2xl max-w-lg p-5 sm:p-6">
  <DialogHeader>
    <DialogTitle className="text-[17px] font-semibold text-slate-900">Tiêu đề</DialogTitle>
  </DialogHeader>
  <div className="space-y-5 py-4 max-h-[70vh] overflow-y-auto px-1">
    {/* Nội dung */}
  </div>
</DialogContent>
```

### Section Label (chuẩn trong card)

```jsx
<h3 className="text-sm font-medium text-slate-500 flex items-center gap-2">
  <Icon className="w-4 h-4 text-primary" />
  Tên section
</h3>
```

---

## Data Security & Role Permissions

### Phân Quyền Truy Cập Dữ Liệu

| Role | Phạm vi xem |
|------|-------------|
| `admin` | Toàn hệ thống, không giới hạn |
| `director` | Toàn hệ thống, không giới hạn |
| `manager` | Phòng của mình + tasks do mình tạo/được giao |
| `staff` | Phòng của mình + tasks do mình tạo/được giao |

**Pattern filter chuẩn (Supabase):**
```typescript
const isPowerUser = profile?.role === 'admin' || profile?.role === 'director';

if (!isPowerUser && profile?.department_id) {
  query = query.or(
    `department_id.eq.${profile.department_id},created_by.eq.${profile.id},assignee_id.eq.${profile.id}`
  );
}
```

### Task Type Routing

| `task_type` | Hiển thị tại |
|-------------|--------------|
| `regular` | Trang Công việc (`/dashboard/tasks`) |
| `report` | Trang Công việc tab Báo cáo |
| `kpi` | Trang KPI (`/dashboard/kpi`) — **không hiển thị ở Công việc** |

---

## Style Guidelines

**Style:** Exaggerated Minimalism

**Keywords:** Bold minimalism, high contrast, negative space, premium, banking, statement design

**Key Principles:**
- Contrast cao: nền trắng/slate-50 với text slate-900
- Typography đậm: heading `font-bold` / `font-semibold`, label `font-bold`
- Góc bo tròn nhất quán: card `rounded-2xl`, button `rounded-xl`, input `rounded-xl`
- Animation tinh tế: `transition-all duration-200`, `animate-fade-in-up`, `active:scale-95`
- Số tabular: `tabular-nums` cho mọi con số quan trọng

---

## Anti-Patterns (Do NOT Use)

- ❌ Purple/pink/indigo gradient
- ❌ Lồng `.premium-card` trong `.premium-card`
- ❌ Padding `px-4 sm:px-0` trong header row (đã xử lý ở outer wrapper)
- ❌ `p-4` hay `p-8` thay cho `p-6` trong `.premium-card`
- ❌ Hiển thị KPI task ở trang Công việc
- ❌ Hiển thị data ngoài phòng ban cho non-admin/non-director
- ❌ Emoji làm icon — dùng Lucide SVG
- ❌ Layout-shifting hover (scale transform làm bật chỗ khác)
- ❌ Transition instant — luôn dùng `duration-150` đến `duration-300`
- ❌ Double padding: shell padding + page padding chồng nhau

---

## Pre-Delivery Checklist

Trước khi commit bất kỳ UI nào, kiểm tra:

- [ ] Outer wrapper đúng pattern: `max-w-6xl mx-auto px-4 sm:px-6 space-y-... pb-20`
- [ ] Cards dùng `premium-card p-6 border-none`
- [ ] KPI task không hiện ở trang Công việc
- [ ] Data scoped đúng theo role/department
- [ ] Không dùng màu indigo/purple/pink
- [ ] `cursor-pointer` trên tất cả element clickable
- [ ] Hover transitions 150–300ms
- [ ] `active:scale-95` trên button/card có action
- [ ] Text contrast ≥ 4.5:1
- [ ] Responsive tốt tại: 375px, 768px, 1024px, 1440px
- [ ] Không horizontal scroll trên mobile
- [ ] Số liệu dùng `tabular-nums`
