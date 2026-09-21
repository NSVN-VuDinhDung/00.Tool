# Implementation Plan: Homestay Management System (HomeMan)

_Version 1.0 — 2026-07-02_
_Spec: [docs/spec/homestay-management-spec.md](../spec/homestay-management-spec.md)_

---

## Overview

Build a self-hosted PMS for a 12-room Vietnamese homestay. The plan is vertically sliced: each phase delivers working, testable functionality end-to-end. Foundation layers are built first; no frontend task starts before its backend counterpart is complete and tested.

**Total tasks: 23 across 5 phases.**

---

## Architecture Decisions

- **Clean Architecture layers:** Domain → Application → Infrastructure → API. No MediatR — Application services are injected directly into controllers.
- **JWT auth:** Stateless tokens with role claims. Refresh token stored in HttpOnly cookie.
- **Photo storage:** VPS local disk at `/uploads/tasks/{taskId}/`. Served by Nginx, not the API.
- **Database seeding:** 12 rooms + default admin user created on first migration run.
- **Frontend routing:** React Router v7. Role-aware route guards in a shared `ProtectedRoute` wrapper.
- **API client:** Native `fetch` with a typed wrapper in `frontend/src/services/`. No Axios dependency.
- **Calendar library:** `@tanstack/react-table` for lists; custom room-grid for the booking calendar (avoid heavy charting libs).

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Booking overlap detection has edge cases | High | Unit test every boundary: same-day check-in/out, midnight, multi-night |
| Photo uploads on mobile (large files, slow VPS) | Medium | Compress client-side before upload (browser Canvas API); cap at 5MB per photo |
| JWT refresh on mobile (cleaner loses session mid-task) | Medium | Silent refresh with retry on 401; short access token (15min), long refresh (30 days) |
| EF Core migration conflicts during development | Low | One developer — linear migration history; use `dotnet ef migrations add` only on clean state |
| shadcn/ui calendar component not flexible enough | Low | Fall back to custom CSS Grid room calendar if needed |

---

## Task List

### Phase 1: Foundation

---

#### Task 1: Monorepo scaffold and Docker setup

**Description:** Create the top-level folder structure, `docker-compose.yml` for local development (API + PostgreSQL + Nginx), `.gitignore`, and `README.md` with run instructions. No application code yet — just the skeleton that everything else builds on.

**Acceptance criteria:**
- [ ] `docker compose up` starts PostgreSQL and a placeholder API container without errors
- [ ] `frontend/` and `backend/` folders exist with correct project scaffolding
- [ ] `.env.example` lists all required environment variables (DB connection string, JWT secret, upload path)
- [ ] `uploads/` directory is gitignored

**Verification:**
- [ ] Manual: `docker compose up` → no errors, PostgreSQL accessible on port 5432
- [ ] Manual: `ls backend/ frontend/ docs/ uploads/` → all present

**Dependencies:** None

**Files likely touched:**
- `docker-compose.yml`
- `nginx.conf`
- `.gitignore`
- `.env.example`
- `README.md`

**Estimated scope:** M

---

#### Task 2: Backend Clean Architecture project setup

**Description:** Create four .NET 10 projects under `backend/`: `HomeMan.Domain`, `HomeMan.Application`, `HomeMan.Infrastructure`, `HomeMan.API`. Wire project references (API → Application → Domain; Infrastructure → Application + Domain). Add FluentValidation, EF Core, Npgsql, and ASP.NET Identity NuGet packages. Add `AppDbContext` skeleton.

**Acceptance criteria:**
- [ ] `dotnet build` succeeds across all four projects
- [ ] Project references enforce Clean Architecture direction (Domain has zero external dependencies)
- [ ] `AppDbContext` inherits `IdentityDbContext<AppUser>`
- [ ] Connection string read from environment variable `DATABASE_URL`

**Verification:**
- [ ] `cd backend && dotnet build` → 0 errors, 0 warnings
- [ ] `HomeMan.Domain.csproj` has no `<PackageReference>` entries

**Dependencies:** Task 1

