import { Injectable, Logger } from '@nestjs/common';
import { ConnectorAdapter, ConnectorFetchResult } from '../../../common/interfaces/connector-adapter.interface';
import * as fs from 'fs';
import * as csv from 'csv-parse/sync';

@Injectable()
export class CsvAdapter implements ConnectorAdapter {
  private readonly logger = new Logger(CsvAdapter.name);

  async fetch(config: Record<string, any>): Promise<ConnectorFetchResult> {
    let fileContent: string;

    // Check if we have inline CSV content (from browser upload)
    if (config.csvContent) {
      this.logger.log('Reading CSV from inline content');
      fileContent = config.csvContent;
    }
    // Otherwise read from file path
    else if (config.filePath) {
      this.logger.log(`Reading CSV from: ${config.filePath}`);
      
      if (!fs.existsSync(config.filePath)) {
        throw new Error(`File not found: ${config.filePath}`);
      }
      
      fileContent = fs.readFileSync(config.filePath, 'utf-8');
    } else {
      throw new Error('CSV adapter requires either "csvContent" or "filePath" in configuration');
    }

    // Parse CSV
    const records: any = csv.parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });

    this.logger.log(`Parsed ${records.length} rows from CSV`);

    return {
      records,
      totalFetched: records.length,
    };
  }

  async testConnection(config: Record<string, any>): Promise<boolean> {
    if (config.csvContent) return true;
    if (config.filePath) return fs.existsSync(config.filePath);
    return false;
  }
}