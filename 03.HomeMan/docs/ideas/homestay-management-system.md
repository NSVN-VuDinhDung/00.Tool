# Homestay Management System

_Produced via idea-refine — 2026-07-02_

---

## Problem Statement
How might we help a developer-owner run a 12-room Vietnamese homestay from a self-built system — so bookings, staff tasks, room condition, guests, and supplies are all managed in one place they fully control?

## Recommended Direction
A progressive, self-hosted PMS built in phases. Pre-launch covers the operational minimum needed to open: bookings, staff/task management with photo evidence on room handover, guest CRM, and supplies checklists. Post-launch adds payment automation (SePay) and channel sync (iCal) once there is real data and real volume to justify the complexity.

Staff photo upload is deliberately scoped to the check-in/check-out workflow — not a general media library. This keeps it simple while solving the real problem: a timestamped, room-linked photo record that proves condition at handover.

## Key Assumptions to Validate
- [ ] You'll have sufficient build time solo before launch — estimate each module in weeks, not features
- [ ] Supplies tracking as a per-room checklist is enough pre-launch (validate after first month of operations)
- [ ] Staff are comfortable using a web app on mobile for task updates and photo uploads (test with one real cleaner before launch)
- [ ] SePay webhook reliability is acceptable for payment reconciliation (test with a sandbox account before going live)

## MVP Scope (Pre-Launch)

**In:**
- Bookings — calendar, reservation CRUD, check-in/check-out status, overlap prevention
- CRM — guest profiles (name, phone, ID, nationality, notes), stay history linked to bookings
- Staff Management — user accounts, role assignment (Admin / Co-owner / Staff / Cleaner), task creation and assignment
- Task Workflow — room turnover tasks triggered by check-out, status tracking (Pending → In Progress → Done), photo upload by cleaner on completion
- Supplies — per-room consumable checklist, restock flag, assigned to staff

**Out (pre-launch):**
- SePay payment integration
- iCal channel sync
- Reporting and analytics dashboard
- Native mobile app

## Not Doing (and Why)
- **Full inventory system** — you don't know consumption patterns yet; a checklist is enough until you do
- **Native mobile app** — responsive PWA covers staff phone use without a separate build
- **Airbnb/Booking.com API partner integration** — requires approval process; iCal handles availability blocking post-launch
- **In-app messaging / guest communication** — out of scope; phone/Zalo handles this for a 12-room property
- **Multi-property support** — one property, one system; don't architect for scale you don't have

## Post-Launch Roadmap
| Phase | Features |
|---|---|
| **v1.1** | SePay — VietQR generation + webhook reconciliation |
| **v1.2** | iCal sync — Airbnb + Booking.com availability blocking |
| **v2.0** | Reporting — occupancy rate, revenue, task completion stats |

## Open Questions
- Which VPS provider — Hetzner or DigitalOcean? (affects latency for Vietnamese users; consider a Singapore region)
- Will co-owner have the same permissions as admin, or a read-only financial view?
- Photo storage — local VPS disk or object storage (Cloudflare R2 / S3)? VPS disk is simpler but object storage is safer for media
