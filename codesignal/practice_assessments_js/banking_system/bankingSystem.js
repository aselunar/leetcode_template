/**
 * Banking System — Levels 1–4
 *
 * State shape (build it up per level):
 *   accounts: Map<id, { balance, history, spent, txCount }>
 *     history: [{ type, amount }]  ← most-recent LAST; slice(-n).reverse() to return
 *     spent:   total WITHDRAW + TRANSFER_OUT (for TOP_SPENDERS / CASHBACK)
 *     txCount: total transactions (for TOP_ACTIVITY)
 *
 * Level 3 additions:
 *   pendingPayments: Map<paymentId, { accountId, amount, srcId?, tgtId? }>
 *   scheduledPayments: [{ executeAt, accountId, amount, type }]
 *   paymentCounter: number
 *
 * Level 4 addition:
 *   mergedInto: Map<id, newId>  ← tombstone for merged accounts (not needed if we just delete)
 */
class BankingSystem {
  constructor() {
    // Map<accountId, { balance, history, spent, txCount }>
    this.accounts = new Map();

    // Level 3: two-factor pending payments + scheduled queue
    this.pendingPayments = new Map(); // paymentId → {accountId, amount, srcId?, tgtId?}
    this.scheduledPayments = [];      // [{executeAt, accountId, amount, type}]
    this.paymentCounter = 0;
  }

  // ─── helpers ──────────────────────────────────────────────────────────────

  _getAccount(id) {
    return this.accounts.get(id) || null;
  }

  // Call at the START of every public op to flush due scheduled payments.
  // KEY: process in chronological order; only those with executeAt <= current ts.
  _processScheduled(timestamp) {
    const due = this.scheduledPayments
      .filter(p => p.executeAt <= timestamp)
      .sort((a, b) => a.executeAt - b.executeAt);
    this.scheduledPayments = this.scheduledPayments.filter(p => p.executeAt > timestamp);

    for (const p of due) {
      const acct = this._getAccount(p.accountId);
      if (!acct) continue; // account may have been merged/deleted
      if (p.type === 'DEPOSIT') {
        acct.balance += p.amount;
        acct.history.push({ type: 'DEPOSIT', amount: p.amount });
        acct.txCount++;
      } else if (p.type === 'WITHDRAW') {
        if (acct.balance >= p.amount) {
          acct.balance -= p.amount;
          acct.spent += p.amount;
          acct.history.push({ type: 'WITHDRAW', amount: p.amount });
          acct.txCount++;
        }
      }
    }
  }

  // ─── Level 1: CREATE, DEPOSIT, WITHDRAW, TRANSFER ─────────────────────────

  createAccount(timestamp, accountId) {
    // Edge: duplicate → "false"; new → "true"
    // NOTE: timestamp is stored with account but no time-based logic uses it in L1
    if (this.accounts.has(accountId)) return 'false';
    this.accounts.set(accountId, {
      balance: 0,
      history: [],
      spent: 0,
      txCount: 0,
    });
    return 'true';
  }

  deposit(timestamp, accountId, amount) {
    this._processScheduled(timestamp);
    const acct = this._getAccount(accountId);
    if (!acct) return '';
    acct.balance += amount;
    acct.history.push({ type: 'DEPOSIT', amount });
    acct.txCount++;
    return String(acct.balance);
  }

  withdraw(timestamp, accountId, amount) {
    this._processScheduled(timestamp);
    const acct = this._getAccount(accountId);
    if (!acct) return '';
    if (acct.balance < amount) return '';

    // Level 3: amounts > 1000 require ACCEPT_PAYMENT before executing
    if (amount > 1000) {
      this.paymentCounter++;
      const paymentId = `payment_${this.paymentCounter}`;
      this.pendingPayments.set(paymentId, { accountId, amount, type: 'WITHDRAW' });
      acct.txCount++;
      return paymentId;
    }

    acct.balance -= amount;
    acct.spent += amount;
    acct.history.push({ type: 'WITHDRAW', amount });
    acct.txCount++;
    return String(acct.balance);
  }

  transfer(timestamp, srcId, tgtId, amount) {
    this._processScheduled(timestamp);
    const src = this._getAccount(srcId);
    const tgt = this._getAccount(tgtId);
    if (!src || !tgt) return '';
    if (src.balance < amount) return '';

    // Level 3: amounts > 1000 require ACCEPT_PAYMENT
    if (amount > 1000) {
      this.paymentCounter++;
      const paymentId = `payment_${this.paymentCounter}`;
      this.pendingPayments.set(paymentId, { accountId: srcId, amount, type: 'TRANSFER', srcId, tgtId });
      src.txCount++;
      tgt.txCount++;
      return paymentId;
    }

    src.balance -= amount;
    src.spent += amount;
    tgt.balance += amount;
    src.history.push({ type: 'TRANSFER_OUT', amount });
    tgt.history.push({ type: 'TRANSFER_IN', amount });
    src.txCount++;
    tgt.txCount++;
    return String(src.balance);
  }

  // ─── Level 2: TOP_SPENDERS, GET_PAYMENT_HISTORY ───────────────────────────
  // → Add `spent` tracking to WITHDRAW + TRANSFER_OUT above (already done).

