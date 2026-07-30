# Acknowledgement Receipts Design

Date: 2026-07-30  
Status: Approved for implementation

## Summary

Add acknowledgement receipts to the credit card tracker. The receiver creates and manages receipts in a private dashboard. A payer opens a reusable public portal with a unique link and PIN, reviews all receipts assigned to them, uploads proof images, and confirms that they received and agree with a receipt. The receiver separately confirms that payment was received. A receipt is complete only when both parties have confirmed its current revision.

Receipts may optionally reference transactions. These links are informational only: they do not allocate the receipt amount, require totals to match, or calculate transaction balances. Notes explain partial, excess, or advance payments.

## Confirmed Product Decisions

- Only the payer is selected from the existing `persons` table.
- The payer name displayed on a receipt is snapshotted from the selected Person.
- The receiver name is entered manually and snapshotted on each receipt.
- Amount received and payment date are required.
- Currency is stored explicitly and defaults to `PHP`.
- Transaction references are optional and many-to-many, with no allocations.
- Both payer and receiver may upload proof images.
- A receipt may have at most five active proof images.
- Each image may be at most 10 MB.
- Supported MVP formats are JPEG, PNG, and WebP. SVG is excluded.
- A payer has one reusable public portal link and PIN for all of their receipts.
- The link does not expire automatically. The receiver may rotate or revoke it.
- The payer confirms, “I received and agree with this acknowledgement receipt.”
- The receiver confirms, “I received the payment described by this receipt.”
- Both confirmations are required to complete the current revision.
- Any material change resets both confirmations, including changes made after completion.
- A previously completed revision remains preserved in the receiver’s audit history.
- Sharing is manual through a copied link and PIN; the app does not send email, SMS, or chat messages.

## Scope

### Included

- Supabase tables, constraints, indexes, functions, RLS, grants, and a private Storage bucket
- Receiver receipt dashboard and receipt creation/editing/detail flows
- Payer public dashboard protected by a unique URL and PIN
- Proof-image upload, viewing, and removal
- Two-party confirmation and completion indicators
- Immutable revision snapshots and an activity history
- Optional transaction references
- Optional receipt selection when marking a transaction paid
- Payer-link creation, copying, PIN reset, link rotation, and revocation
- Targeted hardening of the existing site-password session before it protects service-role-backed receipt APIs
- Unit, component, service, and end-to-end tests

### Excluded

- Amount allocations across transactions
- Partial-payment balance calculations
- Automatically deriving transaction `paid` state from receipts
- Supabase Auth accounts for payers or receivers
- Email, SMS, or messaging integrations
- PDF generation or electronic signatures
- Multiple currencies in one receipt
- Editing receipt fields from the payer portal

## Terminology

- **Payer:** the Person who paid the receiver. The UI must use “Payer,” not “Payee.”
- **Receiver:** the app owner receiving payment. The receiver is not selected from `persons`.
- **Current revision:** the editable/latest version shown in both dashboards.
- **Completed revision:** a revision confirmed by both parties.
- **Payer portal:** the public, PIN-protected dashboard containing all published receipts for one Person.

## Data Model

The migration is incremental because the repository does not contain the baseline schema. It references the existing `persons(id)` and `transactions(id)` relations without attempting to recreate them.

### `payer_portal_access`

