---
name: NextGen LMS Accessible Soft UI Design System
description: Tactile Soft UI with gentle opposing shadows, debossed inset inputs, soft ambient lighting, and highlight-only borders for NextGen Library Management System.
colors:
  primary: "#4f46e5"
  primary-hover: "#4338ca"
  primary-glow: "rgba(79, 70, 229, 0.16)"
  neutral-bg: "#f1f5f9"
  neutral-surface: "#f8fafc"
  neutral-card: "#f8fafc"
  neutral-inset: "#e2e8f0"
  text-primary: "#0f172a"
  text-secondary: "#334155"
  text-muted: "#64748b"
  border-light: "transparent"
  border-dark: "transparent"
  border-highlight: "rgba(79, 70, 229, 0.35)"
  accent-emerald: "#059669"
  accent-rose: "#dc2626"
  accent-amber: "#d97706"
typography:
  display:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "clamp(2rem, 5vw, 3.25rem)"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.02em"
  caption:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.01em"
  micro:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.04em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  button-secondary:
    backgroundColor: "{colors.neutral-card}"
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "10px 18px"
  card-raised:
    backgroundColor: "{colors.neutral-card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "24px"
  input-inset:
    backgroundColor: "{colors.neutral-inset}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
---

## Overview

NextGen LMS (Library Management System) adopts an accessible, soft-tactile UI design system. Rather than heavy, sharp borders and oversaturated neon glows, the interface relies on soft ambient lighting, whisper-soft shadows, and seamless surfaces.

Key pillars:
- **Soft Ambient Lighting**: Diffuse luminescence (`rgba(79, 70, 229, 0.16)`) replacing harsh neon glows.
- **Selective Highlighting**: Borders are omitted from standard cards and containers, reserved exclusively for active, focused, or high-priority highlighted components.
- **Whisper-Soft Shadow Scales**: Low-opacity shadows (`rgba(148, 163, 184, 0.22)`) that elevate controls naturally without dark, heavy gouges.
- **Strict WCAG AA Contrast**: Slate-900 (`#0f172a`) text on light mode and Slate-50 (`#f8fafc`) on dark mode ($\ge 4.5:1$).
- **Physical Affordance**: Buttons depress physically on click (`active:translate-y-[1px]`), and inputs feature subtle debossed wells.

## Colors

### Surfaces & Substrates
- **Light Theme**:
  - Base canvas: `#f1f5f9` (Slate 100)
  - Raised card surface: `#f8fafc` (Slate 50)
  - Inset well background: `#e2e8f0` (Slate 200)
  - Border highlight: `rgba(79, 70, 229, 0.35)`
- **Dark Theme**:
  - Base canvas: `#0f172a` (Slate 900)
  - Raised card surface: `#1e293b` (Slate 800)
  - Inset well background: `#0b1120`
  - Border highlight: `rgba(99, 102, 241, 0.45)`

### Semantic & Accents
- **Primary / Brand**: `#4f46e5` (Indigo-600) / Dark: `#6366f1` (Indigo-500)
- **Primary Glow**: `rgba(79, 70, 229, 0.16)` (Soft, diffused light)
- **Success / In Stock**: `#059669` (Emerald-600)
- **Warning / Fines**: `#d97706` (Amber-600)
- **Danger / Overdue**: `#dc2626` (Rose-600)
- **Info / Circulation**: `#0284c7` (Sky-600)

## Typography

The typography couples **Space Grotesk** (display & headings) with **Inter** (body, labels, & UI controls) loaded via Google Fonts.

- **Display**: Space Grotesk 800, tight tracking (`-0.03em`), commanding visual presence without gradient text gimmicks.
- **Headlines & Titles**: Space Grotesk 700. Clean structural hierarchy.
- **Body Text**: Inter 400/500, relaxed 1.5 line height, ensuring effortless reading across catalog descriptions and loans.
- **Data & Numbers**: All timestamps, ISBN codes, shelf numbers, copy counts, and fine amounts use `tabular-nums` (`font-variant-numeric: tabular-nums`) to prevent shifting alignment.

