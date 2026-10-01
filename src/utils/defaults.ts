import { uuidv4 } from './uuid';
import { Category } from '../models/Category';
import { Account } from '../models/Account';
import { Transaction } from '../models/Transaction';

export const DEFAULT_CATEGORIES = [
  { name: 'Quick Spend', type: 'expense' as const, icon: 'zap', color: '#F97316' },
  { name: 'Food & Dining', type: 'expense' as const, icon: 'utensils', color: '#EF4444' },
  { name: 'Groceries', type: 'expense' as const, icon: 'shopping-cart', color: '#F59E0B' },
  { name: 'Transportation', type: 'expense' as const, icon: 'car', color: '#3B82F6' },
  { name: 'Housing & Utilities', type: 'expense' as const, icon: 'home', color: '#8B5CF6' },
  { name: 'Entertainment', type: 'expense' as const, icon: 'film', color: '#EC4899' },
  { name: 'Healthcare', type: 'expense' as const, icon: 'activity', color: '#10B981' },
  { name: 'Personal & Shopping', type: 'expense' as const, icon: 'shopping-bag', color: '#6366F1' },
  { name: 'Miscellaneous', type: 'expense' as const, icon: 'more-horizontal', color: '#6B7280' },
  { name: 'Salary', type: 'income' as const, icon: 'briefcase', color: '#10B981' },
  { name: 'Freelance & Business', type: 'income' as const, icon: 'laptop', color: '#059669' },
  { name: 'Investments', type: 'income' as const, icon: 'trending-up', color: '#047857' },
  { name: 'Gifts & Other', type: 'income' as const, icon: 'gift', color: '#34D399' }
];

export const seedDefaultCategories = async (userId: string): Promise<void> => {
  const existingCategories = await Category.find({ userId, deletedAt: null }).lean();

  if (existingCategories.length === 0) {
    const docs = DEFAULT_CATEGORIES.map((cat) => ({
      _id: uuidv4(),
      userId,
      name: cat.name,
      type: cat.type,
      icon: cat.icon,
      color: cat.color,
      isDefault: true
    }));
    await Category.insertMany(docs);
  } else {
    // Ensure 'Quick Spend' exists even for users created prior to this feature
    const hasQuickSpend = existingCategories.some(
      (c) => c.name.toLowerCase() === 'quick spend'
    );
    if (!hasQuickSpend) {
      await Category.create({
        _id: uuidv4(),
        userId,
        name: 'Quick Spend',
        type: 'expense',
        icon: 'zap',
        color: '#F97316',
        isDefault: true
      });
    }
  }
};

export const seedDefaultAccounts = async (userId: string): Promise<void> => {
  const cashAccounts = await Account.find({
    userId,
    deletedAt: null,
    $or: [{ name: /^cash$/i }, { type: 'cash' }]
  }).sort({ createdAt: 1 });

  if (cashAccounts.length === 0) {
    await Account.create({
      _id: uuidv4(),
      userId,
      name: 'Cash',
      type: 'cash',
      startingBalanceCentavos: 0,
      currentBalanceCentavos: 0,
      isArchived: false
    });
  } else if (cashAccounts.length > 1) {
    const primary = cashAccounts[0];
    const duplicates = cashAccounts.slice(1);
    for (const dup of duplicates) {
      await Transaction.updateMany({ accountId: dup._id }, { accountId: primary._id });
      await Transaction.updateMany({ destinationAccountId: dup._id }, { destinationAccountId: primary._id });
      await Account.updateOne({ _id: dup._id }, { deletedAt: new Date() });
    }
  }
};