One row per Person.

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` | Primary key |
| `person_id` | `uuid` | Unique FK to `persons(id)`, `ON DELETE RESTRICT` |
| `public_id` | `uuid` | Unique, random URL identifier |
| `pin_hash` | `text` | Salted scrypt hash; never return to clients |
| `credential_version` | `integer` | Starts at 1; increments on PIN reset, link rotation, or revocation |
| `revoked_at` | `timestamptz` | Nullable |
| `last_accessed_at` | `timestamptz` | Nullable |
| `created_at` | `timestamptz` | Required, defaults to `now()` |
| `updated_at` | `timestamptz` | Required, defaults to `now()` |

The random URL identifier is safe to retain so the receiver can copy the portal URL later. It is not sufficient to authenticate: the PIN is also required. A six-digit PIN is generated with a cryptographically secure random source and shown only when created or reset.

### `acknowledgement_receipts`

Stores the current revision and lifecycle state.

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` | Primary key |
| `receipt_number` | `text` | Unique, server-generated as `AR-YYYY-NNNNNN` |
| `payer_person_id` | `uuid` | FK to `persons(id)`, `ON DELETE RESTRICT` |
| `payer_name_snapshot` | `text` | Required; copied from the Person when created |
| `receiver_name` | `text` | Required, manually entered |
| `amount` | `numeric(14,2)` | Required and greater than zero |
| `currency` | `char(3)` | Required, defaults to `PHP` |
| `payment_date` | `date` | Required |
| `notes` | `text` | Nullable; maximum 5,000 characters |
| `revision_number` | `integer` | Required, starts at 1 |
| `published_at` | `timestamptz` | Null while a draft |
| `payer_confirmed_at` | `timestamptz` | Confirmation of the current revision |
| `receiver_confirmed_at` | `timestamptz` | Confirmation of the current revision |
| `completed_at` | `timestamptz` | Set atomically when both current confirmations exist |
| `is_completed` | `boolean` | Generated from `completed_at IS NOT NULL` |
| `voided_at` | `timestamptz` | Nullable |
| `void_reason` | `text` | Required when voided |
| `created_at` | `timestamptz` | Required, defaults to `now()` |
| `updated_at` | `timestamptz` | Required, defaults to `now()` |

The receipt status is derived rather than independently editable:

- `draft`: not published
- `awaiting_both`: published and neither party has confirmed
- `awaiting_payer`: only the receiver has confirmed
- `awaiting_receiver`: only the payer has confirmed
- `completed`: both parties have confirmed the current revision
- `voided`: explicitly voided with a reason

### `acknowledgement_receipt_transactions`

Stores current reference-only transaction links.

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` | Primary key |
| `receipt_id` | `uuid` | FK to receipts, `ON DELETE CASCADE` |
| `transaction_id` | `uuid` | Nullable FK to transactions, `ON DELETE SET NULL` |
| `transaction_date_snapshot` | `date` | Required |
| `description_snapshot` | `text` | Required |
| `amount_snapshot` | `numeric(14,2)` | Required |
| `created_at` | `timestamptz` | Required, defaults to `now()` |

A partial unique index prevents the same live transaction from being linked twice to one receipt. A transaction may be referenced by multiple receipts. Snapshot columns keep the receipt intelligible if an original transaction is later edited or deleted.

The server permits only transactions whose `person_id` matches the receipt payer.

### `acknowledgement_receipt_files`

Stores proof metadata; bytes live in a private Supabase Storage bucket.

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` | Primary key |
| `receipt_id` | `uuid` | FK to receipts, `ON DELETE CASCADE` |
| `storage_path` | `text` | Unique, random path |
| `original_filename` | `text` | Sanitized display name |
| `content_type` | `text` | JPEG, PNG, or WebP only |
| `size_bytes` | `bigint` | Greater than zero and at most 10 MB |
| `uploader_role` | `text` | `payer` or `receiver` |
| `removed_at` | `timestamptz` | Nullable; removed files disappear from the current revision |
| `created_at` | `timestamptz` | Required, defaults to `now()` |

A database trigger and server validation enforce a maximum of five non-removed files per receipt. Removed evidence remains retained for historical revisions in the MVP; it is not visible in the current payer view.

### `acknowledgement_receipt_revisions`

