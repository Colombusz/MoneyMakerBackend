import { AppError } from '../errors/AppError';

export class AuthPolicy {
  /**
   * Asserts that a resource is owned by the specified user.
   * Throws 404 (Not Found) if the resource does not exist OR does not belong to the user
   * to prevent resource enumeration and maintain strict privacy isolation.
   */
  static assertOwnership<T extends { userId: string }>(
    resource: T | null | undefined,
    userId: string,
    resourceName: string = 'Resource'
  ): asserts resource is T {
    if (!resource || resource.userId !== userId) {
      throw AppError.notFound(`${resourceName} not found`);
    }
  }

  /**
   * Checks if user has permission without throwing
   */
  static isOwner<T extends { userId: string }>(
    resource: T | null | undefined,
    userId: string
  ): boolean {
    return !!resource && resource.userId === userId;
  }
}
