# Security Specification — ORTHOHIN '27 Portal

## 1. Data Invariants
1. Only the verified administrator (`abraralraze@gmail.com` with `email_verified == true`) can read, update, or delete direct hoodie `orders` (which contain customer email and contact PII) and private `batchmateContacts` (protecting student email addresses, phone numbers, and contacts as PII).
2. Public visitors can submit a new `orders` document and matching non-PII `publicHoodieOrders` profile card only with `status == 'Pending'` and `paymentStatus == 'Due'`, valid size (`S`–`XXXL`), quantity (`1`–`5`), bounded string lengths, and server timestamp `createdAt == request.time`. Public readers on `publicHoodieOrders` can never view `email` or `contact`.
3. Public visitors can register in `batchmates` (public flip-card profile fields) and submit their `batchmateContacts` document (private admin-only email/phone) with strict schema bounds and `createdAt == request.time`, while only the verified admin can read `batchmateContacts` or modify/remove existing records.
4. `notices`, `gallery`, `settings`, `adminTeam`, and `activityLogs` can only be created, updated, or deleted by the verified administrator (`abraralraze@gmail.com` with `email_verified == true`).
5. Every document ID must match `^[a-zA-Z0-9_\-]+$` (`<= 128` chars), and every string/list enforces explicit size boundaries to prevent resource exhaustion.

## 2. Dirty Dozen Attack Payloads (Expected: PERMISSION_DENIED)
1. **Unverified Admin Email Spoof**: Auth token has `email: "abraralraze@gmail.com"` with `email_verified: false` attempting to read `orders` -> DENIED.
2. **Non-Admin User Reading PII Orders**: Signed-in user with `email: "other@gmail.com"` listing `/orders` -> DENIED.
3. **Order Payment/Status Bypass on Create**: Public user creating `/orders/ord1` or `/publicHoodieOrders/ord1` with `status: "Delivered"` or `paymentStatus: "Paid"` -> DENIED (must be `"Pending"` and `"Due"`).
4. **Order Shadow / Ghost Field**: Creating `/publicHoodieOrders/ord1` with `email` or `contact` or extra key `isPaid: true` -> DENIED by `hasOnly(...)`.
5. **Client Timestamp Forgery**: Creating `/batchmates/bm1` with backdated `createdAt` (`!= request.time`) -> DENIED.
6. **Public Notice Defacement**: Unauthenticated or non-admin user creating or updating `/notices/n1` -> DENIED.
7. **Public Hoodie Settings Tampering**: Non-admin updating `/settings/main` -> DENIED.
8. **Gallery Injection**: Non-admin creating or deleting `/gallery/g1` -> DENIED.
9. **Resource Poisoning (Oversized Name/Photo)**: Creating `/batchmates/bm1` with `name` of 500 characters or `photo` > 300,000 chars -> DENIED.
10. **ID Poisoning**: Creating `/batchmates/bad$id..!` -> DENIED by `isValidId()`.
11. **Batchmate Deletion by Non-Admin**: Non-admin deleting `/batchmates/bm1` -> DENIED.
12. **Activity Log Tampering**: Updating an existing `/activityLogs/log1` document -> DENIED (`allow update: if false`).
