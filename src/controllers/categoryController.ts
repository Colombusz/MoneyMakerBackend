import { Response } from 'express';
import { uuidv4 } from '../utils/uuid';
import { Category } from '../models/Category';
import { AuthenticatedRequest } from '../middleware/auth';

export const getCategories = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const categories = await Category.find({ userId, deletedAt: null }).sort({ name: 1 });

    res.status(200).json({
      categories: categories.map((c) => ({
        id: c._id,
        userId: c.userId,
        name: c.name,
        type: c.type,
        icon: c.icon,
        color: c.color,
        isDefault: c.isDefault,
        updatedAt: c.updatedAt
      }))
    });
  } catch (error) {
    console.error('getCategories error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

export const createCategory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id, name, type, icon, color } = req.body;

    if (!name || !type) {
      res.status(400).json({ error: 'Category name and type are required' });
      return;
    }

    const category = await Category.create({
      _id: id || uuidv4(),
      userId,
      name: name.trim(),
      type,
      icon: icon || 'tag',
      color: color || '#3B82F6',
      isDefault: false
    });

    res.status(201).json({
      category: {
        id: category._id,
        userId: category.userId,
        name: category.name,
        type: category.type,
        icon: category.icon,
        color: category.color,
        isDefault: category.isDefault,
        updatedAt: category.updatedAt
      }
    });
  } catch (error) {
    console.error('createCategory error:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
};

export const updateCategory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { name, icon, color } = req.body;

    const category = await Category.findOne({ _id: id, userId, deletedAt: null });
    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    if (name !== undefined) category.name = name.trim();
    if (icon !== undefined) category.icon = icon;
    if (color !== undefined) category.color = color;

    await category.save();

    res.status(200).json({
      category: {
        id: category._id,
        userId: category.userId,
        name: category.name,
        type: category.type,
        icon: category.icon,
        color: category.color,
        isDefault: category.isDefault,
        updatedAt: category.updatedAt
      }
    });
  } catch (error) {
    console.error('updateCategory error:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
};

export const deleteCategory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const category = await Category.findOne({ _id: id, userId, deletedAt: null });
    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    category.deletedAt = new Date();
    await category.save();

    res.status(200).json({ success: true, message: 'Category deleted' });
  } catch (error) {
    console.error('deleteCategory error:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
};