Preserves complete immutable historical versions.

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` | Primary key |
| `receipt_id` | `uuid` | FK to receipts, `ON DELETE CASCADE` |
| `revision_number` | `integer` | Unique within the receipt |
| `snapshot` | `jsonb` | Full receipt, transaction-reference, proof-metadata, and confirmation snapshot |
| `change_reason` | `text` | Required |
| `changed_by_role` | `text` | `receiver`, `payer`, or `system` |
| `created_at` | `timestamptz` | Required, defaults to `now()` |

Rows are append-only. Update and delete operations are rejected by a trigger.

### `acknowledgement_receipt_events`

Append-only event history for receiver-facing audit and troubleshooting.

Events include creation, publication, edit, confirmation reset, proof upload/removal, transaction link/unlink, payer confirmation, receiver confirmation, completion, voiding, PIN reset, link rotation, and revocation.

### `payer_portal_pin_attempts`

Provides durable throttling across serverless requests. Attempts are grouped by portal and an HMAC hash of the requesting network address; raw addresses are not retained. Five failures in 15 minutes temporarily block further attempts for that key. Old rows may be pruned by a scheduled maintenance query.

## Revision and Confirmation Rules

A material change is any mutation to:

- payer
- payer-name snapshot
- receiver name
- amount or currency
- payment date
- notes
- published transaction references
- proof images

Every material mutation is atomic:

1. Save the previous complete state in `acknowledgement_receipt_revisions`.
2. Apply the requested change.
3. Increment `revision_number`.
4. Clear `payer_confirmed_at`, `receiver_confirmed_at`, and `completed_at`.
5. Append an event explaining the reset.

This rule also applies to previously completed receipts. The current receipt returns to an unfinished status, while the completed historical revision remains available to the receiver.

Confirmation requests include the revision number displayed to the user. A stale request returns `409 Conflict` instead of confirming a revision the user did not review. Repeating the same confirmation against the same revision is idempotent.

The second confirmation sets `completed_at` in the same database transaction. The payer portal immediately becomes read-only for that receipt. If the receiver subsequently edits it, the new revision becomes actionable again.

## Publishing and Visibility

Creating a receipt initially saves a private draft. Drafts do not appear in the payer portal.

Publishing a receipt:

- creates the payer portal access row if it does not already exist;
- makes the receipt visible in that payer’s portal;
- sets the status to `awaiting_both`; and
- presents the receiver with the copyable portal URL.

Future published receipts for the same Person automatically appear at the same URL. The receiver does not need to create or resend a receipt-specific URL.

Voided published receipts remain visible with a clear `VOID` label and reason so that a previously seen record does not silently disappear.

## Application Architecture

### Server-mediated Supabase access

Receipt tables and private proof objects are never queried directly from the browser with the Supabase anonymous key. Next.js Route Handlers use a server-only Supabase client initialized with `SUPABASE_SERVICE_ROLE_KEY`.

The new tables:

- enable RLS;
- revoke direct privileges from `anon` and `authenticated`;
- grant only the narrowly required function privileges to `service_role`; and
- use database constraints and triggers as a second line of defense.

The service-role key must never be included in a `NEXT_PUBLIC_*` variable, browser bundle, log, or API response.

### Internal receiver authorization

The current site access cookie contains the fixed value `authenticated` and can be forged. It is not sufficient protection for service-role-backed APIs.

As a prerequisite, the existing password endpoint will issue a signed, time-limited, HttpOnly session token using a new `SITE_SESSION_SECRET`. Middleware and internal receipt endpoints verify the signature and expiry. The password itself remains server-only.

This is a targeted hardening change; it does not add user accounts or alter the app’s single-receiver model.

Production receiver APIs fail closed when `SITE_PASSWORD`, `SITE_SESSION_SECRET`, or the server-only Supabase credentials are absent. Development bypasses may apply to page navigation, but never cause service-role credentials to be exposed to an unauthenticated browser.

### Payer portal authorization

The public route is `/payer/[publicId]`.

Before PIN verification it reveals no payer or receipt details. Successful verification creates a signed, HttpOnly, Secure, SameSite cookie scoped to that portal and valid for 12 hours. The cookie includes the portal ID, credential version, and expiry. PIN reset, link rotation, or revocation invalidates prior sessions.

Public mutation routes verify:

- the portal session;
- request origin;
- portal credential version and revocation state;
- receipt ownership by the portal Person;
- receipt publication and void state; and
- the expected receipt revision.

All public responses use `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, and `X-Robots-Tag: noindex, nofollow`.

### Layout and middleware isolation

The public payer portal must not inherit the receiver sidebar or bottom navigation. The root layout retains only global document structure and styles; route-group layouts provide receiver chrome and a separate minimal public shell without changing URLs.

Middleware uses segment-aware public route matching for `/payer/[publicId]` and its public APIs. It must not rely on the current broad `startsWith` checks, which can accidentally make similarly prefixed routes public.

## Proof Upload Flow

