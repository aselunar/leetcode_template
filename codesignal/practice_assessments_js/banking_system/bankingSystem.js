// Banking System — all 4 levels in one file
//
// READING THIS FILE: This is the final, all-levels-done implementation.
// On the actual OA you build incrementally:
//   L1 — write deposit/withdraw/transfer with NO _processDue call (it doesn't exist yet)
//   L2 — add topSpenders/getPaymentHistory (still no _processDue)
//   L3 — add _processDue + scheduled/pending state, then ADD the _processDue(timestamp)
//        call as the very first line of every existing L1/L2 method
//        (it's a no-op while this.scheduled is empty, so L1/L2 behavior is unchanged)
//   L4 — add merge/statistics/cashback on top
//
// Key insight: Map for O(1) account lookup; history array stores strings chronologically.

class BankingSystem {
  constructor() {
    // account_id -> { balance, history: string[], outgoing: number, activityCount: number }
    this.accounts = new Map();
    // LEVEL 3: reference_id -> { accountId, amount, type: 'WITHDRAW'|'TRANSFER', targetId }
    this.pending = new Map();
    // LEVEL 3: { executeAt, accountId, amount, type: 'DEPOSIT'|'WITHDRAW' }
    this.scheduled = [];
    this.paymentSeq = 0;
  }

  // === LEVEL 1: Initial Design & Basic Functions ===

  createAccount(timestamp, accountId) {
    if (this.accounts.has(accountId)) return 'false';
    this.accounts.set(accountId, { balance: 0, history: [], outgoing: 0, activityCount: 0 });
    return 'true';
  }

  deposit(timestamp, accountId, amount) {
    this._processDue(timestamp);
    const acc = this.accounts.get(accountId);
    if (!acc) return '';
    acc.balance += amount;
    acc.history.push(`DEPOSIT(${amount})`);
    acc.activityCount++;
    return String(acc.balance);
  }

  // TRANSITION L1→L2: track outgoing (+= amount) for TOP_SPENDERS; push to history for GET_PAYMENT_HISTORY
  // TRANSITION L2→L3: add >1000 guard at top of withdraw/transfer; return payment_id instead of executing
  withdraw(timestamp, accountId, amount) {
    this._processDue(timestamp);
    const acc = this.accounts.get(accountId);
    if (!acc || acc.balance < amount) return '';
    if (amount > 1000) {
      this.paymentSeq++;
      const ref = `payment_${this.paymentSeq}`;
      this.pending.set(ref, { accountId, amount, type: 'WITHDRAW', targetId: null });
      acc.activityCount++;
      return ref;
    }
    acc.balance -= amount;
    acc.outgoing += amount;
    acc.history.push(`WITHDRAW(${amount})`);
    acc.activityCount++;
    return String(acc.balance);
  }

  transfer(timestamp, sourceId, targetId, amount) {
    this._processDue(timestamp);
    const src = this.accounts.get(sourceId);
    const tgt = this.accounts.get(targetId);
    if (!src || !tgt) return '';
    if (src.balance < amount) return '';
    if (amount > 1000) {
      this.paymentSeq++;
      const ref = `payment_${this.paymentSeq}`;
      this.pending.set(ref, { accountId: sourceId, amount, type: 'TRANSFER', targetId });
      src.activityCount++;
      return ref;
    }
    src.balance -= amount;
    tgt.balance += amount;
    src.outgoing += amount;
    src.history.push(`TRANSFER_OUT(${amount})`);
    tgt.history.push(`TRANSFER_IN(${amount})`);
    src.activityCount++;
    tgt.activityCount++;
    return String(src.balance);
  }

  // === LEVEL 2: Data Structures & Data Processing ===

  topSpenders(timestamp, n) {
    this._processDue(timestamp);
    // Sort outgoing desc, then account_id asc for ties
    const list = [];
    for (const [id, acc] of this.accounts) {
      if (acc.outgoing > 0) list.push([id, acc.outgoing]);
    }
    list.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return list.slice(0, n).map(([id, amt]) => `${id}(${amt})`).join(', ');
  }

  getPaymentHistory(timestamp, accountId, n) {
    this._processDue(timestamp);
    const acc = this.accounts.get(accountId);
    if (!acc) return '';
    const h = acc.history;
    // history is chronological; slice last n, reverse for most-recent-first
    return h.slice(Math.max(0, h.length - n)).reverse().join(', ');
  }

  // === LEVEL 3: Refactoring & Time-based Operations ===
  // TRANSITION L2→L3:
  //   1. Add this.pending, this.scheduled, this.paymentSeq to constructor
  //   2. Implement _processDue below
  //   3. Add this._processDue(timestamp) as the FIRST LINE of every L1/L2 method
  //      (safe to add retroactively — no-op when this.scheduled is empty)
  //   4. Add the amount > 1000 guard to withdraw/transfer

  _processDue(timestamp) {
    // Execute scheduled payments in chronological order before current op
    this.scheduled.sort((a, b) => a.executeAt - b.executeAt);
    const remaining = [];
    for (const p of this.scheduled) {
      if (p.executeAt <= timestamp) {
        const acc = this.accounts.get(p.accountId);
        if (acc) {
          if (p.type === 'DEPOSIT') {
            acc.balance += p.amount;
            acc.history.push(`DEPOSIT(${p.amount})`);
            acc.activityCount++;
          } else if (p.type === 'WITHDRAW' && acc.balance >= p.amount) {
            acc.balance -= p.amount;
            acc.outgoing += p.amount;
            acc.history.push(`WITHDRAW(${p.amount})`);
            acc.activityCount++;
          }
        }
      } else {
        remaining.push(p);
      }
    }
    this.scheduled = remaining;
  }

