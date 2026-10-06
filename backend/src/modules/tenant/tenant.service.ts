import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { BaseCrudService } from '../../common/base/base-crud.service';
import { Organization } from '@prisma/client';
import { CreateTenantDto, UpdateTenantDto } from './dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserManagementService } from '../user/user-management.service';

@Injectable()
export class TenantService extends BaseCrudService<Organization, CreateTenantDto, UpdateTenantDto> implements OnModuleInit {
  constructor(
    prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly userService: UserManagementService,
  ) {
    super(prisma, 'organization');
  }

  // Create a default organization on startup if none exists
  async onModuleInit() {
    const count = await this.prisma.organization.count();
    if (count === 0) {
      const org = await this.prisma.organization.create({
        data: {
          name: 'Default Organization',
          slug: 'default',
          primaryContactEmail: 'admin@omnicore.zm',
          settings: {},
          subscriptionTier: 'enterprise',
          isActive: true,
        },
      });
      console.log(`✅ Default organization created: ${org.id}`);
      
      // Seed default roles for this org
      await this.userService.seedDefaultRoles(org.id);
      console.log('✅ Default roles seeded');
    }
  }

  async create(orgId: string, dto: CreateTenantDto): Promise<Organization> {
    const org = await super.create(orgId, dto);
    
    // Seed default roles
    await this.userService.seedDefaultRoles(org.id);
    
    this.eventEmitter.emit('organization.created', { orgId: org.id });
    return org;
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    return this.prisma.organization.findUnique({ where: { slug } });
  }

  async getDefaultOrg(): Promise<Organization | null> {
    return this.prisma.organization.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
  }
}