import crypto from 'crypto';

export const uuidv4 = (): string => {
  return crypto.randomUUID();
};
