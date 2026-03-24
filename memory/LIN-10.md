# LIN-10 — Build an exact Trello clone.

## Spec
_2026-03-24T00:00:00Z_

### Problem Statement
Teams need a visual, kanban-style project management tool to organise tasks across customisable boards, lists, and cards. This ticket delivers a fully functional Trello clone so users can plan and track work without relying on a third-party subscription.

### Proposed Solution
Build a web application that replicates Trello's core experience: authenticated users can create boards, add lists to a board, and create cards within those lists. Cards can be opened to reveal a detail view where users can add a description, labels, a due date, a checklist, and comments. Lists and cards are reorderable via drag-and-drop. Boards can be shared with other workspace members.

### Acceptance Criteria
1. A user can register with an email and password and log in / log out.
2. A logged-in user can create a new board with a title and background colour.
3. A logged-in user can view a list of all boards they own or are a member of.
4. A user can add one or more named lists to a board.
5. A user can add a card (with at minimum a title) to any list on a board.
6. A user can drag a card from one list to another list on the same board; the new position persists on reload.
7. A user can reorder lists on a board via drag-and-drop; the new order persists on reload.
8. A user can open a card detail modal and add/edit: description (rich or plain text), due date, at least one colour label, and a checklist with individually completable items.
9. A user can add a comment to a card; comments are displayed in chronological order with author and timestamp.
10. A user can archive (soft-delete) a card; archived cards do not appear on the board.
11. A user can archive a list; archived lists do not appear on the board.
12. A board owner can invite another registered user to a board by email; the invitee then sees the board in their board list.
13. All board state (lists, cards, order, card content) is persisted in a database and survives a server restart.
14. The UI is responsive and usable on viewport widths ≥ 375 px.

### Out of Scope
- Power-Ups / integrations (Slack, GitHub, etc.)
- Calendar view, Timeline/Gantt view, Dashboard view
- Card attachments (file uploads)
- Card cover images
- Custom fields
- Board templates
- Activity log at the board level
- Email / push notifications
- OAuth social login (Google, GitHub, etc.)
- Mobile native apps
- Offline support / service workers
- Billing or subscription management

### Open Questions
- **Auth provider**: Should the app use its own credential-based auth (e.g. NextAuth credentials) or is an external auth service (Clerk, Auth0) acceptable?
- **Real-time updates**: Should changes made by one board member appear live for other members (WebSockets/SSE), or is a page-refresh sufficient for the MVP?
- **Deployment target**: Where will this be hosted (Vercel, AWS, self-hosted Docker)? This may influence the database choice (SQLite vs Postgres).
- **Design fidelity**: Should the UI match Trello's exact visual design (colours, icons, typography), or is a "Trello-inspired" design acceptable?

## Architecture Decision
_2026-03-24T01:00:00Z_

### Approach

**Framework**: Next.js 14 (App Router) + TypeScript + Tailwind CSS, bootstrapped with `create-next-app`. The project root is `app/` (already established by the factory). The `src/` convention is used for all source files.

**Auth**: NextAuth.js v5 (Auth.js) with the built-in `Credentials` provider. Users register with an email + bcrypt-hashed password stored in SQLite. JWT sessions are persisted in a secure, httpOnly cookie. This answers the open question — no external auth service is required for the MVP.

**Database**: SQLite via Prisma ORM (`prisma` + `@prisma/client`). SQLite is a single-file database that survives server restarts, is zero-config, and is fully supported on Railway. Prisma provides type-safe queries and first-class migration tooling. This answers the deployment/database open question.

**Drag-and-drop**: `@hello-pangea/dnd` (actively maintained fork of `react-beautiful-dnd`). Provides `<DragDropContext>`, `<Droppable>`, and `<Draggable>` — one API for both card-within-list reordering and cross-list card movement, as well as list reordering. All state is managed client-side during a drag; on `onDragEnd` a PATCH API call persists the new `position` string.

**Ordering strategy**: Fractional indexing (`fractional-indexing` package) produces lexicographic position strings (e.g. `"a0"`, `"a1"`, `"a2"`). Only the moved item's `position` field needs updating — no mass-renumbering. Both `List.position` and `Card.position` use this strategy.

