import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class SubmissionService {
  private readonly logger = new Logger(SubmissionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Submit data to a published form.
   * All dynamic fields are stored in the `data` JSONB column.
   */
  async submit(
    formId: string,
    orgId: string,
    data: Record<string, any>,
    userId?: string,
    ip?: string,
  ) {
    // Validate that the form exists and is published
    const form = await this.prisma.formDefinition.findFirst({
      where: { id: formId, organizationId: orgId },
    });

    if (!form) throw new Error('Form not found');
    if (form.status !== 'published') throw new Error('Form is not published');

    // Optional: Validate required fields against formSchema
    const schema = form.formSchema as any;
    const fields = schema?.fields || [];

    for (const field of fields) {
      if (field.required && !data[field.name]) {
        throw new Error(`Field "${field.label || field.name}" is required`);
      }
      // Type validation
      if (data[field.name] && field.type === 'number') {
        if (isNaN(Number(data[field.name]))) {
          throw new Error(`Field "${field.label || field.name}" must be a number`);
        }
        data[field.name] = Number(data[field.name]); // Convert to number
      }
      if (data[field.name] && field.type === 'date') {
        data[field.name] = new Date(data[field.name]).toISOString();
      }
    }

    // Insert submission
    const submission = await this.prisma.formSubmission.create({
      data: {
        formDefinitionId: formId,
        organizationId: orgId,
        data: data, // All dynamic fields go here
        submittedBy: userId,
        ipAddress: ip,
      },
    });

    this.logger.log(`Form submission created: ${submission.id} for form ${form.name}`);
    return submission;
  }

  /**
   * Get submissions for a form with optional JSONB field filters.
   * 
   * Example filter: { "farm_name": "Green Valley Farm" }
   * This queries inside the JSONB `data` column.
   */
  async getSubmissions(
    formId: string,
    orgId: string,
    filters?: Record<string, any>,
    page = 1,
    limit = 20,
  ) {
    const where: any = {
      formDefinitionId: formId,
      organizationId: orgId,
    };

    // Apply JSONB path filters
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        where.data = {
          path: [key],
          equals: value,
        };
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.formSubmission.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          data: true,
          status: true,
          submittedBy: true,
          submittedAt: true,
        },
      }),
      this.prisma.formSubmission.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Search a specific field value across ALL forms in the organization.
   * Useful for finding all records related to a person, farm, etc.
   * 
   * Example: searchAcrossForms(orgId, "nrc", "123456/78/1")
   */
  async searchAcrossForms(orgId: string, fieldName: string, value: string) {
    return this.prisma.formSubmission.findMany({
      where: {
        organizationId: orgId,
        data: {
          path: [fieldName],
          string_contains: value,
        },
      },
      include: {
        formDefinition: {
          select: { id: true, name: true },
        },
      },
      orderBy: { submittedAt: 'desc' },
      take: 50,
    });
  }

  /**
   * Get aggregate statistics for a form field.
   * 
   * Example: getFieldStats(formId, orgId, "crop_type")
   * Returns: [{ value: "maize", count: 15 }, { value: "soya", count: 8 }]
   */
  async getFieldStats(formId: string, orgId: string, fieldName: string) {
    const submissions = await this.prisma.formSubmission.findMany({
      where: {
        formDefinitionId: formId,
        organizationId: orgId,
      },
      select: {
        data: true,
      },
    });

    // Aggregate in application layer (PostgreSQL could do this, but simpler here)
    const stats: Record<string, number> = {};
    for (const sub of submissions) {
      const data = sub.data as Record<string, any>;
      const value = data[fieldName];
      if (value) {
        const key = String(value);
        stats[key] = (stats[key] || 0) + 1;
      }
    }

    return Object.entries(stats).map(([value, count]) => ({ value, count }));
  }
}