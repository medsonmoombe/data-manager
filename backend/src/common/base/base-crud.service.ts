import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export abstract class BaseCrudService<T, CreateDto, UpdateDto> {
  constructor(
    protected readonly prisma: PrismaService,
    private readonly modelName: string,
  ) {}

  async findAll(orgId: string, filters: any = {}): Promise<T[]> {
    return (this.prisma[this.modelName as any] as any).findMany({
      where: { organizationId: orgId, ...filters },
    });
  }

  async findOne(orgId: string, id: string): Promise<T | null> {
    return (this.prisma[this.modelName as any] as any).findFirst({
      where: { organizationId: orgId, id },
    });
  }

  async create(orgId: string, dto: CreateDto): Promise<T> {
    return (this.prisma[this.modelName as any] as any).create({
      data: { ...dto, organizationId: orgId },
    });
  }

  async update(orgId: string, id: string, dto: UpdateDto): Promise<T> {
    return (this.prisma[this.modelName as any] as any).update({
      where: { id },
      data: dto,
    });
  }

  async delete(orgId: string, id: string): Promise<T> {
    return (this.prisma[this.modelName as any] as any).delete({ where: { id } });
  }
}