const BankingSystem = require('./bankingSystem');

describe('Banking System - Level 3: Refactoring & Time-based Operations', () => {
  let bank;
  beforeEach(() => { bank = new BankingSystem(); });

  test('withdraw <= 1000 still returns balance immediately', () => {
    bank.createAccount(1, 'acc1');
    bank.deposit(2, 'acc1', 2000);
    expect(bank.withdraw(3, 'acc1', 1000)).toBe('1000');
  });

  test('withdraw > 1000 returns payment reference id', () => {
    bank.createAccount(1, 'acc1');
    bank.deposit(2, 'acc1', 5000);
    const ref = bank.withdraw(3, 'acc1', 1500);
    expect(ref).toBe('payment_1');
  });

  test('withdraw > 1000 does not change balance until accepted', () => {
    bank.createAccount(1, 'acc1');
    bank.deposit(2, 'acc1', 5000);
    bank.withdraw(3, 'acc1', 1500);
    // Balance should still be 5000 (pending)
    expect(bank.deposit(4, 'acc1', 0)).toBe('5000');
  });

  test('accept_payment completes pending withdrawal', () => {
    bank.createAccount(1, 'acc1');
    bank.deposit(2, 'acc1', 5000);
    const ref = bank.withdraw(3, 'acc1', 1500);
    expect(bank.acceptPayment(4, 'acc1', ref)).toBe('3500');
  });

  test('accept_payment with invalid reference returns empty string', () => {
    bank.createAccount(1, 'acc1');
    expect(bank.acceptPayment(2, 'acc1', 'payment_99')).toBe('');
  });

  test('accept_payment cannot be used twice (already processed)', () => {
    bank.createAccount(1, 'acc1');
    bank.deposit(2, 'acc1', 5000);
    const ref = bank.withdraw(3, 'acc1', 1500);
    bank.acceptPayment(4, 'acc1', ref);
    expect(bank.acceptPayment(5, 'acc1', ref)).toBe('');
  });

  test('transfer > 1000 returns payment reference id', () => {
    bank.createAccount(1, 'acc1');
    bank.createAccount(2, 'acc2');
    bank.deposit(3, 'acc1', 5000);
    const ref = bank.transfer(4, 'acc1', 'acc2', 2000);
    expect(ref).toBe('payment_1');
  });

  test('accept_payment completes pending transfer', () => {
    bank.createAccount(1, 'acc1');
    bank.createAccount(2, 'acc2');
    bank.deposit(3, 'acc1', 5000);
    const ref = bank.transfer(4, 'acc1', 'acc2', 2000);
    expect(bank.acceptPayment(5, 'acc1', ref)).toBe('3000');
    // acc2 should have received 2000
    expect(bank.deposit(6, 'acc2', 0)).toBe('2000');
  });

  test('schedule_payment for non-existent account returns empty string', () => {
    expect(bank.schedulePayment(1, 'nope', 500, 'DEPOSIT', 10)).toBe('');
  });

  test('schedule_payment returns true and executes at correct time', () => {
    bank.createAccount(1, 'acc1');
    bank.deposit(2, 'acc1', 1000);
    expect(bank.schedulePayment(3, 'acc1', 200, 'DEPOSIT', 10)).toBe('true');
    // Before due time: deposit at ts=12 (< 3+10=13), scheduled not yet fired
    expect(bank.deposit(12, 'acc1', 0)).toBe('1000');
    // At due time: deposit at ts=13 triggers the scheduled payment first
    expect(bank.deposit(13, 'acc1', 0)).toBe('1200');
  });

  test('scheduled withdraw fires at correct time', () => {
    bank.createAccount(1, 'acc1');
    bank.deposit(2, 'acc1', 1000);
    bank.schedulePayment(3, 'acc1', 300, 'WITHDRAW', 5);
    // fires at ts=8; trigger with op at ts=10
    expect(bank.deposit(10, 'acc1', 0)).toBe('700');
  });

  test('scheduled withdraw silently skipped if insufficient funds', () => {
    bank.createAccount(1, 'acc1');
    bank.deposit(2, 'acc1', 100);
    bank.schedulePayment(3, 'acc1', 500, 'WITHDRAW', 5);
    // fires at ts=8 but balance is only 100
    expect(bank.deposit(10, 'acc1', 0)).toBe('100');
  });

  test('top_activity sorted by count desc then id asc', () => {
    bank.createAccount(1, 'acc1');
    bank.createAccount(2, 'acc2');
    bank.deposit(3, 'acc1', 500);   // acc1: 1
    bank.deposit(4, 'acc1', 500);   // acc1: 2
    bank.deposit(5, 'acc2', 200);   // acc2: 1
    expect(bank.topActivity(6, 2)).toBe('acc1(2), acc2(1)');
  });

  test('payment_id sequence increments correctly', () => {
    bank.createAccount(1, 'acc1');
    bank.deposit(2, 'acc1', 10000);
    expect(bank.withdraw(3, 'acc1', 1500)).toBe('payment_1');
    expect(bank.withdraw(4, 'acc1', 1500)).toBe('payment_2');
  });

  test('simulate: level 3 combined scenario', () => {
    const result = bank.simulate([
      ['CREATE_ACCOUNT', 1, 'acc1'],
      ['CREATE_ACCOUNT', 2, 'acc2'],
      ['DEPOSIT', 3, 'acc1', 5000],
      ['WITHDRAW', 4, 'acc1', 2000],     // > 1000, returns payment_1
      ['ACCEPT_PAYMENT', 5, 'acc1', 'payment_1'],
      ['SCHEDULE_PAYMENT', 6, 'acc1', 300, 'DEPOSIT', 10],
      ['DEPOSIT', 20, 'acc1', 0],        // triggers scheduled payment at ts=16
      ['TOP_ACTIVITY', 21, 2],
    ]);
    expect(result[3]).toBe('payment_1');
    expect(result[4]).toBe('3000');
    expect(result[5]).toBe('true');
    expect(result[6]).toBe('3300'); // 3000 + 300 scheduled
  });
});
