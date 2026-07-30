# Acknowledgement Receipts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure receiver-managed acknowledgement receipts and a reusable PIN-protected public receipt dashboard for each payer.

**Architecture:** New receipt tables and atomic PostgreSQL functions live in one incremental Supabase migration. Receiver and payer browsers call focused Next.js Route Handlers; only server modules use the Supabase service-role key. Receiver pages use the signed site-password session, while payer pages use a portal-specific signed session after URL-and-PIN verification.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5, Supabase PostgreSQL and private Storage, Zod 3, Vitest 4, Testing Library, Playwright.

## Global Constraints

- Only the payer is selected from `persons`; the receiver name is manually entered.
- Receipt amount and payment date are required; currency defaults to `PHP`.
- Transaction links are optional references only and never allocate or reconcile amounts.
- Both parties may upload JPEG, PNG, or WebP images; five active images maximum and 10 MiB per image.
- One payer portal URL and PIN exposes only that Person’s published receipts.
- Both parties confirm the same revision; any material edit clears current confirmations, including after completion.
- Prior completed revisions remain available to the receiver.
- Public links remain available until the receiver rotates or revokes them.
- No Supabase service-role credential or PIN hash may reach a browser.
- All shell commands in this repository use `rtk`.

---

## File Map

### Database and domain

- Create `supabase/migrations/20260730_acknowledgement_receipts.sql` for tables, private bucket, constraints, RLS, grants, triggers, views, and RPC functions.
- Create `src/lib/acknowledgements/types.ts` for browser-safe domain types and request/response contracts.
- Create `src/lib/acknowledgements/status.ts` for pure status and confirmation helpers.
- Create `src/lib/acknowledgements/schemas.ts` for all Zod request validation.
- Create `src/lib/acknowledgements/format.ts` for explicit PHP/date presentation.

### Authentication and server access

- Create `src/lib/auth/signedSession.ts` for Edge-compatible HMAC sessions.
- Create `src/lib/auth/receiverSession.ts` for receiver-cookie issuance and verification.
- Create `src/lib/auth/payerPortalSession.ts` for portal-cookie issuance and verification.
- Create `src/lib/auth/pin.ts` for secure PIN generation and scrypt hashing.
- Create `src/lib/supabase/server.ts` for the server-only service-role client.
- Create `src/lib/acknowledgements/server/http.ts` for no-store JSON/error responses.
- Create `src/lib/acknowledgements/server/receiptService.ts` for receiver receipt queries and mutations.
- Create `src/lib/acknowledgements/server/portalAdminService.ts` for receiver-managed portal credentials.
- Create `src/lib/acknowledgements/server/portalService.ts` for scoped public queries and PIN throttling.
- Create `src/lib/acknowledgements/server/proofService.ts` for private Storage upload/finalize/read/remove behavior.

### Route handlers

- Create internal receipt routes below `src/app/api/acknowledgements/`.
- Create portal-management routes below `src/app/api/payer-portals/`.
- Create public payer routes below `src/app/api/public/payer-portals/`.
- Create `src/app/api/transactions/[id]/paid-status/route.ts` for atomic paid-state/reference updates.
- Modify `src/app/api/site-auth/route.ts` and `src/middleware.ts` for signed receiver sessions and segment-aware public paths.

### Receiver UI

- Move receiver pages beneath `src/app/(receiver)/` without changing URLs.
- Create `src/app/(receiver)/layout.tsx` for receiver navigation.
- Reduce `src/app/layout.tsx` to global document structure.
- Create acknowledgement list, new, and detail pages beneath `src/app/(receiver)/acknowledgements/`.
- Create focused components beneath `src/components/acknowledgements/`.
- Modify navigation constants and icons to expose the dashboard.

### Payer UI and transaction integration

- Create `src/app/(public)/payer/[publicId]/page.tsx`.
- Create focused payer components beneath `src/components/acknowledgements/payer/`.
- Create `src/components/transactions/MarkPaidModal.tsx`.
- Modify all three existing transaction paid-toggle pages to use the shared modal/API flow.

---

### Task 1: Signed Receiver Sessions

**Files:**

- Create: `src/lib/auth/signedSession.ts`
- Create: `src/lib/auth/receiverSession.ts`
- Create: `src/lib/auth/__tests__/signedSession.test.ts`
- Modify: `src/lib/constants/auth-constants.ts`
- Modify: `src/app/api/site-auth/route.ts`
- Modify: `src/middleware.ts`
- Modify: `.env.example`
- Modify: `env.example`

