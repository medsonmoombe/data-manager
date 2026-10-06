import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { OFFICIAL_TEMPLATES } from './seed-templates';

@Injectable()
export class TemplateInstallerService {
  private readonly logger = new Logger(TemplateInstallerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Seed official templates into the marketplace.
   */
  async seedOfficialTemplates() {
    for (const template of OFFICIAL_TEMPLATES) {
      const existing = await this.prisma.marketplaceTemplate.findFirst({
        where: { name: template.name, isOfficial: true },
      });

      if (!existing) {
        await this.prisma.marketplaceTemplate.create({
          data: {
            name: template.name,
            description: template.description,
            category: template.category,
            icon: template.icon,
            version: template.version,
            includes: template.includes,
            installPayload: template.installPayload,
            isPublished: true,
            isOfficial: true,
          },
        });
        this.logger.log(`Seeded template: ${template.name}`);
      }
    }
  }

  /**
   * Install a template for an organization.
   * Creates all entities, forms, workflows, dashboards, and rules.
   */
  async installTemplate(orgId: string, templateId: string, userId?: string): Promise<any> {
    const template = await this.prisma.marketplaceTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template || !template.isPublished) {
      throw new Error('Template not found or not published');
    }

    // Check if already installed
    const existing = await this.prisma.templateInstallation.findUnique({
      where: { organizationId_templateId: { organizationId: orgId, templateId } },
    });

    if (existing && existing.status === 'active') {
      throw new Error('Template already installed. Use update instead.');
    }

    const payload = template.installPayload as any;
    const result: any = {
      entities: [],
      forms: [],
      workflows: [],
      dashboards: [],
      rules: [],
      autoLinkRules: [],
    };

    // 1. Create entity definitions with attributes
    for (const entity of (payload.entities || [])) {
      const entityDef = await this.prisma.entityDefinition.create({
        data: {
          organizationId: orgId,
          name: entity.name,
          description: entity.description,
        },
      });

      // Create attributes
      for (const attr of (entity.attributes || [])) {
        await this.prisma.entityAttribute.create({
          data: {
            entityDefinitionId: entityDef.id,
            name: attr.name,
            displayName: attr.displayName,
            dataType: attr.dataType,
            isRequired: attr.isRequired || false,
            isIdentifier: attr.isIdentifier || false,
            validationRules: attr.validationRules || {},
          },
        });
      }

      // Create matching rules
      for (const rule of (entity.matchingRules || [])) {
        await this.prisma.matchingRule.create({
          data: {
            entityDefinitionId: entityDef.id,
            name: rule.name,
            ruleType: rule.ruleType,
            fieldWeights: rule.fieldWeights,
            threshold: rule.threshold,
          },
        });
      }

      result.entities.push({ name: entity.name, id: entityDef.id });
    }

    // 2. Create forms
    for (const form of (payload.forms || [])) {
      const formDef = await this.prisma.formDefinition.create({
        data: {
          organizationId: orgId,
          name: form.name,
          description: form.description,
          formSchema: form.formSchema,
          status: 'published',
        },
      });
      result.forms.push({ name: form.name, id: formDef.id });
    }

    // 3. Create workflows
    for (const workflow of (payload.workflows || [])) {
      const wfDef = await this.prisma.workflowDefinition.create({
        data: {
          organizationId: orgId,
          name: workflow.name,
          description: workflow.description,
          triggerType: workflow.triggerType,
          triggerConfig: workflow.triggerConfig,
          steps: workflow.steps,
          failureStrategy: workflow.failureStrategy || 'stop',
          isActive: true,
        },
      });
      result.workflows.push({ name: workflow.name, id: wfDef.id });
    }

    // 4. Create dashboards with widgets
    for (const dashboard of (payload.dashboards || [])) {
      const dash = await this.prisma.dashboard.create({
        data: {
          organizationId: orgId,
          name: dashboard.name,
          description: dashboard.description,
          isDefault: dashboard.isDefault || false,
          isPublic: true,
          createdBy: userId,
        },
      });

      for (const widget of (dashboard.widgets || [])) {
        await this.prisma.dashboardWidget.create({
          data: {
            dashboardId: dash.id,
            name: widget.name,
            widgetType: widget.widgetType,
            dataSource: 'golden_records',
            config: widget.config,
            position: widget.position,
          },
        });
      }

      result.dashboards.push({ name: dashboard.name, id: dash.id });
    }

    // 5. Create validation rules
    for (const rule of (payload.validationRules || [])) {
      const vRule = await this.prisma.validationRule.create({
        data: {
          organizationId: orgId,
          name: rule.name,
          targetEntity: rule.targetEntity,
          targetField: rule.targetField,
          ruleType: rule.ruleType,
          ruleConfig: rule.ruleConfig,
          errorMessage: rule.errorMessage,
          severity: rule.severity || 'error',
        },
      });
      result.rules.push({ name: rule.name, id: vRule.id });
    }

    // 6. Create auto-link rules
    for (const rule of (payload.autoLinkRules || [])) {
      const alRule = await this.prisma.autoLinkRule.create({
        data: {
          organizationId: orgId,
          name: rule.name,
          sourceEntityType: rule.sourceEntityType,
          targetEntityType: rule.targetEntityType,
          fieldMappings: rule.fieldMappings,
          relationshipType: rule.relationshipType,
          autoAcceptAbove: rule.autoAcceptAbove,
          suggestAbove: rule.suggestAbove,
          priority: rule.priority,
        },
      });
      result.autoLinkRules.push({ name: rule.name, id: alRule.id });
    }

    // Record installation
    await this.prisma.templateInstallation.upsert({
      where: { organizationId_templateId: { organizationId: orgId, templateId } },
      create: {
        templateId,
        organizationId: orgId,
        installedEntities: result.entities,
        installedForms: result.forms,
        installedWorkflows: result.workflows,
        installedDashboards: result.dashboards,
        installedRules: result.rules,
        installedBy: userId,
        status: 'active',
      },
      update: {
        installedEntities: result.entities,
        installedForms: result.forms,
        installedWorkflows: result.workflows,
        installedDashboards: result.dashboards,
        installedRules: result.rules,
        status: 'active',
      },
    });

    // Update download count
    await this.prisma.marketplaceTemplate.update({
      where: { id: templateId },
      data: { downloads: { increment: 1 } },
    });

    this.logger.log(`Template "${template.name}" installed for org ${orgId}. Created: ${result.entities.length} entities, ${result.forms.length} forms, ${result.workflows.length} workflows, ${result.dashboards.length} dashboards`);

    return {
      success: true,
      message: `Template "${template.name}" installed successfully`,
      summary: {
        entities: result.entities.length,
        forms: result.forms.length,
        workflows: result.workflows.length,
        dashboards: result.dashboards.length,
        rules: result.rules.length,
        autoLinkRules: result.autoLinkRules.length,
      },
      details: result,
    };
  }

