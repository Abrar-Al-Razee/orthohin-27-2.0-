# Security Specification — ORTHOHIN '27 Portal

## 1. Data Invariants
1. Only the verified administrator (`abraralraze@gmail.com` with `email_verified == true`) can read, update, or delete direct hoodie `orders` (protecting student phone numbers and social contacts as PII).
2. Public visitors can submit a new `orders` document only with `status == 'Pending'`, valid size (`S`–`XXXL`), quantity (`1`–`5`), bounded string lengths, and server timestamp `createdAt == request.time`.
3. Public visitors can register in `batchmates` with strict schema bounds and `createdAt == request.time`, but only the verified admin can modify or remove existing `batchmates` records.
4. `notices`, `gallery`, `settings`, `adminTeam`, and `activityLogs` can only be created, updated, or deleted by the verified administrator (`abraralraze@gmail.com` with `email_verified == true`).
5. Every document ID must match `^[a-zA-Z0-9_\-]+$` (`<= 128` chars), and every string/list enforces explicit size boundaries to prevent resource exhaustion.

## 2. Dirty Dozen Attack Payloads (Expected: PERMISSION_DENIED)
1. **Unverified Admin Email Spoof**: Auth token has `email: "abraralraze@gmail.com"` with `email_verified: false` attempting to read `orders` -> DENIED.
2. **Non-Admin User Reading PII Orders**: Signed-in user with `email: "other@gmail.com"` listing `/orders` -> DENIED.
3. **Order Status Bypass on Create**: Public user creating `/orders/ord1` with `status: "Delivered"` -> DENIED (must be `"Pending"`).
4. **Order Shadow / Ghost Field**: Creating `/orders/ord1` with extra key `isPaid: true` -> DENIED by `hasOnly(...)`.
5. **Client Timestamp Forgery**: Creating `/batchmates/bm1` with backdated `createdAt` (`!= request.time`) -> DENIED.
6. **Public Notice Defacement**: Unauthenticated or non-admin user creating or updating `/notices/n1` -> DENIED.
7. **Public Hoodie Settings Tampering**: Non-admin updating `/settings/main` -> DENIED.
8. **Gallery Injection**: Non-admin creating or deleting `/gallery/g1` -> DENIED.
9. **Resource Poisoning (Oversized Name/Photo)**: Creating `/batchmates/bm1` with `name` of 500 characters or `photo` > 300,000 chars -> DENIED.
10. **ID Poisoning**: Creating `/batchmates/bad$id..!` -> DENIED by `isValidId()`.
11. **Batchmate Deletion by Non-Admin**: Non-admin deleting `/batchmates/bm1` -> DENIED.
12. **Activity Log Tampering**: Updating an existing `/activityLogs/log1` document -> DENIED (`allow update: if false`).