  topSpenders(timestamp, n) {
    // Sort: spent DESC → accountId ASC (lexicographic)
    const sorted = [...this.accounts.entries()]
      .sort(([aId, aData], [bId, bData]) => {
        if (bData.spent !== aData.spent) return bData.spent - aData.spent;
        return aId < bId ? -1 : 1;
      })
      .slice(0, n);
    return sorted.map(([id, d]) => `${id}(${d.spent})`).join(', ');
  }

  getPaymentHistory(timestamp, accountId, n) {
    const acct = this._getAccount(accountId);
    if (!acct) return '';
    // Most recent first: slice off the last n, then reverse
    const recent = acct.history.slice(-n).reverse();
    if (recent.length === 0) return '';
    return recent.map(t => `${t.type}(${t.amount})`).join(', ');
  }

  // ─── Level 3: SCHEDULE_PAYMENT, ACCEPT_PAYMENT, TOP_ACTIVITY ──────────────
  // → WITHDRAW/TRANSFER already check amount > 1000 (above).
  // TRANSITION NOTE: modify _processScheduled() in constructor area (already done).

  schedulePayment(timestamp, accountId, amount, paymentType, delay) {
    if (!this._getAccount(accountId)) return '';
    this.scheduledPayments.push({
      executeAt: timestamp + delay,
      accountId,
      amount,
      type: paymentType,
    });
    return 'true';
  }

  acceptPayment(timestamp, accountId, paymentId) {
    this._processScheduled(timestamp);
    const pending = this.pendingPayments.get(paymentId);
    if (!pending) return '';
    this.pendingPayments.delete(paymentId);

    if (pending.type === 'WITHDRAW') {
      const acct = this._getAccount(pending.accountId);
      if (!acct || acct.balance < pending.amount) return '';
      acct.balance -= pending.amount;
      acct.spent += pending.amount;
      acct.history.push({ type: 'WITHDRAW', amount: pending.amount });
      return String(acct.balance);
    }

    if (pending.type === 'TRANSFER') {
      const src = this._getAccount(pending.srcId);
      const tgt = this._getAccount(pending.tgtId);
      if (!src || !tgt || src.balance < pending.amount) return '';
      src.balance -= pending.amount;
      src.spent += pending.amount;
      tgt.balance += pending.amount;
      src.history.push({ type: 'TRANSFER_OUT', amount: pending.amount });
      tgt.history.push({ type: 'TRANSFER_IN', amount: pending.amount });
      return String(src.balance);
    }

    return '';
  }

  topActivity(timestamp, n) {
    // txCount includes ALL ops (deposits, withdraws, transfers, scheduled)
    const sorted = [...this.accounts.entries()]
      .sort(([aId, aData], [bId, bData]) => {
        if (bData.txCount !== aData.txCount) return bData.txCount - aData.txCount;
        return aId < bId ? -1 : 1;
      })
      .slice(0, n);
    return sorted.map(([id, d]) => `${id}(${d.txCount})`).join(', ');
  }

  // ─── Level 4: MERGE_ACCOUNTS, GET_BANK_STATISTICS, CASHBACK ──────────────
  // TRANSITION NOTE: merge combines balance + history + scheduled payments.

  mergeAccounts(timestamp, id1, id2) {
    this._processScheduled(timestamp);
    const acct1 = this._getAccount(id1);
    const acct2 = this._getAccount(id2);
    if (!acct1 || !acct2) return '';

    // Merge balance, history, spent, txCount into acct1
    acct1.balance += acct2.balance;
    acct1.history = acct1.history.concat(acct2.history);
    acct1.spent += acct2.spent;
    acct1.txCount += acct2.txCount;

    // Transfer any scheduled payments referencing acct2 → acct1
    for (const sp of this.scheduledPayments) {
      if (sp.accountId === id2) sp.accountId = id1;
    }
    // Transfer any pending payments referencing acct2 → acct1
    for (const [, p] of this.pendingPayments) {
      if (p.accountId === id2) p.accountId = id1;
      if (p.srcId === id2) p.srcId = id1;
      if (p.tgtId === id2) p.tgtId = id1;
    }

    this.accounts.delete(id2);
    return String(acct1.balance);
  }

  getBankStatistics(timestamp) {
    this._processScheduled(timestamp);
    const active = [...this.accounts.values()];
    const total = active.length;
    const totalBalance = active.reduce((s, a) => s + a.balance, 0);
    // Math.floor for average_balance
    const avg = total === 0 ? 0 : Math.floor(totalBalance / total);
    return `total_accounts:${total},total_balance:${totalBalance},average_balance:${avg}`;
  }

  cashback(timestamp, accountId, percentage) {
    this._processScheduled(timestamp);
    const acct = this._getAccount(accountId);
    if (!acct) return '';
    if (acct.spent === 0) return '';
    // Math.floor the cashback amount
    const amount = Math.floor(acct.spent * percentage / 100);
    acct.balance += amount;
    acct.history.push({ type: 'DEPOSIT', amount });
    return String(amount);
  }
}

module.exports = BankingSystem;