  /**
   * Apply customizations to an installed template.
   * Tenants can add fields, modify workflows, or disable features.
   */
  async customizeTemplate(orgId: string, templateId: string, customizations: any, userId?: string) {
    const installation = await this.prisma.templateInstallation.findUnique({
      where: { organizationId_templateId: { organizationId: orgId, templateId } },
    });

    if (!installation) throw new Error('Template not installed');

    const template = await this.prisma.marketplaceTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) throw new Error('Template not found');

    // Apply customizations
    const payload = template.installPayload as any;

    // Add custom fields to entities
   const installedEntities = (installation.installedEntities as any[]) ?? [];

if (customizations.addedFields) {
  for (const field of customizations.addedFields) {
    const entityDef = installedEntities.find(
      (e: any) => e.name === field.entityName,
    );

    if (entityDef) {
      await this.prisma.entityAttribute.create({
        data: {
          entityDefinitionId: entityDef.id,
          name: field.name,
          displayName: field.displayName || field.name,
          dataType: field.dataType || 'string',
          isRequired: field.isRequired || false,
          isIdentifier: false,
        },
      });
    }
  }
}

    // Add custom forms
    if (customizations.addedForms) {
      for (const form of customizations.addedForms) {
        await this.prisma.formDefinition.create({
          data: {
            organizationId: orgId,
            name: form.name,
            description: form.description,
            formSchema: form.formSchema,
            status: 'published',
          },
        });
      }
    }

    // Modify workflow steps
if (customizations.modifiedWorkflows) {
  const installedWorkflows = (installation.installedWorkflows as any[]) ?? [];

  for (const mod of customizations.modifiedWorkflows) {
    const workflow = installedWorkflows.find(
      (w: any) => w.name === mod.workflowName,
    );

    if (workflow) {
      const existing = await this.prisma.workflowDefinition.findUnique({
        where: { id: workflow.id },
      });

      if (existing) {
        const steps = existing.steps as any[];
        if (mod.addStep) {
          steps.splice(mod.addStep.position || steps.length, 0, mod.addStep.step);
        }
        if (mod.removeStepId) {
          const index = steps.findIndex((s: any) => s.id === mod.removeStepId);
          if (index >= 0) steps.splice(index, 1);
        }

        await this.prisma.workflowDefinition.update({
          where: { id: workflow.id },
          data: { steps },
        });
      }
    }
  }
}

    // Update installation record
    await this.prisma.templateInstallation.update({
      where: { organizationId_templateId: { organizationId: orgId, templateId } },
      data: {
        customizations: {
          ...(installation.customizations as any),
          ...customizations,
          lastModifiedBy: userId,
          lastModifiedAt: new Date().toISOString(),
        },
        status: 'modified',
      },
    });

    return { success: true, message: 'Customizations applied' };
  }

  /**
   * Uninstall a template (soft — keeps data, removes configuration).
   */
  async uninstallTemplate(orgId: string, templateId: string) {
    await this.prisma.templateInstallation.update({
      where: { organizationId_templateId: { organizationId: orgId, templateId } },
      data: { status: 'uninstalled' },
    });

    return { success: true, message: 'Template uninstalled. Your data is preserved.' };
  }
}