Large files do not pass through a Next.js serverless function body.

1. The browser requests a one-time signed upload target.
2. The server validates the portal or receiver session, receipt state, claimed MIME type, claimed size, and current file count.
3. The server creates an unguessable object path and a short-lived Supabase signed-upload token.
4. The browser uploads directly to the private Storage bucket.
5. The browser calls a finalize endpoint.
6. The server verifies stored size, content type, and image magic bytes; rejects unsupported or mismatched formats; inserts metadata; creates a new revision; and resets confirmations.

Orphaned unfinalized objects use a temporary path prefix and may be removed by scheduled cleanup.

Proof viewing uses short-lived signed read URLs. Original filenames are sanitized for display; storage paths never use user-supplied names.

Payers may remove only their own current proof images before completion. The receiver may remove any current proof before completion. Removal is material and resets confirmations.

## Receiver Experience

### `/acknowledgements`

The receiver dashboard includes:

- receipt number;
- payer;
- amount and payment date;
- status;
- payer and receiver confirmation indicators with dates;
- proof count;
- revision number; and
- filters for payer, status, and payment date.

Primary actions:

- Create receipt
- View
- Edit
- Confirm payment received
- Publish
- Void
- Copy payer portal link
- Generate/reset PIN
- Rotate link
- Revoke/reactivate portal access

The PIN is shown only when generated or reset because only its hash is stored. If it is lost, the receiver resets it.

### Receipt form

Fields:

- Payer Person
- Receiver legal/display name
- Amount received
- Currency, defaulting to PHP
- Payment date
- Notes
- Optional transaction references
- Optional proof images

Changing the payer refreshes the transaction picker to show only that Person’s transactions. The picker shows transaction date, description, amount, paid state, and whether it is already referenced elsewhere. Selected totals may be displayed for context, but they never constrain the receipt amount.

Editing a receipt with confirmations displays a warning that saving will reset both confirmations. Editing a completed receipt additionally states that its completed historical revision will remain in the audit history.

## Payer Experience

### `/payer/[publicId]`

The first screen requests the PIN and does not identify the payer. After successful unlock, the payer sees:

- their name;
- all published receipts assigned to them;
- receipt status and amount;
- payment and confirmation dates;
- linked transaction summaries;
- proof thumbnails;
- the current revision number; and
- prior confirmation status when a receipt was updated and needs reconfirmation.

Within an unfinished receipt, the payer may:

- upload proof images;
- remove proof images they uploaded; and
- confirm that they received and agree with the current receipt.

Completed receipts are read-only unless the receiver creates a new revision. Draft receipts are hidden. Voided receipts are visibly marked and cannot be confirmed or changed.

## Mark-Paid Integration

All three existing paid-toggle locations receive the same flow:

- global transactions;
- Person transactions; and
- purchase-detail transactions.

When marking a transaction paid, a modal offers:

- `No acknowledgement receipt`; or
- an eligible receipt for the same payer.

Choosing a receipt creates a reference-only link using a transaction snapshot. It does not compare or allocate amounts. Marking paid and creating the optional link occur atomically through a server-mediated database function.

If the selected receipt has confirmations, the modal warns that adding the transaction reference creates a new revision and resets them. Completed receipts are allowed because the product explicitly permits later edits.

Marking a transaction unpaid does not silently remove its receipt references. References are historical context and may be removed explicitly from the receipt editor, which also creates a new revision.

The existing `transactions.paid` boolean remains authoritative for transaction status.

## API Boundaries

Representative internal endpoints:

- `GET/POST /api/acknowledgements`
- `GET/PATCH /api/acknowledgements/[id]`
- `POST /api/acknowledgements/[id]/publish`
- `POST /api/acknowledgements/[id]/confirm`
- `POST /api/acknowledgements/[id]/void`
- `POST/DELETE /api/acknowledgements/[id]/transactions`
- `POST /api/acknowledgements/[id]/files/upload-url`
- `POST /api/acknowledgements/[id]/files/finalize`
- `DELETE /api/acknowledgements/[id]/files/[fileId]`
- `POST /api/payer-portals/[personId]/pin`
- `POST /api/payer-portals/[personId]/rotate`
- `POST /api/payer-portals/[personId]/revoke`
- `POST /api/transactions/[id]/paid-status`

