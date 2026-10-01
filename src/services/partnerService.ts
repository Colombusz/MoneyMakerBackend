import crypto from 'crypto';
import { uuidv4 } from '../utils/uuid';
import { UserRepository } from '../repositories/userRepository';
import { PartnerRepository } from '../repositories/partnerRepository';
import { AppError } from '../errors/AppError';
import { TOKEN_EXPIRY } from '../constants';

export class PartnerService {
  static async generateInvite(userId: string) {
    const user = await UserRepository.findById(userId);
    if (user?.partnerId) {
      throw AppError.badRequest(
        'You are already connected to a partner. Unlink first to invite another.'
      );
    }

    await PartnerRepository.cancelPendingInvites(userId);

    const inviteCode = crypto.randomBytes(3).toString('hex').toUpperCase();
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY.INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const invite = await PartnerRepository.createInvite({
      _id: uuidv4(),
      inviterUserId: userId,
      inviteCode,
      expiresAt,
      status: 'pending'
    });

    return {
      inviteCode: invite.inviteCode,
      expiresAt: invite.expiresAt,
      message: 'Share this 6-character code with your partner'
    };
  }

  static async acceptInvite(userId: string, inviteCode: string) {
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw AppError.notFound('User not found');
    }
    if (user.partnerId) {
      throw AppError.badRequest('You already have an active partner connection');
    }

    const invite = await PartnerRepository.findPendingInviteByCode(inviteCode);
    if (!invite) {
      throw AppError.notFound('Invalid or expired invite code');
    }

    if (invite.inviterUserId === userId) {
      throw AppError.badRequest('You cannot accept your own invite');
    }

    const inviter = await UserRepository.findById(invite.inviterUserId);
    if (!inviter) {
      throw AppError.notFound('Inviter user not found');
    }

    if (inviter.partnerId) {
      throw AppError.badRequest('The inviter has already connected to another partner');
    }

    await UserRepository.update(user._id, { partnerId: inviter._id });
    await UserRepository.update(inviter._id, { partnerId: user._id });
    await PartnerRepository.updateInviteStatus(invite._id, 'accepted');

    return {
      success: true,
      partner: { id: inviter._id, name: inviter.name },
      message: `Successfully connected with ${inviter.name}`
    };
  }

  static async unlinkPartner(userId: string) {
    const user = await UserRepository.findById(userId);
    if (!user || !user.partnerId) {
      throw AppError.badRequest('No active partner connection to unlink');
    }

    const partnerId = user.partnerId;
    await PartnerRepository.archiveSharedGoalsForUsers(userId);
    await PartnerRepository.archiveSharedAccountsForUsers(userId);

    await UserRepository.update(userId, { partnerId: null });
    if (partnerId) {
      await UserRepository.update(partnerId, { partnerId: null });
    }

    return {
      success: true,
      message: 'Partner unlinked successfully. Shared goals and shared accounts have been archived.'
    };
  }

  static async getPartnerStatus(userId: string) {
    const user = await UserRepository.findById(userId);
    if (!user || !user.partnerId) {
      return { connected: false };
    }

    const partner = await UserRepository.findById(user.partnerId);
    if (!partner) {
      await UserRepository.update(userId, { partnerId: null });
      return { connected: false };
    }

    return {
      connected: true,
      partner: { id: partner._id, name: partner.name }
    };
  }
}