**API layer**: REST API routes under `src/app/api/`. All routes use the NextAuth `getServerSession` helper to verify the caller's identity and confirm board membership before any data access. Input validated with `zod` schemas.

**Card detail**: Full-screen modal rendered client-side using `@radix-ui/react-dialog`. Opened via URL state (query parameter `cardId`) so the board URL remains shareable without a nested route segment.

**Real-time**: Not required for MVP; SWR (`useSWR`) provides optimistic local updates and background revalidation for the same browser session. Page-refresh reflects all persisted state (AC 13).

**Responsive layout**: Board canvas uses horizontal scroll (`overflow-x-auto`) on small viewports. Tailwind breakpoints keep the card columns readable at ≥ 375 px (AC 14).

**Data flow summary**:
1. User authenticates → NextAuth issues JWT session cookie.
2. Server Components fetch initial board/list/card data directly via Prisma (no extra round-trip).
3. Client Components (board canvas, modals) use `useSWR` + fetch for mutations (POST/PATCH/DELETE) and cache invalidation.
4. Drag-and-drop events call PATCH endpoints to persist new `position` values.

---

### Alternatives Considered

- **Supabase (Postgres + Auth + Realtime)**: Rejected because it introduces an external managed service, complicates local development, and adds cost — the spec explicitly defers real-time and the MVP can run entirely self-hosted.
- **Drizzle ORM instead of Prisma**: Rejected because Prisma has a more mature migration workflow (`prisma migrate dev`) and generates a type-safe client automatically, reducing boilerplate for the Dev Agent.
- **dnd-kit instead of @hello-pangea/dnd**: Rejected because dnd-kit requires more manual composition for a pure kanban layout; `@hello-pangea/dnd` has a simpler, purpose-built API and is the direct successor of the industry-standard `react-beautiful-dnd`.
- **Server Actions instead of REST API routes**: Rejected because drag-and-drop position updates are fired from deep client components that already hold local state — REST API calls from those components are cleaner and independently testable.
- **Remix instead of Next.js**: Rejected because the factory's CLAUDE.md mandates Next.js + Tailwind.

---

### Constraints

- **Auth on every API route**: All `src/app/api/**` handlers must call `getServerSession(authOptions)` and return `401` if unauthenticated; board-scoped routes must also verify the caller is the board owner or a member.
- **Password hashing**: `bcryptjs` with cost factor 12.
- **SQL injection / XSS**: Prisma parameterised queries prevent SQL injection; React escapes JSX by default; rich-text description stored as plain text (no `dangerouslySetInnerHTML`).
- **CSRF**: NextAuth manages CSRF for auth endpoints; REST mutations rely on the `SameSite=Lax` cookie and `Content-Type: application/json` header check.
- **Input validation**: All POST/PATCH bodies validated with `zod` before touching Prisma — return `400` on failure.
- **Ordering uniqueness**: `fractional-indexing` may produce identical keys under concurrent writes; single-user boards make this negligible for MVP; handle gracefully by re-keying on the client if duplicates are detected.
- **SQLite concurrency**: SQLite uses file-level locking; sufficient for a low-concurrency MVP but noted as a future migration point to Postgres.

---

### Files Affected

#### Project bootstrap & config
- `app/package.json` — new; Next.js project manifest with all dependencies
- `app/next.config.ts` — new; minimal Next.js config
- `app/tsconfig.json` — new; TypeScript config (strict mode, path aliases)
- `app/tailwind.config.ts` — new; Tailwind config with custom Trello-palette colours
- `app/postcss.config.ts` — new; PostCSS config for Tailwind
- `app/.env.example` — new; documents required env vars (`DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`)

#### Database
- `app/prisma/schema.prisma` — new; Prisma schema (models: `User`, `Board`, `BoardMember`, `List`, `Card`, `Label`, `ChecklistItem`, `Comment`)

#### NextAuth
- `app/src/app/api/auth/[...nextauth]/route.ts` — new; NextAuth v5 App Router handler
- `app/src/lib/auth.ts` — new; `authOptions` (Credentials provider, JWT strategy, Prisma adapter callbacks)

