import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { uuidv4 } from '../utils/uuid';
import { seedDefaultCategories, seedDefaultAccounts } from '../utils/defaults';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/token';
import { UserRepository } from '../repositories/userRepository';
import { AppError } from '../errors/AppError';

export class AuthService {
  private static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Resolve the `partner` object the web client renders from.
   * The DB only stores `partnerId`; without this enrichment `user.partner`
   * is always undefined on web, so `isPartnerConnected` is always false and
   * shared goals are never fetched — even though Android (which reads
   * `/api/partners/status` directly) works fine.
   */
  private static async toUserDTO(user: {
    _id: string;
    email: string;
    name: string;
    currency: string;
    partnerId?: string | null;
  }) {
    if (!user.partnerId) {
      return {
        id: user._id,
        email: user.email,
        name: user.name,
        currency: user.currency,
        partnerId: null,
        partner: null
      };
    }
    const partner = await UserRepository.findById(user.partnerId);
    if (!partner) {
      await UserRepository.update(user._id, { partnerId: null });
      return {
        id: user._id,
        email: user.email,
        name: user.name,
        currency: user.currency,
        partnerId: null,
        partner: null
      };
    }
    return {
      id: user._id,
      email: user.email,
      name: user.name,
      currency: user.currency,
      partnerId: partner._id,
      partner: { id: partner._id, name: partner.name, email: partner.email }
    };
  }

  static async register(data: {
    email: string;
    password: string;
    name: string;
    currency?: string;
  }) {
    const existing = await UserRepository.findByEmail(data.email.toLowerCase().trim());
    if (existing) {
      throw AppError.conflict('An account with this email already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);
    const userId = uuidv4();

    const refreshToken = generateRefreshToken(userId);
    const refreshTokenHash = this.hashToken(refreshToken);

    const user = await UserRepository.create({
      _id: userId,
      email: data.email.toLowerCase().trim(),
      passwordHash,
      name: data.name.trim(),
      currency: data.currency || 'PHP',
      refreshTokenHash,
      refreshTokenHashes: [refreshTokenHash]
    });

    // Seed default categories & default Cash account
    await seedDefaultCategories(userId);
    await seedDefaultAccounts(userId);

    const accessToken = generateAccessToken(user._id);

    return {
      user: { id: user._id, email: user.email, name: user.name, currency: user.currency, partnerId: null, partner: null },
      accessToken,
      refreshToken
    };
  }

  static async login(credentials: { email: string; password: string }) {
    const user = await UserRepository.findByEmail(credentials.email.toLowerCase().trim());
    if (!user) {
      throw AppError.unauthorized('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(credentials.password, user.passwordHash);
    if (!isMatch) {
      throw AppError.unauthorized('Invalid email or password');
    }

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    const refreshTokenHash = this.hashToken(refreshToken);

    const existingHashes = Array.isArray(user.refreshTokenHashes)
      ? user.refreshTokenHashes
      : (user.refreshTokenHash ? [user.refreshTokenHash] : []);

    // Support multiple concurrent sessions (up to 10) so Android and Web don't revoke each other
    const updatedHashes = [...existingHashes.filter((h) => h !== refreshTokenHash), refreshTokenHash].slice(-10);

    await UserRepository.update(user._id, {
      refreshTokenHash,
      refreshTokenHashes: updatedHashes
    });

    return {
      user: await AuthService.toUserDTO(user),
      accessToken,
      refreshToken
    };
  }

  static async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw AppError.badRequest('Refresh token is required');
    }

    let payload: { userId: string };
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (_err) {
      throw AppError.unauthorized('Invalid or expired refresh token');
    }

    const user = await UserRepository.findById(payload.userId);
    if (!user) {
      throw AppError.unauthorized('Session invalidated');
    }

    const incomingHash = this.hashToken(refreshToken);
    const existingHashes = Array.isArray(user.refreshTokenHashes)
      ? user.refreshTokenHashes
      : (user.refreshTokenHash ? [user.refreshTokenHash] : []);

    const isMatch = existingHashes.includes(incomingHash) || user.refreshTokenHash === incomingHash;
    if (!isMatch) {
      throw AppError.unauthorized('Invalid or expired refresh token');
    }

    const newAccessToken = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);
    const newHash = this.hashToken(newRefreshToken);

    const updatedHashes = [...existingHashes.filter((h) => h !== incomingHash), newHash].slice(-10);

    await UserRepository.update(user._id, {
      refreshTokenHash: newHash,
      refreshTokenHashes: updatedHashes
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    };
  }

  static async logout(refreshToken?: string) {
    if (refreshToken) {
      try {
        const payload = verifyRefreshToken(refreshToken);
        const user = await UserRepository.findById(payload.userId);
        if (user) {
          const incomingHash = this.hashToken(refreshToken);
          const existingHashes = Array.isArray(user.refreshTokenHashes)
            ? user.refreshTokenHashes
            : (user.refreshTokenHash ? [user.refreshTokenHash] : []);
          const updatedHashes = existingHashes.filter((h) => h !== incomingHash);
          const latestHash = updatedHashes[updatedHashes.length - 1] || null;

          await UserRepository.update(user._id, {
            refreshTokenHash: latestHash,
            refreshTokenHashes: updatedHashes
          });
        }
      } catch (_err) {
        // Ignore invalid token during logout
      }
    }
    return { success: true, message: 'Logged out successfully' };
  }

  static async getCurrentUser(userId: string) {
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw AppError.notFound('User not found');
    }
    return AuthService.toUserDTO(user);
  }
}