## Layout

- **Responsive Grid**: Fluid responsive layout using Tailwind CSS v4, supporting mobile viewports up to 4K ultra-wide monitors.
- **App Shell**:
  - Elevated left navigation rail (`w-64`) with tactile active tab extrusion.
  - Floating TopNav header with breadcrumbs and tactile profile menu.
  - Tactile bottom navigation bar for small mobile screens.
- **Spacers**: Consistent 4px scale token ramps (`4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`).

## Elevation & Depth

1. **Raised Card (`--neo-raised`)**:
   `box-shadow: 2px 4px 10px -2px var(--neo-shadow-dark), -2px -2px 8px var(--neo-shadow-light);`
2. **Elevated Surface (`--neo-raised-lg`)**:
   `box-shadow: 4px 8px 18px -3px var(--neo-shadow-dark), -4px -4px 14px var(--neo-shadow-light);`
3. **Subtle Pill (`--neo-raised-sm`)**:
   `box-shadow: 1px 2px 5px 0px var(--neo-shadow-dark), -1px -1px 4px var(--neo-shadow-light);`
4. **Debossed Inset Well (`--neo-inset`)**:
   `box-shadow: inset 1px 2px 5px var(--neo-shadow-dark), inset -1px -1px 4px var(--neo-shadow-light);`
5. **Shallow Inset (`--neo-inset-sm`)**:
   `box-shadow: inset 1px 1px 3px var(--neo-shadow-dark), inset -1px -1px 2px var(--neo-shadow-light);`

## Shapes

- **Corner Radii**:
  - Small pills & badges: `rounded-full` or `rounded-xl` (`10px`)
  - Buttons & Inputs: `rounded-xl` (`10px` to `12px`)
  - Cards & Panels: `rounded-2xl` (`16px`)
  - Modals & Floating Consoles: `rounded-3xl` (`20px` to `24px`)
- **Borders**: Transparent by default. Only highlighted elements receive a 1px border.

## Components

- **`NeoCard` / `Card`**: Soft tactile raised substrate with whisper-soft dual shadow; clean borderless edges.
- **`NeoButton` / `Button`**: Physical depression (`active:translate-y-[1px]`), high-contrast text, soft warm ambient glow for primary actions.
- **`NeoInput` / `Input`**: Debossed inset well with clear placeholder, focus-visible outline ring (`2px` solid primary with `2px` offset), and highlighted border on focus.
- **`NeoBadge` / `Badge`**: Soft pill with semantic dot (emerald for available, rose for overdue, amber for pending).
- **`NeoStatCard` / `StatCard`**: Extruded card with tactile icon pod, large tabular figures, and trend indicators.
- **`NeoTable` / `Table`**: Elevated table container with clean header row and smooth hover feedback.
- **`NeoModal` / `Modal`**: High-elevation dialog with backdrop blur and tactile close button.

## Do's and Don'ts

### Do:
- **Do** use soft, diffused ambient light instead of harsh neon glows.
- **Do** use `tabular-nums` on all ISBNs, shelf call numbers, fine balances, and copy numbers.
- **Do** use debossed inset wells for search inputs, dropzones, and textareas.
- **Do** reserve borders strictly for components that need highlighting (e.g. active inputs, selected tabs, key callouts).
- **Do** use physical depression (`active:translate-y-[1px]`) on clickable controls.
- **Do** test WCAG AA contrast (minimum 4.5:1 for body copy, 3:1 for large headers).

### Don't:
- **Don't** add eyebrow or kicker labels stacked directly above headings (Banned by Craft Floor).
- **Don't** use gradient text. Contrast and hierarchy must derive from typography weight, size, and crisp color.
- **Don't** use harsh saturated neon glow shadows.
- **Don't** put borders around every single card, badge, or container.
- **Don't** create identical 3-card feature columns with interchangeable icons.
