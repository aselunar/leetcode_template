/**
 * Banking System — Level 3 Tests
 * New ops: schedulePayment, acceptPayment, topActivity
 * Modified: withdraw/transfer with amount > 1000 → returns "payment_N"
 *
 * Key transitions from L2:
 *   - WITHDRAW/TRANSFER > 1000 now return paymentId instead of balance
 *   - All ops must call _processScheduled(timestamp) first
 *   - txCount tracked for topActivity
 */
const BankingSystem = require('./bankingSystem');

let bank;
beforeEach(() => { bank = new BankingSystem(); });

describe('withdraw / transfer requiring acceptance (> 1000)', () => {
  test('withdraw > 1000 returns payment_N', () => {
    bank.createAccount(1, 'acc1');
    bank.deposit(2, 'acc1', 5000);
    const result = bank.withdraw(3, 'acc1', 2000);
    expect(result).toMatch(/^payment_\d+$/);
  });

  test('transfer > 1000 returns payment_N', () => {
    bank.createAccount(1, 'acc1');
    bank.createAccount(2, 'acc2');
    bank.deposit(3, 'acc1', 5000);
    const result = bank.transfer(4, 'acc1', 'acc2', 1500);
    expect(result).toMatch(/^payment_\d+$/);
  });

  test('balance NOT deducted until acceptPayment', () => {
    bank.createAccount(1, 'acc1');
    bank.deposit(2, 'acc1', 5000);
    bank.withdraw(3, 'acc1', 2000);
    // Balance should still be 5000
    expect(bank.deposit(4, 'acc1', 0)).toBe('5000');
  });
});

describe('acceptPayment', () => {
  test('accept withdraw payment → balance deducted, returns new balance', () => {
    bank.createAccount(1, 'acc1');
    bank.deposit(2, 'acc1', 5000);
    const pid = bank.withdraw(3, 'acc1', 2000);
    expect(bank.acceptPayment(4, 'acc1', pid)).toBe('3000');
  });

  test('accept transfer payment → source balance deducted, target credited', () => {
    bank.createAccount(1, 'acc1');
    bank.createAccount(2, 'acc2');
    bank.deposit(3, 'acc1', 5000);
    const pid = bank.transfer(4, 'acc1', 'acc2', 2000);
    const result = bank.acceptPayment(5, 'acc1', pid);
    expect(result).toBe('3000');
    // acc2 should have 2000
    expect(bank.deposit(6, 'acc2', 0)).toBe('2000');
  });

  test('invalid paymentId → ""', () => {
    expect(bank.acceptPayment(1, 'acc1', 'payment_999')).toBe('');
  });

  test('already processed paymentId → ""', () => {
    bank.createAccount(1, 'acc1');
    bank.deposit(2, 'acc1', 5000);
    const pid = bank.withdraw(3, 'acc1', 2000);
    bank.acceptPayment(4, 'acc1', pid);
    expect(bank.acceptPayment(5, 'acc1', pid)).toBe('');
  });
});

describe('schedulePayment', () => {
  test('scheduled deposit executes when future op crosses timestamp', () => {
    bank.createAccount(1, 'acc1');
    bank.deposit(2, 'acc1', 100);
    bank.schedulePayment(3, 'acc1', 200, 'DEPOSIT', 5); // executes at t=8
    // At t=10, the scheduled deposit should have fired before deposit(10) processes
    expect(bank.deposit(10, 'acc1', 0)).toBe('300');
  });

  test('scheduled withdraw executes (sufficient funds)', () => {
    bank.createAccount(1, 'acc1');
    bank.deposit(2, 'acc1', 500);
    bank.schedulePayment(3, 'acc1', 200, 'WITHDRAW', 5); // executes at t=8
    expect(bank.deposit(10, 'acc1', 0)).toBe('300');
  });

  test('scheduled withdraw skipped if insufficient funds at execution time', () => {
    bank.createAccount(1, 'acc1');
    bank.deposit(2, 'acc1', 100);
    bank.schedulePayment(3, 'acc1', 200, 'WITHDRAW', 5); // executes at t=8
    // Only 100 in balance — scheduled withdraw is skipped
    expect(bank.deposit(10, 'acc1', 0)).toBe('100');
  });

  test('non-existent account → ""', () => {
    expect(bank.schedulePayment(1, 'ghost', 100, 'DEPOSIT', 5)).toBe('');
  });
});

describe('topActivity', () => {
  test('sorts by txCount DESC then accountId ASC', () => {
    bank.createAccount(1, 'acc1');
    bank.createAccount(2, 'acc2');
    bank.deposit(3, 'acc1', 100); // acc1: 1 tx
    bank.deposit(4, 'acc2', 100); // acc2: 1 tx
    bank.deposit(5, 'acc2', 100); // acc2: 2 tx
    expect(bank.topActivity(6, 2)).toBe('acc2(2), acc1(1)');
  });
});
