const BankingSystem = require('./bankingSystem');

describe('Banking System - Level 4: Extending Design & Functionality', () => {
  let bank;
  beforeEach(() => { bank = new BankingSystem(); });

  test('merge_accounts combines balances', () => {
    bank.createAccount(1, 'acc1');
    bank.createAccount(2, 'acc2');
    bank.deposit(3, 'acc1', 1000);
    bank.deposit(4, 'acc2', 500);
    expect(bank.mergeAccounts(5, 'acc1', 'acc2')).toBe('1500');
  });

  test('merge_accounts removes acc2', () => {
    bank.createAccount(1, 'acc1');
    bank.createAccount(2, 'acc2');
    bank.deposit(3, 'acc1', 1000);
    bank.deposit(4, 'acc2', 500);
    bank.mergeAccounts(5, 'acc1', 'acc2');
    // acc2 should no longer exist
    expect(bank.deposit(6, 'acc2', 100)).toBe('');
  });

  test('merge_accounts transfers history', () => {
    bank.createAccount(1, 'acc1');
    bank.createAccount(2, 'acc2');
    bank.deposit(3, 'acc1', 1000);
    bank.deposit(4, 'acc2', 500);
    bank.mergeAccounts(5, 'acc1', 'acc2');
    const history = bank.getPaymentHistory(6, 'acc1', 10);
    expect(history).toContain('DEPOSIT(1000)');
    expect(history).toContain('DEPOSIT(500)');
  });

  test('merge_accounts with non-existent account returns empty string', () => {
    bank.createAccount(1, 'acc1');
    expect(bank.mergeAccounts(2, 'acc1', 'nope')).toBe('');
    expect(bank.mergeAccounts(3, 'nope', 'acc1')).toBe('');
  });

  test('merge_accounts transfers scheduled payments', () => {
    bank.createAccount(1, 'acc1');
    bank.createAccount(2, 'acc2');
    bank.deposit(3, 'acc2', 500);
    bank.schedulePayment(4, 'acc2', 200, 'DEPOSIT', 10); // fires at ts=14
    bank.mergeAccounts(5, 'acc1', 'acc2');
    // After merge, acc1 should receive the scheduled deposit at ts=14
    expect(bank.deposit(20, 'acc1', 0)).toBe('700'); // 500 merged + 200 scheduled
  });

  test('get_bank_statistics with multiple accounts', () => {
    bank.createAccount(1, 'acc1');
    bank.createAccount(2, 'acc2');
    bank.createAccount(3, 'acc3');
    bank.deposit(4, 'acc1', 1000);
    bank.deposit(5, 'acc2', 2000);
    bank.deposit(6, 'acc3', 3000);
    // total=6000, count=3, avg=2000
    expect(bank.getBankStatistics(7)).toBe('total_accounts:3,total_balance:6000,average_balance:2000');
  });

  test('get_bank_statistics average_balance rounds down', () => {
    bank.createAccount(1, 'acc1');
    bank.createAccount(2, 'acc2');
    bank.deposit(3, 'acc1', 1000);
    bank.deposit(4, 'acc2', 1001);
    // total=2001, count=2, avg=floor(2001/2)=1000
    expect(bank.getBankStatistics(5)).toBe('total_accounts:2,total_balance:2001,average_balance:1000');
  });

  test('get_bank_statistics excludes merged accounts', () => {
    bank.createAccount(1, 'acc1');
    bank.createAccount(2, 'acc2');
    bank.deposit(3, 'acc1', 1000);
    bank.deposit(4, 'acc2', 500);
    bank.mergeAccounts(5, 'acc1', 'acc2');
    // Only acc1 remains with balance 1500
    expect(bank.getBankStatistics(6)).toBe('total_accounts:1,total_balance:1500,average_balance:1500');
  });

  test('cashback applies percentage of total spending', () => {
    bank.createAccount(1, 'acc1');
    bank.deposit(2, 'acc1', 5000);
    bank.withdraw(3, 'acc1', 1000);   // spending = 1000 (≤1000, immediate)
    // 10% cashback on 1000 = 100
    expect(bank.cashback(4, 'acc1', 10)).toBe('100');
    // Balance: 5000-1000+100 = 4100
    expect(bank.deposit(5, 'acc1', 0)).toBe('4100');
  });

  test('cashback rounds down', () => {
    bank.createAccount(1, 'acc1');
    bank.deposit(2, 'acc1', 5000);
    bank.withdraw(3, 'acc1', 1000);   // spending = 1000
    // 5% of 1000 = 50 (exact, no rounding needed)
    expect(bank.cashback(4, 'acc1', 5)).toBe('50');
    // Use odd spending to test floor
    bank.withdraw(5, 'acc1', 1);      // spending = 1001
    // 5% of 1001 = 50.05 -> floor = 50
    expect(bank.cashback(6, 'acc1', 5)).toBe('50');
  });

  test('cashback on account with no spending returns empty string', () => {
    bank.createAccount(1, 'acc1');
    bank.deposit(2, 'acc1', 1000);
    expect(bank.cashback(3, 'acc1', 10)).toBe('');
  });

  test('cashback on non-existent account returns empty string', () => {
    expect(bank.cashback(1, 'nope', 10)).toBe('');
  });

  test('simulate: level 4 combined scenario', () => {
    const result = bank.simulate([
      ['CREATE_ACCOUNT', 1, 'acc1'],
      ['CREATE_ACCOUNT', 2, 'acc2'],
      ['DEPOSIT', 3, 'acc1', 3000],
      ['DEPOSIT', 4, 'acc2', 1000],
      ['WITHDRAW', 5, 'acc1', 500],
      ['MERGE_ACCOUNTS', 6, 'acc1', 'acc2'],
      ['GET_BANK_STATISTICS', 7],
      ['CASHBACK', 8, 'acc1', 10],
    ]);
    expect(result[5]).toBe('3500'); // 2500+1000 after merge
    expect(result[6]).toBe('total_accounts:1,total_balance:3500,average_balance:3500');
    expect(result[7]).toBe('50'); // 10% of 500 spending = 50
  });
});