**Files likely touched:**
- `backend/HomeMan.Domain/HomeMan.Domain.csproj`
- `backend/HomeMan.Application/HomeMan.Application.csproj`
- `backend/HomeMan.Infrastructure/HomeMan.Infrastructure.csproj`
- `backend/HomeMan.API/HomeMan.API.csproj`
- `backend/HomeMan.Infrastructure/Data/AppDbContext.cs`

**Estimated scope:** M

---

#### Task 3: Domain entities and initial database migration

**Description:** Define all domain entities in `HomeMan.Domain`: `AppUser`, `Room`, `Guest`, `Booking`, `CleaningTask`, `TaskPhoto`, `SupplyItem`. Configure EF Core mappings in `HomeMan.Infrastructure`. Create and apply the initial migration. Seed 12 rooms and a default admin user.

**Acceptance criteria:**
- [ ] All tables created in PostgreSQL after `dotnet ef database update`
- [ ] 12 rooms seeded (Room 101–112 or configurable numbers)
- [ ] Default admin user seeded (credentials from environment variables)
- [ ] All foreign key constraints and indexes present
- [ ] `Booking` table has a unique index preventing overlapping dates per room (enforced at DB level)

**Verification:**
- [ ] `dotnet ef database update` → success
- [ ] `psql` query: `SELECT COUNT(*) FROM "Rooms"` → 12
- [ ] `psql` query: `SELECT COUNT(*) FROM "AspNetUsers"` → 1

**Dependencies:** Task 2

**Files likely touched:**
- `backend/HomeMan.Domain/Entities/` (all 7 entity files)
- `backend/HomeMan.Infrastructure/Data/AppDbContext.cs`
- `backend/HomeMan.Infrastructure/Data/Migrations/` (generated)
- `backend/HomeMan.Infrastructure/Data/Seed/DatabaseSeeder.cs`

**Estimated scope:** L

---

#### Task 4: JWT authentication — login and token refresh endpoints

**Description:** Implement `POST /api/auth/login` (returns access token + sets HttpOnly refresh token cookie) and `POST /api/auth/refresh`. Add role-based `[Authorize]` middleware. Access token expires in 15 minutes; refresh token in 30 days.

**Acceptance criteria:**
- [ ] `POST /api/auth/login` with valid credentials returns `{ accessToken, expiresIn, role }`
- [ ] `POST /api/auth/login` with invalid credentials returns 401
- [ ] `POST /api/auth/refresh` with valid cookie returns new access token
- [ ] `[Authorize(Roles = "Cleaner")]` blocks Admin token → 403
- [ ] Refresh token is HttpOnly, Secure, SameSite=Strict

**Verification:**
- [ ] `dotnet test` → `AuthServiceTests` all pass
- [ ] Manual: `curl -X POST /api/auth/login` with wrong password → 401
- [ ] Manual: access a protected endpoint without token → 401

**Dependencies:** Task 3

**Files likely touched:**
- `backend/HomeMan.Application/Services/IAuthService.cs`
- `backend/HomeMan.Application/Services/AuthService.cs`
- `backend/HomeMan.Application/DTOs/AuthDTOs.cs`
- `backend/HomeMan.API/Controllers/AuthController.cs`
- `backend/HomeMan.API/Program.cs` (JWT middleware config)

**Estimated scope:** M

---

### ✅ Checkpoint 1 — Foundation

- [ ] `dotnet build` passes
- [ ] `dotnet test` passes
- [ ] `docker compose up` starts all services
- [ ] Login endpoint returns a valid JWT
- [ ] Database has 12 rooms and 1 admin user
- [ ] **Human review before proceeding**

---

### Phase 2: Auth UI + Staff Management

---

#### Task 5: Staff management API (user CRUD + role assignment)

**Description:** Implement endpoints for Admin/Co-owner to manage user accounts: `GET /api/users`, `POST /api/users`, `PUT /api/users/{id}`, `DELETE /api/users/{id}` (soft delete — sets `IsActive = false`). Role assignment on create/update.

**Acceptance criteria:**
- [ ] Admin can create a user with any role
- [ ] Deactivated users cannot log in (401 on login attempt)
- [ ] Cleaner token cannot access `/api/users` → 403
- [ ] `GET /api/users` supports `?role=Cleaner` filter