#### Pages (App Router)
- `app/src/app/layout.tsx` — new; root layout with `SessionProvider`, global CSS
- `app/src/app/globals.css` — new; Tailwind base + component imports
- `app/src/app/page.tsx` — new; redirects to `/boards` if authenticated, else `/login`
- `app/src/app/(auth)/login/page.tsx` — new; login form (AC 1)
- `app/src/app/(auth)/register/page.tsx` — new; registration form (AC 1)
- `app/src/app/boards/page.tsx` — new; board list page (AC 3)
- `app/src/app/boards/new/page.tsx` — new; create-board form with title + bg-colour picker (AC 2)
- `app/src/app/boards/[boardId]/page.tsx` — new; board canvas: lists + cards + DnD (AC 4–7, 10–11)
- `app/src/app/boards/[boardId]/settings/page.tsx` — new; invite member by email (AC 12)

#### API routes
- `app/src/app/api/boards/route.ts` — new; `GET` all boards for user; `POST` create board
- `app/src/app/api/boards/[boardId]/route.ts` — new; `GET` single board; `PATCH` update; `DELETE` archive
- `app/src/app/api/boards/[boardId]/members/route.ts` — new; `POST` invite member by email (AC 12)
- `app/src/app/api/boards/[boardId]/lists/route.ts` — new; `GET` lists; `POST` create list
- `app/src/app/api/boards/[boardId]/lists/[listId]/route.ts` — new; `PATCH` update (title, position, archive); `DELETE`
- `app/src/app/api/boards/[boardId]/lists/[listId]/cards/route.ts` — new; `GET` cards; `POST` create card
- `app/src/app/api/boards/[boardId]/cards/[cardId]/route.ts` — new; `GET` card detail; `PATCH` (title, desc, dueDate, position, listId, archived)
- `app/src/app/api/boards/[boardId]/cards/[cardId]/labels/route.ts` — new; `GET`/`POST`/`DELETE` colour labels (AC 8)
- `app/src/app/api/boards/[boardId]/cards/[cardId]/checklist/route.ts` — new; `GET`/`POST` checklist items; `PATCH` item completion (AC 8)
- `app/src/app/api/boards/[boardId]/cards/[cardId]/comments/route.ts` — new; `GET`/`POST` comments (AC 9)
- `app/src/app/api/register/route.ts` — new; `POST` create new user (AC 1)

#### Components — Board
- `app/src/components/board/BoardCanvas.tsx` — new; `<DragDropContext>` root; handles `onDragEnd` for lists and cards; renders `<ListColumn>` per list
- `app/src/components/board/ListColumn.tsx` — new; `<Droppable>` column; renders `<CardItem>` per card; contains `<AddCardForm>`; archive list button
- `app/src/components/board/CardItem.tsx` — new; `<Draggable>` card chip; shows title + label dots + due-date badge; opens `<CardModal>` on click
- `app/src/components/board/AddListForm.tsx` — new; inline "Add a list" form with title input (AC 4)
- `app/src/components/board/AddCardForm.tsx` — new; inline "Add a card" form with title input (AC 5)

#### Components — Card detail
- `app/src/components/card/CardModal.tsx` — new; Radix `<Dialog>` wrapper; composes all card sub-components; handles open/close via `?cardId=` query param
- `app/src/components/card/CardDescription.tsx` — new; plain-text textarea with edit/save toggle (AC 8)
- `app/src/components/card/CardLabels.tsx` — new; label colour swatch picker, add/remove labels (AC 8)
- `app/src/components/card/CardDueDate.tsx` — new; date `<input type="date">` with save (AC 8)
- `app/src/components/card/CardChecklist.tsx` — new; checklist items with checkboxes, add item form (AC 8)
- `app/src/components/card/CardComments.tsx` — new; comment list + add-comment form; sorted ascending by `createdAt` (AC 9)

#### Components — UI primitives
- `app/src/components/ui/Button.tsx` — new; styled button variants (primary, ghost, danger)
- `app/src/components/ui/Input.tsx` — new; styled text input
- `app/src/components/ui/Modal.tsx` — new; thin Radix Dialog wrapper for reuse
- `app/src/components/ui/ColorPicker.tsx` — new; grid of preset colour swatches (used for board bg and card labels)

