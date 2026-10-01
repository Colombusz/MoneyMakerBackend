import { z } from 'zod';
import { SYNC_ENTITIES } from '../constants';

export const syncPushSchema = z.object({
  changes: z.array(
    z.object({
      id: z.string().min(1),
      entityType: z.enum(SYNC_ENTITIES),
      action: z.enum(['upsert', 'delete']),
      payload: z.record(z.string(), z.any()),
      updatedAt: z.number().int()
    })
  )
});

export const syncPullQuerySchema = z.object({
  since: z.string().optional()
});
