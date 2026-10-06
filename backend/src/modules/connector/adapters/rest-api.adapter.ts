import { Injectable, Logger } from '@nestjs/common';
import { ConnectorAdapter, ConnectorFetchResult } from '../../../common/interfaces/connector-adapter.interface';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

@Injectable()
export class RestApiAdapter implements ConnectorAdapter {
  private readonly logger = new Logger(RestApiAdapter.name);

  async fetch(config: Record<string, any>, params?: Record<string, any>): Promise<ConnectorFetchResult> {
    const {
      url,
      method = 'GET',
      headers = {},
      body,
      dataPath,
      pagination = {},
      auth = {},
      incrementalSync = {},
    } = config;

    if (!url) throw new Error('REST API adapter requires "url" in configuration');

    const allRecords: any[] = [];
    let hasMore = true;
    let currentPage = params?.page || 1;
    let cursor: string | null = params?.cursor || null;

    const authHeaders: Record<string, string> = {};
    if (auth.type === 'bearer') {
      authHeaders['Authorization'] = `Bearer ${auth.token}`;
    } else if (auth.type === 'basic') {
      const encoded = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
      authHeaders['Authorization'] = `Basic ${encoded}`;
    } else if (auth.type === 'api_key') {
      authHeaders[auth.headerName || 'X-API-Key'] = auth.apiKey;
    }

    const queryParams: Record<string, any> = {};
    if (incrementalSync.enabled && incrementalSync.field && params?.lastSyncAt) {
      queryParams[incrementalSync.queryParam || 'modified_since'] = params.lastSyncAt;
    }

    while (hasMore) {
      try {
        const requestConfig: AxiosRequestConfig = {
          url,
          method: method as any,
          headers: { ...headers, ...authHeaders },
          timeout: 30000,
          params: {
            ...queryParams,
            ...(pagination.type === 'page' ? { [pagination.pageParam || 'page']: currentPage } : {}),
            ...(pagination.type === 'offset' ? { [pagination.offsetParam || 'offset']: (currentPage - 1) * (pagination.limit || 100) } : {}),
            ...(pagination.type === 'cursor' && cursor ? { [pagination.cursorParam || 'cursor']: cursor } : {}),
          },
        };

        if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
          requestConfig.data = body;
        }

        this.logger.debug(`Fetching ${url} - page ${currentPage}`);

        const response: AxiosResponse = await axios(requestConfig);

        let pageData: any[] = [];
        let responseData = response.data;

        if (dataPath) {
          const paths = dataPath.split('.');
          for (const p of paths) {
            responseData = responseData?.[p];
          }
        }

        if (Array.isArray(responseData)) {
          pageData = responseData;
        } else if (responseData?.data && Array.isArray(responseData.data)) {
          pageData = responseData.data;
        } else if (responseData?.results && Array.isArray(responseData.results)) {
          pageData = responseData.results;
        } else if (responseData?.items && Array.isArray(responseData.items)) {
          pageData = responseData.items;
        } else if (responseData?.records && Array.isArray(responseData.records)) {
          pageData = responseData.records;
        } else {
          pageData = [responseData];
        }

        allRecords.push(...pageData);

        const totalPages = responseData?.total_pages || responseData?.pages || responseData?.meta?.totalPages;
        const totalCount = responseData?.total || responseData?.count || responseData?.meta?.total;
        const nextCursor = responseData?.next_cursor || responseData?.cursor || responseData?.meta?.nextCursor;
        const hasNextPage = responseData?.has_more || responseData?.hasMore || responseData?.meta?.hasMore;

        if (pagination.type === 'page' && totalPages) {
          hasMore = currentPage < totalPages;
        } else if (pagination.type === 'cursor' && nextCursor) {
          cursor = nextCursor;
          hasMore = true;
        } else if (pagination.type === 'offset' && totalCount) {
          hasMore = allRecords.length < totalCount;
        } else if (typeof hasNextPage === 'boolean') {
          hasMore = hasNextPage;
        } else {
          hasMore = pageData.length > 0 && currentPage < 100;
        }

        currentPage++;

        if (hasMore) {
          await this.delay(200);
        }
      } catch (error: any) {
        this.logger.error(`Failed to fetch page ${currentPage}:`, error.message);
        if (currentPage === 1 && allRecords.length === 0) {
          throw error;
        }
        hasMore = false;
      }
    }

    this.logger.log(`Fetched ${allRecords.length} total records from API`);

    return {
      records: allRecords,
      totalFetched: allRecords.length,
    };
  }

  async testConnection(config: Record<string, any>): Promise<boolean> {
    try {
      const { url, headers = {}, auth = {} } = config;
      if (!url) return false;

      const authHeaders: Record<string, string> = {};
      if (auth.type === 'bearer') {
        authHeaders['Authorization'] = `Bearer ${auth.token}`;
      }

      await axios.head(url, {
        headers: { ...headers, ...authHeaders },
        timeout: 10000,
      });
      return true;
    } catch {
      return false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
