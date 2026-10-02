import { Vacation } from '../models/Vacation';
import { VacationExpenseItem } from '../models/VacationExpenseItem';
import { VacationLoggedExpense } from '../models/VacationLoggedExpense';
import { VacationChipIn } from '../models/VacationChipIn';
import { VacationTransactionLog } from '../models/VacationTransactionLog';
import {
  IVacation,
  IVacationExpenseItem,
  IVacationLoggedExpense,
  IVacationChipIn,
  IVacationChipInContribution,
  IVacationTransactionLog
} from '../types';

export class VacationRepository {
  static async createVacation(data: Partial<IVacation>): Promise<IVacation> {
    const doc = await Vacation.create(data);
    return doc.toObject() as unknown as IVacation;
  }

  static async findVacationById(id: string): Promise<IVacation | null> {
    return Vacation.findById(id).lean() as unknown as Promise<IVacation | null>;
  }

  static async findVacationByJoinCode(code: string): Promise<IVacation | null> {
    return Vacation.findOne({
      joinCode: code.trim().toUpperCase(),
      deletedAt: null
    }).lean() as unknown as Promise<IVacation | null>;
  }

  static async findActiveVacationsForUser(userId: string): Promise<IVacation[]> {
    return Vacation.find({
      'members.userId': userId,
      status: 'active',
      deletedAt: null
    })
      .sort({ createdAt: -1 })
      .lean() as unknown as Promise<IVacation[]>;
  }

  static async findPastVacationsForUser(userId: string): Promise<IVacation[]> {
    return Vacation.find({
      'members.userId': userId,
      status: 'concluded',
      deletedAt: null
    })
      .sort({ concludedAt: -1, createdAt: -1 })
      .lean() as unknown as Promise<IVacation[]>;
  }

  static async updateVacation(id: string, updates: Partial<IVacation>): Promise<IVacation | null> {
    return Vacation.findByIdAndUpdate(id, updates, {
      returnDocument: 'after'
    }).lean() as unknown as Promise<IVacation | null>;
  }

  static async createExpenseItem(data: Partial<IVacationExpenseItem>): Promise<IVacationExpenseItem> {
    const doc = await VacationExpenseItem.create(data);
    return doc.toObject() as unknown as IVacationExpenseItem;
  }

  static async findExpenseItems(vacationId: string): Promise<IVacationExpenseItem[]> {
    return VacationExpenseItem.find({ vacationId })
      .sort({ date: -1, createdAt: -1 })
      .lean() as unknown as Promise<IVacationExpenseItem[]>;
  }

  static async findExpenseItemById(expenseItemId: string): Promise<IVacationExpenseItem | null> {
    return VacationExpenseItem.findById(expenseItemId).lean() as unknown as Promise<IVacationExpenseItem | null>;
  }

  static async createLoggedExpense(
    data: Partial<IVacationLoggedExpense>
  ): Promise<IVacationLoggedExpense> {
    const doc = await VacationLoggedExpense.create(data);
    return doc.toObject() as unknown as IVacationLoggedExpense;
  }

  static async findLoggedExpenses(
    vacationId: string,
    userId?: string
  ): Promise<IVacationLoggedExpense[]> {
    const query: Record<string, any> = { vacationId };
    if (userId) {
      query.userId = userId;
    }
    return VacationLoggedExpense.find(query)
      .sort({ date: -1, createdAt: -1 })
      .lean() as unknown as Promise<IVacationLoggedExpense[]>;
  }

  static async createChipIn(data: Partial<IVacationChipIn>): Promise<IVacationChipIn> {
    const doc = await VacationChipIn.create(data);
    return doc.toObject() as unknown as IVacationChipIn;
  }

  static async findChipIns(vacationId: string): Promise<IVacationChipIn[]> {
    return VacationChipIn.find({ vacationId })
      .sort({ createdAt: -1 })
      .lean() as unknown as Promise<IVacationChipIn[]>;
  }

  static async findChipInById(chipInId: string): Promise<IVacationChipIn | null> {
    return VacationChipIn.findById(chipInId).lean() as unknown as Promise<IVacationChipIn | null>;
  }

  static async addChipInContribution(
    chipInId: string,
    contribution: IVacationChipInContribution,
    collectedAddition: number
  ): Promise<IVacationChipIn | null> {
    return VacationChipIn.findByIdAndUpdate(
      chipInId,
      {
        $push: { contributions: contribution },
        $inc: { totalCollectedCentavos: collectedAddition }
      },
      { returnDocument: 'after' }
    ).lean() as unknown as Promise<IVacationChipIn | null>;
  }

  static async updateChipIn(
    chipInId: string,
    update: any
  ): Promise<IVacationChipIn | null> {
    return VacationChipIn.findByIdAndUpdate(chipInId, update, { returnDocument: 'after' }).lean() as unknown as Promise<IVacationChipIn | null>;
  }

  static async createLogEntry(
    data: Partial<IVacationTransactionLog>
  ): Promise<IVacationTransactionLog> {
    const doc = await VacationTransactionLog.create(data);
    return doc.toObject() as unknown as IVacationTransactionLog;
  }

  static async findLogs(vacationId: string): Promise<IVacationTransactionLog[]> {
    return VacationTransactionLog.find({ vacationId })
      .sort({ date: -1, createdAt: -1 })
      .lean() as unknown as Promise<IVacationTransactionLog[]>;
  }

  static async findLogById(logId: string): Promise<IVacationTransactionLog | null> {
    return VacationTransactionLog.findById(logId).lean() as unknown as Promise<IVacationTransactionLog | null>;
  }
}
