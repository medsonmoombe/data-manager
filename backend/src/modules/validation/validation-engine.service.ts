import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class ValidationEngineService {
  private readonly logger = new Logger(ValidationEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate data after golden record is created or updated.
   */
  @OnEvent('golden_record.created')
  async onRecordCreated(payload: { orgId: string; recordId: string; data: any }) {
    await this.validateGoldenRecord(payload.orgId, payload.recordId, payload.data);
  }

  @OnEvent('golden_record.updated')
  async onRecordUpdated(payload: { orgId: string; recordId: string; changedFields: string[] }) {
    const record = await this.prisma.goldenRecord.findUnique({
      where: { id: payload.recordId },
      select: { data: true },
    });
    if (record) {
      await this.validateGoldenRecord(payload.orgId, payload.recordId, record.data as Record<string, any>);
    }
  }

  /**
   * Validate a form submission.
   */
  @OnEvent('form.submitted')
  async onFormSubmitted(payload: { orgId: string; submissionId: string }) {
    const submission = await this.prisma.formSubmission.findUnique({
      where: { id: payload.submissionId },
      select: { data: true, formDefinition: { select: { name: true } } },
    });
    if (submission) {
      await this.validateSubmission(
        payload.orgId,
        payload.submissionId,
        submission.data as Record<string, any>,
        submission.formDefinition.name,
      );
    }
  }

  /**
   * Validate a single golden record against all active rules.
   */
  private async validateGoldenRecord(orgId: string, recordId: string, data: Record<string, any>) {
    const entityDef = await this.prisma.entityDefinition.findFirst({
      where: { id: (await this.prisma.goldenRecord.findUnique({ where: { id: recordId }, select: { entityDefinitionId: true } }))?.entityDefinitionId },
      select: { name: true },
    });

    const entityName = entityDef?.name || 'unknown';

    const rules = await this.prisma.validationRule.findMany({
      where: { organizationId: orgId, targetEntity: entityName, isActive: true },
    });

    for (const rule of rules) {
      const value = data[rule.targetField];
      const isValid = this.evaluateRule(value, rule);

      // Clear previous open results for this field/record
      await this.prisma.validationResult.updateMany({
        where: { ruleId: rule.id, goldenRecordId: recordId, status: 'open' },
        data: { status: 'fixed', resolvedAt: new Date() },
      });

      if (!isValid) {
        await this.prisma.validationResult.create({
          data: {
            ruleId: rule.id,
            goldenRecordId: recordId,
            fieldName: rule.targetField,
            currentValue: value !== undefined ? String(value) : null,
            status: 'open',
          },
        });
      }
    }
  }

  /**
   * Validate a form submission against rules.
   */
  private async validateSubmission(
    orgId: string,
    submissionId: string,
    data: Record<string, any>,
    formName: string,
  ) {
    const rules = await this.prisma.validationRule.findMany({
      where: { organizationId: orgId, targetEntity: `form_${formName}`, isActive: true },
    });

    for (const rule of rules) {
      const value = data[rule.targetField];
      const isValid = this.evaluateRule(value, rule);

      if (!isValid) {
        await this.prisma.validationResult.create({
          data: {
            ruleId: rule.id,
            submissionId,
            fieldName: rule.targetField,
            currentValue: value !== undefined ? String(value) : null,
            status: 'open',
          },
        });
      }
    }
  }

  /**
   * Evaluate a single rule against a value.
   */
  private evaluateRule(value: any, rule: any): boolean {
    const config = rule.ruleConfig;

    if (value === undefined || value === null || value === '') {
      return rule.ruleType !== 'required'; // 'required' fails on empty
    }

    switch (rule.ruleType) {
      case 'required':
        return true; // Already passed the empty check above

      case 'regex':
        try {
          return new RegExp(config.regex).test(String(value));
        } catch {
          return true; // Invalid regex = skip validation
        }

      case 'range':
        const num = Number(value);
        if (isNaN(num)) return false;
        if (config.min !== undefined && num < config.min) return false;
        if (config.max !== undefined && num > config.max) return false;
        return true;

      case 'enum':
        return (config.values || []).includes(String(value));

      case 'date_range':
        const date = new Date(value);
        if (isNaN(date.getTime())) return false;
        if (config.minDate && new Date(value) < new Date(config.minDate)) return false;
        if (config.maxDate && new Date(value) > new Date(config.maxDate)) return false;
        return true;

      case 'length':
        const str = String(value);
        if (config.minLength !== undefined && str.length < config.minLength) return false;
        if (config.maxLength !== undefined && str.length > config.maxLength) return false;
        return true;

      default:
        return true;
    }
  }

  /**
   * Run all rules against all records (batch validation).
   */
  async runBatchValidation(orgId: string, entityName: string): Promise<{ total: number; issues: number }> {
    const rules = await this.prisma.validationRule.findMany({
      where: { organizationId: orgId, targetEntity: entityName, isActive: true },
    });

    if (rules.length === 0) return { total: 0, issues: 0 };

    const entityDef = await this.prisma.entityDefinition.findFirst({
      where: { organizationId: orgId, name: entityName },
    });

    if (!entityDef) return { total: 0, issues: 0 };

    const records = await this.prisma.goldenRecord.findMany({
      where: { organizationId: orgId, entityDefinitionId: entityDef.id, status: 'active', deletedAt: null },
      select: { id: true, data: true },
    });

    let issues = 0;

    for (const record of records) {
      const data = record.data as Record<string, any>;
      for (const rule of rules) {
        const value = data[rule.targetField];
        if (!this.evaluateRule(value, rule)) {
          await this.prisma.validationResult.create({
            data: {
              ruleId: rule.id,
              goldenRecordId: record.id,
              fieldName: rule.targetField,
              currentValue: value !== undefined ? String(value) : null,
              status: 'open',
            },
          });
          issues++;
        }
      }
    }

    this.logger.log(`Batch validation for ${entityName}: ${records.length} records, ${issues} issues`);
    return { total: records.length, issues };
  }
}