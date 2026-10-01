import request from 'supertest';
import app from '../src/app';
import { setupTestDB } from './setup';

setupTestDB();

describe('Partner Connection & Strict Privacy Isolation', () => {
  let partnerAToken: string;
  let partnerBToken: string;
  let partnerAAccountId: string;
  let partnerBAccountId: string;

  beforeEach(async () => {
    // 1. Register Partner A (Alice)
    const userARes = await request(app).post('/api/auth/register').send({
      email: 'alice@example.com',
      password: 'password123',
      name: 'Alice'
    });
    partnerAToken = userARes.body.accessToken;

    // 2. Register Partner B (Bob)
    const userBRes = await request(app).post('/api/auth/register').send({
      email: 'bob@example.com',
      password: 'password123',
      name: 'Bob'
    });
    partnerBToken = userBRes.body.accessToken;

    // Create private accounts for each
    const accARes = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${partnerAToken}`)
      .send({ name: "Alice's Secret Vault", type: 'savings', startingBalanceCentavos: 5000000 });
    partnerAAccountId = accARes.body.account.id;

    const accBRes = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${partnerBToken}`)
      .send({ name: "Bob's Spending Account", type: 'payroll', startingBalanceCentavos: 1000000 });
    partnerBAccountId = accBRes.body.account.id;

    // Create private personal transactions
    await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${partnerAToken}`)
      .send({
        accountId: partnerAAccountId,
        type: 'expense',
        amountCentavos: 50000,
        notes: 'Secret medical purchase'
      });
  });

  it('should connect partners via invite code', async () => {
    // Alice generates invite
    const inviteRes = await request(app)
      .post('/api/partners/invite')
      .set('Authorization', `Bearer ${partnerAToken}`);

    expect(inviteRes.status).toBe(201);
    const code = inviteRes.body.inviteCode;
    expect(code).toBeDefined();

    // Bob accepts invite
    const acceptRes = await request(app)
      .post('/api/partners/accept')
      .set('Authorization', `Bearer ${partnerBToken}`)
      .send({ inviteCode: code });

    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.partner.name).toBe('Alice');

    // Partner status checks
    const statusA = await request(app)
      .get('/api/partners/status')
      .set('Authorization', `Bearer ${partnerAToken}`);
    expect(statusA.body.connected).toBe(true);
    expect(statusA.body.partner.name).toBe('Bob');

    const statusB = await request(app)
      .get('/api/partners/status')
      .set('Authorization', `Bearer ${partnerBToken}`);
    expect(statusB.body.connected).toBe(true);
    expect(statusB.body.partner.name).toBe('Alice');
  });

  it('CRITICAL PRIVACY TEST: Partner B CANNOT access Partner A accounts, transactions, or personal goals', async () => {
    // 1. Bob attempts to fetch Alice's accounts
    const bAccounts = await request(app)
      .get('/api/accounts')
      .set('Authorization', `Bearer ${partnerBToken}`);

    expect(bAccounts.status).toBe(200);
    const hasAliceAccount = bAccounts.body.accounts.some((a: any) => a.id === partnerAAccountId);
    expect(hasAliceAccount).toBe(false);
    expect(bAccounts.body.accounts.length).toBe(1);
    expect(bAccounts.body.accounts[0].name).toBe("Bob's Spending Account");

    // 2. Bob attempts to directly update or delete Alice's account by ID
    const hackUpdate = await request(app)
      .put(`/api/accounts/${partnerAAccountId}`)
      .set('Authorization', `Bearer ${partnerBToken}`)
      .send({ name: 'Hacked Account' });
    expect(hackUpdate.status).toBe(404);

    const hackDelete = await request(app)
      .delete(`/api/accounts/${partnerAAccountId}`)
      .set('Authorization', `Bearer ${partnerBToken}`);
    expect(hackDelete.status).toBe(404);

    // 3. Bob attempts to view transactions: should see 0 of Alice's transactions
    const bTransactions = await request(app)
      .get('/api/transactions')
      .set('Authorization', `Bearer ${partnerBToken}`);
    expect(bTransactions.status).toBe(200);
    expect(bTransactions.body.transactions.length).toBe(0);

    // 4. Alice creates a private personal goal
    const aGoalRes = await request(app)
      .post('/api/goals')
      .set('Authorization', `Bearer ${partnerAToken}`)
      .send({ name: "Alice's Secret Solo Trip", targetAmountCentavos: 2000000 });
    const aGoalId = aGoalRes.body.goal.id;

    // Bob tries to view or contribute to Alice's personal goal
    const bGoals = await request(app)
      .get('/api/goals')
      .set('Authorization', `Bearer ${partnerBToken}`);
    expect(bGoals.body.goals.length).toBe(0);

    const bHackContribute = await request(app)
      .post(`/api/goals/${aGoalId}/contribute`)
      .set('Authorization', `Bearer ${partnerBToken}`)
      .send({ amountCentavos: 10000 });
    expect(bHackContribute.status).toBe(404);
  });

  it('Shared Goal: both see only the goal entity, total saved, and contribution breakdown without account leaks', async () => {
    // 1. Connect Alice and Bob
    const inviteRes = await request(app)
      .post('/api/partners/invite')
      .set('Authorization', `Bearer ${partnerAToken}`);
    await request(app)
      .post('/api/partners/accept')
      .set('Authorization', `Bearer ${partnerBToken}`)
      .send({ inviteCode: inviteRes.body.inviteCode });

    // 2. Alice creates a shared goal for "House Downpayment"
    const goalRes = await request(app)
      .post('/api/partners/shared-goals')
      .set('Authorization', `Bearer ${partnerAToken}`)
      .send({
        name: 'House Downpayment',
        targetAmountCentavos: 10000000 // 100,000 PHP
      });
    expect(goalRes.status).toBe(201);
    const sharedGoalId = goalRes.body.sharedGoal.id;

    // 3. Alice contributes 20,000 PHP from her private vault
    const aContrib = await request(app)
      .post(`/api/partners/shared-goals/${sharedGoalId}/contribute`)
      .set('Authorization', `Bearer ${partnerAToken}`)
      .send({
        amountCentavos: 2000000,
        fromAccountId: partnerAAccountId,
        notes: 'Monthly deposit'
      });
    expect(aContrib.status).toBe(201);

    // 4. Bob contributes 10,000 PHP from his private account
    const bContrib = await request(app)
      .post(`/api/partners/shared-goals/${sharedGoalId}/contribute`)
      .set('Authorization', `Bearer ${partnerBToken}`)
      .send({
        amountCentavos: 1000000,
        fromAccountId: partnerBAccountId,
        notes: 'Bonus contribution'
      });
    expect(bContrib.status).toBe(201);

    // 5. Bob queries shared goals:
    const bobSharedRes = await request(app)
      .get('/api/partners/shared-goals')
      .set('Authorization', `Bearer ${partnerBToken}`);

    expect(bobSharedRes.status).toBe(200);
    expect(bobSharedRes.body.sharedGoals.length).toBe(1);

    const goalView = bobSharedRes.body.sharedGoals[0];
    expect(goalView.name).toBe('House Downpayment');
    expect(goalView.totalSavedCentavos).toBe(3000000); // 30,000 PHP total
    expect(goalView.remainingCentavos).toBe(7000000); // 70,000 PHP remaining
    expect(goalView.percentage).toBe(30);

    // Member contributions breakdown
    const aliceMember = goalView.members.find((m: any) => m.name === 'Alice');
    const bobMember = goalView.members.find((m: any) => m.name === 'Bob');
    expect(aliceMember.totalContributedCentavos).toBe(2000000);
    expect(bobMember.totalContributedCentavos).toBe(1000000);

    // PRIVACY VERIFICATION: Recent contributions DTO must NOT contain `accountId` or bank details
    goalView.recentContributions.forEach((rc: any) => {
      expect(rc).not.toHaveProperty('accountId');
      expect(rc).not.toHaveProperty('destinationAccountId');
      expect(rc).not.toHaveProperty('transactionId');
      expect(rc).toHaveProperty('contributorName');
      expect(rc).toHaveProperty('amountCentavos');
    });

    // 6. Test Unlinking: archives the shared goal and severs partner relationship
    const unlinkRes = await request(app)
      .post('/api/partners/unlink')
      .set('Authorization', `Bearer ${partnerAToken}`);
    expect(unlinkRes.status).toBe(200);

    // Check status is now disconnected for both
    const statusAfterA = await request(app)
      .get('/api/partners/status')
      .set('Authorization', `Bearer ${partnerAToken}`);
    expect(statusAfterA.body.connected).toBe(false);

    const statusAfterB = await request(app)
      .get('/api/partners/status')
      .set('Authorization', `Bearer ${partnerBToken}`);
    expect(statusAfterB.body.connected).toBe(false);
  });
});