**Interfaces:**

- Produces `signSession<T>(payload: T, secret: string, expiresAt: number): Promise<string>`.
- Produces `verifySession<T>(token: string, secret: string, now?: number): Promise<T | null>`.
- Produces `createReceiverSessionToken(): Promise<string>` and `verifyReceiverSessionToken(token: string): Promise<boolean>`.
- Later internal routes consume `verifyReceiverRequest(request: NextRequest): Promise<boolean>`.

- [ ] **Step 1: Write failing session tests**

```ts
it("round-trips a signed session and rejects tampering or expiry", async () => {
    const token = await signSession({ kind: "receiver" }, SECRET, 2_000);
    expect(await verifySession(token, SECRET, 1_000)).toEqual({
        kind: "receiver",
    });
    expect(await verifySession(`${token}x`, SECRET, 1_000)).toBeNull();
    expect(await verifySession(token, SECRET, 2_001)).toBeNull();
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `rtk pnpm test:run -- src/lib/auth/__tests__/signedSession.test.ts`

Expected: failure because the session module does not exist.

- [ ] **Step 3: Implement Edge-compatible HMAC tokens**

Use Web Crypto HMAC-SHA256, base64url encoding, constant-time byte comparison, a versioned payload, and explicit expiry. Reject secrets shorter than 32 characters and malformed payloads without throwing details to callers.

- [ ] **Step 4: Replace the fixed receiver cookie**

Make `/api/site-auth` issue the signed token as the existing HttpOnly cookie. Make middleware verify the token asynchronously outside development navigation bypasses. Add `SITE_SESSION_SECRET` to both example environment files without a real value.

- [ ] **Step 5: Add receiver-request verification**

`verifyReceiverRequest` reads the cookie and verifies it on every service-role-backed internal API request, including in development. Missing production password/session configuration must return a fail-closed result.

- [ ] **Step 6: Run focused and existing auth-adjacent tests**

Run: `rtk pnpm test:run -- src/lib/auth/__tests__/signedSession.test.ts`

Expected: all session tests pass.

- [ ] **Step 7: Commit**

```bash
rtk git add src/lib/auth src/lib/constants/auth-constants.ts src/app/api/site-auth/route.ts src/middleware.ts .env.example env.example
rtk git commit -m "feat(auth): sign receiver sessions"
```

### Task 2: Supabase Schema and Domain Contracts

**Files:**

- Create: `supabase/migrations/20260730_acknowledgement_receipts.sql`
- Create: `src/lib/acknowledgements/types.ts`
- Create: `src/lib/acknowledgements/status.ts`
- Create: `src/lib/acknowledgements/schemas.ts`
- Create: `src/lib/acknowledgements/format.ts`
- Create: `src/lib/acknowledgements/__tests__/status.test.ts`
- Create: `src/lib/acknowledgements/__tests__/schemas.test.ts`

**Interfaces:**

- Produces `ReceiptStatus`, `ReceiptStatusFields`, `AcknowledgementReceipt`, `AcknowledgementReceiptSummary`, `AcknowledgementReceiptDetail`, `ReceiptTransactionReference`, `ReceiptProof`, `ReceiptRevision`, `ReceiptFilters`, `ReceiptFormMeta`, `PayerPortalSummary`, `PayerPortalAdminView`, `PayerPortalCredentialResult`, `CreateReceiptInput`, `UpdateReceiptInput`, `ReceiverReceiptAction`, and `PortalAdminAction`.
- Produces `deriveReceiptStatus(receipt): ReceiptStatus`.
- Produces `createReceiptSchema`, `updateReceiptSchema`, `receiptActionSchema`, and `paidStatusSchema`.
- Migration produces RPCs:
  - `ack_create_receipt`
  - `ack_update_receipt`
  - `ack_publish_receipt`
  - `ack_confirm_receipt`
  - `ack_void_receipt`
  - `ack_register_file`
  - `ack_remove_file`
  - `ack_set_transaction_paid`

- [ ] **Step 1: Write failing status and schema tests**

```ts
it("returns completed only when completed_at belongs to the current revision", () => {
    expect(
        deriveReceiptStatus({
            published_at: "2026-07-30T00:00:00Z",
            payer_confirmed_at: "2026-07-30T00:01:00Z",
            receiver_confirmed_at: "2026-07-30T00:02:00Z",
            completed_at: "2026-07-30T00:02:00Z",
            voided_at: null,
        }),
    ).toBe("completed");
});

