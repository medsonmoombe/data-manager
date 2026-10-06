import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    return this.prisma.organization.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true, domain: true },
      orderBy: { name: 'asc' },
    });
  }
}
