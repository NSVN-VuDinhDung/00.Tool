# Intent: Homestay Management System

_Confirmed via interview-me — 2026-07-02_

---

## Confirmed Statement of Intent

- **Outcome:**      A self-hosted property management system built and owned by the developer-owner, covering all daily operations of a 12-room homestay
- **User:**         Primarily the owner (admin); secondary users are staff, cleaners, and a co-owner with role-restricted access
- **Why now:**      The homestay launches next year — the system must be ready before the first guest arrives
- **Success:**      All operations (bookings, tasks, payments, room status, channel sync) managed from one system the owner fully controls
- **Constraint:**   Built and maintained by one developer; must run cost-effectively on a VPS
- **Out of scope:** Native mobile app, full Airbnb/Booking.com API partner integration, third-party payment gateway (SePay handles QR + reconciliation)

---

## Modules

| Module | Description |
|---|---|
| **Booking Management** | Reservations, calendar view, check-in / check-out |
| **Customer Management** | Guest profiles, stay history |
| **Operational Workflows** | Task assignment to staff/cleaners, room turnover status tracking |
| **Supplies Tracking** | Consumables per room, restock alerts |
| **Channel Sync** | iCal export/import — Airbnb, Booking.com (not full API) |
| **Payments** | VietQR code generation per booking + SePay webhook auto-reconciliation |

---

## Tech Stack

| Layer | Choice |
|---|---|
| **Frontend** | React + Tailwind CSS (responsive, PWA-ready) |
| **Backend** | ASP.NET Core REST API |
| **Database** | PostgreSQL |
| **Auth** | ASP.NET Identity — roles: Admin, Staff, Cleaner, Co-owner |
| **Hosting** | VPS (Hetzner / DigitalOcean) — Docker + Nginx |
| **Payment** | SePay — VietQR generation + incoming transfer webhook |

---

## Property Details

- **Rooms:** 12
- **Location:** Vietnam
- **Status:** Pre-launch (target: next year)

---

## Next Steps

- [ ] Apply `idea-refine` to converge on MVP scope and "Not Doing" list
- [ ] Apply `spec-driven-development` to write full requirements
- [ ] Apply `planning-and-task-breakdown` to create implementable tasks
