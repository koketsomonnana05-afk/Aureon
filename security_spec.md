# Phase 0: Payload-First Security TDD

## 1. Data Invariants
- A user document can only be created and updated by the user themself (ID must match `request.auth.uid`).
- The `userId` field is immortal and cannot be updated once created.
- A journal entry belongs strictly to a user, and its ID must match the parameter `journalId`.
- A journal entry cannot be updated after creation (immutable).
- Public profiles require `name` and `xp` to be listed on the leaderboard.
- `lastCompletedDate` and `history` can only be updated if `update` strictly limits fields via `affectedKeys()`.

## 2. The "Dirty Dozen" Payloads

1. **Shadow Update (Ghost Field)**: Attempting to insert `isAdmin: true` into `users/{userId}`.
2. **ID Mismatch**: `userId` payload field does not match the actual authenticated UID in `users/{userId}`.
3. **Type Poisoning**: `xp` is a massive string instead of a number.
4. **Denial of Wallet (Huge String)**: `name` on `publicProfiles` is a 1.5MB block of text.
5. **Array Exhaustion (Huge Array)**: `tasks` array contains 10,000 entries.
6. **Orphaned Write**: Trying to create a journal without setting its `userId` properly.
7. **Identity Spoofing**: Changing the `userId` field during an update.
8. **Email Spoofing (Unverified Email)**: Doing a write with an unverified email (should reject).
9. **Mutation of Immutable Fields**: Attempting to update a journal entry.
10. **Bypassing Affected Keys**: Passing `status` in an update when not explicitly allowed by `affectedKeys().hasOnly()`.
11. **Client Delegation**: Reading `publicProfiles` with a spoofed `xp` value (not applicable due to `resource.data.xp >= 0` check).
12. **PII Blanket Leak**: Attempting to read another user's private data (`users/{userId}`).

## 3. The Test Runner
See `firestore.rules.test.ts` for detailed Firebase rules verification.
