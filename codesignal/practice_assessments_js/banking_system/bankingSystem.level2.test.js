/**
 * Banking System — Level 2 Tests
 * New ops: topSpenders, getPaymentHistory
 * Key: topSpenders sorts by spent DESC then accountId ASC (lexicographic tie-break)
 * Key: getPaymentHistory returns most-recent FIRST; TRANSFER shows TRANSFER_IN / TRANSFER_OUT
 */
const BankingSystem = require('./bankingSystem');

let bank;
beforeEach(() => { bank = new BankingSystem(); });

describe('topSpenders', () => {
  test('single account with withdrawals', () => {
    bank.createAccount(1, 'acc1');
    bank.deposit(2, 'acc1', 1000);
    bank.withdraw(3, 'acc1', 400);
    expect(bank.topSpenders(4, 1)).toBe('acc1(400)');
  });

  test('sorts by spent DESC', () => {
    bank.createAccount(1, 'acc1');
    bank.createAccount(2, 'acc2');
    bank.deposit(3, 'acc1', 500);
    bank.deposit(4, 'acc2', 1000);
    bank.withdraw(5, 'acc1', 200);
    bank.withdraw(6, 'acc2', 800);
    expect(bank.topSpenders(7, 2)).toBe('acc2(800), acc1(200)');
  });

  test('tie-break sorts by accountId ASC', () => {
    bank.createAccount(1, 'acc1');
    bank.createAccount(2, 'acc2');
    bank.deposit(3, 'acc1', 500);
    bank.deposit(4, 'acc2', 500);
    bank.withdraw(5, 'acc1', 300);
    bank.withdraw(6, 'acc2', 300);
    expect(bank.topSpenders(7, 2)).toBe('acc1(300), acc2(300)');
  });

  test('n greater than account count returns all', () => {
    bank.createAccount(1, 'acc1');
    bank.deposit(2, 'acc1', 100);
    bank.withdraw(3, 'acc1', 50);
    expect(bank.topSpenders(4, 10)).toBe('acc1(50)');
  });

  test('transfer counts as spending for sender', () => {
    bank.createAccount(1, 'acc1');
    bank.createAccount(2, 'acc2');
    bank.deposit(3, 'acc1', 1000);
    bank.transfer(4, 'acc1', 'acc2', 500);
    // acc1 spent 500 via transfer; acc2 received, not spent
    expect(bank.topSpenders(5, 2)).toBe('acc1(500), acc2(0)');
  });
});

describe('getPaymentHistory', () => {
  test('returns most recent first', () => {
    bank.createAccount(1, 'acc1');
    bank.deposit(2, 'acc1', 100);
    bank.deposit(3, 'acc1', 200);
    expect(bank.getPaymentHistory(4, 'acc1', 2)).toBe('DEPOSIT(200), DEPOSIT(100)');
  });

  test('WITHDRAW shows in history', () => {
    bank.createAccount(1, 'acc1');
    bank.deposit(2, 'acc1', 500);
    bank.withdraw(3, 'acc1', 100);
    expect(bank.getPaymentHistory(4, 'acc1', 2)).toBe('WITHDRAW(100), DEPOSIT(500)');
  });

  test('TRANSFER shows TRANSFER_OUT for sender and TRANSFER_IN for receiver', () => {
    bank.createAccount(1, 'acc1');
    bank.createAccount(2, 'acc2');
    bank.deposit(3, 'acc1', 500);
    bank.transfer(4, 'acc1', 'acc2', 200);
    expect(bank.getPaymentHistory(5, 'acc1', 2)).toBe('TRANSFER_OUT(200), DEPOSIT(500)');
    expect(bank.getPaymentHistory(5, 'acc2', 1)).toBe('TRANSFER_IN(200)');
  });

  test('n greater than history length returns all', () => {
    bank.createAccount(1, 'acc1');
    bank.deposit(2, 'acc1', 100);
    expect(bank.getPaymentHistory(3, 'acc1', 10)).toBe('DEPOSIT(100)');
  });

  test('non-existent account → ""', () => {
    expect(bank.getPaymentHistory(1, 'ghost', 5)).toBe('');
  });
});
