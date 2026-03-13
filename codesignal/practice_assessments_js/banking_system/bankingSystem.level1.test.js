/**
 * Banking System — Level 1 Tests
 * Operations: createAccount, deposit, withdraw, transfer
 * Edge cases: duplicate account, missing account, insufficient funds
 */
const BankingSystem = require('./bankingSystem');

let bank;
beforeEach(() => { bank = new BankingSystem(); });

describe('createAccount', () => {
  test('creates new account → "true"', () => {
    expect(bank.createAccount(1, 'acc1')).toBe('true');
  });
  test('duplicate account → "false"', () => {
    bank.createAccount(1, 'acc1');
    expect(bank.createAccount(2, 'acc1')).toBe('false');
  });
});

describe('deposit', () => {
  test('deposits to existing account → new balance', () => {
    bank.createAccount(1, 'acc1');
    expect(bank.deposit(2, 'acc1', 500)).toBe('500');
  });
  test('multiple deposits accumulate', () => {
    bank.createAccount(1, 'acc1');
    bank.deposit(2, 'acc1', 100);
    expect(bank.deposit(3, 'acc1', 200)).toBe('300');
  });
  test('non-existent account → ""', () => {
    expect(bank.deposit(1, 'ghost', 100)).toBe('');
  });
});

describe('withdraw', () => {
  test('withdraw with sufficient funds → new balance', () => {
    bank.createAccount(1, 'acc1');
    bank.deposit(2, 'acc1', 1000);
    expect(bank.withdraw(3, 'acc1', 200)).toBe('800');
  });
  test('withdraw exact balance → "0"', () => {
    bank.createAccount(1, 'acc1');
    bank.deposit(2, 'acc1', 500);
    expect(bank.withdraw(3, 'acc1', 500)).toBe('0');
  });
  test('insufficient funds → ""', () => {
    bank.createAccount(1, 'acc1');
    bank.deposit(2, 'acc1', 100);
    expect(bank.withdraw(3, 'acc1', 200)).toBe('');
  });
  test('non-existent account → ""', () => {
    expect(bank.withdraw(1, 'ghost', 100)).toBe('');
  });
});

describe('transfer', () => {
  test('valid transfer → source new balance', () => {
    bank.createAccount(1, 'acc1');
    bank.createAccount(2, 'acc2');
    bank.deposit(3, 'acc1', 1000);
    expect(bank.transfer(4, 'acc1', 'acc2', 300)).toBe('700');
  });
  test('target receives correct balance', () => {
    bank.createAccount(1, 'acc1');
    bank.createAccount(2, 'acc2');
    bank.deposit(3, 'acc1', 1000);
    bank.transfer(4, 'acc1', 'acc2', 300);
    expect(bank.deposit(5, 'acc2', 0)).toBe('300'); // deposit 0 to peek balance
  });
  test('source missing → ""', () => {
    bank.createAccount(1, 'acc2');
    expect(bank.transfer(2, 'ghost', 'acc2', 100)).toBe('');
  });
  test('target missing → ""', () => {
    bank.createAccount(1, 'acc1');
    bank.deposit(2, 'acc1', 500);
    expect(bank.transfer(3, 'acc1', 'ghost', 100)).toBe('');
  });
  test('insufficient funds → ""', () => {
    bank.createAccount(1, 'acc1');
    bank.createAccount(2, 'acc2');
    bank.deposit(3, 'acc1', 100);
    expect(bank.transfer(4, 'acc1', 'acc2', 200)).toBe('');
  });
});

describe('Level 1 complete scenario', () => {
  test('mixed operations', () => {
    expect(bank.createAccount(1, 'acc1')).toBe('true');
    expect(bank.createAccount(2, 'acc2')).toBe('true');
    expect(bank.createAccount(3, 'acc1')).toBe('false');
    expect(bank.deposit(4, 'acc1', 1000)).toBe('1000');
    expect(bank.deposit(5, 'acc2', 500)).toBe('500');
    expect(bank.withdraw(6, 'acc1', 200)).toBe('800');
    expect(bank.withdraw(7, 'acc2', 600)).toBe('');
    expect(bank.transfer(8, 'acc1', 'acc2', 300)).toBe('500');
    expect(bank.deposit(9, 'acc3', 100)).toBe('');
  });
});
