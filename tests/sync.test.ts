import request from 'supertest';
import app from '../src/app';
import { setupTestDB } from './setup';
import { uuidv4 } from '../src/utils/uuid';

setupTestDB();

describe('Offline-First Sync Engine', () => {
  let token: string;

  beforeEach(async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'syncer@example.com',
      password: 'password123',
      name: 'Sync Master'
    });
    token = res.body.accessToken;
  });

  it('should push offline created records and pull them back by cursor', async () => {
    const accountId = uuidv4();
    const now = Date.now();

    // Push offline created account
    const pushRes = await request(app)
      .post('/api/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .send({
        changes: [
          {
            id: accountId,
            entityType: 'accounts',
            action: 'upsert',
            payload: {
              name: 'Offline Wallet',
              type: 'cash',
              startingBalanceCentavos: 50000,
              currentBalanceCentavos: 50000
            },
            updatedAt: now
          }
        ]
      });

    expect(pushRes.status).toBe(200);
    expect(pushRes.body.appliedIds).toContain(accountId);
    expect(pushRes.body.conflicts.length).toBe(0);

    // Pull changes with since cursor
    const pullRes = await request(app)
      .get(`/api/sync/pull?since=${new Date(now - 10000).toISOString()}`)
      .set('Authorization', `Bearer ${token}`);

    expect(pullRes.status).toBe(200);
    expect(pullRes.body).toHaveProperty('cursor');
    const pulledAccount = pullRes.body.accounts.find((a: any) => a._id === accountId);
    expect(pulledAccount).toBeDefined();
    expect(pulledAccount.name).toBe('Offline Wallet');

    // Test conflict resolution: Server has newer timestamp
    const conflictRes = await request(app)
      .post('/api/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .send({
        changes: [
          {
            id: accountId,
            entityType: 'accounts',
            action: 'upsert',
            payload: { name: 'Outdated Offline Edit' },
            updatedAt: now - 5000 // Older than existing
          }
        ]
      });

    expect(conflictRes.status).toBe(200);
    expect(conflictRes.body.conflicts.length).toBe(1);
    expect(conflictRes.body.conflicts[0].id).toBe(accountId);
  });
});
