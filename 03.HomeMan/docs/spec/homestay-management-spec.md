# Spec: Homestay Management System (HomeMan)

_Version 1.0 — 2026-07-02_
_Based on: [docs/intent/homestay-management.md](../intent/homestay-management.md) · [docs/ideas/homestay-management-system.md](../ideas/homestay-management-system.md)_

---

## Objective

Build a self-hosted property management system (PMS) for a 12-room Vietnamese homestay, owned and operated by a solo developer. The system replaces manual tracking with a single source of truth covering bookings, guest records, staff tasks, and supplies.

**Users:**
| Role | Description |
|---|---|
| Admin | Owner — full access to all modules and settings |
| Co-owner | Full access identical to Admin |
| Staff | Can view/manage bookings, assign tasks, manage supplies |
| Cleaner | Can view assigned tasks, update status, upload photos |

**Success criteria:**
- [ ] All 12 rooms have a real-time status (Available / Occupied / Dirty / Clean)
- [ ] A booking can be created, checked in, and checked out without leaving the system
- [ ] A cleaning task is created automatically on checkout and assigned to a cleaner
- [ ] A cleaner can log in on a phone, complete the task, and upload photos
- [ ] Guest profile is created or linked on every booking
- [ ] Supplies checklist per room is viewable and updatable by staff
- [ ] All pages render correctly on mobile (375px), tablet (768px), and desktop (1280px)
- [ ] Role-based access is enforced — cleaners cannot access bookings or CRM

---

## Tech Stack

| Layer | Choice | Version |
|---|---|---|
| Backend framework | ASP.NET Core Web API | .NET 10 |
| Architecture | Clean Architecture — Domain / Application / Infrastructure / API | — |
| ORM | Entity Framework Core | 10.x |
| Database | PostgreSQL | 16 |
| Auth | ASP.NET Core Identity + JWT | built-in |
| Frontend framework | React + Vite | React 19 / Vite 6 |
| UI component library | shadcn/ui (Radix UI + Tailwind) | latest |
| UI styling | Tailwind CSS | v4 |
| Language | TypeScript (frontend), C# (backend) | TS 5.x / C# 13 |
| Containerization | Docker + Docker Compose | latest |
| Reverse proxy | Nginx | latest stable |
| Photo storage | VPS local disk (served via Nginx) | — |
| Locale | Vietnamese — DD/MM/YYYY, VND currency | — |

**Explicitly not using:** MediatR — services are injected directly into controllers. No CQRS bus overhead for this scale.

**Post-launch additions (not in this spec):**
- SePay payment integration
- iCal channel sync (Airbnb / Booking.com)

---

## Commands

```bash
# --- Backend ---
cd backend
dotnet build                        # Compile all projects
dotnet run --project HomeMan.API    # Start API (http://localhost:5000)
dotnet test                         # Run all tests
dotnet ef migrations add <Name> --project HomeMan.Infrastructure --startup-project HomeMan.API
dotnet ef database update --project HomeMan.Infrastructure --startup-project HomeMan.API

# --- Frontend ---
cd frontend
npm install                         # Install dependencies
npm run dev                         # Dev server (http://localhost:5173)
npm run build                       # Production build → dist/
npm run lint                        # ESLint check
npm run lint:fix                    # ESLint auto-fix
npm test                            # Vitest unit tests
npm run test:ui                     # Vitest with browser UI

# --- Docker (full stack) ---
docker compose up --build           # Build and start all services
docker compose down                 # Stop all services
docker compose logs -f api          # Tail API logs
```

---

## Project Structure

```
/
├── backend/
│   ├── HomeMan.Domain/             # Layer 1 — Entities, Value Objects, Domain Interfaces, Enums
│   │   ├── Entities/               # Pure C# classes — no EF attributes, no framework deps
│   │   ├── Enums/                  # BookingStatus, TaskStatus, RoomStatus, UserRole…
│   │   └── Interfaces/             # IRepository<T>, domain service contracts
│   ├── HomeMan.Application/        # Layer 2 — Use Cases, DTOs, Application Service Interfaces
│   │   ├── Services/               # IBookingService, ITaskService… (interfaces + implementations)
│   │   ├── DTOs/                   # Request/Response record types per domain
│   │   └── Interfaces/             # IFileStorageService, IUnitOfWork…
│   ├── HomeMan.Infrastructure/     # Layer 3 — EF Core, Repositories, File Storage
│   │   ├── Data/                   # AppDbContext, EF Core configurations, Migrations
│   │   ├── Repositories/           # Concrete IRepository<T> implementations
│   │   └── Services/               # FileStorageService, etc.
│   └── HomeMan.API/                # Layer 4 — Entry point, controllers, middleware, DI wiring
│       ├── Controllers/            # Thin controllers — call Application services directly
│       ├── Middleware/             # Global error handling, request logging
│       ├── Program.cs              # DI registration, pipeline config
│       └── appsettings.json
│
├── frontend/
│   ├── src/
│   │   ├── components/             # Reusable UI components (Button, Modal, Badge…)
│   │   ├── pages/                  # Route-level components (BookingsPage, TasksPage…)
│   │   ├── services/               # Typed API client functions
│   │   ├── hooks/                  # Custom React hooks (useBookings, useTasks…)
│   │   ├── types/                  # TypeScript interfaces mirroring backend DTOs
│   │   ├── utils/                  # Date formatting, currency, helpers
│   │   └── main.tsx
│   ├── public/
│   ├── index.html
│   └── vite.config.ts
│
├── docs/
│   ├── intent/homestay-management.md
│   ├── ideas/homestay-management-system.md
│   └── spec/homestay-management-spec.md  ← this file
│
├── uploads/                        # VPS local disk photo storage (gitignored)
├── docker-compose.yml
├── docker-compose.prod.yml
├── nginx.conf
└── README.md
```