  schedulePayment(timestamp, accountId, amount, paymentType, delay) {
    this._processDue(timestamp);
    const acc = this.accounts.get(accountId);
    if (!acc) return '';
    this.scheduled.push({ executeAt: timestamp + delay, accountId, amount, type: paymentType });
    acc.activityCount++;
    return 'true';
  }

  acceptPayment(timestamp, accountId, referenceId) {
    this._processDue(timestamp);
    const payment = this.pending.get(referenceId);
    if (!payment) return '';
    this.pending.delete(referenceId);
    const acc = this.accounts.get(payment.accountId);
    if (!acc) return '';
    if (payment.type === 'WITHDRAW') {
      if (acc.balance < payment.amount) return '';
      acc.balance -= payment.amount;
      acc.outgoing += payment.amount;
      acc.history.push(`WITHDRAW(${payment.amount})`);
      acc.activityCount++;
      return String(acc.balance);
    }
    // TRANSFER
    const tgt = this.accounts.get(payment.targetId);
    if (!tgt || acc.balance < payment.amount) return '';
    acc.balance -= payment.amount;
    tgt.balance += payment.amount;
    acc.outgoing += payment.amount;
    acc.history.push(`TRANSFER_OUT(${payment.amount})`);
    tgt.history.push(`TRANSFER_IN(${payment.amount})`);
    acc.activityCount++;
    tgt.activityCount++;
    return String(acc.balance);
  }

  topActivity(timestamp, n) {
    this._processDue(timestamp);
    const list = [];
    for (const [id, acc] of this.accounts) {
      list.push([id, acc.activityCount]);
    }
    list.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return list.slice(0, n).map(([id, cnt]) => `${id}(${cnt})`).join(', ');
  }

  // === LEVEL 4: Extending Design & Functionality ===
  // TRANSITION L3→L4: MERGE_ACCOUNTS transfers scheduled (remap accountId) and pending (remap accountId/targetId)

  mergeAccounts(timestamp, id1, id2) {
    this._processDue(timestamp);
    const acc1 = this.accounts.get(id1);
    const acc2 = this.accounts.get(id2);
    if (!acc1 || !acc2) return '';
    acc1.balance += acc2.balance;
    // Append acc2 history (both arrays are chronological; interleaving not required by spec)
    acc1.history = acc1.history.concat(acc2.history);
    acc1.outgoing += acc2.outgoing;
    acc1.activityCount += acc2.activityCount;
    // Transfer scheduled payments for acc2 -> acc1
    for (const sp of this.scheduled) {
      if (sp.accountId === id2) sp.accountId = id1;
    }
    // Transfer pending payments
    for (const [, pp] of this.pending) {
      if (pp.accountId === id2) pp.accountId = id1;
      if (pp.targetId === id2) pp.targetId = id1;
    }
    this.accounts.delete(id2);
    return String(acc1.balance);
  }

  getBankStatistics(timestamp) {
    this._processDue(timestamp);
    const count = this.accounts.size;
    if (count === 0) return 'total_accounts:0,total_balance:0,average_balance:0';
    let total = 0;
    for (const acc of this.accounts.values()) total += acc.balance;
    const avg = Math.floor(total / count);
    return `total_accounts:${count},total_balance:${total},average_balance:${avg}`;
  }

  cashback(timestamp, accountId, percentage) {
    this._processDue(timestamp);
    const acc = this.accounts.get(accountId);
    if (!acc || acc.outgoing === 0) return '';
    // floor(outgoing * percentage / 100)
    const amount = Math.floor(acc.outgoing * percentage / 100);
    acc.balance += amount;
    acc.history.push(`DEPOSIT(${amount})`);
    acc.activityCount++;
    return String(amount);
  }

  simulate(commands) {
    return commands.map(cmd => {
      const [op, ...a] = cmd;
      switch (op) {
        case 'CREATE_ACCOUNT': return this.createAccount(+a[0], a[1]);
        case 'DEPOSIT': return this.deposit(+a[0], a[1], +a[2]);
        case 'WITHDRAW': return this.withdraw(+a[0], a[1], +a[2]);
        case 'TRANSFER': return this.transfer(+a[0], a[1], a[2], +a[3]);
        case 'TOP_SPENDERS': return this.topSpenders(+a[0], +a[1]);
        case 'GET_PAYMENT_HISTORY': return this.getPaymentHistory(+a[0], a[1], +a[2]);
        case 'SCHEDULE_PAYMENT': return this.schedulePayment(+a[0], a[1], +a[2], a[3], +a[4]);
        case 'ACCEPT_PAYMENT': return this.acceptPayment(+a[0], a[1], a[2]);
        case 'TOP_ACTIVITY': return this.topActivity(+a[0], +a[1]);
        case 'MERGE_ACCOUNTS': return this.mergeAccounts(+a[0], a[1], a[2]);
        case 'GET_BANK_STATISTICS': return this.getBankStatistics(+a[0]);
        case 'CASHBACK': return this.cashback(+a[0], a[1], +a[2]);
        default: return '';
      }
    });
  }
}

module.exports = BankingSystem;
