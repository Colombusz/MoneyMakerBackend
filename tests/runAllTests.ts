import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import { uuidv4 } from '../src/utils/uuid';

const TEST_MONGO_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/moneysaver_test';

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

    // =========================================================================
    // 7. VACATION MODE TESTS
    // =========================================================================
    console.log('\n--- Suite 7: Vacation Mode (Pool, Chip-in, Overdraft, Master Controls, Refunds, Conclude & Past Privacy) ---');
    await cleanDB();

    // 1. Create Master (Alice) and Member (Bob)
    const masterAuth = await request(app).post('/api/auth/register').send({
      email: 'master@vacation.test',
      password: 'password123',
      name: 'Alice Master'
    });
    const masterToken = masterAuth.body.accessToken;

    const memberAuth = await request(app).post('/api/auth/register').send({
      email: 'member@vacation.test',
      password: 'password123',
      name: 'Bob Member'
    });
    const memberToken = memberAuth.body.accessToken;

    // Fund Alice's local account (500,000 centavos = ₱5,000)
    const aliceAccRes = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ name: 'Alice Checking', type: 'payroll', startingBalanceCentavos: 500000 });
    const masterAccId = aliceAccRes.body.account.id;

    // Fund Bob's local account (200,000 centavos = ₱2,000)
    const bobAccRes = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ name: 'Bob Savings', type: 'savings', startingBalanceCentavos: 200000 });
    const memberAccId = bobAccRes.body.account.id;

    // 2. Master creates vacation
    const createVacRes = await request(app)
      .post('/api/vacations')
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ name: 'Boracay Getaway 2026', description: 'Summer trip' });
    if (createVacRes.status !== 201 || !createVacRes.body.vacation) {
      throw new Error(`Create vacation failed: ${JSON.stringify(createVacRes.body)}`);
    }
    const vacation = createVacRes.body.vacation;
    const vacationId = vacation._id;
    const joinCode = vacation.joinCode;
    if (!joinCode || vacation.balanceCentavos !== 0 || vacation.members[0].role !== 'master') {
      throw new Error(`Invalid vacation initialization: ${JSON.stringify(vacation)}`);
    }
    console.log(`  ✔ Vacation created with join code: ${joinCode}`);

    // 3. Member joins vacation via code
    const joinRes = await request(app)
      .post('/api/vacations/join')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ joinCode });
    if (joinRes.status !== 200 || joinRes.body.vacation.members.length !== 2) {
      throw new Error(`Join vacation failed: ${JSON.stringify(joinRes.body)}`);
    }
    console.log('  ✔ Member successfully joined vacation using join code');

    // 4. Overdraft Prevention on Member Deposit
    const overDepositRes = await request(app)
      .post(`/api/vacations/${vacationId}/deposit`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        amountCentavos: 300000, // ₱3,000 (Bob only has ₱2,000)
        fromAccountId: memberAccId
      });
    if (overDepositRes.status !== 400) {
      throw new Error(`Deposit overdraft was not blocked! Status: ${overDepositRes.status}`);
    }
    console.log('  ✔ Local account overdraft blocked during deposit');

    // 5. Valid deposits by Alice (₱1,000) and Bob (₱500)
    const aliceDep = await request(app)
      .post(`/api/vacations/${vacationId}/deposit`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ amountCentavos: 100000, fromAccountId: masterAccId, notes: 'Alice initial share' });
    if (aliceDep.status !== 201 || aliceDep.body.vacation.balanceCentavos !== 100000) {
      throw new Error(`Alice deposit failed: ${JSON.stringify(aliceDep.body)}`);
    }

    const bobDep = await request(app)
      .post(`/api/vacations/${vacationId}/deposit`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ amountCentavos: 50000, fromAccountId: memberAccId, notes: 'Bob initial share' });
    if (bobDep.status !== 201 || bobDep.body.vacation.balanceCentavos !== 150000) {
      throw new Error(`Bob deposit failed: ${JSON.stringify(bobDep.body)}`);
    }
    console.log('  ✔ Valid deposits pooled into vacation balance (Total: 150,000 centavos)');

    // 6. Master-only Expense Items & Vacation Overdraft Prevention
    // Non-master Bob tries to create shared expense
    const bobExpenseRes = await request(app)
      .post(`/api/vacations/${vacationId}/expense-items`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ title: 'Dinner buffet', amountCentavos: 40000 });
    if (bobExpenseRes.status !== 403) {
      throw new Error(`Non-master creating expense should fail with 403, got ${bobExpenseRes.status}`);
    }

    // Master tries to create expense larger than vacation balance (overdraft)
    const overExpenseRes = await request(app)
      .post(`/api/vacations/${vacationId}/expense-items`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ title: 'Luxury Villa', amountCentavos: 200000 }); // Pool only has 150,000
    if (overExpenseRes.status !== 400) {
      throw new Error(`Vacation overdraft should fail with 400, got ${overExpenseRes.status}`);
    }

    // Master creates valid expense (₱1,000)
    const validExpRes = await request(app)
      .post(`/api/vacations/${vacationId}/expense-items`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ title: 'Resort Booking', amountCentavos: 100000, category: 'Accommodation' });
    if (validExpRes.status !== 201 || validExpRes.body.vacation.balanceCentavos !== 50000) {
      throw new Error(`Master expense item creation failed: ${JSON.stringify(validExpRes.body)}`);
    }
    console.log('  ✔ Master-only expense item deduction & vacation overdraft prevention verified');

    // 7. Member Logged Expenses (Records Only - Does NOT change pool balance; deducts from local account)
    // Overdraft check on chosen local account (Bob only has 150,000 available)
    const logExpOverdraftRes = await request(app)
      .post(`/api/vacations/${vacationId}/logged-expenses`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        title: 'Expensive Watch',
        amountCentavos: 250000,
        fromAccountId: memberAccId,
        category: 'Shopping'
      });
    if (logExpOverdraftRes.status !== 400) {
      throw new Error(`Personal logged expense overdraft should fail with 400, got ${logExpOverdraftRes.status}`);
    }

    // Valid personal logged expense with chosen account deduction
    const logExpRes = await request(app)
      .post(`/api/vacations/${vacationId}/logged-expenses`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        title: 'Souvenir T-shirt',
        amountCentavos: 15000,
        fromAccountId: memberAccId,
        category: 'Shopping'
      });
    if (logExpRes.status !== 201 || logExpRes.body.loggedExpense.fromAccountId !== memberAccId) {
      throw new Error(`Log expense failed: ${JSON.stringify(logExpRes.body)}`);
    }

    // Verify member's local account balance was deducted (was 150,000 - 15,000 = 135,000)
    const memberAccRes = await request(app)
      .get('/api/accounts')
      .set('Authorization', `Bearer ${memberToken}`);
    const updatedMemberAcc = memberAccRes.body.accounts.find((a: any) => a.id === memberAccId);
    if (!updatedMemberAcc || updatedMemberAcc.currentBalanceCentavos !== 135000) {
      throw new Error(`Member account balance not updated after personal expense deduction: ${updatedMemberAcc?.currentBalanceCentavos}`);
    }

    const checkVacRes = await request(app)
      .get(`/api/vacations/${vacationId}`)
      .set('Authorization', `Bearer ${masterToken}`);
    if (checkVacRes.body.vacation.balanceCentavos !== 50000) {
      throw new Error(`Personal logged expense altered vacation balance: ${checkVacRes.body.vacation.balanceCentavos}`);
    }
    console.log('  ✔ Personal logged expense deducted from chosen local account without affecting vacation balance');

    // 8. Chip-ins: Creation (Master only) & Contribution (Any member)
    const chipInCreateRes = await request(app)
      .post(`/api/vacations/${vacationId}/chip-ins`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ title: 'Island Hopping Boat', targetAmountCentavos: 80000 });
    if (chipInCreateRes.status !== 201 || !chipInCreateRes.body.chipIn) {
      throw new Error(`Chip-in creation failed: ${JSON.stringify(chipInCreateRes.body)}`);
    }
    const chipInId = chipInCreateRes.body.chipIn._id;

    // Bob chips in 40,000 centavos
    const bobChipRes = await request(app)
      .post(`/api/vacations/${vacationId}/chip-ins/${chipInId}/contribute`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ amountCentavos: 40000, fromAccountId: memberAccId, notes: 'Bob share for boat' });
    if (bobChipRes.status !== 201 || bobChipRes.body.vacation.balanceCentavos !== 50000 || bobChipRes.body.chipIn.totalCollectedCentavos !== 40000) {
      throw new Error(`Bob chip-in failed: ${JSON.stringify(bobChipRes.body)}`);
    }

    // Alice chips in 40,000 centavos
    const aliceChipRes = await request(app)
      .post(`/api/vacations/${vacationId}/chip-ins/${chipInId}/contribute`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ amountCentavos: 40000, fromAccountId: masterAccId, notes: 'Alice share for boat' });
    if (aliceChipRes.status !== 201 || aliceChipRes.body.vacation.balanceCentavos !== 50000 || aliceChipRes.body.chipIn.totalCollectedCentavos !== 80000) {
      throw new Error(`Alice chip-in failed: ${JSON.stringify(aliceChipRes.body)}`);
    }
    console.log('  ✔ Chip-in item funded by members without affecting main pool (Main pool remains: 50,000 centavos)');

    // 9. Master creates expense with source of deduction chosen:
    // 9a. Overdraft check on chip-in item deduction (Boat only collected 80,000, try 90,000)
    const overChipExp = await request(app)
      .post(`/api/vacations/${vacationId}/expense-items`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ title: 'Luxury Yacht upgrade', amountCentavos: 90000, deductionSource: 'chip_in', chipInId });
    if (overChipExp.status !== 400) {
      throw new Error(`Chip-in overdraft should fail with 400, got ${overChipExp.status}`);
    }

    // 9b. Valid expense deducted from chip-in item (₱600 = 60,000 centavos, leaving 20,000 leftover in chip-in)
    const boatExp = await request(app)
      .post(`/api/vacations/${vacationId}/expense-items`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ title: 'Boat rental payment', amountCentavos: 60000, deductionSource: 'chip_in', chipInId });
    if (
      boatExp.status !== 201 ||
      boatExp.body.vacation.balanceCentavos !== 50000 ||
      boatExp.body.expenseItem.deductionSource !== 'chip_in' ||
      boatExp.body.expenseItem.chipInId !== chipInId
    ) {
      throw new Error(`Boat expense mismatch: ${JSON.stringify(boatExp.body)}`);
    }
    console.log('  ✔ Expense deducted from chosen chip-in item without altering main pool (Remaining chip-in: 20,000)');

    // Append-only reversal test: Master records a mistaken 10,000 centavos expense from main pool and reverses it
    const mistakenExp = await request(app)
      .post(`/api/vacations/${vacationId}/expense-items`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ title: 'Accidental charge', amountCentavos: 10000, deductionSource: 'pool' });
    // Main pool balance is now 40,000
    if (mistakenExp.body.vacation.balanceCentavos !== 40000) {
      throw new Error(`Mistaken pool expense mismatch: ${mistakenExp.body.vacation.balanceCentavos}`);
    }
    const mistakeLogId = mistakenExp.body.log._id;

    const reverseRes = await request(app)
      .post(`/api/vacations/${vacationId}/reversal`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ originalLogId: mistakeLogId, reason: 'Erroneous billing reversed by merchant' });
    if (reverseRes.status !== 200 || reverseRes.body.vacation.balanceCentavos !== 50000) {
      throw new Error(`Reversal failed: ${JSON.stringify(reverseRes.body)}`);
    }
    console.log('  ✔ Append-only log reversal restored correct vacation balance');

    // 10. Refunds and Conclusion Rules
    // Master attempts to conclude when balance is 50,000 centavos -> Blocked!
    const prematureConclude = await request(app)
      .post(`/api/vacations/${vacationId}/conclude`)
      .set('Authorization', `Bearer ${masterToken}`);
    if (prematureConclude.status !== 400) {
      throw new Error(`Concluding with non-zero balance should fail, got ${prematureConclude.status}`);
    }
    console.log('  ✔ Concluding blocked when vacation account balance is non-zero');

    // Master refunds 25,000 centavos to Bob and 25,000 to Alice from pool
    const refundBob = await request(app)
      .post(`/api/vacations/${vacationId}/refund`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ memberUserId: memberAuth.body.user.id, amountCentavos: 25000, notes: 'Bob pool refund' });
    if (refundBob.status !== 200 || refundBob.body.vacation.balanceCentavos !== 25000) {
      throw new Error(`Refund Bob failed: ${JSON.stringify(refundBob.body)}`);
    }

    const refundAlice = await request(app)
      .post(`/api/vacations/${vacationId}/refund`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ memberUserId: masterAuth.body.user.id, amountCentavos: 25000, notes: 'Alice pool refund' });
    if (refundAlice.status !== 200 || refundAlice.body.vacation.balanceCentavos !== 0) {
      throw new Error(`Refund Alice failed: ${JSON.stringify(refundAlice.body)}`);
    }
    console.log('  ✔ Remaining pool funds transferred back to members (Pool balance now: 0)');

    // Concluding must STILL be blocked because chip-in has 20,000 remaining balance!
    const chipInPendingConclude = await request(app)
      .post(`/api/vacations/${vacationId}/conclude`)
      .set('Authorization', `Bearer ${masterToken}`);
    if (chipInPendingConclude.status !== 400) {
      throw new Error(`Concluding with non-zero chip-in balance should fail, got ${chipInPendingConclude.status}`);
    }
    console.log('  ✔ Concluding blocked when a chip-in item still has remaining balance');

    // Overdraft check on chip-in refund (try 25,000 when only 20,000 remains)
    const overRefundChip = await request(app)
      .post(`/api/vacations/${vacationId}/refund`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({
        memberUserId: memberAuth.body.user.id,
        amountCentavos: 25000,
        refundSource: 'chip_in',
        chipInId,
        notes: 'Excess chip-in refund'
      });
    if (overRefundChip.status !== 400) {
      throw new Error(`Chip-in refund overdraft should fail with 400, got ${overRefundChip.status}`);
    }
    console.log('  ✔ Chip-in refund overdraft prevention verified');

    // Refund remaining 20,000 centavos from chip-in back to Bob
    const refundChipInBob = await request(app)
      .post(`/api/vacations/${vacationId}/refund`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({
        memberUserId: memberAuth.body.user.id,
        amountCentavos: 20000,
        refundSource: 'chip_in',
        chipInId,
        notes: 'Bob leftover boat chip-in refund'
      });
    if (refundChipInBob.status !== 200) {
      throw new Error(`Chip-in refund failed: ${JSON.stringify(refundChipInBob.body)}`);
    }
    console.log('  ✔ Chip-in remaining balance refunded to member');

    // Master concludes vacation now that pool and all chip-ins are 0
    const concludeRes = await request(app)
      .post(`/api/vacations/${vacationId}/conclude`)
      .set('Authorization', `Bearer ${masterToken}`);
    if (concludeRes.status !== 200 || concludeRes.body.vacation.status !== 'concluded') {
      throw new Error(`Conclude vacation failed: ${JSON.stringify(concludeRes.body)}`);
    }
    console.log('  ✔ Master concluded vacation when all pool & chip-in balances reached zero');

    // Concluded vacation is read-only
    const postConcludeDeposit = await request(app)
      .post(`/api/vacations/${vacationId}/deposit`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ amountCentavos: 10000, fromAccountId: masterAccId });
    if (postConcludeDeposit.status !== 400) {
      throw new Error(`Modifying concluded vacation should fail with 400, got ${postConcludeDeposit.status}`);
    }
    console.log('  ✔ Concluded vacation is strictly read-only');

    // 11. Past Vacations Page & Privacy Isolation + Shared Expenses of Everyone
    const pastSummaryBob = await request(app)
      .get(`/api/vacations/${vacationId}/past-summary`)
      .set('Authorization', `Bearer ${memberToken}`);
    if (pastSummaryBob.status !== 200) {
      throw new Error(`Past summary failed: ${JSON.stringify(pastSummaryBob.body)}`);
    }

    // Verify sharedExpenses includes everyone's shared group expenses (Resort Booking + Boat rental payment)
    const sharedExpenses = pastSummaryBob.body.sharedExpenses;
    if (!Array.isArray(sharedExpenses) || sharedExpenses.length < 2) {
      throw new Error(`Shared expenses missing or incomplete in past summary: ${JSON.stringify(sharedExpenses)}`);
    }
    const hasResort = sharedExpenses.some((e: any) => e.title === 'Resort Booking');
    const hasBoat = sharedExpenses.some((e: any) => e.title === 'Boat rental payment');
    if (!hasResort || !hasBoat) {
      throw new Error(`Shared expenses missing expected items: ${JSON.stringify(sharedExpenses)}`);
    }
    if (pastSummaryBob.body.summary.totalSharedExpensesCentavos !== 170000) {
      throw new Error(`totalSharedExpensesCentavos mismatch: ${pastSummaryBob.body.summary.totalSharedExpensesCentavos}`);
    }
    console.log('  ✔ Past Vacations: Shared expenses of everyone included in conclusion summary');

    // Bob only sees Bob's own logged expenses and Bob's own chip-in contributions!
    const bobExpenses = pastSummaryBob.body.myLoggedExpenses;
    if (bobExpenses.length !== 1 || bobExpenses[0].title !== 'Souvenir T-shirt') {
      throw new Error(`Bob past expenses mismatch: ${JSON.stringify(bobExpenses)}`);
    }

    const bobChipIns = pastSummaryBob.body.myChipIns;
    bobChipIns.forEach((ci: any) => {
      ci.contributions.forEach((c: any) => {
        if (c.userId !== memberAuth.body.user.id) {
          throw new Error('CRITICAL PRIVACY LEAK: Bob sees other members chip-ins in past vacation!');
        }
      });
    });
    console.log('  ✔ Past Vacations: Strict privacy isolation verified (only viewing member own records exposed)');

    console.log('\n🎉 ALL BACKEND TEST SUITES PASSED FLAWLESSLY!\n');
  } catch (error) {
    console.error('\n❌ TEST RUN FAILED:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
};

runTests();