---

## Code Style

### Backend (C#)

```csharp
// HomeMan.Domain — pure entity, no EF or framework attributes
public class Booking
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid RoomId { get; private set; }
    public Guid GuestId { get; private set; }
    public DateOnly CheckInDate { get; private set; }
    public DateOnly CheckOutDate { get; private set; }
    public BookingStatus Status { get; private set; } = BookingStatus.Pending;

    public static Booking Create(Guid roomId, Guid guestId, DateOnly checkIn, DateOnly checkOut)
    {
        if (checkOut <= checkIn) throw new DomainException("Check-out must be after check-in.");
        return new Booking { RoomId = roomId, GuestId = guestId, CheckInDate = checkIn, CheckOutDate = checkOut };
    }

    public void Confirm() => Status = BookingStatus.Confirmed;
    public void CheckIn()  => Status = BookingStatus.CheckedIn;
    public void CheckOut() => Status = BookingStatus.CheckedOut;
}

// HomeMan.Application — DTOs are record types, suffix Request/Response
public record CreateBookingRequest(Guid RoomId, Guid GuestId, DateOnly CheckInDate, DateOnly CheckOutDate);
public record BookingResponse(Guid Id, string RoomNumber, string GuestName, DateOnly CheckInDate, DateOnly CheckOutDate, string Status);

// HomeMan.Application — service interface (no MediatR — direct injection)
public interface IBookingService
{
    Task<BookingResponse> CreateAsync(CreateBookingRequest request, CancellationToken ct = default);
    Task<BookingResponse> GetByIdAsync(Guid id, CancellationToken ct = default);
}

// HomeMan.API — thin controller, delegates to Application service directly
[ApiController]
[Route("api/[controller]")]
public class BookingsController(IBookingService bookingService) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<BookingResponse>> Create(CreateBookingRequest request, CancellationToken ct)
    {
        var result = await bookingService.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }
}
```

**Conventions:**
- PascalCase: types, methods, properties
- camelCase: local variables, parameters
- `I` prefix on interfaces: `IBookingService`, `IBookingRepository`
- Async methods end in `Async`: `GetByIdAsync`, `CreateAsync`
- DTOs are `record` types, entities are `class`
- Never return domain entities directly from controllers — always use DTOs

### Frontend (TypeScript + React)

```tsx
// shadcn/ui components are imported from @/components/ui (copied into your codebase)
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Functional components — named export, typed props
interface RoomCardProps {
  room: Room;
  onStatusChange: (roomId: string, status: RoomStatus) => void;
}

export function RoomCard({ room, onStatusChange }: RoomCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <span className="text-sm font-semibold text-gray-700">{room.number}</span>
        <Badge variant={room.status === 'Available' ? 'default' : 'secondary'}>
          {room.status}
        </Badge>
      </CardHeader>
      <CardContent>
        <Button size="sm" onClick={() => onStatusChange(room.id, 'Dirty')}>Mark Dirty</Button>
      </CardContent>
    </Card>
  );
}
```

**Conventions:**
- No default exports (named exports only)
- No inline styles — Tailwind utility classes only; never mix with shadcn/ui inline styles
- shadcn/ui components live in `src/components/ui/` (owned by you, not a node_modules dependency)
- Add new shadcn/ui components via: `npx shadcn@latest add <component>`
- API calls live in `services/`, never inside components
- Types in `types/` mirror backend DTOs exactly
- `use` prefix for hooks: `useBookings`, `useRoomStatus`
- Date display: `DD/MM/YYYY` via shared `formatDate()` util
- Currency display: `formatVND(amount)` utility — always shows `₫`

---

## Testing Strategy

### Backend — xUnit + Moq

