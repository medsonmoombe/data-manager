import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

/**
 * Generic soft-delete service.
 * Works with any Prisma model that has a `deletedAt` field.
 */
@Injectable()
export class SoftDeleteService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Soft delete a record (sets deletedAt).
   */
  async softDelete(modelName: string, id: string, orgId: string): Promise<any> {
    // Verify ownership before deleting
    const record = await (this.prisma[modelName as any] as any).findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
    });

    if (!record) throw new Error(`${modelName} not found or already deleted`);

    return (this.prisma[modelName as any] as any).update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Restore a soft-deleted record.
   */
  async restore(modelName: string, id: string, orgId: string): Promise<any> {
    const record = await (this.prisma[modelName as any] as any).findFirst({
      where: { id, organizationId: orgId, deletedAt: { not: null } },
    });

    if (!record) throw new Error(`${modelName} not found in trash`);

    return (this.prisma[modelName as any] as any).update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  /**
   * Get all soft-deleted records (trash).
   */
  async getTrash(modelName: string, orgId: string, page = 1, limit = 20): Promise<any> {
    const where = { organizationId: orgId, deletedAt: { not: null } };

    const [data, total] = await Promise.all([
      (this.prisma[modelName as any] as any).findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { deletedAt: 'desc' },
      }),
      (this.prisma[modelName as any] as any).count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Permanently delete records that have been in trash for more than X days.
   * Called by a scheduled job.
   */
  async purgeExpired(modelName: string, retentionDays: number = 30): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const result = await (this.prisma[modelName as any] as any).deleteMany({
      where: {
        deletedAt: { not: null, lt: cutoff },
      },
    });

    return result.count;
  }

  /**
   * Override findAll to exclude soft-deleted records.
   * Use this in your base CRUD service.
   */
  getNonDeletedFilter() {
    return { deletedAt: null };
  }
}