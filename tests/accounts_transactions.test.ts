import request from 'supertest';
import app from '../src/app';
import { setupTestDB } from './setup';

setupTestDB();

describe('Accounts & Transactions', () => {
  let token: string;

  beforeEach(async () => {
    const regRes = await request(app).post('/api/auth/register').send({
      email: 'finance@example.com',
      password: 'password123',
      name: 'Finance Tester'
    });
    token = regRes.body.accessToken;
  });

  it('should handle accounts, transfers, and month summary accurately', async () => {
    // 1. Create Payroll account with 10,000 PHP (1,000,000 centavos)
    const payrollRes = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Payroll',
        type: 'payroll',
        startingBalanceCentavos: 1000000
      });
    expect(payrollRes.status).toBe(201);
    const payrollId = payrollRes.body.account.id;

    // 2. Create Maribank account with 0 balance
    const maribankRes = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Maribank',
        type: 'goals',
        startingBalanceCentavos: 0
      });
    expect(maribankRes.status).toBe(201);
    const maribankId = maribankRes.body.account.id;

    // 3. Log an income transaction of 5,000 PHP (500,000 centavos)
    const incomeRes = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: payrollId,
        type: 'income',
        amountCentavos: 500000,
        source: 'Freelance Client',
        date: '2026-09-15T10:00:00.000Z',
        notes: 'September project'
      });
    expect(incomeRes.status).toBe(201);

    // 4. Log an expense of 1,200 PHP (120,000 centavos)
    const expenseRes = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: payrollId,
        type: 'expense',
        amountCentavos: 120000,
        date: '2026-09-16T12:00:00.000Z',
        notes: 'Groceries'
      });
    expect(expenseRes.status).toBe(201);

    // 5. Transfer 3,000 PHP (300,000 centavos) from Payroll to Maribank
    const transferRes = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: payrollId,
        destinationAccountId: maribankId,
        type: 'transfer',
        amountCentavos: 300000,
        date: '2026-09-17T15:00:00.000Z',
        notes: 'Transfer to goal savings'
      });
    expect(transferRes.status).toBe(201);

    // 6. Verify Account balances
    // Payroll: 1,000,000 (start) + 500,000 (income) - 120,000 (expense) - 300,000 (transfer out) = 1,080,000 centavos
    // Maribank: 0 (start) + 300,000 (transfer in) = 300,000 centavos
    const accountsRes = await request(app)
      .get('/api/accounts')
      .set('Authorization', `Bearer ${token}`);

    expect(accountsRes.status).toBe(200);
    const payroll = accountsRes.body.accounts.find((a: any) => a.id === payrollId);
    const maribank = accountsRes.body.accounts.find((a: any) => a.id === maribankId);

    expect(payroll.currentBalanceCentavos).toBe(1080000);
    expect(maribank.currentBalanceCentavos).toBe(300000);
    expect(accountsRes.body.totalBalanceCentavos).toBe(1380000);

    // 7. Verify Month Summary
    // Income: 500,000
    // Expense: 120,000
    // Transfer: 300,000 MUST NOT BE COUNTED AS INCOME OR EXPENSE
    // Net: 500,000 - 120,000 = 380,000
    const summaryRes = await request(app)
      .get('/api/transactions/month-summary?year=2026&month=9')
      .set('Authorization', `Bearer ${token}`);

    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body.totalIncomeCentavos).toBe(500000);
    expect(summaryRes.body.totalExpenseCentavos).toBe(120000);
    expect(summaryRes.body.netCentavos).toBe(380000);
  });
});
