# Laikipia East TVC — Internal Quality Assurance (IQA) Management System
## Technical Architecture

## 1. System Summary

A role-based web application that routes Learning Plans and Session Plans through a fixed
four-stage approval chain — **Trainer → HOD → IQA Officer → Deputy Principal Academics** —
while structurally preventing any user from reviewing or verifying a document they
personally submitted, even when that user also holds a reviewing role.

## 2. Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 18 (Vite) + TypeScript-ready JS, Tailwind CSS, React Router, TanStack Query, React Hook Form | Matches spec; fast dev loop, good data-fetching caching for dashboards |
| Backend | Node.js + Express.js | Matches spec; simple to reason about for a workflow-heavy CRUD app |
| Auth | **Firebase Authentication** (email/password), verified server-side with the Firebase Admin SDK | Offloads credential storage, password reset emails, and session/token refresh to a managed identity provider instead of hand-rolling bcrypt + JWT + refresh-token rotation |
| ORM / DB | Prisma + **Supabase Postgres** | Prisma gives us schema-as-code, migrations, and type-safe queries which materially reduces bugs in the conflict-of-interest logic; Supabase is just managed Postgres here — see §2.1 for why RBAC/role-and-workflow logic stays in the Express API rather than in Supabase's own client SDK or Row Level Security |
| File storage | Local disk in dev via `/uploads`, pluggable adapter for Supabase Storage in prod | Keeps local dev simple; swap via `services/storage.js`. (Supabase Storage is a natural fit alongside Supabase Postgres, and is one of the two options the original spec named.) |
| PDF | pdf-lib (stamping signatures/QR/watermark), pdfkit (report PDFs), pdf.js (frontend preview) | Matches spec |
| Email | Nodemailer for system notifications; Firebase Auth's own email sender for password-reset links | Matches spec for notification emails; password reset is a Firebase-owned flow so it uses Firebase's delivery, not Nodemailer |
| Charts | Recharts | Matches spec |

### 2.1 Identity architecture: Firebase Auth + Supabase Postgres, deliberately split

Identity (who can log in, and with what credential) and profile/authorization data (what
role they hold, which department, whether they're a conflicted reviewer for a given
document) live in two different stores on purpose, joined by one column:

- **Firebase Authentication** owns email/password sign-in, session/ID-token issuance and
  refresh, and the password-reset email flow. The Express backend never sees or stores a
  password — it only ever verifies a short-lived ID token via the Firebase Admin SDK
  (`config/firebaseAdmin.js`).
- **Supabase Postgres** (via Prisma) owns everything Firebase has no concept of: a user's
  `systemRole`, their `DepartmentAssignment` rows (HOD/IQA/DP of which department), their
  documents, reviews, and the entire conflict-of-interest/workflow engine in §4–§6.
