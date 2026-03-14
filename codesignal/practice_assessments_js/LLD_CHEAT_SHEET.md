# LLD Cheat Sheet — Patterns Common to Every Problem

> Banking System · File Storage · In-Memory Database

---

## 1. State — always a `Map` in the constructor

```js
constructor() {
  this.items = new Map(); // primary store
}
```

Access with `this.items.get(id)`, write with `this.items.set(id, value)`,
check existence with `this.items.has(id)`, remove with `this.items.delete(id)`.

---

## 2. The Universal Output Pipeline — **Spread → Filter → Sort → Slice → Map → Join**

Every search / ranking operation uses this **exact** chain in this **exact** order:

```js
[...this.items.entries()]               // 1. SPREAD  — turn Map into array of [key, value]
  .filter(([key, val]) => /* keep? */)  // 2. FILTER  — drop unwanted entries
  .sort(([aKey, aVal], [bKey, bVal]) => {
    if (bVal.metric !== aVal.metric)    // 3. SORT    — primary metric DESC
      return bVal.metric - aVal.metric;
    return aKey < bKey ? -1 : 1;       //             tie-break by name ASC
  })
  .slice(0, n)                          // 4. SLICE   — top N only
  .map(([key, val]) => `${key}(${val.metric})`) // 5. MAP — format each entry
  .join(', ');                          // 6. JOIN    — comma-space separated string
```

**Memory trick:** _"Spread, Filter, Sort, Slice, Map, Join"_ — **SF³MJ**

### When you only need keys (no value in output):

```js
[...this.items.keys()]
  .filter(key => /* condition */)
  .sort()              // lexicographic ASC — no custom comparator needed
  .join(', ');
```

### The sort comparator — two lines, always the same shape:

```js
// Line 1: primary sort — higher number first (DESC)
if (bVal.metric !== aVal.metric) return bVal.metric - aVal.metric;
// Line 2: tie-break — earlier alphabetically first (ASC)
return aKey < bKey ? -1 : 1;
```

---

## 3. TTL / Expiry — `expiresAt` is an **absolute** timestamp

Store the *deadline*, not the countdown:

```js
const expiresAt = ttl !== null ? timestamp + ttl : null;
//                               ↑ add TTL to current time once, store forever
```

### Check if something is still alive:

```js
_isAlive(entity, timestamp) {
  return entity.expiresAt === null || timestamp < entity.expiresAt;
  //     null = lives forever      OR  not yet expired
}
```

`null` means "no TTL — live forever". Always check `null` first.

### TTL recalculation when restoring a snapshot:

```js
if (entity.expiresAt === null) {
  // no TTL — restore as-is, lives forever
  restored.expiresAt = null;
} else {
  const remaining    = entity.expiresAt - snapshotTimestamp; // how much was left
  const newExpiresAt = restoreTimestamp  + remaining;        // re-anchor to now
  if (newExpiresAt <= restoreTimestamp) { /* already expired — skip */ }
  else restored.expiresAt = newExpiresAt;
}
```

---

## 4. Snapshot Before You Mutate (Rollback / Restore / Backup)

The snapshot must happen as the **first line** of every mutating method,
*before* the state changes:

```js
mutatingMethod(timestamp, ...args) {
  this._snapshot(timestamp);   // ← FIRST — capture state before the change
  // ... now make the change
}

_snapshot(timestamp) {
  const snap = new Map();
  for (const [key, val] of this.items) {
    snap.set(key, { ...val }); // shallow copy each entry
  }
  this.snapshots.push({ timestamp, data: snap });
}
```

To restore, find the most recent snapshot at or before the target timestamp:

```js
const entry = [...this.snapshots].reverse().find(s => s.timestamp <= timestamp);
```

---

## 5. Return Value Conventions

| Situation | Return |
|---|---|
| Success with a value | `String(numericValue)` — e.g. `String(account.balance)` |
| Boolean success | `'true'` or `'false'` (string, not boolean) |
| Not found / invalid | `''` (empty string) |
| Ranked/search list | pipeline result — already a string via `.join(', ')` |

---

## 6. Private Helpers Keep Public Methods Clean

```js
// Public method — only guards + dispatch
deposit(timestamp, id, amount) {
  const acct = this._get(id);
  if (!acct) return '';          // guard
  return this._executeDeposit(acct, amount); // delegate
}

// Private core — raw mutation, no guards
_executeDeposit(acct, amount) {
  acct.balance += amount;
  return String(acct.balance);
}

// Private lookup
_get(id) {
  return this.items.get(id) ?? null;
}
```

Naming convention: `_camelCase` for helpers that are never called from outside the class.
