import { Category } from '../models/Category';
import { ICategory } from '../types';

export class CategoryRepository {
  static async findByUserId(userId: string): Promise<ICategory[]> {
    return Category.find({ userId, deletedAt: null })
      .sort({ name: 1 })
      .lean() as unknown as Promise<ICategory[]>;
  }

  static async findById(id: string): Promise<ICategory | null> {
    return Category.findById(id).lean() as unknown as Promise<ICategory | null>;
  }

  static async create(data: Partial<ICategory>): Promise<ICategory> {
    const doc = await Category.create(data);
    return doc.toObject() as unknown as ICategory;
  }

  static async createMany(data: Partial<ICategory>[]): Promise<ICategory[]> {
    const docs = await Category.insertMany(data);
    return docs.map((d) => d.toObject()) as unknown as ICategory[];
  }

  static async update(id: string, updates: Partial<ICategory>): Promise<ICategory | null> {
    return Category.findByIdAndUpdate(id, updates, {
      new: true
    }).lean() as unknown as Promise<ICategory | null>;
  }
}
