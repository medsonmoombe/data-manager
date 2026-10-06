import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

interface FieldMapping {
  sourceField: string;
  targetField: string;
  matchType: 'exact' | 'fuzzy' | 'contains';
}

interface AutoLinkRule {
  id: string;
  organizationId: string;
  name: string;
  sourceEntityType: string;
  targetEntityType: string;
  fieldMappings: FieldMapping[];
  relationshipType: string;
  autoAcceptAbove: number;
  suggestAbove: number;
}

@Injectable()
export class AutoLinkService {
  private readonly logger = new Logger(AutoLinkService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Triggered after new golden records are created (from MDM pipeline).
   */
  @OnEvent('connector.run.completed')
  async onNewDataImported(payload: { organizationId: string }) {
    this.logger.log(`Auto-link triggered for org ${payload.organizationId}`);
    await this.processPendingSourceRecords(payload.organizationId);
  }

  /**
   * Triggered after a form is submitted.
   */
  @OnEvent('form.submitted')
  async onFormSubmitted(payload: {
    orgId: string;
    formId: string;
    submissionId: string;
  }) {
    this.logger.log(`Auto-link triggered by form submission ${payload.submissionId}`);
    await this.processFormSubmission(payload.orgId, payload.submissionId);
  }

  /**
   * Process all source_records with status 'matched' that haven't been checked for relationships.
   */
  private async processPendingSourceRecords(orgId: string) {
    const rules = await this.getActiveRules(orgId);
    if (rules.length === 0) return;

    // Get recently matched source records (last 15 minutes)
    const recentSourceRecords = await this.prisma.sourceRecord.findMany({
      where: {
        goldenRecordId: { not: null },
        status: 'matched',
        importDate: { gte: new Date(Date.now() - 15 * 60 * 1000) },
      },
      include: {
        goldenRecord: {
          select: { id: true, data: true, entityDefinitionId: true },
        },
      },
    });

    for (const sourceRecord of recentSourceRecords) {
      const goldenData = (sourceRecord.goldenRecord?.data || {}) as Record<string, any>;
      const entityDefId = sourceRecord.goldenRecord?.entityDefinitionId;

      // Find the entity type name
      const entityDef = await this.prisma.entityDefinition.findUnique({
        where: { id: entityDefId || '' },
        select: { name: true },
      });

      const sourceEntityType = entityDef?.name || 'unknown';

      // Apply each rule
      for (const rule of rules) {
        if (rule.sourceEntityType === sourceEntityType) {
          await this.applyRule(rule, goldenData, sourceRecord.goldenRecord!.id, orgId, sourceEntityType);
        }
      }
    }
  }

  /**
   * Process a single form submission against auto-link rules.
   */
  private async processFormSubmission(orgId: string, submissionId: string) {
    const rules = await this.getActiveRules(orgId);
    if (rules.length === 0) return;

    const submission = await this.prisma.formSubmission.findUnique({
      where: { id: submissionId },
      include: { formDefinition: true },
    });

    if (!submission) return;

    const submissionData = submission.data as Record<string, any>;
    const sourceEntityType = `form_${submission.formDefinition.name}`;

    for (const rule of rules) {
      if (rule.sourceEntityType === sourceEntityType || rule.sourceEntityType === 'form_submission') {
        await this.applyRuleToForm(rule, submissionData, submission.id, orgId, sourceEntityType);
      }
    }
  }

  /**
   * Apply a single auto-link rule against a golden record.
   */
  private async applyRule(
    rule: AutoLinkRule,
    sourceData: Record<string, any>,
    sourceRecordId: string,
    orgId: string,
    sourceEntityType: string,
  ) {
    // Build search criteria from field mappings
    const searchCriteria: Record<string, any> = {};

    for (const mapping of rule.fieldMappings) {
      const sourceValue = sourceData[mapping.sourceField];
      if (sourceValue) {
        searchCriteria[mapping.targetField] = sourceValue;
      }
    }

    if (Object.keys(searchCriteria).length === 0) return;

    // Find matching golden records of target entity type
    const entityDef = await this.prisma.entityDefinition.findFirst({
      where: { organizationId: orgId, name: rule.targetEntityType },
    });

    if (!entityDef) return;

    // Build JSONB path queries
    const dataConditions: any[] = [];
    for (const [field, value] of Object.entries(searchCriteria)) {
      dataConditions.push({
        data: { path: [field], equals: value },
      });
    }

    const matches = await this.prisma.goldenRecord.findMany({
      where: {
        organizationId: orgId,
        entityDefinitionId: entityDef.id,
        status: 'active',
        OR: dataConditions,
      },
    });

    for (const match of matches) {
      if (match.id === sourceRecordId) continue; // Don't link to self

      // Calculate confidence based on match quality
      const confidence = this.calculateConfidence(rule.fieldMappings, sourceData, match.data as Record<string, any>);

      if (confidence >= rule.autoAcceptAbove) {
        // Auto-create relationship
        await this.createRelationship(
          orgId,
          sourceEntityType,
          sourceRecordId,
          rule.targetEntityType,
          match.id,
          rule.relationshipType,
          confidence,
        );
        this.logger.log(`Auto-linked: ${sourceRecordId} → ${match.id} (${rule.relationshipType}, confidence: ${confidence})`);
      } else if (confidence >= rule.suggestAbove) {
        // Create suggestion for review
        await this.createSuggestion(
          orgId,
          sourceEntityType,
          sourceRecordId,
          rule.targetEntityType,
          match.id,
          rule.relationshipType,
          confidence,
          rule.name,
        );
        this.logger.log(`Suggestion created: ${sourceRecordId} → ${match.id} (confidence: ${confidence})`);
      }
    }
  }

  /**
   * Apply a rule against a form submission.
   */
  private async applyRuleToForm(
    rule: AutoLinkRule,
    submissionData: Record<string, any>,
    submissionId: string,
    orgId: string,
    sourceEntityType: string,
  ) {
    // Similar logic but targets golden records
    await this.applyRule(rule, submissionData, submissionId, orgId, sourceEntityType);
  }

  /**
   * Calculate match confidence based on field mappings.
   */
  private calculateConfidence(
    mappings: FieldMapping[],
    sourceData: Record<string, any>,
    targetData: Record<string, any>,
  ): number {
    let totalWeight = 0;
    let weightedScore = 0;

    for (const mapping of mappings) {
      const weight = mapping.matchType === 'exact' ? 1.0 : 0.7;
      totalWeight += weight;

      const sourceValue = String(sourceData[mapping.sourceField] || '').toLowerCase().trim();
      const targetValue = String(targetData[mapping.targetField] || '').toLowerCase().trim();

      if (!sourceValue || !targetValue) continue;

      if (mapping.matchType === 'exact') {
        if (sourceValue === targetValue) weightedScore += weight;
      } else if (mapping.matchType === 'contains') {
        if (sourceValue.includes(targetValue) || targetValue.includes(sourceValue)) {
          weightedScore += weight * 0.8;
        }
      } else if (mapping.matchType === 'fuzzy') {
        const similarity = this.stringSimilarity(sourceValue, targetValue);
        weightedScore += weight * similarity;
      }
    }

    return totalWeight > 0 ? weightedScore / totalWeight : 0;
  }

  /**
   * Simple string similarity (0 to 1).
   */
  private stringSimilarity(a: string, b: string): number {
    if (a === b) return 1.0;
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    if (shorter.length === 0) return 0.0;

    let matches = 0;
    const longerChars = longer.split('');
    for (const char of shorter.split('')) {
      const idx = longerChars.indexOf(char);
      if (idx !== -1) {
        matches++;
        longerChars.splice(idx, 1);
      }
    }
    return matches / shorter.length;
  }

  /**
   * Create a relationship (auto-accepted).
   */
  private async createRelationship(
    orgId: string,
    sourceEntityType: string,
    sourceRecordId: string,
    targetEntityType: string,
    targetRecordId: string,
    relationshipType: string,
    confidence: number,
  ) {
    // Check for existing
    const existing = await this.prisma.recordRelationship.findFirst({
      where: {
        organizationId: orgId,
        sourceEntityType,
        sourceRecordId,
        targetEntityType,
        targetRecordId,
        relationshipType,
      },
    });

    if (!existing) {
      await this.prisma.recordRelationship.create({
        data: {
          organizationId: orgId,
          sourceEntityType,
          sourceRecordId,
          targetEntityType,
          targetRecordId,
          relationshipType,
          confidence,
          isInferred: true,
        },
      });

      // Emit event for timeline
      this.eventEmitter.emit('relationship.created', {
        orgId,
        sourceEntityType,
        sourceRecordId,
        targetEntityType,
        targetRecordId,
        relationshipType,
      });
    }
  }

  /**
   * Create a suggestion for manual review.
   */
  private async createSuggestion(
    orgId: string,
    entityTypeA: string,
    entityIdA: string,
    entityTypeB: string,
    entityIdB: string,
    relationshipType: string,
    confidence: number,
    ruleName: string,
  ) {
    // Avoid duplicate pending suggestions
    const existing = await this.prisma.suggestion.findFirst({
      where: {
        organizationId: orgId,
        suggestionType: 'relationship',
        entityTypeA,
        entityIdA,
        entityTypeB,
        entityIdB,
        status: 'pending',
      },
    });

    if (!existing) {
      await this.prisma.suggestion.create({
        data: {
          organizationId: orgId,
          suggestionType: 'relationship',
          title: `Possible ${relationshipType.replace(/_/g, ' ')} detected`,
          description: `Rule: ${ruleName}`,
          entityTypeA,
          entityIdA,
          entityTypeB,
          entityIdB,
          proposedAction: {
            action: 'create_relationship',
            relationshipType,
          },
          confidence,
        },
      });
    }
  }

  /**
   * Get active rules for an organization, ordered by priority.
   */
  private async getActiveRules(orgId: string): Promise<AutoLinkRule[]> {
    const rules = await this.prisma.autoLinkRule.findMany({
      where: { organizationId: orgId, isActive: true },
      orderBy: { priority: 'desc' },
    });

    return rules.map((r) => ({
      ...r,
      fieldMappings: r.fieldMappings as unknown as FieldMapping[],
    }));
  }

  /**
   * Public method: Run auto-link manually on all records for an org.
   */
  async runFullAutoLink(orgId: string) {
    this.logger.log(`Running full auto-link for org ${orgId}`);
    await this.processPendingSourceRecords(orgId);
    return { success: true, message: 'Auto-link completed' };
  }

  /**
   * Get matching golden record pairs for a specific auto-link rule.
   * Computes fresh matches using the rule's field mappings.
   */
  async getRuleMatches(orgId: string, ruleId: string, limit: number = 100) {
    const rule = await this.prisma.autoLinkRule.findFirst({
      where: { id: ruleId, organizationId: orgId },
    });
    if (!rule) throw new NotFoundException('Rule not found');

    const mappings = rule.fieldMappings as unknown as FieldMapping[];

    // Get entity definitions for source and target
    const sourceEntityDef = await this.prisma.entityDefinition.findFirst({
      where: { organizationId: orgId, name: rule.sourceEntityType },
    });
    const targetEntityDef = await this.prisma.entityDefinition.findFirst({
      where: { organizationId: orgId, name: rule.targetEntityType },
    });

    if (!sourceEntityDef || !targetEntityDef) return { rule, matches: [], total: 0 };

    // Get all golden records of source and target types
    const [sourceRecords, targetRecords] = await Promise.all([
      this.prisma.goldenRecord.findMany({
        where: { organizationId: orgId, entityDefinitionId: sourceEntityDef.id, status: 'active' },
        select: { id: true, data: true, externalId: true },
      }),
      this.prisma.goldenRecord.findMany({
        where: { organizationId: orgId, entityDefinitionId: targetEntityDef.id, status: 'active' },
        select: { id: true, data: true, externalId: true },
      }),
    ]);

    // Pre-fetch existing relationships and suggestions to annotate results
    const [existingRelationships, existingSuggestions] = await Promise.all([
      this.prisma.recordRelationship.findMany({
        where: {
          organizationId: orgId,
          sourceEntityType: rule.sourceEntityType,
          targetEntityType: rule.targetEntityType,
        },
        select: { sourceRecordId: true, targetRecordId: true },
      }),
      this.prisma.suggestion.findMany({
        where: {
          organizationId: orgId,
          suggestionType: 'relationship',
          entityTypeA: rule.sourceEntityType,
          entityTypeB: rule.targetEntityType,
          status: 'pending',
        },
        select: { entityIdA: true, entityIdB: true, id: true },
      }),
    ]);

    const existingRelSet = new Set<string>();
    existingRelationships.forEach(r => {
      existingRelSet.add(`${r.sourceRecordId}:${r.targetRecordId}`);
      existingRelSet.add(`${r.targetRecordId}:${r.sourceRecordId}`);
    });
    const existingSugById = new Map<string, string>();
    existingSuggestions.forEach(s => {
      existingSugById.set(`${s.entityIdA}:${s.entityIdB}`, s.id);
      existingSugById.set(`${s.entityIdB}:${s.entityIdA}`, s.id);
    });

    const matches: any[] = [];

    for (const source of sourceRecords) {
      const sourceData = source.data as Record<string, any>;

      for (const target of targetRecords) {
        if (source.id === target.id) continue;

        const pairKey = `${source.id}:${target.id}`;
        const confidence = this.calculateConfidence(mappings, sourceData, target.data as Record<string, any>);

        if (confidence >= rule.suggestAbove) {
          if (existingRelSet.has(pairKey)) continue; // Already linked, skip

          const existingSuggestionId = existingSugById.get(pairKey);

          matches.push({
            sourceRecord: { id: source.id, data: sourceData, externalId: source.externalId },
            targetRecord: { id: target.id, data: target.data as Record<string, any>, externalId: target.externalId },
            confidence,
            relationshipType: rule.relationshipType,
            existingRelation: existingRelSet.has(pairKey),
            existingSuggestionId: existingSuggestionId || null,
            matchedFields: mappings
              .filter(m => {
                const sv = String(sourceData[m.sourceField] || '').toLowerCase().trim();
                const tv = String((target.data as Record<string, any>)[m.targetField] || '').toLowerCase().trim();
                return sv && tv && sv === tv;
              })
              .map(m => m.sourceField),
          });
        }
      }
    }

    matches.sort((a, b) => b.confidence - a.confidence);
    const limited = matches.slice(0, limit);

    return {
      rule: {
        id: rule.id,
        name: rule.name,
        sourceEntityType: rule.sourceEntityType,
        targetEntityType: rule.targetEntityType,
        relationshipType: rule.relationshipType,
        fieldMappings: mappings,
        suggestAbove: rule.suggestAbove,
        autoAcceptAbove: rule.autoAcceptAbove,
      },
      matches: limited,
      total: matches.length,
    };
  }
}