it("accepts reference-only transaction ids without allocations", () => {
    expect(
        createReceiptSchema.parse({
            payerPersonId: crypto.randomUUID(),
            receiverName: "Receiver Name",
            amount: 12500,
            currency: "PHP",
            paymentDate: "2026-07-30",
            notes: "Includes an advance.",
            transactionIds: [],
        }),
    ).toMatchObject({ currency: "PHP", transactionIds: [] });
});
```

- [ ] **Step 2: Run tests and verify missing-module failures**

Run: `rtk pnpm test:run -- src/lib/acknowledgements/__tests__`

Expected: failure because the acknowledgement domain files do not exist.

- [ ] **Step 3: Implement browser-safe types, status derivation, schemas, and formatting**

Keep database-only fields such as `pin_hash` and raw `storage_path` out of public types. Validate UUIDs, positive two-decimal amounts, three-letter currency, ISO dates, 200-character names, 5,000-character notes, and unique transaction IDs.

- [ ] **Step 4: Write the incremental migration**

Create:

- `payer_portal_access`
- `payer_portal_pin_attempts`
- `acknowledgement_receipts`
- `acknowledgement_receipt_transactions`
- `acknowledgement_receipt_files`
- `acknowledgement_receipt_revisions`
- `acknowledgement_receipt_events`
- a private `acknowledgement-proofs` bucket
- an `acknowledgement_receipt_overview` view

Add all checks, partial unique indexes, FK indexes, `ON DELETE` rules, append-only revision/event triggers, updated-at triggers, file-count enforcement, and explicit RLS/grant revocation.

- [ ] **Step 5: Implement atomic database functions**

Each mutation must lock the current receipt, verify `expected_revision`, snapshot the prior state for material changes, reset confirmations, and append an event. `ack_confirm_receipt` must be idempotent and set `completed_at` only when both timestamps exist. `ack_set_transaction_paid` must update `transactions.paid` and optionally create a same-payer receipt reference in one transaction.

- [ ] **Step 6: Run domain tests and static checks**

Run:

```bash
rtk pnpm test:run -- src/lib/acknowledgements/__tests__
rtk tsc --noEmit
```

Expected: domain tests and TypeScript pass.

- [ ] **Step 7: Commit**

```bash
rtk git add supabase/migrations/20260730_acknowledgement_receipts.sql src/lib/acknowledgements
rtk git commit -m "feat(database): add acknowledgement receipt schema"
```

### Task 3: Server Client, Portal Credentials, and Receiver API

**Files:**

- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/auth/pin.ts`
- Create: `src/lib/auth/__tests__/pin.test.ts`
- Create: `src/lib/acknowledgements/server/http.ts`
- Create: `src/lib/acknowledgements/server/receiptService.ts`
- Create: `src/lib/acknowledgements/server/portalAdminService.ts`
- Create: `src/lib/acknowledgements/server/__tests__/receiptService.test.ts`
- Create: `src/app/api/acknowledgements/route.ts`
- Create: `src/app/api/acknowledgements/meta/route.ts`
- Create: `src/app/api/acknowledgements/[id]/route.ts`
- Create: `src/app/api/acknowledgements/[id]/actions/route.ts`
- Create: `src/app/api/payer-portals/[personId]/route.ts`

**Interfaces:**

- Produces `getServerSupabase(): SupabaseClient`.
- Produces `generatePin(): string`, `hashPin(pin: string): Promise<string>`, and `verifyPin(pin: string, encoded: string): Promise<boolean>`.
- Produces receiver service functions:

```ts
listReceipts(filters?: ReceiptFilters): Promise<AcknowledgementReceiptSummary[]>
getReceipt(id: string): Promise<AcknowledgementReceiptDetail>
createReceipt(input: CreateReceiptInput): Promise<AcknowledgementReceiptDetail>
updateReceipt(id: string, input: UpdateReceiptInput): Promise<AcknowledgementReceiptDetail>
performReceiptAction(id: string, action: ReceiverReceiptAction): Promise<AcknowledgementReceiptDetail>
getPortalAccess(personId: string): Promise<PayerPortalAdminView | null>
managePortalAccess(personId: string, action: PortalAdminAction): Promise<PayerPortalCredentialResult>
getReceiptFormMeta(payerPersonId?: string): Promise<ReceiptFormMeta>
```

