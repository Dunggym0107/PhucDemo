# Schedule Page Overrides

> **PROJECT:** projectFlow
> **Generated:** 2026-05-17 15:16:01
> **Page Type:** Dashboard / Data View

> ⚠️ **IMPORTANT:** Rules in this file **override** the Master file (`design-system/MASTER.md`).
> Only deviations from the Master are documented here. For all other rules, refer to the Master.

---

## Page-Specific Rules

### Layout Overrides

- **Max Width:** 1400px or full-width
- **Grid:** 12-column grid for data flexibility
- **Sections:** 1. Hero (date/location/countdown), 2. Speakers grid, 3. Agenda/schedule, 4. Sponsors, 5. Register CTA

### Spacing Overrides

- **Content Density:** High — optimize for information display

### Typography Overrides

- No overrides — use Master typography

### Color Overrides

- **Strategy:** Urgency colors (countdown). Event branding. Speaker cards professional. Sponsor logos neutral.

### Component Overrides

- Avoid: Default keyboard for all inputs
- Avoid: Desktop-first causing mobile issues
- Avoid: Enable by default everywhere

---

## Page-Specific Components

- No unique components for this page

---

## Recommendations

- Effects: grid-template with varied spans, rounded-xl (16px), subtle shadows, hover scale (1.02), smooth transitions
- Forms: Use inputmode attribute
- Responsive: Start with mobile styles then add breakpoints
- Touch: Disable where not needed
- CTA Placement: Register CTA sticky + After speakers + Bottom