Representative payer endpoints:

- `POST /api/public/payer-portals/[publicId]/unlock`
- `POST /api/public/payer-portals/[publicId]/lock`
- `GET /api/public/payer-portals/[publicId]/receipts`
- `GET /api/public/payer-portals/[publicId]/receipts/[receiptId]`
- `POST /api/public/payer-portals/[publicId]/receipts/[receiptId]/confirm`
- signed upload/finalize/removal endpoints scoped beneath the receipt

Route handlers are thin. Validation, authorization, receipt mutation, storage, and serialization live in focused server modules so they can be tested independently.

## Validation and Error Handling

- Zod validates every request at the route boundary.
- Database checks enforce amount, currency, length, enum, file-count, and file-size invariants.
- Invalid or revoked public IDs return a generic unavailable response.
- Incorrect PINs do not reveal whether a Person or receipt exists.
- Rate limits return `429` with a retry time.
- Stale revision writes and confirmations return `409`.
- Repeated confirmations are safe and idempotent.
- Upload failures show retry controls and never create receipt metadata prematurely.
- Finalization failure removes or schedules removal of the orphan object.
- All user-visible mutations show explicit success or error feedback; paid checkboxes no longer fail silently.
- Confirmation times are stored as `timestamptz` and rendered explicitly in `Asia/Manila`.

## Migration Safety

- Use explicit `ON DELETE` behavior and indexes for every foreign key.
- Explicitly revoke function execution from `PUBLIC`, `anon`, and `authenticated`.
- Database mutation functions use a fixed `search_path`.
- Functions used by the server are `SECURITY INVOKER` unless a narrowly justified definer function is necessary.
- Receipt rows are not physically deleted through the UI. They are voided.
- The migration creates the private `acknowledgement-proofs` bucket idempotently.
- The migration does not assume that existing RLS or grants are safe.

## Testing Strategy

### Unit tests

- receipt status derivation
- revision-reset rules
- PIN generation, hashing, and verification
- signed portal-session verification
- request validation
- transaction eligibility
- file type, size, and count validation

### Service and route tests

- receipt CRUD and publication
- public responses are payer-scoped
- invalid PIN throttling
- portal credential rotation invalidates sessions
- both confirmation orders
- idempotent confirmation
- stale-revision conflicts
- completed-receipt edit preserves history and resets completion
- transaction linking without amount allocation
- mark-paid atomicity
- signed upload initialization and finalization

### Component tests

- receipt form and filtered transaction picker
- receiver dashboard status indicators
- edit-reset warnings
- payer PIN gate
- payer receipt list/detail
- proof-limit feedback
- confirmation loading, success, and error states

### Playwright flows

1. Receiver creates and publishes a receipt, then copies the payer portal link.
2. Payer unlocks the portal, uploads proof, and confirms.
3. Receiver confirms and observes completion.
4. Receiver edits the completed receipt and both confirmations reset.
5. Payer revisits the same portal and confirms the new revision.
6. Receiver marks a transaction paid and optionally links a receipt.
7. PIN reset and link rotation invalidate previous payer access.

## Deployment Configuration

Add server-only environment variables:

- `SUPABASE_SERVICE_ROLE_KEY`
- `SITE_SESSION_SECRET`
- `ACKNOWLEDGEMENT_SESSION_SECRET`

Existing public Supabase variables remain unchanged. Example environment files and README setup instructions must clearly distinguish browser-safe and server-only secrets.

## Success Criteria

- The receiver can create, publish, edit, confirm, void, and audit receipts.
- A payer can use one link and PIN to access all of their published receipts.
- Neither the URL alone nor the PIN alone reveals receipt data.
- Both parties can upload supported proofs within the five-file and 10 MB limits.
- A receipt completes only when both parties confirm the same revision.
- Editing any material detail resets current completion while preserving prior completed history.
- Transaction references remain optional and never require matching amounts.
- Marking a transaction paid can optionally add a receipt reference.
- Public users cannot access another payer’s receipts or Supabase tables directly.
- Service-role credentials never reach the browser.