- [ ] **Step 1: Write failing PIN and receiver-service tests**

Use a minimal fake Supabase client and assert:

- PINs contain six numeric digits, hashes use distinct salts, and incorrect PINs fail;
- list results are serialized without database-only fields;
- an RPC `409` revision conflict maps to `ReceiptConflictError`;
- a missing row maps to `ReceiptNotFoundError`;
- create forwards only schema-approved fields; and
- form metadata filters transactions by the selected payer.

- [ ] **Step 2: Run the service tests and verify failure**

Run: `rtk pnpm test:run -- src/lib/auth/__tests__/pin.test.ts src/lib/acknowledgements/server/__tests__/receiptService.test.ts`

Expected: failure because the service is missing.

- [ ] **Step 3: Implement the server-only Supabase client**

Read `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; throw a configuration error without echoing values when either is absent. Disable session persistence and token refresh. Import `server-only`.

- [ ] **Step 4: Implement PIN hashing and portal administration**

Use `crypto.randomInt` for PIN generation and Node `scrypt` with a random 16-byte salt for storage. `portalAdminService` creates one access row per Person, returns a plaintext PIN only on generation/reset, rotates `public_id`, increments `credential_version`, and supports revoke/reactivate without ever returning `pin_hash`.

- [ ] **Step 5: Implement the receiver service**

Use PostgREST selects for read models and the Task 2 RPCs for mutations. Normalize Supabase errors into typed not-found, conflict, validation, and unexpected errors. Never return `pin_hash`, raw attempt data, or unrestricted Storage paths.

- [ ] **Step 6: Implement internal route handlers**

Every handler:

1. verifies the signed receiver session;
2. parses params/body with Zod;
3. calls one service function;
4. maps typed errors to `400`, `401`, `404`, `409`, or `500`; and
5. returns `Cache-Control: no-store`.

The actions route accepts the discriminated actions `publish`, `confirm`, and `void`. Publishing ensures portal credentials exist. The metadata route returns Persons plus payer-filtered transactions. The portal-management route accepts `generate-pin`, `reset-pin`, `rotate-link`, `revoke`, and `reactivate`.

- [ ] **Step 7: Run focused tests and type-check**

Run:

```bash
rtk pnpm test:run -- src/lib/auth/__tests__/pin.test.ts src/lib/acknowledgements/server/__tests__/receiptService.test.ts
rtk tsc --noEmit
```

Expected: tests and TypeScript pass.

- [ ] **Step 8: Commit**

```bash
rtk git add src/lib/supabase/server.ts src/lib/auth/pin.ts src/lib/auth/__tests__/pin.test.ts src/lib/acknowledgements/server src/app/api/acknowledgements src/app/api/payer-portals
rtk git commit -m "feat(receipts): add receiver receipt API"
```

### Task 4: Receiver Layout, Dashboard, and Receipt Forms

**Files:**

- Modify: `src/app/layout.tsx`
- Create: `src/app/(receiver)/layout.tsx`
- Move: `src/app/page.tsx` to `src/app/(receiver)/page.tsx`
- Move: `src/app/credit-cards/page.tsx` to `src/app/(receiver)/credit-cards/page.tsx`
- Move: `src/app/persons/page.tsx` to `src/app/(receiver)/persons/page.tsx`
- Move: `src/app/purchases/page.tsx` to `src/app/(receiver)/purchases/page.tsx`
- Move: `src/app/purchases/bulk-add/page.tsx` to `src/app/(receiver)/purchases/bulk-add/page.tsx`
- Move: `src/app/purchases/[id]/page.tsx` to `src/app/(receiver)/purchases/[id]/page.tsx`
- Move: `src/app/transactions/page.tsx` to `src/app/(receiver)/transactions/page.tsx`
- Move: `src/app/transactions/person/[slug]/page.tsx` to `src/app/(receiver)/transactions/person/[slug]/page.tsx`
- Create: `src/app/(receiver)/acknowledgements/page.tsx`
- Create: `src/app/(receiver)/acknowledgements/new/page.tsx`
- Create: `src/app/(receiver)/acknowledgements/[id]/page.tsx`
- Create: `src/components/acknowledgements/ReceiptStatusBadge.tsx`
- Create: `src/components/acknowledgements/ReceiptForm.tsx`
- Create: `src/components/acknowledgements/TransactionReferencePicker.tsx`
- Create: `src/components/acknowledgements/ConfirmationPanel.tsx`
- Create: `src/components/acknowledgements/PortalAccessCard.tsx`
- Create: `src/components/acknowledgements/__tests__/ReceiptForm.test.tsx`
- Modify: `src/lib/constants.ts`
- Modify: `src/lib/icons.ts`

**Interfaces:**

- `ReceiptForm` consumes Persons, payer-filtered transactions, optional initial receipt data, and `onSubmit(input)`.
- `PortalAccessCard` consumes the copyable URL and credential state; newly generated PINs are transient props and never persisted in browser storage.

- [ ] **Step 1: Write failing receipt-form tests**

Cover required receiver name, amount, payment date, payer selection, optional transaction IDs, and a visible warning when editing a confirmed revision.

- [ ] **Step 2: Run the form test and verify failure**

Run: `rtk pnpm test:run -- src/components/acknowledgements/__tests__/ReceiptForm.test.tsx`

Expected: failure because the form is missing.

- [ ] **Step 3: Split receiver and public layouts**

Keep `<html>`, `<body>`, fonts, metadata, and global CSS in the root layout. Put `AppSidebar`, `BottomNavigation`, and receiver main padding in `(receiver)/layout.tsx`. Move existing receiver pages with no URL changes. Leave password, API, and payer routes outside the receiver group.

- [ ] **Step 4: Implement focused receiver components**

Use existing base inputs/buttons/cards. The transaction picker fetches and displays only the chosen payer’s transactions, allows multiple references, and shows selected totals as context without validation against receipt amount.

- [ ] **Step 5: Implement receiver pages**

- List page: payer/status/date filters, status and confirmation indicators, proof count, revision, and primary actions.
- New page: save draft, then redirect to detail.
- Detail page: view/edit, publish, receiver confirm, void, audit history, and portal access management.

Display explicit loading, empty, validation, conflict, success, and retry states. A stale edit reloads the latest revision instead of overwriting it.

- [ ] **Step 6: Add navigation**

Add “Acknowledgements” to desktop/mobile navigation and the home card list with a receipt icon.

- [ ] **Step 7: Run component tests, type-check, and build**

Run:

```bash
rtk pnpm test:run -- src/components/acknowledgements/__tests__/ReceiptForm.test.tsx
rtk tsc --noEmit
rtk pnpm build
```

Expected: tests, TypeScript, and Next build pass.

- [ ] **Step 8: Commit**

```bash
rtk git add src/app src/components/acknowledgements src/lib/constants.ts src/lib/icons.ts
rtk git commit -m "feat(receipts): add receiver dashboard"
```

### Task 5: Payer Portal Session and Scoped Public API

**Files:**

- Create: `src/lib/auth/payerPortalSession.ts`
- Create: `src/lib/auth/__tests__/payerPortalSession.test.ts`
- Create: `src/lib/acknowledgements/server/portalService.ts`
- Create: `src/lib/acknowledgements/server/__tests__/portalService.test.ts`
- Create: `src/app/api/public/payer-portals/[publicId]/unlock/route.ts`
- Create: `src/app/api/public/payer-portals/[publicId]/lock/route.ts`
- Create: `src/app/api/public/payer-portals/[publicId]/receipts/route.ts`
- Create: `src/app/api/public/payer-portals/[publicId]/receipts/[receiptId]/route.ts`
- Create: `src/app/api/public/payer-portals/[publicId]/receipts/[receiptId]/confirm/route.ts`
- Modify: `src/lib/constants/auth-constants.ts`
- Modify: `src/middleware.ts`

**Interfaces:**

- Produces `createPayerPortalSession` and `verifyPayerPortalRequest`.
- Public receipt functions always accept the authorized `personId` and scope every query by it.

- [ ] **Step 1: Write failing portal-session and scope tests**

Test credential-version session invalidation and a service query that always includes `payer_person_id = authorizedPersonId`. Reuse Task 3 PIN verification and test that a wrong PIN records a failed attempt without issuing a session.

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
rtk pnpm test:run -- src/lib/auth/__tests__/payerPortalSession.test.ts
rtk pnpm test:run -- src/lib/acknowledgements/server/__tests__/portalService.test.ts
```

