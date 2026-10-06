import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Models that support soft delete
const SOFT_DELETE_MODELS = [
  'organization',
  'user',
  'connector',
  'goldenRecord',
  'formDefinition',
  'formSubmission',
] as const;

type SoftDeleteModel = (typeof SOFT_DELETE_MODELS)[number];

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL!,
    });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Soft delete a single record by setting deletedAt.
   * Use instead of prisma.<model>.delete()
   */
  async softDelete(model: SoftDeleteModel, id: string): Promise<void> {
    await (this[model] as any).update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Soft delete many records matching a where clause.
   * Use instead of prisma.<model>.deleteMany()
   */
  async softDeleteMany(model: SoftDeleteModel, where: Record<string, any>): Promise<void> {
    await (this[model] as any).updateMany({
      where,
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Returns a where clause that excludes soft-deleted records.
   * Spread into your existing where: { ...prisma.notDeleted(), ...otherConditions }
   */
  notDeleted(): { deletedAt: null } {
    return { deletedAt: null };
  }
}