**Verification:**
- [ ] `dotnet test` → `UserServiceTests` all pass
- [ ] Integration test: create user → login → deactivate → login again → 401

**Dependencies:** Task 4

**Files likely touched:**
- `backend/HomeMan.Application/Services/IUserService.cs` + `UserService.cs`
- `backend/HomeMan.Application/DTOs/UserDTOs.cs`
- `backend/HomeMan.API/Controllers/UsersController.cs`

**Estimated scope:** M

---

#### Task 6: Frontend scaffold — Vite, React, Tailwind, shadcn/ui, API client

**Description:** Initialize the React + Vite + TypeScript project. Install and configure Tailwind v4 and shadcn/ui. Set up React Router v7 with a root layout. Create the typed `fetch` API client in `src/services/api.ts` with JWT header injection and 401 auto-refresh logic. Add `zustand` for auth state.

**Acceptance criteria:**
- [ ] `npm run dev` starts without errors
- [ ] `npm run build` produces a clean `dist/`
- [ ] Tailwind styles apply on a test page
- [ ] `npx shadcn@latest add button` installs correctly into `src/components/ui/`
- [ ] API client automatically attaches `Authorization: Bearer <token>` to every request
- [ ] On 401, client attempts silent refresh before failing

**Verification:**
- [ ] `npm run build` → 0 errors
- [ ] Manual: open app in browser → no console errors

**Dependencies:** Task 4 (API must exist for client to target)

**Files likely touched:**
- `frontend/vite.config.ts`
- `frontend/src/main.tsx`
- `frontend/src/services/api.ts`
- `frontend/src/store/authStore.ts`
- `frontend/src/components/layout/AppLayout.tsx`
- `frontend/tailwind.config.ts`

**Estimated scope:** M

---

#### Task 7: Login page and role-aware route guards

**Description:** Build the `/login` page using shadcn/ui `Form`, `Input`, `Button`. On success, store the token and redirect by role (Admin/Co-owner/Staff → `/dashboard`; Cleaner → `/tasks`). Add `ProtectedRoute` wrapper that checks role and redirects unauthorized users.

**Acceptance criteria:**
- [ ] Login with valid credentials redirects to correct route by role
- [ ] Login with invalid credentials shows inline error message (no page reload)
- [ ] Navigating to `/dashboard` without a token redirects to `/login`
- [ ] Cleaner navigating to `/bookings` is redirected to `/tasks`
- [ ] Form is usable on a 375px mobile screen

**Verification:**
- [ ] `npm test` → `LoginPage.test.tsx` passes
- [ ] Manual: login as Cleaner → try to access `/bookings` → redirected

**Dependencies:** Task 6

