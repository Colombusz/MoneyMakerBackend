import { User } from '../models/User';
import { IUser } from '../types';

export class UserRepository {
  static async findById(id: string): Promise<IUser | null> {
    return User.findById(id).lean() as unknown as Promise<IUser | null>;
  }

  static async findByEmail(email: string): Promise<IUser | null> {
    return User.findOne({ email }).lean() as unknown as Promise<IUser | null>;
  }

  static async create(data: Partial<IUser>): Promise<IUser> {
    const user = await User.create(data);
    return user.toObject() as unknown as IUser;
  }

  static async update(id: string, updates: Partial<IUser>): Promise<IUser | null> {
    const user = await User.findByIdAndUpdate(id, updates, { new: true }).lean();
    return user as unknown as IUser | null;
  }
}
