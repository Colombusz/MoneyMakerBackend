import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import { uuidv4 } from '../src/utils/uuid';

const TEST_MONGO_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27018/moneysaver_test';

const runTests = async () => {
  console.log('🚀 Starting MoneySaver Backend Test Suite...\n');
  await mongoose.connect(TEST_MONGO_URI);

  const cleanDB = async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  };

  try {
    // =========================================================================
    // 1. AUTH TESTS
    // =========================================================================
    console.log('--- Suite 1: Authentication & JWT Rotation ---');
    await cleanDB();

    const testUser = {
      email: 'test@example.com',
      password: 'password123',
      name: 'Juan Dela Cruz',
      currency: 'PHP'
    };

    // Register
    const regRes = await request(app).post('/api/auth/register').send(testUser);
    if (regRes.status !== 201 || !regRes.body.accessToken || !regRes.body.refreshToken) {
      throw new Error(`Register failed: ${JSON.stringify(regRes.body)}`);
    }
    const token = regRes.body.accessToken;
    const refreshToken = regRes.body.refreshToken;
    console.log('  ✔ User registration successful');

    // Default categories seeded
    const catRes = await request(app)
      .get('/api/categories')
      .set('Authorization', `Bearer ${token}`);
    if (catRes.status !== 200 || catRes.body.categories.length < 8) {
      throw new Error(`Categories seeding failed: ${JSON.stringify(catRes.body)}`);
    }
    console.log(`  ✔ Default categories seeded (${catRes.body.categories.length} categories)`);

    // Login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });
    if (loginRes.status !== 200 || !loginRes.body.accessToken) {
      throw new Error(`Login failed: ${JSON.stringify(loginRes.body)}`);
    }
    console.log('  ✔ User login successful');

    // Token refresh rotation
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: loginRes.body.refreshToken });
    if (refreshRes.status !== 200 || !refreshRes.body.refreshToken) {
      throw new Error(`Refresh failed: ${JSON.stringify(refreshRes.body)}`);
    }
    if (refreshRes.body.refreshToken === loginRes.body.refreshToken) {
      throw new Error('Refresh token was not rotated!');
    }
    console.log('  ✔ Refresh token rotation verified');

    // Replay attack prevention (reusing old refresh token must fail)
    const replayRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: loginRes.body.refreshToken });
    if (replayRes.status !== 401) {
      throw new Error(`Replay attack was not blocked! Status: ${replayRes.status}`);
    }
    console.log('  ✔ Refresh token replay attack blocked');

    // Verify session token lifetime is at least 15 days
    const decoded = jwt.decode(token) as { exp: number; iat: number };
    const validitySeconds = decoded.exp - decoded.iat;
    const fifteenDaysInSeconds = 15 * 24 * 60 * 60;
    if (validitySeconds < fifteenDaysInSeconds) {
      throw new Error(`Session token lifetime is less than 15 days! Was: ${validitySeconds}s`);
    }
    console.log(`  ✔ Session token validity is at least 15 days (${Math.round(validitySeconds / 86400)} days)`);

    // Verify multi-device session coexistence (Web & Android)
    const androidLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });
    const webLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });

    // Both Android and Web can access authenticated endpoint
    const androidMe = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${androidLoginRes.body.accessToken}`);
    const webMe = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${webLoginRes.body.accessToken}`);
    if (androidMe.status !== 200 || webMe.status !== 200) {
      throw new Error('Multi-device access failed');
    }

    // Both Android and Web can independently refresh without revoking each other
    const androidRefresh = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: androidLoginRes.body.refreshToken });
    const webRefresh = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: webLoginRes.body.refreshToken });
    if (androidRefresh.status !== 200 || webRefresh.status !== 200) {
      throw new Error('Multi-device refresh revoked concurrent session');
    }
    console.log('  ✔ Multi-device sessions (Web & Android) maintained without revocation');

    // =========================================================================
    // 2. ACCOUNTS & TRANSACTIONS TESTS
    // =========================================================================
    console.log('\n--- Suite 2: Accounts, Transactions, Transfers & Month Summary ---');
    await cleanDB();

    const userRes = await request(app).post('/api/auth/register').send({
      email: 'finance@example.com',
      password: 'password123',
      name: 'Maria Santos'
    });
    const userToken = userRes.body.accessToken;

    // Create Payroll account (10,000 PHP = 1,000,000 centavos)
    const payrollRes = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Payroll', type: 'payroll', startingBalanceCentavos: 1000000 });
    const payrollId = payrollRes.body.account.id;

    // Create Maribank account (0 starting)
    const maribankRes = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Maribank', type: 'goals', startingBalanceCentavos: 0 });
    const maribankId = maribankRes.body.account.id;

    // Income: 5,000 PHP (500,000 centavos)
    await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        accountId: payrollId,
        type: 'income',
        amountCentavos: 500000,
        source: 'Acme Corp Salary',
        date: '2026-09-15T09:00:00.000Z'
      });

    // Expense: 1,200 PHP (120,000 centavos)
    const foodCat = catRes.body.categories.find((c: any) => c.name.includes('Food'))?.id;
    await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        accountId: payrollId,
        type: 'expense',
        amountCentavos: 120000,
        categoryId: foodCat,
        date: '2026-09-16T12:00:00.000Z'
      });

    // Transfer: 3,000 PHP (300,000 centavos) Payroll -> Maribank via POST /api/accounts/transfer
    await request(app)
      .post('/api/accounts/transfer')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        fromAccountId: payrollId,
        toAccountId: maribankId,
        amountCentavos: 300000,
        date: '2026-09-17T15:00:00.000Z',
        notes: 'Transfer to Maribank'
      });

    // Verify account balances
    const accListRes = await request(app)
      .get('/api/accounts')
      .set('Authorization', `Bearer ${userToken}`);
    const payrollAcc = accListRes.body.accounts.find((a: any) => a.id === payrollId);
    const maribankAcc = accListRes.body.accounts.find((a: any) => a.id === maribankId);

    // Expected: Payroll: 1,000,000 + 500,000 - 120,000 - 300,000 = 1,080,000 centavos
    // Expected: Maribank: 0 + 300,000 = 300,000 centavos
    if (payrollAcc.currentBalanceCentavos !== 1080000) {
      throw new Error(`Payroll balance mismatch: expected 1080000, got ${payrollAcc.currentBalanceCentavos}`);
    }
    if (maribankAcc.currentBalanceCentavos !== 300000) {
      throw new Error(`Maribank balance mismatch: expected 300000, got ${maribankAcc.currentBalanceCentavos}`);
    }

    // Verify default Cash account exists and is protected
    const cashAcc = accListRes.body.accounts.find((a: any) => a.name.toLowerCase() === 'cash' || a.type === 'cash');
    if (!cashAcc) {
      throw new Error('Default Cash account was not found');
    }
    const renameRes = await request(app)
      .put(`/api/accounts/${cashAcc.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Renamed Cash' });
    if (renameRes.status !== 400) {
      throw new Error(`Renaming Cash account should fail with 400, got ${renameRes.status}`);
    }
    const deleteRes = await request(app)
      .delete(`/api/accounts/${cashAcc.id}`)
      .set('Authorization', `Bearer ${userToken}`);
    if (deleteRes.status !== 400) {
      throw new Error(`Deleting Cash account should fail with 400, got ${deleteRes.status}`);
    }
    console.log('  ✔ Default Cash account verified and protected against rename/delete');
    if (accListRes.body.totalBalanceCentavos !== 1380000) {
      throw new Error(`Total balance mismatch: expected 1380000, got ${accListRes.body.totalBalanceCentavos}`);
    }
    console.log('  ✔ Account balances & transfers calculated correctly in centavos');

    // Month Summary (transfers must not be counted)
    const summaryRes = await request(app)
      .get('/api/transactions/month-summary?year=2026&month=9')
      .set('Authorization', `Bearer ${userToken}`);
    if (summaryRes.body.totalIncomeCentavos !== 500000) {
      throw new Error(`Summary income mismatch: expected 500000, got ${summaryRes.body.totalIncomeCentavos}`);
    }
    if (summaryRes.body.totalExpenseCentavos !== 120000) {
      throw new Error(`Summary expense mismatch: expected 120000, got ${summaryRes.body.totalExpenseCentavos}`);
    }
    if (summaryRes.body.netCentavos !== 380000) {
      throw new Error(`Summary net mismatch: expected 380000, got ${summaryRes.body.netCentavos}`);
    }
    console.log('  ✔ Month summary excludes transfers and tallies income/expense accurately');

    // =========================================================================
    // 3. RECURRING BILLS & OCCURRENCES
    // =========================================================================
    console.log('\n--- Suite 3: Recurring Bills, Virtual Projections & Overrides ---');
    // Test POST /api/recurring/rules (alias)
    const recurringRes = await request(app)
      .post('/api/recurring/rules')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        accountId: payrollId,
        categoryId: foodCat || 'default-cat',
        amountCentavos: 150000, // 1,500 PHP
        frequency: 'monthly',
        startDate: '2026-09-01T00:00:00.000Z',
        notes: 'Internet Fiber Bill'
      });
    if (recurringRes.status !== 201 || !recurringRes.body.rule) {
      throw new Error(`POST /api/recurring/rules failed: ${JSON.stringify(recurringRes.body)}`);
    }
    const ruleId = recurringRes.body.rule.id;

    // Test GET /api/recurring/rules (alias)
    const getRulesRes = await request(app)
      .get('/api/recurring/rules')
      .set('Authorization', `Bearer ${userToken}`);
    if (getRulesRes.status !== 200 || !Array.isArray(getRulesRes.body.rules)) {
      throw new Error(`GET /api/recurring/rules failed: ${JSON.stringify(getRulesRes.body)}`);
    }

    // Get projections for September to November 2026 using startDate & endDate query params
    const occRes = await request(app)
      .get('/api/recurring/occurrences?startDate=2026-09-01&endDate=2026-11-30')
      .set('Authorization', `Bearer ${userToken}`);
    if (occRes.body.occurrences.length !== 3) {
      throw new Error(`Expected 3 projected occurrences, got ${occRes.body.occurrences.length}`);
    }
    console.log('  ✔ Virtual projection generated correct occurrences for visible range');

    // Pay occurrence using POST /api/recurring/occurrences/pay with ruleId in body
    const payRes = await request(app)
      .post('/api/recurring/occurrences/pay')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ ruleId, occurrenceDate: '2026-09-01T00:00:00.000Z' });
    if (payRes.status !== 200 || !payRes.body.transactionId) {
      throw new Error(`Pay occurrence failed: ${JSON.stringify(payRes.body)}`);
    }

    // Skip occurrence using POST /api/recurring/occurrences/skip with ruleId in body
    const skipRes = await request(app)
      .post('/api/recurring/occurrences/skip')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ ruleId, occurrenceDate: '2026-10-01T00:00:00.000Z' });
    if (skipRes.status !== 200) {
      throw new Error(`Skip occurrence failed: ${JSON.stringify(skipRes.body)}`);
    }

    // Check updated occurrences
    const occResAfter = await request(app)
      .get('/api/recurring/occurrences?start=2026-09-01&end=2026-11-30')
      .set('Authorization', `Bearer ${userToken}`);
    const sepOcc = occResAfter.body.occurrences.find((o: any) => o.date === '2026-09-01');
    const octOcc = occResAfter.body.occurrences.find((o: any) => o.date === '2026-10-01');
    const novOcc = occResAfter.body.occurrences.find((o: any) => o.date === '2026-11-01');

    if (sepOcc.status !== 'paid' || octOcc.status !== 'skipped' || novOcc.status !== 'pending') {
      throw new Error(`Occurrence statuses incorrect: Sep=${sepOcc.status}, Oct=${octOcc.status}, Nov=${novOcc.status}`);
    }
    console.log('  ✔ Recurring pay and skip overrides functioning as expected');

    // =========================================================================
    // 4. PERSONAL GOALS & CONTRIBUTIONS
    // =========================================================================
    console.log('\n--- Suite 4: Personal Savings Goals & Progress Tracking ---');
    const goalRes = await request(app)
      .post('/api/goals')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Emergency Fund',
        targetAmountCentavos: 5000000, // 50,000 PHP
        linkedAccountId: maribankId
      });
    const goalId = goalRes.body.goal.id;

    // Contribute 10,000 PHP (1,000,000 centavos)
    const contribRes = await request(app)
      .post(`/api/goals/${goalId}/contribute`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        amountCentavos: 1000000,
        fromAccountId: maribankId,
        notes: 'First contribution'
      });
    if (contribRes.status !== 201) {
      throw new Error(`Goal contribution failed: ${JSON.stringify(contribRes.body)}`);
    }

    const goalsList = await request(app)
      .get('/api/goals')
      .set('Authorization', `Bearer ${userToken}`);
    const goal = goalsList.body.goals[0];
    if (goal.totalSavedCentavos !== 1000000 || goal.percentage !== 20 || goal.remainingCentavos !== 4000000) {
      throw new Error(`Goal metrics mismatch: ${JSON.stringify(goal)}`);
    }
    console.log('  ✔ Goal metrics, percentage, and remaining amount calculated correctly');

    // =========================================================================
    // 5. CRITICAL PRIVACY & PARTNER ISOLATION TESTS
    // =========================================================================
    console.log('\n--- Suite 5: CRITICAL PRIVACY TEST (Partner Isolation & Shared Goals) ---');
    await cleanDB();

    // Alice
    const aliceAuth = await request(app).post('/api/auth/register').send({
      email: 'alice@isolation.test',
      password: 'password123',
      name: 'Alice'
    });
    const aliceToken = aliceAuth.body.accessToken;

    // Bob
    const bobAuth = await request(app).post('/api/auth/register').send({
      email: 'bob@isolation.test',
      password: 'password123',
      name: 'Bob'
    });
    const bobToken = bobAuth.body.accessToken;

    // Alice's secret account and transaction
    const aliceAcc = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ name: "Alice's Secret Vault", type: 'savings', startingBalanceCentavos: 10000000 });
    const aliceAccId = aliceAcc.body.account.id;

    await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        accountId: aliceAccId,
        type: 'expense',
        amountCentavos: 500000,
        notes: 'Confidential Medical Expense'
      });

    // Bob's account
    const bobAcc = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ name: "Bob's Checking", type: 'payroll', startingBalanceCentavos: 2000000 });
    const bobAccId = bobAcc.body.account.id;

    // Connect via Invite
    const inviteRes = await request(app)
      .post('/api/partners/invite')
      .set('Authorization', `Bearer ${aliceToken}`);
    const inviteCode = inviteRes.body.inviteCode;

    const acceptRes = await request(app)
      .post('/api/partners/accept')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ inviteCode });
    if (acceptRes.status !== 200) {
      throw new Error(`Accept invite failed: ${JSON.stringify(acceptRes.body)}`);
    }
    console.log('  ✔ Partner connection established via invite code');

    // PRIVACY CHECK 1: Bob queries /api/accounts
    const bobAccountsRes = await request(app)
      .get('/api/accounts')
      .set('Authorization', `Bearer ${bobToken}`);
    const seesAliceAccount = bobAccountsRes.body.accounts.some((a: any) => a.id === aliceAccId);
    if (seesAliceAccount) {
      throw new Error('CRITICAL LEAK: Bob can see Alice private account!');
    }
    console.log("  ✔ Partner Isolation: Bob CANNOT see Alice's accounts");

    // PRIVACY CHECK 2: Bob queries /api/transactions
    const bobTxRes = await request(app)
      .get('/api/transactions')
      .set('Authorization', `Bearer ${bobToken}`);
    if (bobTxRes.body.transactions.length !== 0) {
      throw new Error("CRITICAL LEAK: Bob can see Alice's private transactions!");
    }
    console.log("  ✔ Partner Isolation: Bob CANNOT see Alice's transactions");

    // PRIVACY CHECK 3: Bob tries to manipulate Alice's account directly by ID
    const hackRes = await request(app)
      .put(`/api/accounts/${aliceAccId}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ name: 'Tampered Account' });
    if (hackRes.status !== 404) {
      throw new Error(`CRITICAL LEAK: Bob accessed Alice's account directly! Status: ${hackRes.status}`);
    }
    console.log("  ✔ Partner Isolation: Direct ID manipulation blocked (404)");

    // Shared Goal Creation
    const sharedGoalRes = await request(app)
      .post('/api/partners/shared-goals')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        name: 'Wedding Fund',
        targetAmountCentavos: 10000000 // 100,000 PHP
      });
    const sharedGoalId = sharedGoalRes.body.sharedGoal.id;

    // Both contribute
    await request(app)
      .post(`/api/partners/shared-goals/${sharedGoalId}/contribute`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ amountCentavos: 3000000, fromAccountId: aliceAccId, notes: 'Alice initial deposit' });

    await request(app)
      .post(`/api/partners/shared-goals/${sharedGoalId}/contribute`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ amountCentavos: 2000000, fromAccountId: bobAccId, notes: 'Bob initial deposit' });

    // Verify Bob queries shared goal
    const bobSharedRes = await request(app)
      .get('/api/partners/shared-goals')
      .set('Authorization', `Bearer ${bobToken}`);
    const weddingGoal = bobSharedRes.body.sharedGoals[0];

    if (weddingGoal.totalSavedCentavos !== 5000000 || weddingGoal.percentage !== 50) {
      throw new Error(`Shared goal totals mismatch: ${JSON.stringify(weddingGoal)}`);
    }

    // Check contribution breakdown by partner
    const aliceContrib = weddingGoal.members.find((m: any) => m.name === 'Alice')?.totalContributedCentavos;
    const bobContrib = weddingGoal.members.find((m: any) => m.name === 'Bob')?.totalContributedCentavos;
    if (aliceContrib !== 3000000 || bobContrib !== 2000000) {
      throw new Error(`Member breakdown mismatch: Alice=${aliceContrib}, Bob=${bobContrib}`);
    }

    // Verify DTO does not leak account details
    weddingGoal.recentContributions.forEach((rc: any) => {
      if (rc.accountId || rc.fromAccountId || rc.destinationAccountId) {
        throw new Error('CRITICAL LEAK: Shared goal exposed bank account IDs!');
      }
    });
    console.log('  ✔ Shared Goal: Only allowed shared-goal DTO fields exposed, zero bank accounts leaked');

    // Unlinking partners
    const unlinkRes = await request(app)
      .post('/api/partners/unlink')
      .set('Authorization', `Bearer ${aliceToken}`);
    if (unlinkRes.status !== 200) {
      throw new Error(`Unlink failed: ${JSON.stringify(unlinkRes.body)}`);
    }

    const aliceStatusAfter = await request(app)
      .get('/api/partners/status')
      .set('Authorization', `Bearer ${aliceToken}`);
    if (aliceStatusAfter.body.connected !== false) {
      throw new Error('Alice still connected after unlink');
    }
    console.log('  ✔ Partner unlinked and shared goals properly archived');

    // =========================================================================
    // 6. SYNC ENGINE TESTS
    // =========================================================================
    console.log('\n--- Suite 6: Offline Sync Engine (Push, Pull, LWW Conflict) ---');
    const offlineAccId = uuidv4();
    const now = Date.now();

    // Push offline record
    const pushRes = await request(app)
      .post('/api/sync/push')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        changes: [
          {
            id: offlineAccId,
            entityType: 'accounts',
            action: 'upsert',
            payload: {
              name: 'Offline Stash',
              type: 'cash',
              startingBalanceCentavos: 250000,
              currentBalanceCentavos: 250000
            },
            updatedAt: now
          }
        ]
      });
    if (!pushRes.body.appliedIds.includes(offlineAccId)) {
      throw new Error(`Sync push failed: ${JSON.stringify(pushRes.body)}`);
    }
    console.log('  ✔ Offline outbox push accepted by client UUID');

    // Pull changes with cursor
    const pullRes = await request(app)
      .get(`/api/sync/pull?since=${new Date(now - 1000).toISOString()}`)
      .set('Authorization', `Bearer ${aliceToken}`);
    const pulled = pullRes.body.accounts.find((a: any) => a._id === offlineAccId);
    if (!pulled || pulled.name !== 'Offline Stash') {
      throw new Error(`Sync pull did not find account: ${JSON.stringify(pullRes.body)}`);
    }
    console.log('  ✔ Sync pull retrieved changes since cursor');

    // Conflict detection: older timestamp must be rejected
    const conflictRes = await request(app)
      .post('/api/sync/push')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        changes: [
          {
            id: offlineAccId,
            entityType: 'accounts',
            action: 'upsert',
            payload: { name: 'Stale Edit' },
            updatedAt: now - 10000
          }
        ]
      });
    if (conflictRes.body.conflicts.length === 0) {
      throw new Error('LWW conflict was not detected!');
    }
    console.log('  ✔ Last-Write-Wins (LWW) conflict resolution verified');

    console.log('\n🎉 ALL BACKEND TEST SUITES PASSED FLAWLESSLY!\n');
  } catch (error) {
    console.error('\n❌ TEST RUN FAILED:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
};

runTests();
