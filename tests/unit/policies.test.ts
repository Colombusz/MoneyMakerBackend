import { AuthPolicy } from '../../src/policies/authPolicy';
import { GoalPolicy } from '../../src/policies/goalPolicy';
import { AppError } from '../../src/errors/AppError';
import { ISharedGoal } from '../../src/types';

describe('AuthPolicy & GoalPolicy Unit Tests', () => {
  it('AuthPolicy allows access for legitimate owner', () => {
    const resource = { userId: 'alice-123', name: 'Savings' };
    expect(() => AuthPolicy.assertOwnership(resource, 'alice-123', 'Account')).not.toThrow();
  });

  it('AuthPolicy throws 404 on ownership mismatch to prevent leaking existence', () => {
    const resource = { userId: 'alice-123', name: 'Savings' };
    expect(() => AuthPolicy.assertOwnership(resource, 'bob-456', 'Account')).toThrow(AppError);
    try {
      AuthPolicy.assertOwnership(resource, 'bob-456', 'Account');
    } catch (err: any) {
      expect(err.statusCode).toBe(404);
    }
  });

  it('GoalPolicy checks active member access', () => {
    const sharedGoal: ISharedGoal = {
      _id: 'sg-1',
      name: 'Travel Fund',
      targetAmountCentavos: 5000000,
      createdByUserId: 'alice-123',
      members: [
        { userId: 'alice-123', role: 'owner', joinedAt: new Date(), status: 'active' },
        { userId: 'bob-456', role: 'member', joinedAt: new Date(), status: 'left' }
      ],
      isArchived: false,
      updatedAt: new Date()
    };

    expect(() => GoalPolicy.assertMemberAccess(sharedGoal, 'alice-123')).not.toThrow();
    expect(() => GoalPolicy.assertMemberAccess(sharedGoal, 'bob-456')).toThrow(AppError);
    expect(() => GoalPolicy.assertMemberAccess(sharedGoal, 'eve-999')).toThrow(AppError);
  });

  it('GoalPolicy prevents contributing to archived goals', () => {
    const archivedGoal: ISharedGoal = {
      _id: 'sg-2',
      name: 'Old Fund',
      targetAmountCentavos: 1000000,
      createdByUserId: 'alice-123',
      members: [{ userId: 'alice-123', role: 'owner', joinedAt: new Date(), status: 'active' }],
      isArchived: true,
      updatedAt: new Date()
    };

    expect(() => GoalPolicy.assertNotArchived(archivedGoal)).toThrow(AppError);
  });
});
