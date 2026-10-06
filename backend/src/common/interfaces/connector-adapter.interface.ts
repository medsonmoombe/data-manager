export interface ConnectorFetchResult {
  records: Record<string, any>[];   // array of raw data rows
  totalFetched: number;
}

export interface ConnectorAdapter {
  /**
   * Fetch data from the source.
   * @param config - Connection configuration (decrypted)
   * @param params - Optional query params (last run date, filters)
   */
  fetch(config: Record<string, any>, params?: Record<string, any>): Promise<ConnectorFetchResult>;

  /**
   * Test the connection without fetching data.
   * @param config - Connection configuration
   */
  testConnection(config: Record<string, any>): Promise<boolean>;
}