#### Components — Layout
- `app/src/components/layout/Header.tsx` — new; top nav with logo, user email, logout button
- `app/src/components/layout/BoardHeader.tsx` — new; board title + background colour + settings link

#### Library / utilities
- `app/src/lib/db.ts` — new; Prisma client singleton (avoids hot-reload connection leaks in dev)
- `app/src/lib/auth.ts` — new; NextAuth `authOptions`: Credentials provider, bcrypt verify, JWT callbacks, session shape
- `app/src/lib/ordering.ts` — new; `generateKeyBetween` wrapper from `fractional-indexing`; helpers `getInitialPosition`, `getPositionBetween`
- `app/src/lib/validations.ts` — new; Zod schemas: `CreateBoardSchema`, `CreateListSchema`, `CreateCardSchema`, `UpdateCardSchema`, `CreateCommentSchema`, `InviteMemberSchema`

#### Types
- `app/src/types/index.ts` — new; shared TypeScript interfaces (`BoardWithMembers`, `ListWithCards`, `CardDetail`, `CommentWithAuthor`, etc.) derived from Prisma generated types

---

### Dependencies

```
Production
├── next@14                    — Next.js framework (App Router)
├── react@18 + react-dom@18    — React
├── next-auth@5                — Authentication (JWT + Credentials)
├── @auth/prisma-adapter       — Prisma adapter for NextAuth session store (optional but keeps user data in one DB)
├── @prisma/client             — Prisma query client (generated from schema)
├── bcryptjs                   — Password hashing (pure JS, no native bindings needed on Railway)
├── zod                        — Runtime input validation for all API routes
├── @hello-pangea/dnd          — Drag-and-drop for lists and cards
├── fractional-indexing        — Lexicographic position strings for stable ordering
├── @radix-ui/react-dialog     — Accessible modal primitive for card detail
├── @radix-ui/react-popover    — Popover primitive for label/date pickers
├── lucide-react               — Icon set (Trello-compatible visual language)
└── date-fns                   — Due-date formatting (lightweight, tree-shakeable)

Development
├── prisma                     — Prisma CLI (migrations, schema push, codegen)
├── typescript                 — TypeScript compiler
├── tailwindcss                — Utility CSS
├── postcss + autoprefixer     — CSS processing
├── @types/react + @types/node — Type declarations
└── @types/bcryptjs            — bcryptjs type declarations
```

## Implementation
_2026-03-24T20:15:00Z_

### Branch
`LIN-10/implementation`

