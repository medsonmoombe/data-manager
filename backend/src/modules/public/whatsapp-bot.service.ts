import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

type Command = 
  | 'register' | 'check' | 'submit' | 'help' | 'status' | 'unknown';

interface ParsedMessage {
  command: Command;
  params: Record<string, string>;
  rawMessage: string;
  senderPhone: string;
}

@Injectable()
export class WhatsAppBotService {
  private readonly logger = new Logger(WhatsAppBotService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Process an incoming WhatsApp message.
   */
  async processMessage(senderPhone: string, message: string): Promise<string> {
    const parsed = this.parseMessage(senderPhone, message);

    switch (parsed.command) {
      case 'register':
        return this.handleRegister(parsed);
      case 'check':
        return this.handleCheck(parsed);
      case 'submit':
        return this.handleSubmit(parsed);
      case 'status':
        return this.handleStatus(parsed);
      case 'help':
        return this.getHelpMessage();
      default:
        return this.getHelpMessage();
    }
  }

  /**
   * Parse a natural language message into a command.
   */
  private parseMessage(senderPhone: string, message: string): ParsedMessage {
    const msg = message.toLowerCase().trim();
    const params: Record<string, string> = {};

    // Extract key-value pairs: "name John Phiri" or "nrc:123456/78/1"
    const kvRegex = /(\w+)[\s:]+([^,]+)/g;
    let match;
    while ((match = kvRegex.exec(msg)) !== null) {
      params[match[1]] = match[2].trim();
    }

    let command: Command = 'unknown';

    if (msg.startsWith('register') || msg.startsWith('new')) {
      command = 'register';
    } else if (msg.startsWith('check') || msg.startsWith('lookup') || msg.startsWith('find')) {
      command = 'check';
    } else if (msg.startsWith('submit') || msg.startsWith('report')) {
      command = 'submit';
    } else if (msg.startsWith('status') || msg.startsWith('progress')) {
      command = 'status';
    } else if (msg.startsWith('help') || msg === 'hi' || msg === 'hello') {
      command = 'help';
    }

    return { command, params, rawMessage: message, senderPhone };
  }

  /**
   * Handle: Register a new person.
   * Example: "register name John Phiri, nrc 123456/78/1, district Lusaka, age 34"
   */
  private async handleRegister(parsed: ParsedMessage): Promise<string> {
    const { params, senderPhone } = parsed;

    const firstName = params['first_name'] || params['name']?.split(' ')[0] || '';
    const lastName = params['last_name'] || params['name']?.split(' ')[1] || '';
    const nrc = params['nrc'] || '';
    const district = params['district'] || '';
    const age = params['age'] || '';

    if (!firstName || !nrc) {
      return `To register, please provide at least a name and NRC.\n\nExample: register name John Phiri, nrc 123456/78/1, district Lusaka, age 34`;
    }

    try {
      // Find or create entity definition
      const orgId = await this.getDefaultOrgId();
      if (!orgId) return 'System not configured. Please contact support.';

      const entityDef = await this.getOrCreateEntityDef(orgId, 'person');

      // Check for existing record
      const existing = await this.prisma.goldenRecord.findFirst({
        where: {
          organizationId: orgId,
          entityDefinitionId: entityDef.id,
          hashedIdentifier: this.hashNrc(nrc),
        },
      });

      if (existing) {
        return `A record with NRC ${nrc} already exists. Use "check nrc ${nrc}" to view it.`;
      }

      // Create golden record
      const record = await this.prisma.goldenRecord.create({
        data: {
          organizationId: orgId,
          entityDefinitionId: entityDef.id,
          data: {
            first_name: firstName,
            last_name: lastName,
            nrc,
            district,
            age: age ? parseInt(age) : null,
            registered_via: 'whatsapp',
            registered_by: senderPhone,
          },
          hashedIdentifier: this.hashNrc(nrc),
          matchConfidence: 1,
        },
      });

      return `✅ Registration successful!\n\nName: ${firstName} ${lastName}\nNRC: ${nrc}\nReference ID: ${record.id.substring(0, 8)}\n\nUse "check nrc ${nrc}" to view this record anytime.`;
    } catch (error) {
      this.logger.error(`Registration failed: ${(error as Error).message}`);
      return '❌ Registration failed. Please try again or contact support.';
    }
  }

  /**
   * Handle: Check/Lookup a record.
   * Example: "check nrc 123456/78/1"
   */
  private async handleCheck(parsed: ParsedMessage): Promise<string> {
    const { params } = parsed;
    const nrc = params['nrc'] || '';
    const name = params['name'] || '';

    if (!nrc && !name) {
      return 'To check a record, provide NRC or name.\n\nExample: check nrc 123456/78/1';
    }

    try {
      const orgId = await this.getDefaultOrgId();
      if (!orgId) return 'System not configured.';

      let records: any[] = [];

      if (nrc) {
        const hashedNrc = this.hashNrc(nrc);
        records = await this.prisma.goldenRecord.findMany({
          where: {
            organizationId: orgId,
            hashedIdentifier: hashedNrc,
            status: 'active',
            deletedAt: null,
          },
          select: { id: true, data: true, updatedAt: true },
          take: 5,
        });
      } else if (name) {
        records = await this.prisma.goldenRecord.findMany({
          where: {
            organizationId: orgId,
            status: 'active',
            deletedAt: null,
            OR: [
              { data: { path: ['first_name'], string_contains: name } },
              { data: { path: ['last_name'], string_contains: name } },
            ],
          },
          select: { id: true, data: true, updatedAt: true },
          take: 5,
        });
      }

      if (records.length === 0) {
        return `No records found. Check the NRC/name and try again.`;
      }

      let response = `📋 Found ${records.length} record(s):\n\n`;
      for (const record of records) {
        const data = record.data as Record<string, any>;
        response += `• ${data.first_name || ''} ${data.last_name || ''}\n`;
        response += `  NRC: ${data.nrc || 'N/A'}\n`;
        response += `  District: ${data.district || 'N/A'}\n`;
        response += `  Updated: ${new Date(record.updatedAt).toLocaleDateString()}\n\n`;
      }

      return response;
    } catch (error) {
      return '❌ Lookup failed. Please try again.';
    }
  }

  /**
   * Handle: Submit form data.
   * Example: "submit inspection farm Green Valley, crop maize, hectares 25"
   */
  private async handleSubmit(parsed: ParsedMessage): Promise<string> {
    const { params, senderPhone } = parsed;
    const formType = params['type'] || params['form'] || 'inspection';

    if (Object.keys(params).length < 2) {
      return `To submit data, specify form type and fields.\n\nExample: submit inspection farm Green Valley, crop maize, hectares 25`;
    }

    try {
      const orgId = await this.getDefaultOrgId();
      if (!orgId) return 'System not configured.';

      // Find or create a form for this type
      let form = await this.prisma.formDefinition.findFirst({
        where: { organizationId: orgId, name: { contains: formType, mode: 'insensitive' } },
      });

      if (!form) {
        // Auto-create a form
        form = await this.prisma.formDefinition.create({
          data: {
            organizationId: orgId,
            name: `${formType}_whatsapp`,
            description: `Auto-created from WhatsApp submissions`,
            status: 'published',
            formSchema: { fields: [] },
          },
        });
      }

      // Submit
      const submission = await this.prisma.formSubmission.create({
        data: {
          formDefinitionId: form.id,
          organizationId: orgId,
          data: {
            ...params,
            submitted_via: 'whatsapp',
            submitter_phone: senderPhone,
          },
          submittedBy: `whatsapp:${senderPhone}`,
        },
      });

      return `✅ Submission successful!\n\nReference: ${submission.id.substring(0, 8)}\n\nUse "status ${submission.id.substring(0, 8)}" to check progress.`;
    } catch (error) {
      return '❌ Submission failed. Please try again.';
    }
  }

  /**
   * Handle: Check status of a previous submission.
   */
  private async handleStatus(parsed: ParsedMessage): Promise<string> {
    const ref = parsed.params['ref'] || parsed.params['id'] || '';
    if (!ref) return 'To check status, provide reference ID.\n\nExample: status abc12345';

    return `📊 Status for ${ref}: Processing.\n\nTrack full details at: https://portal.omnicore.zm/track/${ref}`;
  }

  /**
   * Get help message.
   */
  private getHelpMessage(): string {
    return `🤖 *OmniCore Assistant*\n\nI can help you with:\n\n• *register* - Register a new person\n  _register name John Phiri, nrc 123456/78/1, district Lusaka, age 34_\n\n• *check* - Look up a record\n  _check nrc 123456/78/1_\n\n• *submit* - Submit form data\n  _submit inspection farm Green Valley, crop maize_\n\n• *status* - Check submission status\n  _status abc12345_\n\n• *help* - Show this message`;
  }

  // =====================
  // Helpers
  // =====================

  private hashNrc(nrc: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(nrc.toLowerCase().trim()).digest('hex');
  }

  private async getDefaultOrgId(): Promise<string | null> {
    const org = await this.prisma.organization.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    return org?.id || null;
  }

  private async getOrCreateEntityDef(orgId: string, name: string) {
    let entityDef = await this.prisma.entityDefinition.findFirst({
      where: { organizationId: orgId, name },
    });

    if (!entityDef) {
      entityDef = await this.prisma.entityDefinition.create({
        data: { organizationId: orgId, name, description: 'Auto-created' },
      });
    }

    return entityDef;
  }
}