```
HomeMan.Tests/
├── Unit/
│   ├── Services/       # BookingServiceTests, TaskServiceTests…
│   └── Validators/     # Input validation tests
└── Integration/
    └── Controllers/    # HTTP-level tests with TestContainers (real PostgreSQL)
```

- Unit tests: all service-layer business logic (overlap detection, status transitions)
- Integration tests: all API endpoints — at minimum happy path + validation error
- Run with: `dotnet test`
- Coverage target: 80% on `HomeMan.Core` and `HomeMan.Infrastructure`

### Frontend — Vitest + React Testing Library

```
frontend/src/
└── __tests__/
    ├── components/     # RoomCard, StatusBadge, BookingForm…
    ├── hooks/          # useBookings, useTasks…
    └── utils/          # formatDate, formatVND…
```

- Test components for user behaviour, not implementation details
- Mock API calls via `vi.mock('./services/bookingService')`
- Run with: `npm test`

---

## Boundaries

**Always:**
- Run `dotnet test` and `npm test` before committing
- Validate all user inputs at the API boundary (FluentValidation)
- Enforce role-based access via `[Authorize(Roles = "...")]` on every protected endpoint
- Use parameterised queries (EF Core) — never raw SQL string interpolation
- Store uploaded files outside the web root; serve via dedicated `/uploads` Nginx route
- Use `DateOnly` for calendar dates, `DateTimeOffset` for timestamps

**Ask first:**
- Adding a new NuGet or npm package
- Changing the database schema after the first migration
- Modifying the JWT token payload or expiry
- Adding a new user role
- Changing the file upload storage location or naming convention

**Never:**
- Commit secrets, connection strings, or JWT keys — use environment variables / `.env` (gitignored)
- Return stack traces or internal error messages to API clients in production
- Allow a Cleaner role to access any endpoint outside `/api/tasks` and `/api/uploads`
- Delete photos from disk via the API without soft-deleting the database record first
- Bypass role checks with hardcoded user ID comparisons

---

## Module Acceptance Criteria

### 1. Bookings
- [ ] Create a booking with room, guest, check-in date, check-out date
- [ ] System rejects overlapping bookings for the same room
- [ ] Booking status transitions: `Pending → Confirmed → CheckedIn → CheckedOut → Cancelled`
- [ ] Check-out automatically creates a cleaning task assigned to the default cleaner (or unassigned)
- [ ] Calendar view shows all rooms with occupancy for a given month

### 2. CRM (Guest Management)
- [ ] Create a guest profile: name, phone, ID number, nationality, notes
- [ ] Search guests by name or phone
- [ ] Guest profile shows full stay history
- [ ] Booking creation links to an existing guest or creates a new one inline

### 3. Staff Management
- [ ] Admin/Co-owner can create user accounts with role assignment
- [ ] Roles: Admin, Co-owner, Staff, Cleaner
- [ ] Admin/Co-owner can deactivate accounts (soft delete — user cannot log in)
- [ ] User list with role filter

### 4. Task Workflow
- [ ] Tasks have: room, assigned user, status (Pending / InProgress / Done), due date, notes, photos
- [ ] Cleaner sees only their assigned tasks on login
- [ ] Cleaner can update status and upload up to 10 photos per task
- [ ] Photos are stored on VPS disk at `/uploads/tasks/{taskId}/`
- [ ] Admin/Staff can view all tasks filtered by room, status, or assignee

### 5. Supplies
- [ ] Per-room checklist of consumable items (configurable by admin)
- [ ] Each checklist item has: name, quantity, restock threshold, current status (OK / Low / Out)
- [ ] Staff can update quantity after restocking
- [ ] Dashboard shows all rooms with at least one item in Low/Out status

---

## Open Questions

- [ ] **VPS provider:** Hetzner (Helsinki/Singapore) or DigitalOcean? Singapore region recommended for lower latency from Vietnam
- [ ] **Domain + SSL:** Will you use a custom domain? Nginx + Let's Encrypt (Certbot) assumed
- [ ] **Email/SMS notifications:** Should cleaners receive a notification (email or Zalo webhook) when a task is assigned?
- [ ] **Backup strategy:** Automated daily PostgreSQL dumps — to VPS local disk or offsite (Cloudflare R2 / Backblaze)?
- [ ] **Default language:** Vietnamese UI or English UI? (affects all label/copy work)

---

## Success Definition (Launch-Ready)

The system is ready to launch when:
1. All 5 module acceptance criteria above pass
2. Admin can log in, create a booking, check in a guest, assign a cleaning task, and confirm task completion end-to-end in under 5 minutes
3. A cleaner can log in on a smartphone, complete a task, and upload photos without layout issues
4. The application starts cleanly from `docker compose up` on a fresh VPS with only Docker installed
5. No secrets are committed to the repository
