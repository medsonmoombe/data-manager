import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class EntityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List all entity definitions for an organization.
   */
  async findAll(orgId: string) {
    return this.prisma.entityDefinition.findMany({
      where: { organizationId: orgId },
      include: {
        attributes: {
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: { goldenRecords: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get a single entity definition with all attributes.
   */
  async findOne(orgId: string, id: string) {
    const entity = await this.prisma.entityDefinition.findFirst({
      where: { id, organizationId: orgId },
      include: {
        attributes: {
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: { goldenRecords: true },
        },
      },
    });

    if (!entity) {
      throw new NotFoundException('Entity definition not found');
    }

    return entity;
  }

  /**
   * Create a new entity definition with attributes.
   */
  async create(orgId: string, dto: {
    name: string;
    description?: string;
    attributes?: Array<{
      name: string;
      displayName?: string;
      dataType: string;
      isRequired?: boolean;
      isIdentifier?: boolean;
      validationRules?: any;
    }>;
  }) {
    // Check for duplicate name
    const existing = await this.prisma.entityDefinition.findFirst({
      where: { organizationId: orgId, name: dto.name },
    });

    if (existing) {
      throw new BadRequestException(`Entity "${dto.name}" already exists`);
    }

    // Create entity with attributes
    const entity = await this.prisma.entityDefinition.create({
      data: {
        organizationId: orgId,
        name: dto.name,
        description: dto.description,
        attributes: {
          create: (dto.attributes || []).map((attr, index) => ({
            name: attr.name,
            displayName: attr.displayName || attr.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            dataType: attr.dataType || 'string',
            isRequired: attr.isRequired || false,
            isIdentifier: attr.isIdentifier || false,
            validationRules: attr.validationRules || {},
            sortOrder: index,
          })),
        },
      },
      include: {
        attributes: true,
      },
    });

    return entity;
  }

  /**
   * Update an entity definition.
   */
  async update(orgId: string, id: string, dto: {
    name?: string;
    description?: string;
  }) {
    const entity = await this.findOne(orgId, id);

    return this.prisma.entityDefinition.update({
      where: { id: entity.id },
      data: {
        name: dto.name,
        description: dto.description,
      },
    });
  }

  /**
   * Delete an entity definition and all its attributes.
   */
  async remove(orgId: string, id: string) {
    const entity = await this.findOne(orgId, id);

    // Check if there are records using this entity
    const recordCount = await this.prisma.goldenRecord.count({
      where: { entityDefinitionId: id },
    });

    if (recordCount > 0) {
      throw new BadRequestException(
        `Cannot delete entity "${entity.name}" — it has ${recordCount} records. Delete all records first or archive the entity.`
      );
    }

    await this.prisma.entityDefinition.delete({ where: { id } });

    return { success: true, message: `Entity "${entity.name}" deleted` };
  }

  // ============ ATTRIBUTES ============

  /**
   * Add an attribute to an entity.
   */
  async addAttribute(orgId: string, entityId: string, dto: {
    name: string;
    displayName?: string;
    dataType: string;
    isRequired?: boolean;
    isIdentifier?: boolean;
    validationRules?: any;
  }) {
    await this.findOne(orgId, entityId);

    // Check for duplicate attribute name
    const existing = await this.prisma.entityAttribute.findFirst({
      where: { entityDefinitionId: entityId, name: dto.name },
    });

    if (existing) {
      throw new BadRequestException(`Attribute "${dto.name}" already exists on this entity`);
    }

    // Get current max sort order
    const maxSort = await this.prisma.entityAttribute.findFirst({
      where: { entityDefinitionId: entityId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    return this.prisma.entityAttribute.create({
      data: {
        entityDefinitionId: entityId,
        name: dto.name,
        displayName: dto.displayName || dto.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        dataType: dto.dataType || 'string',
        isRequired: dto.isRequired || false,
        isIdentifier: dto.isIdentifier || false,
        validationRules: dto.validationRules || {},
        sortOrder: (maxSort?.sortOrder || 0) + 1,
      },
    });
  }

  /**
   * Update an attribute.
   */
  async updateAttribute(orgId: string, entityId: string, attributeId: string, dto: {
    name?: string;
    displayName?: string;
    dataType?: string;
    isRequired?: boolean;
    isIdentifier?: boolean;
    validationRules?: any;
    sortOrder?: number;
  }) {
    await this.findOne(orgId, entityId);

    return this.prisma.entityAttribute.update({
      where: { id: attributeId },
      data: dto,
    });
  }

  /**
   * Remove an attribute from an entity.
   */
  async removeAttribute(orgId: string, entityId: string, attributeId: string) {
    await this.findOne(orgId, entityId);

    await this.prisma.entityAttribute.delete({
      where: { id: attributeId },
    });

    return { success: true, message: 'Attribute removed' };
  }

  /**
   * Bulk update attributes (reorder, add, remove).
   */
  async updateAttributes(orgId: string, entityId: string, attributes: Array<{
    id?: string;
    name: string;
    displayName?: string;
    dataType: string;
    isRequired?: boolean;
    isIdentifier?: boolean;
    sortOrder?: number;
    _delete?: boolean;
  }>) {
    await this.findOne(orgId, entityId);

    for (let i = 0; i < attributes.length; i++) {
      const attr = attributes[i];

      if (attr._delete && attr.id) {
        await this.prisma.entityAttribute.delete({ where: { id: attr.id } });
      } else if (attr.id) {
        await this.prisma.entityAttribute.update({
          where: { id: attr.id },
          data: {
            name: attr.name,
            displayName: attr.displayName,
            dataType: attr.dataType,
            isRequired: attr.isRequired,
            isIdentifier: attr.isIdentifier,
            sortOrder: i,
          },
        });
      } else {
        await this.prisma.entityAttribute.create({
          data: {
            entityDefinitionId: entityId,
            name: attr.name,
            displayName: attr.displayName || attr.name,
            dataType: attr.dataType || 'string',
            isRequired: attr.isRequired || false,
            isIdentifier: attr.isIdentifier || false,
            sortOrder: i,
          },
        });
      }
    }

    return this.findOne(orgId, entityId);
  }
}