Expected: missing-module failures.

- [ ] **Step 3: Implement portal sessions**

Use the signed-session primitive with `ACKNOWLEDGEMENT_SESSION_SECRET` for a 12-hour HttpOnly, Secure-in-production, SameSite=Lax portal cookie containing portal ID and credential version.

- [ ] **Step 4: Implement durable throttling**

Before PIN verification, check the database window for the portal plus HMAC-obscured request address. Record failures, return `429` after five failures in 15 minutes, and clear the key on success. Do not store or log raw PINs or raw addresses.

- [ ] **Step 5: Implement public routes**

Unlock reveals no details until successful PIN verification. Receipt list/detail/confirm routes verify portal session, credential version, revocation, publication, and Person ownership. Confirmation passes role `payer` server-side and the expected revision from the request.

- [ ] **Step 6: Harden public middleware behavior**

Allow exact `/payer/` and `/api/public/payer-portals/` segments past the receiver password gate. Do not make prefix lookalikes public. Add no-store, no-referrer, and noindex headers to public responses.

- [ ] **Step 7: Run focused tests and type-check**

Run:

```bash
rtk pnpm test:run -- src/lib/auth/__tests__/payerPortalSession.test.ts src/lib/acknowledgements/server/__tests__/portalService.test.ts
rtk tsc --noEmit
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
rtk git add src/lib/auth src/lib/acknowledgements/server src/app/api/public src/lib/constants/auth-constants.ts src/middleware.ts
rtk git commit -m "feat(receipts): secure payer portal API"
```

