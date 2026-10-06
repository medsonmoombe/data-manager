import { Controller, Post, Param, Body, Req, Headers, BadRequestException, Logger } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import * as crypto from 'crypto';

@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Post('receive/:entityName')
  async receiveWebhook(
    @Param('entityName') entityName: string,
    @Body() payload: any,
    @Headers('x-webhook-secret') secret: string,
    @Headers('x-webhook-signature') signature: string,
  ) {
    const apiKey = await this.prisma.apiKey.findFirst({
      where: {
        keyHash: crypto.createHash('sha256').update(secret || '').digest('hex'),
        isActive: true,
        ...(this.isNotExpired()),
      },
    });

    if (!apiKey) {
      throw new BadRequestException('Invalid or expired webhook secret');
    }

    const orgId = apiKey.organizationId;

    if (signature) {
      const payloadStr = JSON.stringify(payload);
      const expectedSig = crypto
        .createHmac('sha256', secret || '')
        .update(payloadStr)
        .digest('hex');

      if (signature !== expectedSig) {
        throw new BadRequestException('Invalid signature');
      }
    }

    const entityDef = await this.prisma.entityDefinition.findFirst({
      where: { organizationId: orgId, name: entityName },
    });

    if (!entityDef) {
      throw new BadRequestException(`Entity "${entityName}" not found`);
    }

    const records = Array.isArray(payload) ? payload : [payload];
    const results = {
      created: 0,
      updated: 0,
      errors: [] as string[],
    };

    for (const record of records) {
      try {
        let existingRecord: any = null;

        const populatedFields = Object.entries(record)
          .filter(([_, v]: any) => v !== '' && v !== null && v !== undefined)
          .map(([k]) => k);

        if (populatedFields.length >= 2) {
          const conditions = populatedFields.map(field => ({
            data: { path: [field], equals: String(record[field]).trim() },
          }));

          const potentialMatches = await this.prisma.goldenRecord.findMany({
            where: {
              organizationId: orgId,
              entityDefinitionId: entityDef.id,
              status: 'active',
              deletedAt: null,
              OR: conditions,
            },
            select: { id: true, data: true },
            take: 5,
          });

          for (const match of potentialMatches) {
            const matchData = match.data as Record<string, any>;
            let matchCount = 0;

            for (const field of populatedFields) {
              const incoming = String(record[field] || '').trim().toLowerCase();
              const existing = String(matchData[field] || '').trim().toLowerCase();
              if (incoming && existing && incoming === existing) {
                matchCount++;
              }
            }

            if (matchCount >= 2) {
              existingRecord = match;
              this.logger.log(`Webhook: Duplicate found - ${matchCount} fields match`);
              break;
            }
          }
        }

        if (existingRecord) {
          const mergedData = { ...(existingRecord.data as any), ...record };
          await this.prisma.goldenRecord.update({
            where: { id: existingRecord.id },
            data: { data: mergedData, updatedAt: new Date() },
          });
          results.updated++;
        } else {
          await this.prisma.goldenRecord.create({
            data: {
              organizationId: orgId,
              entityDefinitionId: entityDef.id,
              data: record,
              matchConfidence: 1.0,
              status: 'active',
            },
          });
          results.created++;
        }
      } catch (err: any) {
        results.errors.push(`Record: ${err.message}`);
        this.logger.error(`Webhook record error: ${err.message}`);
      }
    }

    return {
      success: true,
      message: `Processed ${records.length} records`,
      results,
    };
  }

  private isNotExpired() {
    return {
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    };
  }
}
