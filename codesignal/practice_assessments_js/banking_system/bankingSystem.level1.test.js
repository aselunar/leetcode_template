const BankingSystem = require('./bankingSystem');

describe('Banking System - Level 1: Basic Operations', () => {
  let bank;
  beforeEach(() => { bank = new BankingSystem(); });

  test('create_account returns true for new account', () => {
    expect(bank.createAccount(1, 'acc1')).toBe('true');
  });

  test('create_account returns false for duplicate', () => {
    bank.createAccount(1, 'acc1');
    expect(bank.createAccount(2, 'acc1')).toBe('false');
  });

  test('deposit to existing account returns new balance', () => {
    bank.createAccount(1, 'acc1');
    expect(bank.deposit(2, 'acc1', 1000)).toBe('1000');
  });

  test('deposit to non-existent account returns empty string', () => {
    expect(bank.deposit(1, 'nope', 100)).toBe('');
  });

  test('multiple deposits accumulate', () => {
    bank.createAccount(1, 'acc1');
    bank.deposit(2, 'acc1', 100);
    expect(bank.deposit(3, 'acc1', 200)).toBe('300');
  });

  test('withdraw with sufficient funds returns new balance', () => {
    bank.createAccount(1, 'acc1');
    bank.deposit(2, 'acc1', 1000);
    expect(bank.withdraw(3, 'acc1', 200)).toBe('800');
  });

  test('withdraw with insufficient funds returns empty string', () => {
    bank.createAccount(1, 'acc1');
    bank.deposit(2, 'acc1', 500);
    expect(bank.withdraw(3, 'acc1', 600)).toBe('');
  });

  test('withdraw from non-existent account returns empty string', () => {
    expect(bank.withdraw(1, 'nope', 100)).toBe('');
  });

  test('withdraw exact balance returns 0', () => {
    bank.createAccount(1, 'acc1');
    bank.deposit(2, 'acc1', 500);
    expect(bank.withdraw(3, 'acc1', 500)).toBe('0');
  });

  test('transfer with sufficient funds returns source balance', () => {
    bank.createAccount(1, 'acc1');
    bank.createAccount(2, 'acc2');
    bank.deposit(3, 'acc1', 1000);
    expect(bank.transfer(4, 'acc1', 'acc2', 300)).toBe('700');
  });

  test('transfer with insufficient funds returns empty string', () => {
    bank.createAccount(1, 'acc1');
    bank.createAccount(2, 'acc2');
    bank.deposit(3, 'acc1', 200);
    expect(bank.transfer(4, 'acc1', 'acc2', 300)).toBe('');
  });

  test('transfer to non-existent target returns empty string', () => {
    bank.createAccount(1, 'acc1');
    bank.deposit(2, 'acc1', 1000);
    expect(bank.transfer(3, 'acc1', 'nope', 100)).toBe('');
  });

  test('transfer from non-existent source returns empty string', () => {
    bank.createAccount(1, 'acc2');
    expect(bank.transfer(2, 'nope', 'acc2', 100)).toBe('');
  });

  test('simulate: complete level 1 scenario', () => {
    const result = bank.simulate([
      ['CREATE_ACCOUNT', 1, 'acc1'],
      ['CREATE_ACCOUNT', 2, 'acc2'],
      ['CREATE_ACCOUNT', 3, 'acc1'],
      ['DEPOSIT', 4, 'acc1', 1000],
      ['DEPOSIT', 5, 'acc2', 500],
      ['WITHDRAW', 6, 'acc1', 200],
      ['WITHDRAW', 7, 'acc2', 600],
      ['TRANSFER', 8, 'acc1', 'acc2', 300],
      ['DEPOSIT', 9, 'acc3', 100],
    ]);
    expect(result).toEqual(['true', 'true', 'false', '1000', '500', '800', '', '500', '']);
  });
});
