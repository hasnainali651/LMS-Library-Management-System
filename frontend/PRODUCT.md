# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Community Library Patrons (Members):** General public patrons, readers, and students discovering titles across multi-genre catalogs, borrowing books, managing loan renewals, and reserving waitlisted books.
- **Librarians / Branch Staff:** Circulation managers handling checkouts, return inspections, hold-shelf fulfillment, and catalog shelf/rack assignments.
- **Library Administrators:** System managers overseeing system health, patron accounts, queue monitoring, and catalog data policies.

## Product Purpose

NextGen LMS transforms public community library operations into a modern, real-time, and friction-free service. Success means community patrons easily explore titles and manage their loans without overdue friction, while library staff automate routine circulation notices, fine management, and inventory tracking.

## Positioning

An intelligent, real-time community library platform powered by high-speed Redis caching, automated Bull background queue notifications, and AI book summaries for intuitive patron discovery.

## Operating Context

- Community library web application accessed across desktop and mobile devices.
- Circulation desk routines: book lending, return processing, hold-shelf pickups (`shelfLocation` verification), and overdue fine tracking.
- Automated background processes: daily fine updates, scheduled overdue reminder alerts, and real-time inventory synchronization.

## Capabilities and Constraints

- **Capabilities:**
  - Multi-genre catalog search and category filtering with live availability indicators.
  - Rich book records with ISBN, shelf/rack location, total vs. available copies, and AI synopses.
  - Comprehensive lending lifecycle: active loans, due date reminders, return logging, and overdue fine calculations.
  - Patron reservation and waitlist queues with position tracking and pickup deadlines.
  - Role-based authentication (Member, Librarian, Admin) with token refresh handling.
- **Constraints:**
  - Web platform built on Next.js 14 App Router and custom CSS design system.
  - Connects to an Express / MongoDB / Redis backend API via REST and Socket.io.

## Brand Commitments

- **Name:** NextGen LMS (Modern Library Management System).
- **Tone:** Welcoming, dependable, structured, and modern.
- **Identity Assets:** Clean book emblem icon, purple/indigo accent palette, and glassmorphic card styling.

## Evidence on Hand

- Next.js 14 routes in place: `/` (Home landing), `/books` (Catalog search & AI summaries), `/dashboard` (Patron & staff circulation management), and `/login` (Role-based authentication).
- Concrete data models for books, active loans, reservations, and user roles (`src/app/dashboard/page.jsx`, `src/app/books/page.jsx`).
- Axios client configured with automatic JWT refresh token rotation (`src/lib/api.js`).

## Product Principles

1. **Frictionless Discovery First:** Help patrons find books, understand key takeaways through AI summaries, and check physical shelf availability instantly.
2. **Zero Surprises on Loans & Fines:** Provide unmistakable clarity on due dates, return statuses, and hold pickups so patrons never face unexpected penalties.
3. **Circulation Efficiency:** Give librarians clear, high-density workflows for fast checking-in, checking-out, and hold-shelf management.
4. **Real-Time Reliability:** Keep book availability, waitlist positions, and loan statuses consistently synchronized across the entire branch.
