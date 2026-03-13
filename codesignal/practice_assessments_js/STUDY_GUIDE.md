# OA Study Guide: Meta-Style CodeSignal Progressive Assessments

> **Problems covered:** Banking System · File Storage · In-Memory Database  
> **Format:** 4 levels each — each level builds on the previous. Memorize level-by-level.

---

## Table of Contents
1. [How to Use This Guide](#1-how-to-use-this-guide)
2. [Banking System Cheat Sheet](#2-banking-system-cheat-sheet)
3. [File Storage Cheat Sheet](#3-file-storage-cheat-sheet)
4. [In-Memory Database Cheat Sheet](#4-in-memory-database-cheat-sheet)
5. [Cross-Problem Confusion Avoidance](#5-cross-problem-confusion-avoidance)
6. [Timed Recall Drills](#6-timed-recall-drills)
7. [Spaced Repetition (Anki) Templates](#7-spaced-repetition-anki-templates)
8. [Test-Day Checklist](#8-test-day-checklist)

---

## 1. How to Use This Guide

**Daily practice sequence (3 days before OA):**
1. Read one problem's Level 1 spec → close it → write the solution from memory
2. Run `npm run test:bank:1` (or `:file:1`, `:db:1`) to validate
3. Repeat for Level 2, then refactor Level 1+2 together
4. Do the same for Levels 3 and 4

**Day-before sequence:**
- Run through each problem's drill questions in Section 6
- Recite edge cases aloud (talk through them)
- Check the cross-problem confusion table (Section 5)

**Test day:**
- Use the checklist in Section 8 before each level

---

## 2. Banking System Cheat Sheet

### State Schema (build incrementally)
```
accounts: Map<id, {
  balance: number,      // L1
  history: [{type, amount}], // L2 — most recent LAST; slice(-n).reverse() to return
  spent: number,        // L2 — WITHDRAW + TRANSFER_OUT only (for topSpenders/cashback)
  txCount: number,      // L3 — ALL transactions (for topActivity)
}>
pendingPayments: Map<paymentId, {accountId, amount, type, srcId?, tgtId?}>  // L3
scheduledPayments: [{executeAt, accountId, amount, type}]                   // L3
paymentCounter: number                                                       // L3
```

### Level-by-Level Operations

| Level | Operation | Returns | Edge Cases |
|-------|-----------|---------|------------|
| 1 | `createAccount(ts, id)` | `"true"` / `"false"` | Duplicate → `"false"` |
| 1 | `deposit(ts, id, amt)` | new balance string | Missing → `""` |
| 1 | `withdraw(ts, id, amt)` | new balance string | Missing or insufficient → `""` |
| 1 | `transfer(ts, src, tgt, amt)` | src new balance string | Either missing, src insufficient → `""` |
| 2 | `topSpenders(ts, n)` | `"id(spent), ..."` | Tie → sort id ASC; n > count → return all |
| 2 | `getPaymentHistory(ts, id, n)` | `"TYPE(amt), ..."` | Most recent FIRST; n > count → return all; missing → `""` |
| 3 | `schedulePayment(ts, id, amt, type, delay)` | `"true"` / `""` | Missing account → `""` |
| 3 | `acceptPayment(ts, id, paymentId)` | new balance | Invalid/used paymentId → `""` |
| 3 | `topActivity(ts, n)` | `"id(count), ..."` | Tie → sort id ASC |
| 4 | `mergeAccounts(ts, id1, id2)` | id1 new balance | Either missing → `""` |
| 4 | `getBankStatistics(ts)` | `"total_accounts:N,total_balance:B,average_balance:A"` | avg = Math.floor |
| 4 | `cashback(ts, id, pct)` | cashback amount (not new balance!) | No spending → `""` |

### Critical Edge Cases

```
❌ WITHDRAW / TRANSFER with amount > 1000 (L3):
   → Returns "payment_N" (NOT balance)
   → Balance NOT deducted until acceptPayment()
   → txCount IS incremented immediately

❌ topSpenders vs topActivity:
   topSpenders: sorted by SPENT (WITHDRAW + TRANSFER_OUT)
   topActivity: sorted by TOTAL TRANSACTION COUNT (every op)

❌ getPaymentHistory format:
   DEPOSIT, WITHDRAW, TRANSFER_IN, TRANSFER_OUT (no plain "TRANSFER")

❌ cashback returns the AMOUNT deposited, NOT the new balance
   Math.floor( spent * pct / 100 )

❌ mergeAccounts: also re-assign scheduled/pending payments from id2 → id1
```

### Level Transition Notes

**L1 → L2:**
- Start tracking `spent` inside withdraw and transfer (outgoing only)
- Start recording `history` array in every deposit/withdraw/transfer

**L2 → L3:**
- Add `_processScheduled(timestamp)` call at the START of every op
- In withdraw/transfer, check `if (amount > 1000)` and return paymentId instead
- Add `txCount` tracking to all operations

**L3 → L4:**
- mergeAccounts must combine balance + history + spent + txCount
- Also re-point any pending/scheduled payments from id2 to id1
- getBankStatistics only counts accounts still in the Map (deleted by merge = gone)

---

## 3. File Storage Cheat Sheet

### State Schema
```
files: Map<name, {
  size: number,
  expiresAt: null | number,  // L3: null=permanent, number=timestamp when expired
  uploadedAt: number,        // L3
  ttl: null | number,        // L3: stored for rollback recalculation
}>
history: [{timestamp, snapshot: Map}]  // L4: for rollback
```

### Level-by-Level Operations

| Level | Operation | Returns | Edge Cases |
|-------|-----------|---------|------------|
| 1 | `fileUpload(name, size)` | void | Duplicate → throw |
| 1 | `fileGet(name)` | size or undefined | Missing → undefined |
| 1 | `fileCopy(src, dest)` | void | Missing src → throw; dest exists → overwrite |
| 2 | `fileSearch(prefix)` | string[] top 10 | Sort: size DESC → name ASC |
| 3 | `fileUploadAt(ts, name, size[, ttl])` | void | Alive duplicate → throw |
| 3 | `fileGetAt(ts, name)` | size or undefined | Expired → undefined |
| 3 | `fileCopyAt(ts, src, dest)` | void | Expired src → throw |
| 3 | `fileSearchAt(ts, prefix)` | string[] | Only alive files |
| 4 | `rollback(ts)` | void | Restore to state at ts; recalculate TTLs |

### Critical Edge Cases

```
❌ File "alive" rule:
   expiresAt === null → permanent
   timestamp < expiresAt → alive
   timestamp >= expiresAt → DEAD (expired)
   → Boundary: file WITH ttl=5 uploaded at t=10 expires at t=15
     alive at t=14, DEAD at t=15

❌ fileCopy in L1 creates a permanent copy (no TTL inheritance)

❌ fileSearch returns an ARRAY of strings like ["file.txt(100)", "file2.txt(50)"]
   NOT a comma-separated string (unlike banking/db problems!)

❌ ROLLBACK TTL recalculation:
   remaining = originalExpiresAt - snapshotTimestamp
   newExpiresAt = rollbackTimestamp + remaining
   If newExpiresAt <= rollbackTimestamp → file should not be restored
```

### Level Transition Notes

**L1 → L2:**
- No state changes needed; add fileSearch using filter + sort

**L2 → L3:**
- Add `expiresAt` field to all file entries (null for L1/L2 files)
- Create `*_AT` variants of all operations
- `_isAlive(file, timestamp)` helper is key

**L3 → L4:**
- Before each mutating op, call `_recordHistory(timestamp)` to snapshot state
- On rollback: iterate snapshot, recalculate TTL for time-bounded files

---

## 4. In-Memory Database Cheat Sheet

### State Schema
```
db: Map<key, Map<field, {
  value: string,
  expiresAt: null | number,  // L3: null=permanent, number=exclusive expiry timestamp
}>>
backups: Map<backupId, { timestamp, data: Map<key, Map<field, {value, expiresAt}>> }>  // L4
backupCounter: number  // L4
```

### Level-by-Level Operations

| Level | Operation | Returns | Edge Cases |
|-------|-----------|---------|------------|
| 1 | `setField(key, field, value)` | value | Creates key if missing; overwrites if exists |
| 1 | `getField(key, field)` | value or `""` | Missing key or field → `""` |
| 1 | `deleteField(key, field)` | `"true"` / `"false"` | Last field → removes key too |
| 1 | `get(key)` | `"f1(v1), f2(v2)"` | Fields sorted ALPHA; missing → `""` |
| 2 | `scan(prefix)` | `"k1, k2, ..."` | Sorted alpha; no match → `""` |
| 2 | `scanByField(field, value)` | `"k1, k2, ..."` | Sorted alpha; no match → `""` |
| 2 | `delete(key)` | `"true"` / `"false"` | Removes entire key+all fields |
| 2 | `topNKeys(n)` | `"k1(c1), k2(c2)"` | Sort: count DESC → key ASC |
| 3 | `setFieldAt(ts, key, field, value)` | value | No TTL |
| 3 | `setFieldWithTTL(ts, key, field, value, ttl)` | value | expiresAt = ts + ttl |
| 3 | `getFieldAt(ts, key, field)` | value or `""` | Expired → `""` |
| 3 | `getAt(ts, key)` | `"f1(v1), ..."` | Only alive fields; all expired → `""` |
| 3 | `deleteFieldAt(ts, key, field)` | `"true"` / `"false"` | Expired → `"false"` |
| 3 | `scanAt(ts, prefix)` | `"k1, k2"` | Only keys with ≥1 alive field |
| 3 | `scanByFieldAt(ts, field, value)` | `"k1, k2"` | Only alive matching fields |
| 4 | `backup(ts)` | `"backup_N"` | Only snapshots alive fields |
| 4 | `restore(ts, backupId)` | count string or `""` | Recalculates TTLs |
| 4 | `compare(b1, b2)` | diff keys comma-separated | Either invalid → `""` |
| 4 | `getBackupInfo(backupId)` | `"keys:N,fields:M,timestamp:T"` | Invalid → `""` |

### Critical Edge Cases

```
❌ TTL boundary (milliseconds):
   setFieldWithTTL(10, ..., ttl=5) → expires at 15
   alive at getFieldAt(14) ✓
   dead  at getFieldAt(15) ✗  ← EXCLUSIVE boundary

❌ deleteField removes the key if it was the last field — this can break scanAt

❌ scan/scanByField (L2) vs scanAt/scanByFieldAt (L3):
   L2 versions DON'T check TTL (no timestamp)
   L3 versions DO check TTL

❌ getAt returns fields sorted ALPHABETICALLY (same as get in L1)
   Don't forget to sort even when filtering by TTL

❌ restore recalculates TTL:
   remaining = backup.field.expiresAt - backup.timestamp
   newExpiresAt = restoreTimestamp + remaining
   If newExpiresAt <= restoreTimestamp → skip field (already would be expired)

❌ compare: a key differs if it appears in only ONE backup, OR if any field VALUE differs
   (field count difference also causes a "differs" state)
```

### Level Transition Notes

**L1 → L2:**
- No state changes; scan/scanByField are read-only filters on existing db

**L2 → L3:**
- Add `expiresAt: null` to ALL existing setField calls (or default to null)
- Add `_isAlive(fieldMeta, timestamp)` helper
- Add `_getAliveFields(key, timestamp)` helper for reuse across getAt/scanAt

**L3 → L4:**
- backup() deep-clones the db, filtering alive fields only
- restore() replaces this.db entirely
- compare() diffs two snapshot Maps key-by-key, field-by-field

---

## 5. Cross-Problem Confusion Avoidance

| Confusion Point | Banking | File Storage | In-Memory DB |
|----------------|---------|--------------|--------------|
| **TTL unit** | N/A | seconds | milliseconds |
| **"Expired at boundary"** | N/A | `ts >= expiresAt` dead | `ts >= expiresAt` dead |
| **Primary key** | accountId | fileName | key (string) |
| **Secondary key** | none | none | field (string) |
| **Return for search** | `"id(val), ..."` (string) | `["name(size)", ...]` (array!) | `"k1, k2, ..."` (string) |
| **Sort tiebreak** | name ASC | name ASC | key/field ASC |
| **"amount > 1000" rule** | L3: returns paymentId | N/A | N/A |
| **Level 4 key feature** | merge + statistics | rollback | backup/restore |
| **"spent" tracking** | WITHDRAW + TRANSFER_OUT | N/A | N/A |
| **History tracking** | per account, ordered | N/A (use rollback snapshots) | N/A (use backups) |

---

## 6. Timed Recall Drills

### Drill Format
Each drill: close the code → answer from memory → check against spec or run tests.

### Banking System Drills (15 min per level)

**Level 1 — 5 min:**
```
Q: createAccount(1,"a"), createAccount(2,"a") → what do you return each time?
A: "true", "false"

Q: deposit(1,"ghost",100) → return value?
A: ""

Q: withdraw(1,"a", 600) after deposit(1,"a",500) → return?
A: "" (insufficient)

Q: transfer(1,"a","b",300) after deposit(1,"a",1000) → return for "a"?
A: "700"
```

**Level 2 — 5 min:**
```
Q: Two accounts both spent 500. topSpenders(ts, 2) output?
A: "a(500), b(500)"  ← sorted alphabetically on tie

Q: After DEPOSIT(100), WITHDRAW(50), TRANSFER_OUT(25) — getPaymentHistory most recent 2?
A: "TRANSFER_OUT(25), WITHDRAW(50)"  ← most recent FIRST

Q: Is a plain TRANSFER in history? What are the two labels?
A: No. "TRANSFER_IN" or "TRANSFER_OUT"
```

**Level 3 — 5 min:**
```
Q: withdraw(ts, "a", 1500) when balance=5000 → what returns?
A: "payment_1" (or payment_N)

Q: Before acceptPayment fires, is balance deducted?
A: NO

Q: schedulePayment(10, "a", 200, "DEPOSIT", 5) then deposit(20, "a", 0) → balance?
A: 200 (scheduled runs before the deposit at t=20 since executeAt=15 < 20)
```

**Level 4 — 5 min:**
```
Q: cashback returns what — new balance or cashback amount?
A: CASHBACK AMOUNT (not new balance!)

Q: After mergeAccounts(ts,"a","b"), what happens to scheduled payments on "b"?
A: They transfer to "a"

Q: getBankStatistics average rounds how?
A: Math.floor (always DOWN)
```

### File Storage Drills

**Level 2 — 3 min:**
```
Q: fileSearch returns what type — string or array?
A: ARRAY of strings like ["file.txt(100)"]

Q: Sort order for fileSearch?
A: Size DESC, then fileName ASC on tie. Top 10 only.
```

**Level 3 — 3 min:**
```
Q: File uploaded at t=10 with ttl=5. Is it alive at t=15?
A: NO (expired AT 15, alive only up to 14)

Q: fileCopyAt — does the copy inherit TTL?
A: NO — copy has no TTL (permanent)
```

**Level 4 — 3 min:**
```
Q: rollback TTL formula?
A: remaining = originalExpiresAt - snapshotTs; newExpiresAt = rollbackTs + remaining
```

### In-Memory Database Drills

**Level 1 — 3 min:**
```
Q: getField on missing key → return?
A: "" (empty string, not undefined or null)

Q: deleteField on last field → what else happens?
A: The key itself is removed from db
```

**Level 3 — 3 min:**
```
Q: setFieldWithTTL(10, "k","f","v", 5). At timestamp=15, is field alive?
A: NO — expires at exactly 15, valid only through 14

Q: getAt returns fields in what order?
A: Alphabetically by field name (same as L1 get)
```

**Level 4 — 5 min:**
```
Q: backup(20) — does it include expired fields?
A: NO — only fields alive at timestamp 20

Q: restore(50, "backup_1") — if backup was taken at t=10 and a field had expiresAt=30...
A: remaining = 30-10 = 20; newExpiresAt = 50+20 = 70

Q: compare("backup_1", "backup_2") when one key exists in b1 but not b2?
A: That key appears in the diff output

Q: getBackupInfo format?
A: "keys:N,fields:M,timestamp:T"
```

---

## 7. Spaced Repetition (Anki) Templates

### Recommended Anki Deck Structure

Create 3 decks: `OA::Banking`, `OA::FileStorage`, `OA::InMemoryDB`

### Card Format (Q&A)

**Type 1: Edge case cards**
```
Front: [Banking L1] withdraw with insufficient funds returns?
Back: "" (empty string)
Tags: banking, level1, edge-case
```

**Type 2: Return format cards**
```
Front: [Banking L2] topSpenders sort order?
Back: spent DESC, then accountId ASC (alphabetical) on tie
Tags: banking, level2, sort
```

**Type 3: Transition cards**
```
Front: [Banking L2→L3] What new tracking must you add to withdraw/transfer?
Back:
  1. Check if amount > 1000 → return paymentId instead
  2. Call _processScheduled(timestamp) at start of each op
  3. Add txCount++ to all ops
Tags: banking, level3, transition
```

**Type 4: Formula cards**
```
Front: [InMemoryDB L3] TTL expiry formula?
Back: expiresAt = timestamp + ttl; field valid at [timestamp, timestamp+ttl); dead AT timestamp+ttl
Tags: db, level3, ttl
```

**Type 5: Code recall cards**
```
Front: [Banking] What's the state shape at Level 3?
Back:
  accounts: Map<id, {balance, history, spent, txCount}>
  pendingPayments: Map<paymentId, {accountId, amount, type, srcId?, tgtId?}>
  scheduledPayments: [{executeAt, accountId, amount, type}]
  paymentCounter: number
Tags: banking, state, level3
```

### Suggested Anki Settings
- New cards per day: 10
- Max reviews per day: 50
- Graduating interval: 3 days
- Easy interval: 7 days

### Free Anki Resources
- [AnkiWeb](https://ankiweb.net/) — free sync across devices
- Use "Basic (and reversed card)" type so you practice both directions

---

## 8. Test-Day Checklist

### Before You Start Each Problem

- [ ] Read the ENTIRE problem spec before writing a single line
- [ ] Sketch the state object(s) on paper (or in comments)
- [ ] Note the return types for each operation (string? array? void?)
- [ ] Identify the sorting rules for any ranking/search operations

### Before Each Level

- [ ] Re-read only that level's new operations
- [ ] Identify what changes in existing operations (if any)
- [ ] Note new state you need to track
- [ ] Implement, run tests, then move on — don't over-optimize

### Level-Specific Reminders

**Banking System:**
- [ ] L2: Are you tracking `spent` (only outgoing) vs `txCount` (everything)?
- [ ] L3: Does every op call `_processScheduled(timestamp)` first?
- [ ] L3: Does withdraw/transfer check `amount > 1000` before executing?
- [ ] L4: Does `cashback` return the CASHBACK AMOUNT, not the new balance?

**File Storage:**
- [ ] L3: TTL is in seconds; `expiresAt = uploadTimestamp + ttl`
- [ ] L3: Alive check is `timestamp < expiresAt` (strictly less than)
- [ ] L4: Are you recording state BEFORE each mutation (for rollback)?

**In-Memory Database:**
- [ ] L1: Does `deleteField` remove the key if it was the last field?
- [ ] L1: Does `get` sort fields ALPHABETICALLY?
- [ ] L3: TTL is in milliseconds; boundary is EXCLUSIVE (`timestamp >= expiresAt` = dead)
- [ ] L4: Does `restore` recalculate remaining TTL correctly?
- [ ] L4: Does `backup` only snapshot ALIVE fields at that timestamp?

### During the Test

- [ ] Submit after completing each level (partial credit)
- [ ] Don't get stuck on Level 4 — a working Level 3 scores better than broken Level 4
- [ ] Watch the test runner output for which specific tests are failing
- [ ] Keep comments minimal — the OA environment times you

### Common Bugs to Watch For

```
1. Off-by-one in TTL: file/field alive AT boundary or just before?
   → BOTH problems: dead AT expiresAt (exclusive)

2. topSpenders includes accounts with zero spending (they spent 0)
   vs topActivity counts only accounts that have done something

3. getPaymentHistory vs topSpenders: history is per-account;
   topSpenders aggregates across ALL accounts

4. In Banking L4, cashback() is NOT the same as deposit() — it doesn't
   update history[] or spent[] (depends on your interpretation; be consistent)

5. In InMemoryDB, scan() (L2) does NOT filter expired fields (no timestamp).
   Only scanAt() (L3) does.
```

---

*Run tests per level with: `npm run test:bank:1` through `:4`, `npm run test:file:1` through `:4`, `npm run test:db:1` through `:4`*