### PR
[https://github.com/ashtilawat/minimum-viable-factory/pull/2](https://github.com/ashtilawat/minimum-viable-factory/pull/2)

### Changes
- `app/layout.tsx` — Root layout with SessionProvider and Inter font
- `app/globals.css` — Tailwind base imports
- `app/page.tsx` — Root redirect: authenticated → /boards, anonymous → /login
- `app/(auth)/login/page.tsx` — Login form using NextAuth credentials
- `app/(auth)/register/page.tsx` — Registration form posting to /api/register
- `app/boards/page.tsx` — Server-rendered board list page
- `app/boards/new/page.tsx` — Create board form with colour picker
- `app/boards/[boardId]/page.tsx` — Board canvas page with DnD and CardModal
- `app/boards/[boardId]/settings/page.tsx` — Board settings/members page
- `app/api/auth/[...nextauth]/route.ts` — NextAuth handler
- `app/api/register/route.ts` — User registration endpoint
- `app/api/boards/route.ts` — List and create boards
- `app/api/boards/[boardId]/route.ts` — Get, update, archive board
- `app/api/boards/[boardId]/members/route.ts` — List and invite board members
- `app/api/boards/[boardId]/lists/route.ts` — List and create lists
- `app/api/boards/[boardId]/lists/[listId]/route.ts` — Update/archive list
- `app/api/boards/[boardId]/lists/[listId]/cards/route.ts` — List and create cards
- `app/api/boards/[boardId]/cards/[cardId]/route.ts` — Get, update card (position, listId, archive)
- `app/api/boards/[boardId]/cards/[cardId]/labels/route.ts` — CRUD labels
- `app/api/boards/[boardId]/cards/[cardId]/checklist/route.ts` — CRUD checklist items
- `app/api/boards/[boardId]/cards/[cardId]/comments/route.ts` — Create and list comments
- `src/components/board/BoardCanvas.tsx` — DragDropContext root; handles onDragEnd for lists and cards
- `src/components/board/ListColumn.tsx` — Droppable list column with archive button
- `src/components/board/CardItem.tsx` — Draggable card chip with label dots and badges
- `src/components/board/AddListForm.tsx` — Inline add-list form
- `src/components/board/AddCardForm.tsx` — Inline add-card textarea
- `src/components/board/InviteMemberForm.tsx` — Invite member by email form
- `src/components/card/CardModal.tsx` — Full card detail modal (Radix Dialog, ?cardId= URL param)
- `src/components/card/CardDescription.tsx` — Click-to-edit description textarea
- `src/components/card/CardLabels.tsx` — Label colour swatch picker with add/remove
- `src/components/card/CardDueDate.tsx` — Date picker with overdue styling
- `src/components/card/CardChecklist.tsx` — Checklist with progress bar and item CRUD
- `src/components/card/CardComments.tsx` — Comment thread with author avatar and timestamps
- `src/components/ui/Button.tsx` — Styled button with primary/ghost/danger/secondary variants
- `src/components/ui/Input.tsx` — Styled text input with label and error props
- `src/components/ui/Modal.tsx` — Thin Radix Dialog wrapper
- `src/components/ui/ColorPicker.tsx` — Preset colour swatch grid
- `src/components/layout/Header.tsx` — Top nav with logo and sign-out
- `src/components/layout/BoardHeader.tsx` — Board title bar with settings link
- `src/lib/db.ts` — Prisma client singleton
- `src/lib/auth.ts` — NextAuth v5 config with Credentials provider and JWT callbacks
- `src/lib/ordering.ts` — Fractional indexing helpers (getPositionBetween, getPositionAfter)
- `src/lib/validations.ts` — Zod schemas for all entities
- `src/lib/utils.ts` — cn() class utility
- `src/middleware.ts` — NextAuth auth middleware for route protection
- `src/types/index.ts` — Shared TypeScript interfaces derived from Prisma types
- `prisma/schema.prisma` — Prisma schema: User, Board, BoardMember, List, Card, Label, ChecklistItem, Comment
- `package.json` — All dependencies including next-auth@5 beta, @hello-pangea/dnd, fractional-indexing@3.x
- `next.config.mjs` — Minimal Next.js config (note: .mjs not .ts — Next.js 14 requires this)
- `tsconfig.json` — Strict TypeScript with @/* → ./src/* path alias
- `tailwind.config.ts` — Tailwind with custom trello colour palette
- `postcss.config.ts` — PostCSS for Tailwind
- `.env.example` — Template for DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL
- `.gitignore` — Excludes node_modules, .next, .env, database files

### Notes
**Key architectural deviation from spec**: App Router pages are in the root `app/` directory (not `src/app/`) because the factory scaffold pre-created a root-level `app/` directory that Next.js 14 unconditionally prefers over `src/app/`. All components and libraries remain in `src/` with `@/*` path aliases mapping to `./src/*`.

**next.config.mjs**: Next.js 14.2.29 does not support `next.config.ts` — must use `.mjs` or `.js`.

**fractional-indexing**: Version `^3.2.0` used (spec listed `^0.3.0` which doesn't exist on npm). API is identical.

**CardModal placement**: Embedded inside `BoardCanvas` (a client component) rather than rendered in the server page, to allow the archive action to call the `refresh()` callback without passing functions from server to client components.

**JWT-only sessions**: No `@auth/prisma-adapter` session table is used — sessions are JWT-only, keeping the DB schema lean. The `@auth/prisma-adapter` package is installed but not wired in `authOptions`.

**Build passes**: `npm run build` exits 0 with all 20 App Router routes compiled as dynamic (ƒ).

**First-deploy steps**: `npm run db:push` to create the SQLite schema; set `NEXTAUTH_SECRET` to a strong random value.

## Code Review
_pending_

## Test Results
_pending_

## Deploy Log
_pending_