**Files likely touched:**
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/components/auth/ProtectedRoute.tsx`
- `frontend/src/router.tsx`

**Estimated scope:** M

---

#### Task 8: Staff management page (Admin/Co-owner only)

**Description:** Build `/staff` page with a shadcn/ui `DataTable` listing all users (name, role, status). Add "New User" dialog (form: name, email, password, role). Add deactivate action per row. Role badge with color coding.

**Acceptance criteria:**
- [ ] Staff list loads and shows all users with role and active status
- [ ] Admin can create a new user via dialog; user appears in list immediately
- [ ] Admin can deactivate a user; row shows "Inactive" badge
- [ ] Page is not accessible to Staff or Cleaner roles
- [ ] Mobile layout: table collapses to card list on < 640px

**Verification:**
- [ ] `npm test` → `StaffPage.test.tsx` passes (mock API)
- [ ] Manual: create user, log in as that user, verify access

**Dependencies:** Task 5, Task 7

**Files likely touched:**
- `frontend/src/pages/StaffPage.tsx`
- `frontend/src/components/staff/UserTable.tsx`
- `frontend/src/components/staff/NewUserDialog.tsx`
- `frontend/src/services/userService.ts`
- `frontend/src/types/user.ts`

**Estimated scope:** M

---

### ✅ Checkpoint 2 — Auth + Staff Management

- [ ] `dotnet test` + `npm test` pass
- [ ] Admin can log in, create a cleaner account
- [ ] Cleaner can log in, cannot access staff or booking pages
- [ ] All pages render correctly on mobile
- [ ] **Human review before proceeding**

---

### Phase 3: Rooms and Guests

---

#### Task 9: Room management API

**Description:** Implement `GET /api/rooms` (all rooms with current status), `PUT /api/rooms/{id}/status` (manual status override). Room status enum: `Available`, `Occupied`, `Dirty`, `Clean`. Status is also updated automatically by booking check-in/check-out (wired in Phase 4).

**Acceptance criteria:**
- [ ] `GET /api/rooms` returns all 12 rooms with current status
- [ ] Admin can manually set a room status via `PUT /api/rooms/{id}/status`
- [ ] Cleaner token cannot change room status → 403

**Verification:**
- [ ] `dotnet test` → `RoomServiceTests` pass
- [ ] Manual: change room status, verify in DB

**Dependencies:** Task 4

**Files likely touched:**
- `backend/HomeMan.Application/Services/IRoomService.cs` + `RoomService.cs`
- `backend/HomeMan.Application/DTOs/RoomDTOs.cs`
- `backend/HomeMan.API/Controllers/RoomsController.cs`

**Estimated scope:** S

---

#### Task 10: Guest (CRM) API

**Description:** Implement full CRUD for guests: `GET /api/guests` (with `?search=` by name or phone), `GET /api/guests/{id}` (with stay history), `POST /api/guests`, `PUT /api/guests/{id}`. Guest fields: name, phone, ID number, nationality, notes.

**Acceptance criteria:**
- [ ] `GET /api/guests?search=nguyen` returns matching guests by name or phone
- [ ] `GET /api/guests/{id}` includes full booking history for that guest
- [ ] Duplicate phone number returns 409 Conflict
- [ ] Cleaner token cannot access guest endpoints → 403

**Verification:**
- [ ] `dotnet test` → `GuestServiceTests` pass
- [ ] Integration test: create guest, search by phone, verify result

**Dependencies:** Task 4

**Files likely touched:**
- `backend/HomeMan.Application/Services/IGuestService.cs` + `GuestService.cs`
- `backend/HomeMan.Application/DTOs/GuestDTOs.cs`
- `backend/HomeMan.API/Controllers/GuestsController.cs`

**Estimated scope:** M

---

#### Task 11: Room status dashboard page

**Description:** Build `/rooms` page showing a grid of 12 room cards. Each card shows: room number, current status, and a status badge (color-coded). Admin/Staff can click a card to manually change status. Uses shadcn/ui `Card`, `Badge`, `Select`.

**Acceptance criteria:**
- [ ] All 12 rooms displayed in a responsive grid (4 cols desktop, 2 cols mobile)
- [ ] Status badges: Available=green, Occupied=blue, Dirty=amber, Clean=teal
- [ ] Admin/Staff can update status inline; optimistic UI update
- [ ] Page auto-refreshes status every 60 seconds

**Verification:**
- [ ] `npm test` → `RoomGrid.test.tsx` passes
- [ ] Manual: change status → badge updates without full page reload

**Dependencies:** Task 9, Task 7

**Files likely touched:**
- `frontend/src/pages/RoomsPage.tsx`
- `frontend/src/components/rooms/RoomGrid.tsx`
- `frontend/src/components/rooms/RoomCard.tsx`
- `frontend/src/services/roomService.ts`
- `frontend/src/types/room.ts`

**Estimated scope:** M

---

#### Task 12: Guest (CRM) page

**Description:** Build `/guests` page with a searchable, paginated shadcn/ui `DataTable` of all guests. "New Guest" button opens a dialog form. Clicking a row opens a guest detail sheet showing profile + stay history.

**Acceptance criteria:**
- [ ] Guest list loads with pagination (20 per page)
- [ ] Search input filters by name or phone (debounced, hits API)
- [ ] New guest dialog validates required fields (name, phone) before submit
- [ ] Guest detail sheet shows past bookings in reverse chronological order
- [ ] Not accessible to Cleaner role

**Verification:**
- [ ] `npm test` → `GuestsPage.test.tsx` passes
- [ ] Manual: create guest, search for them, open detail panel

**Dependencies:** Task 10, Task 7

**Files likely touched:**
- `frontend/src/pages/GuestsPage.tsx`
- `frontend/src/components/guests/GuestTable.tsx`
- `frontend/src/components/guests/NewGuestDialog.tsx`
- `frontend/src/components/guests/GuestDetailSheet.tsx`
- `frontend/src/services/guestService.ts`
- `frontend/src/types/guest.ts`

**Estimated scope:** M

---

### ✅ Checkpoint 3 — Rooms and Guests

- [ ] `dotnet test` + `npm test` pass
- [ ] All 12 rooms visible on the dashboard
- [ ] Admin can create a guest and view their profile
- [ ] Search works correctly
- [ ] **Human review before proceeding**

---

### Phase 4: Bookings (Core Feature)

---

#### Task 13: Booking API — create, read, overlap detection

**Description:** Implement `POST /api/bookings`, `GET /api/bookings`, `GET /api/bookings/{id}`, `DELETE /api/bookings/{id}` (cancel). Overlap detection must reject bookings where the requested dates collide with an existing `Confirmed` or `CheckedIn` booking for the same room. Guest can be linked by ID or created inline via the request body.

**Acceptance criteria:**
- [ ] `POST /api/bookings` creates a booking in `Pending` status
- [ ] Overlap detection rejects conflicting dates with 409 and a descriptive message
- [ ] Same-day check-out / check-in (back-to-back) is allowed
- [ ] `GET /api/bookings?month=2027-03` returns all bookings for that month
- [ ] `GET /api/bookings?roomId={id}` returns bookings for one room

**Verification:**
- [ ] `dotnet test` → `BookingServiceTests` — overlap boundary tests all pass (7 edge cases minimum)
- [ ] Integration test: create two overlapping bookings → second returns 409

**Dependencies:** Task 10, Task 9

**Files likely touched:**
- `backend/HomeMan.Application/Services/IBookingService.cs` + `BookingService.cs`
- `backend/HomeMan.Application/DTOs/BookingDTOs.cs`
- `backend/HomeMan.API/Controllers/BookingsController.cs`
- `backend/HomeMan.Tests/Unit/Services/BookingServiceTests.cs`

**Estimated scope:** M

---

#### Task 14: Booking status transitions — confirm, check-in, check-out

**Description:** Implement status transition endpoints: `POST /api/bookings/{id}/confirm`, `POST /api/bookings/{id}/checkin`, `POST /api/bookings/{id}/checkout`. On checkout: room status → `Dirty`, and a `CleaningTask` is automatically created and left unassigned (or assigned to a default cleaner if configured).

**Acceptance criteria:**
- [ ] Status machine enforced: only valid transitions succeed; invalid ones return 400
- [ ] Checking in sets room status to `Occupied`
- [ ] Checking out sets room status to `Dirty` and creates an unassigned `CleaningTask`
- [ ] Cancelling a `CheckedIn` booking is rejected with 400

**Verification:**
- [ ] `dotnet test` → `BookingStatusTests` — all transition matrix cases pass
- [ ] Manual: check out booking → verify `CleaningTask` row in DB

**Dependencies:** Task 13

**Files likely touched:**
- `backend/HomeMan.Application/Services/BookingService.cs` (extend)
- `backend/HomeMan.Application/Services/ITaskService.cs` + `TaskService.cs`
- `backend/HomeMan.API/Controllers/BookingsController.cs` (extend)
- `backend/HomeMan.Tests/Unit/Services/BookingStatusTests.cs`

**Estimated scope:** M

---

#### Task 15: Booking calendar page

**Description:** Build `/bookings` page with two views: (1) a monthly room-grid calendar (rows = rooms, columns = days, colored blocks = bookings) and (2) a list view with filters. Month navigation (prev/next). Clicking an empty cell opens a "New Booking" dialog pre-filled with that room and date.

**Acceptance criteria:**
- [ ] Monthly calendar renders all 12 rooms × days-in-month correctly
- [ ] Booking blocks are colored by status (Pending=gray, Confirmed=blue, CheckedIn=green, CheckedOut=slate)
- [ ] Month navigation loads correct data
- [ ] Responsive: on mobile, calendar switches to a scrollable list view
- [ ] Not accessible to Cleaner role

**Verification:**
- [ ] `npm test` → `BookingCalendar.test.tsx` passes
- [ ] Manual: navigate months, verify bookings appear on correct cells

**Dependencies:** Task 13, Task 7

**Files likely touched:**
- `frontend/src/pages/BookingsPage.tsx`
- `frontend/src/components/bookings/BookingCalendar.tsx`
- `frontend/src/components/bookings/BookingListView.tsx`
- `frontend/src/services/bookingService.ts`
- `frontend/src/types/booking.ts`

**Estimated scope:** L

---

#### Task 16: Booking form and status action buttons

**Description:** Build the "New Booking" dialog and booking detail sheet. Detail sheet shows all fields plus status action buttons (Confirm / Check In / Check Out / Cancel) that are conditionally rendered based on current status and user role.

**Acceptance criteria:**
- [ ] New booking form validates: room, guest, dates (check-out > check-in), no overlap (client-side pre-check)
- [ ] Status buttons are disabled when the transition is not valid
- [ ] Check-out button shows a confirmation dialog before proceeding
- [ ] After check-out, room card on `/rooms` page reflects `Dirty` status

**Verification:**
- [ ] `npm test` → `BookingForm.test.tsx` + `BookingActions.test.tsx` pass
- [ ] Manual: full booking lifecycle — create → confirm → check in → check out

**Dependencies:** Task 15, Task 14

**Files likely touched:**
- `frontend/src/components/bookings/NewBookingDialog.tsx`
- `frontend/src/components/bookings/BookingDetailSheet.tsx`
- `frontend/src/components/bookings/BookingStatusActions.tsx`

**Estimated scope:** M

---

### ✅ Checkpoint 4 — Bookings

- [ ] `dotnet test` + `npm test` pass
- [ ] Full booking lifecycle works end-to-end (create → confirm → check in → check out)
- [ ] Overlap detection prevents double-booking
- [ ] Checkout automatically creates a cleaning task
- [ ] Calendar renders correctly on desktop and mobile
- [ ] **Human review before proceeding**

---

### Phase 5: Tasks, Photos, and Supplies

---

#### Task 17: Task management API

**Description:** Implement task endpoints: `GET /api/tasks` (Admin/Staff see all; Cleaner sees only their own), `PUT /api/tasks/{id}/assign`, `PUT /api/tasks/{id}/status`. Task status: `Pending → InProgress → Done`.

**Acceptance criteria:**
- [ ] `GET /api/tasks` for a Cleaner token returns only tasks assigned to them
- [ ] `GET /api/tasks?status=Pending` filters correctly
- [ ] `PUT /api/tasks/{id}/assign` requires Admin or Staff role
- [ ] Status transition `Done → Pending` is rejected (tasks cannot be un-completed)

**Verification:**
- [ ] `dotnet test` → `TaskServiceTests` pass
- [ ] Integration test: Cleaner token calling `GET /api/tasks` returns only own tasks

**Dependencies:** Task 14

**Files likely touched:**
- `backend/HomeMan.Application/Services/ITaskService.cs` + `TaskService.cs` (extend)
- `backend/HomeMan.Application/DTOs/TaskDTOs.cs`
- `backend/HomeMan.API/Controllers/TasksController.cs`

**Estimated scope:** M

---

#### Task 18: Photo upload API

**Description:** Implement `POST /api/tasks/{id}/photos` (multipart form, up to 10 photos per task, 5MB per file). Store files at `/uploads/tasks/{taskId}/{timestamp}-{filename}`. Return photo URLs. Implement `DELETE /api/tasks/{id}/photos/{photoId}` (soft delete only).

**Acceptance criteria:**
- [ ] Upload endpoint accepts JPEG and PNG only; other types return 415
- [ ] Files > 5MB return 413
- [ ] More than 10 photos per task returns 400
- [ ] Photo URLs are accessible via Nginx at `/uploads/tasks/{taskId}/...`
- [ ] Deleting a photo soft-deletes the DB record; file remains on disk

**Verification:**
- [ ] `dotnet test` → `PhotoUploadTests` pass
- [ ] Manual: upload a photo on mobile, verify it loads via URL

**Dependencies:** Task 17

**Files likely touched:**
- `backend/HomeMan.Application/Services/IFileStorageService.cs` + `FileStorageService.cs`
- `backend/HomeMan.API/Controllers/TasksController.cs` (extend)
- `backend/HomeMan.Infrastructure/Services/LocalFileStorageService.cs`
- `nginx.conf` (add `/uploads` static file location)

**Estimated scope:** M

---

#### Task 19: Supplies API

**Description:** Implement supplies endpoints: `GET /api/rooms/{id}/supplies` (checklist for one room), `PUT /api/supplies/{id}` (update quantity/status). Supply item status derived from quantity vs threshold: `OK`, `Low`, `Out`. `GET /api/supplies/alerts` returns all items across all rooms where status is `Low` or `Out`.

**Acceptance criteria:**
- [ ] Each room has an independent supply checklist
- [ ] Status is computed (not stored): `quantity <= 0 → Out`, `quantity <= threshold → Low`, else `OK`
- [ ] `GET /api/supplies/alerts` returns a flat list of all Low/Out items with room info
- [ ] Admin can add/remove supply item types globally (`POST /api/supplies/items`)

**Verification:**
- [ ] `dotnet test` → `SupplyServiceTests` pass
- [ ] Manual: set quantity to 0, verify status shows `Out`

**Dependencies:** Task 9

**Files likely touched:**
- `backend/HomeMan.Application/Services/ISupplyService.cs` + `SupplyService.cs`
- `backend/HomeMan.Application/DTOs/SupplyDTOs.cs`
- `backend/HomeMan.API/Controllers/SuppliesController.cs`

**Estimated scope:** M

---

#### Task 20: Task list and assignment page (Admin/Staff view)

**Description:** Build `/tasks` page (Admin/Staff) with a shadcn/ui `DataTable` showing all tasks filtered by status, room, and assignee. "Assign" action opens a dropdown to pick a cleaner. Tasks created by checkout auto-appear here.

**Acceptance criteria:**
- [ ] Task list shows: room number, status badge, assigned cleaner (or "Unassigned"), created date
- [ ] Filter by status (Pending / InProgress / Done) and by room
- [ ] Assign cleaner inline via dropdown; table row updates without reload
- [ ] Clicking a task row opens a detail sheet showing any uploaded photos

**Verification:**
- [ ] `npm test` → `TasksPage.test.tsx` passes
- [ ] Manual: check out a booking, verify auto-created task appears in list

**Dependencies:** Task 17, Task 7

**Files likely touched:**
- `frontend/src/pages/TasksPage.tsx`
- `frontend/src/components/tasks/TaskTable.tsx`
- `frontend/src/components/tasks/TaskDetailSheet.tsx`
- `frontend/src/services/taskService.ts`
- `frontend/src/types/task.ts`

**Estimated scope:** M

---

#### Task 21: Cleaner task view and photo upload (mobile-optimized)

**Description:** Build the Cleaner-only `/tasks` view — a card-based list (no table) showing only assigned tasks. Each card has: room number, status, "Start" and "Complete" buttons, and a photo upload zone. Optimized for one-handed phone use.

**Acceptance criteria:**
- [ ] Only shows tasks assigned to the logged-in cleaner
- [ ] "Start" button transitions task to `InProgress`
- [ ] "Complete" requires at least 1 photo before allowing status change to `Done`
- [ ] Photo upload compresses images client-side before sending (max 5MB output)
- [ ] Uploaded photos display as thumbnails in the card immediately after upload
- [ ] Full layout works at 375px width without horizontal scroll

**Verification:**
- [ ] `npm test` → `CleanerTaskCard.test.tsx` passes
- [ ] Manual: log in as Cleaner on a phone, complete a full task with photos

**Dependencies:** Task 18, Task 20

**Files likely touched:**
- `frontend/src/pages/CleanerTasksPage.tsx`
- `frontend/src/components/tasks/CleanerTaskCard.tsx`
- `frontend/src/components/tasks/PhotoUploadZone.tsx`
- `frontend/src/utils/imageCompression.ts`

**Estimated scope:** M

---

#### Task 22: Supplies checklist page

**Description:** Build `/supplies` page with a room selector (dropdown or tab). Shows the supply checklist for the selected room. Staff can update quantities inline. Alert banner at top if any room has Low/Out items. Admin can add/remove supply item types.

**Acceptance criteria:**
- [ ] Selecting a room loads its checklist instantly (no full page reload)
- [ ] Status indicator per item: OK (green), Low (amber), Out (red)
- [ ] Quantity input is an inline number input; saves on blur
- [ ] Alert banner shows total count of Low/Out items across all rooms
- [ ] Cleaner role cannot access this page

**Verification:**
- [ ] `npm test` → `SuppliesPage.test.tsx` passes
- [ ] Manual: set a quantity to 0, verify alert banner count updates

**Dependencies:** Task 19, Task 7

**Files likely touched:**
- `frontend/src/pages/SuppliesPage.tsx`
- `frontend/src/components/supplies/SupplyChecklist.tsx`
- `frontend/src/components/supplies/SupplyAlertBanner.tsx`
- `frontend/src/services/supplyService.ts`
- `frontend/src/types/supply.ts`

**Estimated scope:** M

---

### Task 23: Navigation, sidebar, and dashboard summary

**Description:** Build the persistent sidebar navigation with role-aware menu items. Build the `/dashboard` landing page showing today's key numbers: check-ins today, check-outs today, pending tasks, supply alerts, and room status summary grid.

**Acceptance criteria:**
- [ ] Sidebar shows only pages the current role can access
- [ ] Dashboard numbers are accurate and load in < 1 second
- [ ] Active route is highlighted in the sidebar
- [ ] On mobile, sidebar collapses to a bottom nav bar
- [ ] Cleaner lands on `/tasks` after login (no dashboard access)

**Verification:**
- [ ] `npm test` → `Sidebar.test.tsx` + `DashboardPage.test.tsx` pass
- [ ] Manual: log in as each role, verify correct nav items appear

**Dependencies:** All Phase 2–5 tasks

**Files likely touched:**
- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/components/layout/BottomNav.tsx`
- `frontend/src/pages/DashboardPage.tsx`
- `backend/HomeMan.API/Controllers/DashboardController.cs`

