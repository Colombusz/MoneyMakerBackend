import { GoalService } from '../../src/services/goalService';
import { GoalRepository } from '../../src/repositories/goalRepository';
import { AccountService } from '../../src/services/accountService';
import { IGoal } from '../../src/types';

jest.mock('../../src/repositories/goalRepository');
jest.mock('../../src/services/accountService');

describe('GoalService.computeMetrics with linked accounts', () => {
  const mockGoal: IGoal = {
    _id: 'goal-1',
    userId: 'user-1',
    name: 'Emergency Fund',
    targetAmountCentavos: 2000000, // 20,000 PHP
    linkedAccountId: 'acc-maribank',
    isShared: false,
    updatedAt: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('counts a linked account balance as progress even with no contributions', async () => {
    (GoalRepository.findContributions as jest.Mock).mockResolvedValue([]);
    (AccountService.calculateAccountBalance as jest.Mock).mockResolvedValue(1000000); // 10,000 PHP

    const metrics = await GoalService.computeMetrics(mockGoal);

    expect(metrics.totalSavedCentavos).toBe(1000000);
    expect(metrics.remainingCentavos).toBe(1000000);
    expect(metrics.percentage).toBe(50);
  });

  it('adds contributions on top of the connected account balance', async () => {
    (GoalRepository.findContributions as jest.Mock).mockResolvedValue([
      { amountCentavos: 500000, date: new Date() }
    ]);
    (AccountService.calculateAccountBalance as jest.Mock).mockResolvedValue(1000000);

    const metrics = await GoalService.computeMetrics(mockGoal);

    expect(metrics.totalSavedCentavos).toBe(1500000);
    expect(metrics.remainingCentavos).toBe(500000);
    expect(metrics.percentage).toBe(75);
  });

  it('ignores linked balance when goal has no linkedAccountId', async () => {
    const unlinkedGoal: IGoal = {
      ...mockGoal,
      linkedAccountId: null
    };

    (GoalRepository.findContributions as jest.Mock).mockResolvedValue([
      { amountCentavos: 300000, date: new Date() }
    ]);

    const metrics = await GoalService.computeMetrics(unlinkedGoal);

    expect(AccountService.calculateAccountBalance).not.toHaveBeenCalled();
    expect(metrics.totalSavedCentavos).toBe(300000);
    expect(metrics.percentage).toBe(15);
  });

  it('never lets an overdrawn linked account subtract from progress', async () => {
    (GoalRepository.findContributions as jest.Mock).mockResolvedValue([
      { amountCentavos: 500000, date: new Date() }
    ]);
    (AccountService.calculateAccountBalance as jest.Mock).mockResolvedValue(-200000);

    const metrics = await GoalService.computeMetrics(mockGoal);

    expect(metrics.totalSavedCentavos).toBe(500000);
    expect(metrics.percentage).toBe(25);
  });
});
