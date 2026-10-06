import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

interface LineageNode {
  id: string;
  type: 'source' | 'golden_record' | 'version' | 'merge' | 'form' | 'workflow';
  label: string;
  details: Record<string, any>;
  timestamp: string;
}

interface LineageEdge {
  from: string;
  to: string;
  label: string;
}

interface LineageGraph {
  nodes: LineageNode[];
  edges: LineageEdge[];
}

@Injectable()
export class LineageService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build a complete lineage graph for any record.
   */
  async buildLineage(orgId: string, recordId: string): Promise<LineageGraph> {
    const nodes: LineageNode[] = [];
    const edges: LineageEdge[] = [];

    // 1. Get the golden record
    const goldenRecord = await this.prisma.goldenRecord.findFirst({
      where: { id: recordId, organizationId: orgId },
      select: {
        id: true,
        data: true,
        matchConfidence: true,
        createdAt: true,
        updatedAt: true,
        entityDefinition: { select: { name: true } },
      },
    });

    if (!goldenRecord) return { nodes: [], edges: [] };

    // Add golden record node
    const grNodeId = `gr_${goldenRecord.id}`;
    nodes.push({
      id: grNodeId,
      type: 'golden_record',
      label: `${goldenRecord.entityDefinition.name}: ${this.extractName(goldenRecord.data)}`,
      details: {
        id: goldenRecord.id,
        entityType: goldenRecord.entityDefinition.name,
        confidence: goldenRecord.matchConfidence,
      },
      timestamp: goldenRecord.createdAt.toISOString(),
    });

    // 2. Get source records (where data came from)
    const sourceRecords = await this.prisma.sourceRecord.findMany({
      where: { goldenRecordId: recordId },
      select: {
        id: true,
        sourceSystem: true,
        sourceData: true,
        importDate: true,
        connectorRunItem: {
          select: {
            run: {
              select: {
                job: {
                  select: {
                    connector: { select: { name: true, connectorType: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { importDate: 'asc' },
    });

    for (const sr of sourceRecords) {
      const srNodeId = `sr_${sr.id}`;
      nodes.push({
        id: srNodeId,
        type: 'source',
        label: `${sr.sourceSystem || 'Unknown Source'}`,
        details: {
          connector: sr.connectorRunItem?.run?.job?.connector?.name || 'Unknown',
          connectorType: sr.connectorRunItem?.run?.job?.connector?.connectorType || 'unknown',
          sourceData: sr.sourceData,
        },
        timestamp: sr.importDate.toISOString(),
      });

      edges.push({
        from: srNodeId,
        to: grNodeId,
        label: 'imported as',
      });
    }

    // 3. Get versions (history of changes)
    const versions = await this.prisma.recordVersion.findMany({
      where: { goldenRecordId: recordId },
      select: {
        id: true,
        versionNumber: true,
        changedFields: true,
        dataSnapshot: true,
        updatedBy: true,
        updatedAt: true,
      },
      orderBy: { versionNumber: 'asc' },
    });

    let previousVersionNodeId = grNodeId;

    for (const version of versions) {
      const vNodeId = `ver_${version.id}`;
      nodes.push({
        id: vNodeId,
        type: 'version',
        label: `Version ${version.versionNumber}`,
        details: {
          changedFields: version.changedFields,
          updatedBy: version.updatedBy,
        },
        timestamp: version.updatedAt.toISOString(),
      });

      edges.push({
        from: previousVersionNodeId,
        to: vNodeId,
        label: 'updated to',
      });

      previousVersionNodeId = vNodeId;
    }

    // 4. Get merges
    const merges = await this.prisma.mergeHistory.findMany({
      where: {
        OR: [
          { survivingRecordId: recordId },
          { mergedRecordId: recordId },
        ],
      },
      select: {
        survivingRecordId: true,
        mergedRecordId: true,
        mergedBy: true,
        mergedAt: true,
      },
    });

    for (const merge of merges) {
      if (merge.survivingRecordId === recordId) {
        const mergedRecord = await this.prisma.goldenRecord.findUnique({
          where: { id: merge.mergedRecordId },
          select: { id: true, data: true },
        });

        if (mergedRecord) {
          const mNodeId = `merge_${merge.mergedRecordId}`;
          nodes.push({
            id: mNodeId,
            type: 'merge',
            label: `Merged: ${this.extractName(mergedRecord.data)}`,
            details: { recordId: mergedRecord.id },
            timestamp: merge.mergedAt.toISOString(),
          });

          edges.push({
            from: mNodeId,
            to: grNodeId,
            label: 'merged into',
          });
        }
      }
    }

    // 5. Get related form submissions
    const submissions = await this.prisma.formSubmission.findMany({
      where: {
        organizationId: orgId,
        data: { path: ['entity_id'], equals: recordId },
      },
      select: {
        id: true,
        data: true,
        submittedAt: true,
        formDefinition: { select: { name: true } },
      },
      orderBy: { submittedAt: 'asc' },
    });

    for (const sub of submissions) {
      const subNodeId = `form_${sub.id}`;
      nodes.push({
        id: subNodeId,
        type: 'form',
        label: `Form: ${sub.formDefinition.name}`,
        details: { submissionData: sub.data },
        timestamp: sub.submittedAt.toISOString(),
      });

      edges.push({
        from: subNodeId,
        to: grNodeId,
        label: 'linked to',
      });
    }

    // 6. Get timeline events
    const events = await this.prisma.recordTimelineEvent.findMany({
      where: { organizationId: orgId, recordId, entityType: 'golden_record' },
      select: {
        id: true,
        eventType: true,
        eventData: true,
        occurredAt: true,
      },
      orderBy: { occurredAt: 'asc' },
    });

    for (const event of events) {
      const evNodeId = `evt_${event.id}`;
      nodes.push({
        id: evNodeId,
        type: 'workflow',
        label: event.eventType.replace(/_/g, ' '),
        details: event.eventData as Record<string, any>,
        timestamp: event.occurredAt.toISOString(),
      });

      edges.push({
        from: grNodeId,
        to: evNodeId,
        label: 'triggered',
      });
    }

    return { nodes, edges };
  }

  private extractName(data: any): string {
    const d = data as Record<string, any>;
    return `${d.first_name || ''} ${d.last_name || ''}`.trim() || d.id || 'Unknown';
  }
}