/**
 * Banking System — Level 4 Tests
 * New ops: mergeAccounts, getBankStatistics, cashback
 *
 * Key transitions from L3:
 *   - mergeAccounts: balance+history+spent+txCount all merge; scheduled/pending reassigned
 *   - getBankStatistics: only ACTIVE accounts; average_balance floors
 *   - cashback: percentage of acct.spent, Math.floor; deposits to balance
 */
const BankingSystem = require('./bankingSystem');

let bank;
beforeEach(() => { bank = new BankingSystem(); });

describe('mergeAccounts', () => {
  test('merges balance from acc2 into acc1', () => {
    bank.createAccount(1, 'acc1');
    bank.createAccount(2, 'acc2');
    bank.deposit(3, 'acc1', 500);
    bank.deposit(4, 'acc2', 300);
    expect(bank.mergeAccounts(5, 'acc1', 'acc2')).toBe('800');
  });

  test('acc2 is removed after merge', () => {
    bank.createAccount(1, 'acc1');
    bank.createAccount(2, 'acc2');
    bank.deposit(3, 'acc2', 200);
    bank.mergeAccounts(4, 'acc1', 'acc2');
    expect(bank.deposit(5, 'acc2', 100)).toBe('');
  });

  test('acc1 missing → ""', () => {
    bank.createAccount(1, 'acc2');
    expect(bank.mergeAccounts(2, 'ghost', 'acc2')).toBe('');
  });

  test('acc2 missing → ""', () => {
    bank.createAccount(1, 'acc1');
    expect(bank.mergeAccounts(2, 'acc1', 'ghost')).toBe('');
  });

  test('payment history is merged', () => {
    bank.createAccount(1, 'acc1');
    bank.createAccount(2, 'acc2');
    bank.deposit(3, 'acc1', 100);
    bank.deposit(4, 'acc2', 200);
    bank.mergeAccounts(5, 'acc1', 'acc2');
    const history = bank.getPaymentHistory(6, 'acc1', 10);
    expect(history).toContain('DEPOSIT(100)');
    expect(history).toContain('DEPOSIT(200)');
  });

  test('spent is merged (affects topSpenders and cashback)', () => {
    bank.createAccount(1, 'acc1');
    bank.createAccount(2, 'acc2');
    bank.deposit(3, 'acc1', 1000);
    bank.deposit(4, 'acc2', 1000);
    bank.withdraw(5, 'acc1', 200);
    bank.withdraw(6, 'acc2', 300);
    bank.mergeAccounts(7, 'acc1', 'acc2');
    // Combined spent = 500 → 5% cashback = 25
    expect(bank.cashback(8, 'acc1', 5)).toBe('25');
  });
});

describe('getBankStatistics', () => {
  test('basic statistics', () => {
    bank.createAccount(1, 'acc1');
    bank.createAccount(2, 'acc2');
    bank.deposit(3, 'acc1', 500);
    bank.deposit(4, 'acc2', 300);
    expect(bank.getBankStatistics(5)).toBe('total_accounts:2,total_balance:800,average_balance:400');
  });

  test('average_balance floors (not rounds)', () => {
    bank.createAccount(1, 'acc1');
    bank.createAccount(2, 'acc2');
    bank.deposit(3, 'acc1', 1000);
    bank.deposit(4, 'acc2', 1);
    // avg = 1001/2 = 500.5 → floor = 500
    expect(bank.getBankStatistics(5)).toBe('total_accounts:2,total_balance:1001,average_balance:500');
  });

  test('merged account is removed from count', () => {
    bank.createAccount(1, 'acc1');
    bank.createAccount(2, 'acc2');
    bank.deposit(3, 'acc1', 400);
    bank.deposit(4, 'acc2', 200);
    bank.mergeAccounts(5, 'acc1', 'acc2');
    expect(bank.getBankStatistics(6)).toBe('total_accounts:1,total_balance:600,average_balance:600');
  });
});

describe('cashback', () => {
  test('cashback applies percentage of total spending', () => {
    bank.createAccount(1, 'acc1');
    bank.deposit(2, 'acc1', 1000);
    bank.withdraw(3, 'acc1', 400);
    // 5% of 400 = 20
    expect(bank.cashback(4, 'acc1', 5)).toBe('20');
  });

  test('cashback amount floors correctly', () => {
    bank.createAccount(1, 'acc1');
    bank.deposit(2, 'acc1', 1000);
    bank.withdraw(3, 'acc1', 300);
    // 3% of 300 = 9.0
    expect(bank.cashback(4, 'acc1', 3)).toBe('9');
  });

  test('cashback is deposited to account balance', () => {
    bank.createAccount(1, 'acc1');
    bank.deposit(2, 'acc1', 1000);
    bank.withdraw(3, 'acc1', 400); // balance = 600, spent = 400
    bank.cashback(4, 'acc1', 10); // cashback = 40; balance = 640
    expect(bank.deposit(5, 'acc1', 0)).toBe('640');
  });

  test('no spending → ""', () => {
    bank.createAccount(1, 'acc1');
    bank.deposit(2, 'acc1', 500);
    expect(bank.cashback(3, 'acc1', 5)).toBe('');
  });

  test('non-existent account → ""', () => {
    expect(bank.cashback(1, 'ghost', 5)).toBe('');
  });
});
