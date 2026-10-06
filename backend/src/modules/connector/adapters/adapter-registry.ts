import { Injectable } from '@nestjs/common';
import { ConnectorAdapter } from '../../../common/interfaces/connector-adapter.interface';
import { CsvAdapter } from './csv.adapter';
import { RestApiAdapter } from './rest-api.adapter';

@Injectable()
export class AdapterRegistry {
  private readonly adapters: Map<string, ConnectorAdapter> = new Map();

  constructor(
    private readonly csvAdapter: CsvAdapter,
    private readonly restApiAdapter: RestApiAdapter,
  ) {
    // Register all adapters here
    this.adapters.set('csv', this.csvAdapter);
    this.adapters.set('rest_api', this.restApiAdapter);
    // Future: this.adapters.set('mysql', this.mysqlAdapter);
    // Future: this.adapters.set('nhima', this.nhimaAdapter);
  }

  getAdapter(type: string): ConnectorAdapter {
    const adapter = this.adapters.get(type);
    if (!adapter) {
      throw new Error(`No adapter registered for type: ${type}`);
    }
    return adapter;
  }

  getSupportedTypes(): string[] {
    return Array.from(this.adapters.keys());
  }
}