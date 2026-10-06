import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import * as ExcelJS from 'exceljs';

@Injectable()
export class ExportService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Export data from any model or query to JSON.
   */
  async exportToJson(data: any[]): Promise<string> {
    return JSON.stringify(data, null, 2);
  }

  /**
   * Export data to CSV.
   */
  async exportToCsv(data: any[], filename: string): Promise<string> {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const rows = data.map((row) =>
      headers.map((h) => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val).replace(/"/g, '""'); // Escape quotes
      }).join(','),
    );

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Export data to Excel (.xlsx).
   */
  async exportToExcel(data: any[], sheetName: string = 'Data'): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(sheetName);

    if (data.length > 0) {
      const headers = Object.keys(data[0]);
      sheet.columns = headers.map((h) => ({ header: h, key: h, width: 20 }));

      // Style header row
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };

      data.forEach((row) => sheet.addRow(row));
    }

    return workbook.xlsx.writeBuffer() as unknown as Promise<Buffer>;
  }

  /**
   * Export golden records with optional filters.
   */
  async exportGoldenRecords(
    orgId: string,
    entityName: string,
    format: 'csv' | 'json' | 'xlsx',
    filters?: Record<string, any>,
  ): Promise<{ data: string | Buffer; contentType: string; filename: string }> {
    const entityDef = await this.prisma.entityDefinition.findFirst({
      where: { organizationId: orgId, name: entityName },
    });

    if (!entityDef) throw new Error(`Entity ${entityName} not found`);

    const where: any = {
      organizationId: orgId,
      entityDefinitionId: entityDef.id,
      status: 'active',
      deletedAt: null,
    };

    // Apply JSONB filters
    if (filters && Object.keys(filters).length > 0) {
      const conditions = [];
      for (const [key, value] of Object.entries(filters)) {
        conditions.push({ data: { path: [key], string_contains: value } });
      }
      where.AND = conditions;
    }

    const records = await this.prisma.goldenRecord.findMany({
      where,
      select: { id: true, data: true, createdAt: true, updatedAt: true },
      take: 50000, // Limit for performance
    });

    // Flatten data for export
    const flatData = records.map((r) => ({
      id: r.id,
      ...(r.data as Record<string, any>),
      created_at: r.createdAt,
      updated_at: r.updatedAt,
    }));

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${entityName}_export_${timestamp}`;

    switch (format) {
      case 'json':
        return {
          data: await this.exportToJson(flatData),
          contentType: 'application/json',
          filename: `${filename}.json`,
        };
      case 'xlsx':
        return {
          data: await this.exportToExcel(flatData, entityName),
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          filename: `${filename}.xlsx`,
        };
      case 'csv':
      default:
        return {
          data: await this.exportToCsv(flatData, filename),
          contentType: 'text/csv',
          filename: `${filename}.csv`,
        };
    }
  }
}