### Task 6: Private Proof Uploads

**Files:**

- Create: `src/lib/acknowledgements/server/proofService.ts`
- Create: `src/lib/acknowledgements/server/__tests__/proofService.test.ts`
- Create: `src/app/api/acknowledgements/[id]/files/upload-url/route.ts`
- Create: `src/app/api/acknowledgements/[id]/files/finalize/route.ts`
- Create: `src/app/api/acknowledgements/[id]/files/[fileId]/route.ts`
- Create: `src/app/api/public/payer-portals/[publicId]/receipts/[receiptId]/files/upload-url/route.ts`
- Create: `src/app/api/public/payer-portals/[publicId]/receipts/[receiptId]/files/finalize/route.ts`
- Create: `src/app/api/public/payer-portals/[publicId]/receipts/[receiptId]/files/[fileId]/route.ts`
- Create: `src/components/acknowledgements/ProofUploader.tsx`
- Create: `src/components/acknowledgements/__tests__/ProofUploader.test.tsx`
- Modify: `src/app/(receiver)/acknowledgements/new/page.tsx`
- Modify: `src/app/(receiver)/acknowledgements/[id]/page.tsx`
- Modify: `src/components/acknowledgements/ReceiptForm.tsx`

**Interfaces:**

- `requestProofUpload` returns `{ path, token }` only after authorization and preflight validation.
- `finalizeProofUpload` returns the browser-safe `ReceiptProof`.
- `ProofUploader` accepts `receiptId`, current proofs, uploader role, disabled state, and `onChanged`.

- [ ] **Step 1: Write failing proof-service and component tests**

Cover:

