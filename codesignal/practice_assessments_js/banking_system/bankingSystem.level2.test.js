const BankingSystem = require('./bankingSystem');

describe('Banking System - Level 2: Data Structures & Data Processing', () => {
  let bank;
  beforeEach(() => { bank = new BankingSystem(); });

  test('top_spenders sorted by outgoing desc then id asc', () => {
    bank.createAccount(1, 'acc1');
    bank.createAccount(2, 'acc2');
    bank.createAccount(3, 'acc3');
    bank.deposit(4, 'acc1', 2000);
    bank.deposit(5, 'acc2', 1500);
    bank.deposit(6, 'acc3', 3000);
    bank.withdraw(7, 'acc1', 500);
    bank.withdraw(8, 'acc2', 300);
    bank.transfer(9, 'acc1', 'acc3', 400);   // acc1: 900 total
    bank.transfer(10, 'acc2', 'acc3', 200);  // acc2: 500 total
    bank.withdraw(11, 'acc3', 1000);         // acc3: 1000 total
    expect(bank.topSpenders(12, 2)).toBe('acc3(1000), acc1(900)');
  });

  test('top_spenders tie-breaking: same outgoing sorted by id asc', () => {
    bank.createAccount(1, 'acc1');
    bank.createAccount(2, 'acc2');
    bank.createAccount(3, 'acc3');
    bank.deposit(4, 'acc1', 1000);
    bank.deposit(5, 'acc2', 1000);
    bank.deposit(6, 'acc3', 1000);
    bank.withdraw(7, 'acc1', 300);
    bank.withdraw(8, 'acc2', 500);
    bank.withdraw(9, 'acc3', 300);
    expect(bank.topSpenders(10, 3)).toBe('acc2(500), acc1(300), acc3(300)');
  });

  test('top_spenders with no spending returns empty string', () => {
    bank.createAccount(1, 'acc1');
    bank.deposit(2, 'acc1', 1000);
    expect(bank.topSpenders(3, 5)).toBe('');
  });

  test('top_spenders limit n respected', () => {
    for (let i = 0; i < 5; i++) {
      bank.createAccount(i, `acc${i}`);
      bank.deposit(i + 10, `acc${i}`, 1000);
      bank.withdraw(i + 20, `acc${i}`, (i + 1) * 100);
    }
    expect(bank.topSpenders(100, 3)).toBe('acc4(500), acc3(400), acc2(300)');
  });

  test('get_payment_history most recent first', () => {
    bank.createAccount(1, 'acc1');
    bank.deposit(2, 'acc1', 2000);
    bank.withdraw(3, 'acc1', 500);
    bank.createAccount(4, 'acc2');
    bank.transfer(5, 'acc1', 'acc2', 400);
    expect(bank.getPaymentHistory(6, 'acc1', 3)).toBe('TRANSFER_OUT(400), WITHDRAW(500), DEPOSIT(2000)');
  });

  test('get_payment_history includes TRANSFER_IN for recipient', () => {
    bank.createAccount(1, 'acc1');
    bank.createAccount(2, 'acc2');
    bank.createAccount(3, 'acc3');
    bank.deposit(4, 'acc1', 2000);
    bank.deposit(5, 'acc2', 1000); // fund acc2 so transfer succeeds
    bank.deposit(6, 'acc3', 3000);
    bank.transfer(7, 'acc1', 'acc3', 400);
    bank.transfer(8, 'acc2', 'acc3', 200);
    bank.withdraw(9, 'acc3', 1000);
    expect(bank.getPaymentHistory(10, 'acc3', 5)).toBe('WITHDRAW(1000), TRANSFER_IN(200), TRANSFER_IN(400), DEPOSIT(3000)');
  });

  test('get_payment_history limit n respected', () => {
    bank.createAccount(1, 'acc1');
    bank.deposit(2, 'acc1', 100);
    bank.deposit(3, 'acc1', 200);
    bank.deposit(4, 'acc1', 300);
    bank.deposit(5, 'acc1', 400);
    expect(bank.getPaymentHistory(6, 'acc1', 2)).toBe('DEPOSIT(400), DEPOSIT(300)');
  });

  test('get_payment_history for non-existent account returns empty string', () => {
    expect(bank.getPaymentHistory(1, 'nope', 5)).toBe('');
  });

  test('get_payment_history for account with no transactions returns empty string', () => {
    bank.createAccount(1, 'acc1');
    expect(bank.getPaymentHistory(2, 'acc1', 5)).toBe('');
  });

  test('simulate: level 2 combined scenario', () => {
    const result = bank.simulate([
      ['CREATE_ACCOUNT', 1, 'acc1'],
      ['CREATE_ACCOUNT', 2, 'acc2'],
      ['DEPOSIT', 3, 'acc1', 1000],
      ['DEPOSIT', 4, 'acc2', 500],
      ['WITHDRAW', 5, 'acc1', 100],
      ['TRANSFER', 6, 'acc1', 'acc2', 200],
      ['WITHDRAW', 7, 'acc2', 50],
      ['TOP_SPENDERS', 8, 2],
      ['GET_PAYMENT_HISTORY', 9, 'acc1', 3],
    ]);
    // acc1 outgoing: 100+200=300, acc2 outgoing: 50
    expect(result[7]).toBe('acc1(300), acc2(50)');
    expect(result[8]).toBe('TRANSFER_OUT(200), WITHDRAW(100), DEPOSIT(1000)');
  });
});