**Estimated scope:** M

---

### ✅ Checkpoint 5 — Launch Ready

- [ ] `dotnet test` + `npm test` all pass
- [ ] `docker compose up` starts everything from scratch cleanly
- [ ] Admin can complete full booking lifecycle in under 5 minutes
- [ ] Cleaner can log in on a phone, complete a task, and upload photos
- [ ] All pages render correctly on 375px, 768px, 1280px
- [ ] No secrets in repository (check with `git log -p | grep -i secret`)
- [ ] All 5 module acceptance criteria from the spec are met
- [ ] **Final human review — ready to deploy**

---

## Parallelization Opportunities

| Can parallelize | Tasks |
|---|---|
| After Checkpoint 1 | Task 5 (User API) + Task 9 (Room API) + Task 10 (Guest API) can all start in parallel |
| After Checkpoint 2 | Task 11, 12 (frontend) can run in parallel |
| After Checkpoint 3 | Task 13, 14 are sequential; Task 19 (Supplies API) can run in parallel |
| After Task 17 | Task 18 (Photos) + Task 20 (Task UI) can run in parallel |

## Summary

| Phase | Tasks | Key Deliverable |
|---|---|---|
| 1 — Foundation | 1–4 | Runnable stack, DB schema, auth |
| 2 — Auth + Staff | 5–8 | Login works, staff management live |
| 3 — Rooms + Guests | 9–12 | Room grid and CRM usable |
| 4 — Bookings | 13–16 | Full booking lifecycle end-to-end |
| 5 — Tasks + Supplies | 17–23 | Operations fully covered, launch-ready |