- rejection at six active files;
- rejection above `10 * 1024 * 1024` bytes;
- rejection of SVG/GIF/PDF and MIME/signature mismatches;
- payer ownership checks;
- accessible per-file error text; and
- disabled upload on completed or voided receipts.

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
rtk pnpm test:run -- src/lib/acknowledgements/server/__tests__/proofService.test.ts
rtk pnpm test:run -- src/components/acknowledgements/__tests__/ProofUploader.test.tsx
```

Expected: missing-module failures.

- [ ] **Step 3: Implement signed upload preflight**

Validate file metadata, current active count, receipt state, role, and Person scope. Generate a random temporary path and call Supabase `createSignedUploadUrl`.

- [ ] **Step 4: Implement finalization and signed reads**

Fetch Storage metadata and initial bytes, validate JPEG/PNG/WebP magic signatures, then call `ack_register_file`. Generate short-lived signed read URLs when serializing receipt detail. On failure, delete or mark the temporary object for cleanup.

- [ ] **Step 5: Implement proof removal**

Payers may remove only their own current files before completion. Receivers may remove any current file. Use `ack_remove_file` so removal snapshots the prior revision and resets confirmations.

- [ ] **Step 6: Implement `ProofUploader`**

Upload directly with `supabase.storage.from("acknowledgement-proofs").uploadToSignedUrl`, finalize through the appropriate API, and show progress, count, type/size guidance, thumbnails, remove actions, and errors.

The new-receipt form may stage valid images, create the draft first, and then upload the staged files against its returned receipt ID. The receiver detail page uses the same uploader for later proof changes.

- [ ] **Step 7: Run focused tests, type-check, and build**

Run:

```bash
rtk pnpm test:run -- src/lib/acknowledgements/server/__tests__/proofService.test.ts src/components/acknowledgements/__tests__/ProofUploader.test.tsx
rtk tsc --noEmit
rtk pnpm build
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
rtk git add src/lib/acknowledgements/server/proofService.ts src/app/api/acknowledgements src/app/api/public src/components/acknowledgements
rtk git commit -m "feat(receipts): add private proof uploads"
```

### Task 7: Public Payer Dashboard

**Files:**

- Create: `src/app/(public)/payer/[publicId]/page.tsx`
- Create: `src/components/acknowledgements/payer/PayerPortal.tsx`
- Create: `src/components/acknowledgements/payer/PayerPinGate.tsx`
- Create: `src/components/acknowledgements/payer/PayerReceiptCard.tsx`
- Create: `src/components/acknowledgements/payer/PayerReceiptDetail.tsx`
- Create: `src/components/acknowledgements/payer/__tests__/PayerPortal.test.tsx`

**Interfaces:**

- `PayerPortal` consumes only `publicId`; all payer identity and receipt data arrive after unlock.
- `PayerReceiptDetail` consumes current receipt data, signed proof URLs, and callbacks for upload/remove/confirm.

- [ ] **Step 1: Write failing payer-portal tests**

Test:

- no payer identity appears before PIN success;
- all published receipts render after unlock;
- drafts remain absent;
- completed and voided receipts are read-only;
- a changed receipt displays “Updated — confirmation required”; and
- confirming posts the displayed revision.

- [ ] **Step 2: Run the component test and verify failure**

Run: `rtk pnpm test:run -- src/components/acknowledgements/payer/__tests__/PayerPortal.test.tsx`

Expected: missing-component failure.

- [ ] **Step 3: Implement the minimal public shell and PIN gate**

Use a mobile-first card layout with no receiver navigation. Provide explicit invalid-PIN, throttled, revoked, loading, retry, and successful unlock states. Never place the PIN in query strings or browser storage.

- [ ] **Step 4: Implement payer receipt list/detail**

Show receipt number, amount, payment date, receiver, notes, linked transaction snapshots, confirmation dates, revision, proofs, and status. Use explicit Asia/Manila date/time formatting.

- [ ] **Step 5: Connect payer uploads and confirmation**

Mount `ProofUploader` with role `payer`. Confirm only after the current detail finishes loading, disable duplicate submits, handle `409` by reloading, and show a durable completion state.

- [ ] **Step 6: Run tests, type-check, and build**

Run:

```bash
rtk pnpm test:run -- src/components/acknowledgements/payer/__tests__/PayerPortal.test.tsx
rtk tsc --noEmit
rtk pnpm build
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
rtk git add 'src/app/(public)' src/components/acknowledgements/payer
rtk git commit -m "feat(receipts): add payer receipt dashboard"
```

### Task 8: Mark-Paid Receipt Reference Integration

**Files:**

- Create: `src/components/transactions/MarkPaidModal.tsx`
- Create: `src/components/transactions/__tests__/MarkPaidModal.test.tsx`
- Create: `src/app/api/transactions/[id]/paid-status/route.ts`
- Create: `src/lib/services/transactionPaymentService.ts`
- Modify: `src/app/(receiver)/transactions/page.tsx`
- Modify: `src/app/(receiver)/transactions/person/[slug]/page.tsx`
- Modify: `src/app/(receiver)/purchases/[id]/page.tsx`
- Modify: `src/lib/utils.ts`
- Modify: `src/lib/services/purchaseService.ts`
- Modify: `src/lib/hooks/usePurchaseDetails.ts`
- Modify: `src/lib/__tests__/utils.test.ts`
- Modify: `src/lib/services/__tests__/purchaseService.test.ts`
- Modify: `src/lib/hooks/__tests__/usePurchaseDetails.test.ts`

**Interfaces:**

- `MarkPaidModal` receives the transaction, same-payer receipt choices, and `onSubmit({ paid, acknowledgementReceiptId? })`.
- `setTransactionPaidStatus(transactionId, input)` calls the new internal endpoint and returns the updated transaction plus optional receipt-link result.

- [ ] **Step 1: Write failing modal/service tests**

Test:

- “No acknowledgement receipt” remains valid;
- only same-payer receipts are offered;
- selecting a receipt sends its ID;
- a confirmed/completed receipt displays the reset warning;
- marking unpaid sends no unlink request; and
- API errors leave the original checkbox state intact.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `rtk pnpm test:run -- src/components/transactions/__tests__/MarkPaidModal.test.tsx`

Expected: missing-component failure.

- [ ] **Step 3: Implement the atomic internal endpoint and service**

Verify receiver session, validate `paidStatusSchema`, and call `ack_set_transaction_paid`. The RPC checks Person ownership, snapshots the reference, and resets receipt confirmations when a new link changes it.

- [ ] **Step 4: Implement the shared modal**

Open the modal only when changing an unpaid transaction to paid. Load eligible receipts for the transaction Person. Keep a visible skip option. Show status/revision and a confirmation-reset warning where applicable.

- [ ] **Step 5: Replace all three direct paid-toggle implementations**

Use one shared service and modal in global transactions, Person transactions, and purchase detail. Unpaid changes remain explicit but preserve receipt links. Surface success and errors instead of only logging them.

- [ ] **Step 6: Update existing tests and run the transaction suite**

Run:

```bash
rtk pnpm test:run -- src/components/transactions src/lib/__tests__/utils.test.ts src/lib/hooks/__tests__/usePurchaseDetails.test.ts src/lib/services/__tests__/purchaseService.test.ts
rtk tsc --noEmit
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
rtk git add src/components/transactions src/app/api/transactions src/lib/services src/lib/hooks src/lib/utils.ts 'src/app/(receiver)/transactions' 'src/app/(receiver)/purchases/[id]/page.tsx'
rtk git commit -m "feat(transactions): link receipts when marking paid"
```

### Task 9: Integrated Verification and Documentation

**Files:**

- Create: `e2e/acknowledgement-receipts.spec.ts`
- Modify: `README.md`
- Modify: `.env.example`
- Modify: `env.example`

**Interfaces:**

- The E2E fixture may skip with a clear reason when a configured Supabase test project is unavailable, but unit/component coverage must always run.

- [ ] **Step 1: Write the E2E scenarios**

Cover receiver create/publish, payer unlock/upload/confirm, receiver confirm, completed edit/reset, reconfirmation, mark-paid reference, PIN reset, and link rotation.

- [ ] **Step 2: Document setup and migration**

README must explain:

- applying `20260730_acknowledgement_receipts.sql`;
- creating all required environment variables;
- keeping service-role secrets server-only;
- generating/resetting portal PINs; and
- supported image/count/size rules.

- [ ] **Step 3: Run formatting and the full unit/component suite**

Run:

```bash
rtk pnpm exec prettier --check .
rtk pnpm test:run
```

Expected: formatting check and all tests pass.

- [ ] **Step 4: Run static and production checks**

Run:

```bash
rtk tsc --noEmit
rtk pnpm build
```

Expected: TypeScript and Next production build pass.

- [ ] **Step 5: Run E2E when the configured backend is available**

Run: `rtk pnpm test:e2e -- e2e/acknowledgement-receipts.spec.ts`

Expected: all acknowledgement scenarios pass, or the suite reports its explicit missing-test-backend skip.

- [ ] **Step 6: Inspect final migration and secret boundaries**

Run:

```bash
rtk proxy rg -n "SUPABASE_SERVICE_ROLE_KEY|pin_hash|SITE_SESSION_SECRET|ACKNOWLEDGEMENT_SESSION_SECRET" src
rtk proxy rg -n "GRANT|REVOKE|ROW LEVEL SECURITY|SECURITY DEFINER|search_path" supabase/migrations/20260730_acknowledgement_receipts.sql
rtk git diff --check
```

Expected: secrets appear only in server/config code, privileged database functions have explicit grants and search paths, and the diff has no whitespace errors.

- [ ] **Step 7: Commit verification and documentation**

```bash
rtk git add e2e/acknowledgement-receipts.spec.ts README.md .env.example env.example
rtk git commit -m "test(receipts): verify acknowledgement workflow"
```

- [ ] **Step 8: Run final repository verification**

Run:

```bash
rtk git status --short
rtk pnpm test:run
rtk tsc --noEmit
rtk pnpm build
```

Expected: clean worktree after the final commit and every available verification command passes.