- The two are linked by `User.firebaseUid`, a unique column set once at account creation
  (`userController.js::createUser` creates the Firebase Auth account *and* the Postgres
  row together, rolling back the Firebase side if the Postgres write fails, so the two
  never drift into a login with no profile — see that function's comments).

This split is intentional rather than a limitation of using Supabase: the
conflict-of-interest rule requires transactional, relational logic (exclude the uploader
from a capability-scoped candidate pool, fall back to an acting reviewer, enforce a
five-state-plus workflow transition table) that is far more legible and testable as
explicit Prisma/TypeScript logic in `services/reviewerAssignment.js` and
`services/workflowEngine.js` than as a set of Postgres Row Level Security policies. RLS is
a fine tool for "can this row be read/written by this user" but this spec's hardest
requirement is closer to a small state machine than a row-level permission — so Supabase
is used here as managed Postgres + (optionally) file storage, not as the app's API layer.

`middleware/auth.js::requireAuth` is the single point where a verified Firebase identity
is turned into a trusted Postgres `req.user` — every other permission check in the app
(RBAC in §6, the conflict-of-interest gate in §4.3) reads from that, never from the
Firebase token directly.

## 3. Core Domain Model (see `backend/prisma/schema.prisma`)

- **User** — one row per person. Has a base `Role` enum but roles are really *capabilities*;
  see §4. A user can simultaneously be a Trainer, HOD of a department, and/or IQA Officer.
- **Department**
- **DepartmentAssignment** — join table: which users are HOD / IQA Officer / DP for which
  department(s). This is what makes "HODs and IQA Officers are also Trainers" fall out
  naturally: a user's *capabilities* are derived from their assignments, not from a single
  fixed role column.
- **Document** — a Learning Plan or Session Plan, owned by an `uploaderId`.
- **DocumentVersion** — every replace/re-upload creates a new version (audit trail + version history requirement).
- **ReviewAssignment** — one row per stage per document (HOD_REVIEW, IQA_REVIEW,
  DP_VERIFICATION). Has `assigneeId`. This is the single most important table: **the
  assignee is never resolved to the document owner.**
- **AuditLog** — append-only record of every state-changing action.
- **SignatureAsset** — transparent PNG signature/stamp per reviewer, versioned.

## 4. The Conflict-of-Interest Engine (the heart of the spec)

This is implemented as a single, mandatory, server-side gate — **never** a client-side
UI decision — so it can't be bypassed by calling the API directly.

### 4.1 Capability resolution
`services/capabilities.js` computes, for a given user, the set of departments where they
act as HOD, IQA Officer, or DP, independent of what they uploaded. A user's Trainer
capability is universal (everyone can upload).

### 4.2 Reviewer pool resolution
`services/reviewerAssignment.js::resolveReviewer(document, stage)`:

1. Look up all users with the required capability for the document's department
   (e.g. all HODs of "ICT").
2. **Exclude `document.uploaderId` from the pool.**
3. If the pool is non-empty, apply workload balancing (least-open-assignments-first) and
   assign.
4. If the pool is empty (e.g. sole HOD is also the uploader), fall back to the
   Administrator-configured **alternate/acting reviewer** for that department
   (`DepartmentAssignment.isActing = true`) or, failing that, flag the document as
   `NEEDS_ADMIN_ASSIGNMENT` and notify the Administrator — the workflow will not silently
   assign the uploader to themselves under any circumstance.

This same function is reused for HOD, IQA, and DP stages — one code path, one place to
audit, rather than three parallel implementations that could drift out of sync.

### 4.3 Defense in depth
Even though assignment never targets the uploader, every review/approve/reject/comment
endpoint additionally re-checks `assignment.assigneeId === req.user.id &&
document.uploaderId !== req.user.id` before allowing the action — so even a corrupted
assignment or a direct API call cannot let someone approve their own document.

### 4.4 Frontend reflection of the rule
The frontend never independently decides "can I review this" — it renders based on flags
(`canReview: boolean`, `isOwnDocument: boolean`) returned by the API. If `isOwnDocument`
is true, the UI shows *"You cannot review your own document — it has been routed to
[Reviewer Name]."* instead of action buttons. The backend is the source of truth; the
frontend just reflects it.

## 5. Workflow State Machine

```
DRAFT
  -> PENDING_HOD_REVIEW            (on submit)
PENDING_HOD_REVIEW
  -> RETURNED_BY_HOD                (HOD returns)
  -> PENDING_IQA_REVIEW             (HOD approves)
RETURNED_BY_HOD
  -> PENDING_HOD_REVIEW             (trainer resubmits)
PENDING_IQA_REVIEW
  -> RETURNED_BY_IQA                (IQA returns)
  -> PENDING_DP_VERIFICATION        (IQA approves; signature/stamp appended)
RETURNED_BY_IQA
  -> PENDING_IQA_REVIEW             (trainer resubmits)
PENDING_DP_VERIFICATION
  -> RETURNED_BY_DP                 (DP returns)
  -> APPROVED                       (DP verifies; signature/stamp appended)
RETURNED_BY_DP
  -> PENDING_DP_VERIFICATION        (trainer resubmits)
APPROVED
  -> ARCHIVED                       (end of academic year / semester close-out)
```

Implemented as an explicit transition table in `services/workflowEngine.js`
(`ALLOWED_TRANSITIONS`), not scattered `if` statements — so "a document cannot skip a
stage" is enforced by a single lookup, not by convention.

## 6. RBAC Model

Permissions are capability-based, not role-column-based:

| Capability | Granted by |
|---|---|
| `trainer:upload`, `trainer:view_own` | Every authenticated non-admin user |
| `hod:review:{departmentId}` | `DepartmentAssignment(role=HOD)` |
| `iqa:review:{departmentId}` | `DepartmentAssignment(role=IQA_OFFICER)` |
| `dp:verify` | `DepartmentAssignment(role=DP_ACADEMICS)` (college-wide or per-department per config) |
| `admin:*` | `User.systemRole = ADMIN` |

`middleware/rbac.js` exposes `requireCapability('hod:review')` which additionally loads
the target document and calls the conflict-of-interest check in §4.3 before allowing
mutation routes.

## 7. API Surface (high level — see backend routes for full list)

```
GET    /api/auth/me                        (returns Postgres profile + capabilities for the verified Firebase user)
POST   /api/auth/complete-password-change  (flips mustChangePassword after a successful Firebase updatePassword())
```
Login, logout, session refresh, "forgot password" emails, and the password reset itself
are handled client-side by the Firebase Auth SDK (`frontend/src/api/AuthContext.jsx`) —
they're not Express routes at all anymore.

```
GET    /api/users            (admin)
POST   /api/users            (admin)
PATCH  /api/users/:id        (admin)
POST   /api/users/:id/reset-password (admin)
POST   /api/users/:id/signature       (admin, on behalf of any user — "Administrator can update them anytime")
POST   /api/users/:id/stamp           (admin, on behalf of any user)
POST   /api/users/bulk-import (admin, CSV/XLSX)
GET    /api/users/:id/reviewer-assignment   (admin — a trainer's explicit HOD/IQA reviewer, if set)
POST   /api/users/:id/reviewer-assignment   (admin — set a trainer's explicit HOD/IQA reviewer)

GET    /api/users/me                  (own full profile: roles, department assignments, signature/stamp assets)
PATCH  /api/users/me                  (edit own phone/designation)
POST   /api/users/me/photo            (profile photo, PNG/JPEG)
POST   /api/users/me/signature        (transparent PNG — appended to every document you upload or approve)
POST   /api/users/me/stamp            (transparent PNG — reviewer's official stamp)
GET    /api/users/directory           (any signed-in user — minimal name/dept/role listing for filter dropdowns)
GET    /api/users/:id                 (colleague lookup — e.g. "who uploaded this document"; full record only for admin/self)
GET    /api/users/:id/photo
GET    /api/users/signature-assets/:assetId/file

GET    /api/departments
POST   /api/departments
POST   /api/departments/:id/assignments   (admin: assign HOD/IQA/DP/acting reviewer)

POST   /api/documents                     (trainer upload — immediately stamped "Submitted by")
GET    /api/documents/mine
GET    /api/documents/approved            (DP/admin only — filterable by department, trainer, or IQA officer)
GET    /api/documents/:id                 (any authorized stakeholder — see userCanAccessDocument in §9)
POST   /api/documents/:id/versions        (replace file)
GET    /api/documents/:id/download        (any authorized stakeholder, at any stage)
GET    /api/documents/:id/preview         (same access rule, streamed inline for in-browser viewing)

GET    /api/reviews/queue                 (documents assigned to me, excludes own uploads by construction)
GET    /api/reviews/history                (documents I've already decided on — approved/rejected/returned, filterable)
POST   /api/reviews/:assignmentId/approve
POST   /api/reviews/:assignmentId/reject
POST   /api/reviews/:assignmentId/return
POST   /api/reviews/:assignmentId/comment

GET    /api/documents/:id/messages         (per-document discussion thread — same access rule as preview/download)
POST   /api/documents/:id/messages         (chat with reviewers, or reply to a comment — same thread either way)

GET    /api/notifications/mine
POST   /api/notifications/:id/read
POST   /api/notifications/mark-all-read
POST   /api/notifications/broadcast        (Administrator or DP Academics only — audience: ALL/TRAINERS/HOD/IQA/DP)

GET    /api/reports/...
GET    /api/verify/:verificationNumber    (public QR landing page)
```

## 8. Security Checklist Mapping

- Authentication — Firebase Authentication (email/password); ID tokens verified server-side via the Firebase Admin SDK in `middleware/auth.js`. No password ever touches this backend or Postgres.
- RBAC — `middleware/auth.js::requireAdmin` + capability checks derived from `DepartmentAssignment` (see §6)
- CSRF — not applicable in the same way as the old cookie-based session: auth now travels as an `Authorization: Bearer <token>` header, which (unlike cookies) isn't automatically attached by the browser to cross-site requests, removing the main CSRF vector this app had
- XSS — React auto-escaping + `helmet` CSP headers on the API
- SQLi — Prisma parameterized queries only, no raw SQL in request paths
- Audit trail — `AuditLog` row written by a single `logAudit()` helper called from every controller mutation
- Backups — documented as a nightly `pg_dump` cron in deployment notes, or Supabase's own built-in daily backups depending on plan (infra-level, outside app code)
- Virus scanning — upload pipeline has a `scanFile()` hook (ClamAV integration point) that runs before a file is persisted; stubbed as pass-through in dev

## 9. What's fully implemented in this scaffold vs. stubbed

**Fully implemented (core, novel logic):**
- Auth (Firebase Authentication sign-in/reset, Admin-SDK token verification, forced password change tracked in Postgres)
- User + Department + DepartmentAssignment CRUD (admin), with matching Firebase Auth account lifecycle (create/disable/enable/reset alongside the Postgres profile)
- Explicit Trainer -> HOD / Trainer -> IQA reviewer assignment (`TrainerReviewerAssignment`), set by the Administrator per trainer; `reviewerAssignment.js` checks this first and only falls back to the department-wide capability pool if nothing's been explicitly assigned yet. A trainer with no department capability at all is, by construction, an upload-only account that can never review anything.
- User profiles — self-service view/edit, profile photo, and signature upload for every user (needed for the trainer's own submission stamp); official stamp upload is limited to HOD/IQA/DP capability holders. Administrator can also set a signature/stamp on behalf of any user. Every account (whether created by the Administrator or seeded) starts with the same known default password (`Changeme@1`), and every user can change their own password at any time from their Profile page — not just during the forced first-login flow.
- Per-document discussion thread (`Message` model) — the trainer and every reviewer who's ever been assigned to a document (past or present) can chat in one thread, which also serves as "reply to a reviewer's comment" since a reply is just the next message in the same thread. Same access rule as preview/download.
- Notifications — a personal inbox (bell icon, unread count, mark read/all-read) plus Administrator/DP-only broadcast announcements to a chosen audience (everyone, or all HOD/IQA/DP)
- Document upload/versioning, with five document types (Learning Plan, Session Plan, Record of Work, Work Load, Timetable) and fixed dropdowns for academic year (2026-2029) and semester (Term 1/2/3) rather than free text
- Document access control at any lifecycle stage — `documentController.js::userCanAccessDocument` grants preview/download to the uploader, anyone ever assigned to review it, the department's current review-chain roles (HOD/IQA/DP, natural or acting), and Administrators, regardless of the document's current status — not just while it's in someone's active queue
- Reviewer resolution with conflict-of-interest exclusion + acting-reviewer fallback
- Workflow state machine with transition guards
- Review/approve/reject/return endpoints with the defense-in-depth ownership check
- Review history — `GET /api/reviews/history` lets a HOD/IQA/DP look back at everything they've already approved/rejected/returned, filterable and sortable, each still downloadable
- DP approved-document browsing — `GET /api/documents/approved`, filterable by department, trainer, or which IQA officer processed it
- PDF stamping — `services/pdfStamper.js` appends a color-coded name/designation/date/signature/stamp block after every event in a document's life: blue for the trainer's own upload ("Submitted by"), purple for HOD approval, red for IQA approval, yellow for DP approval — each in its own non-overlapping slot in the page margin so all four stack cleanly on the same document. No QR code is drawn; a plain text verification number is still recorded on final DP approval for record-keeping.
- Audit logging
- React dashboards for all five roles, with conditional rendering of review actions, plus a "My Review History" tab for HOD/IQA/DP and an "Approved Documents" tab for DP
- Document detail page showing uploader identity, full review history, and version history — reachable regardless of the document's stage
- College branding using the actual Laikipia East TVC crest (`frontend/public/logo.png`) in the sidebar and login screen, plus the Olive/Gold/White/Dark Gray palette

**Stubbed with a clear extension point (secondary, well-understood features):**
- Exact PDF stamp box coordinates — positioned generically in the page margin; should be tuned once tested against a real Learning Plan/Session Plan template with known margins
- Email sending — `services/email.js` wraps Nodemailer with the message templates; SMTP credentials are env-configured
- Bulk CSV/XLSX import — endpoint + parser present, column-mapping UI is a follow-up
- Virus scanning — hook present, ClamAV wiring is a deployment-time task
- Reports export (PDF/Excel/CSV) — CSV implemented; PDF/Excel export functions stubbed

This split keeps the parts that are *specific to this spec's hardest requirement* — the
conflict-of-interest / workflow engine — fully real and testable, while flagging the
parts that are standard integrations any Node dev can complete quickly.
