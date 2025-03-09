import axios, { AxiosInstance } from 'axios';
import * as dotenv from 'dotenv';
import { logger } from './logger.js';

dotenv.config();

// Redash API types
export interface RedashQuery {
  id: number;
  name: string;
  description: string;
  query: string;
  data_source_id: number;
  latest_query_data_id: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  runtime: number;
  options: any;
  visualizations: RedashVisualization[];
}

// New interfaces for query creation and update
export interface CreateQueryRequest {
  name: string;
  data_source_id: number;
  query: string;
  description?: string;
  options?: any;
  schedule?: any;
  tags?: string[];
}

export interface UpdateQueryRequest {
  name?: string;
  data_source_id?: number;
  query?: string;
  description?: string;
  options?: any;
  schedule?: any;
  tags?: string[];
  is_archived?: boolean;
  is_draft?: boolean;
}

export interface RedashVisualization {
  id: number;
  type: string;
  name: string;
  description: string;
  options: any;
  query_id: number;
}

export interface RedashQueryResult {
  id: number;
  query_id: number;
  data_source_id: number;
  query_hash: string;
  query: string;
  data: {
    columns: Array<{ name: string; type: string; friendly_name: string }>;
    rows: Array<Record<string, any>>;
  };
  runtime: number;
  retrieved_at: string;
}

export interface RedashDashboard {
  id: number;
  name: string;
  slug: string;
  tags: string[];
  is_archived: boolean;
  is_draft: boolean;
  created_at: string;
  updated_at: string;
  version: number;
  dashboard_filters_enabled: boolean;
  widgets: Array<{
    id: number;
    visualization?: {
      id: number;
      type: string;
      name: string;
      description: string;
      options: any;
      query_id: number;
    };
    text?: string;
    width: number;
    options: any;
    dashboard_id: number;
  }>;
}

// RedashClient class for API communication
export class RedashClient {
  private client: AxiosInstance;
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.REDASH_URL || '';
    this.apiKey = process.env.REDASH_API_KEY || '';
    
    if (!this.baseUrl || !this.apiKey) {
      throw new Error('REDASH_URL and REDASH_API_KEY must be provided in .env file');
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Key ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: parseInt(process.env.REDASH_TIMEOUT || '30000')
    });
  }

  // Get all queries (with pagination)
  async getQueries(page = 1, pageSize = 25): Promise<{ count: number; page: number; pageSize: number; results: RedashQuery[] }> {
    try {
      const response = await this.client.get('/api/queries', {
        params: { page, page_size: pageSize }
      });
      
      return {
        count: response.data.count,
        page: response.data.page,
        pageSize: response.data.page_size,
        results: response.data.results
      };
    } catch (error) {
      logger.error(`Error fetching queries: ${error}`);
      throw new Error('Failed to fetch queries from Redash');
    }
  }

  // Get a specific query by ID
  async getQuery(queryId: number): Promise<RedashQuery> {
    try {
      const response = await this.client.get(`/api/queries/${queryId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching query ${queryId}:`, error);
      throw new Error(`Failed to fetch query ${queryId} from Redash`);
    }
  }

  // Create a new query
  async createQuery(queryData: CreateQueryRequest): Promise<RedashQuery> {
    try {
      logger.info(`Creating new query: ${JSON.stringify(queryData)}`);
      logger.info(`Sending request to: ${this.baseUrl}/api/queries`);
      
      try {
        // Ensure we're passing the exact parameters the Redash API expects
        const requestData = {
          name: queryData.name,
          data_source_id: queryData.data_source_id,
          query: queryData.query,
          description: queryData.description || '',
          options: queryData.options || {},
          schedule: queryData.schedule || null,
          tags: queryData.tags || []
        };
        
        logger.info(`Request data: ${JSON.stringify(requestData)}`);
        logger.info(`Request headers: ${JSON.stringify(this.client.defaults.headers)}`);
        const response = await this.client.post('/api/queries', requestData);
        logger.info(`Created query with ID: ${response.data.id}`);
        return response.data;
      } catch (axiosError: any) {
        // Log detailed axios error information
        logger.error(`Axios error in createQuery - Status: ${axiosError.response?.status || 'unknown'}`);
        logger.error(`Response data: ${JSON.stringify(axiosError.response?.data || {}, null, 2)}`);
        logger.error(`Request config: ${JSON.stringify({
          url: axiosError.config?.url,
          method: axiosError.config?.method,
          headers: axiosError.config?.headers,
          data: axiosError.config?.data
        }, null, 2)}`);
        
        if (axiosError.response) {
          throw new Error(`Redash API error (${axiosError.response.status}): ${JSON.stringify(axiosError.response.data)}`);
        } else if (axiosError.request) {
          throw new Error(`No response received from Redash API: ${axiosError.message}`);
        } else {
          throw axiosError;
        }
      }
    } catch (error) {
      logger.error(`Error creating query: ${error instanceof Error ? error.message : String(error)}`);
      logger.error(`Stack trace: ${error instanceof Error && error.stack ? error.stack : 'No stack trace available'}`);
      throw new Error(`Failed to create query: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Update an existing query
  async updateQuery(queryId: number, queryData: UpdateQueryRequest): Promise<RedashQuery> {
    try {
      logger.debug(`Updating query ${queryId}: ${JSON.stringify(queryData)}`);
      
      try {
        // Construct a request payload with only the fields we want to update
        const requestData: Record<string, any> = {};
        
        if (queryData.name !== undefined) requestData.name = queryData.name;
        if (queryData.data_source_id !== undefined) requestData.data_source_id = queryData.data_source_id;
        if (queryData.query !== undefined) requestData.query = queryData.query;
        if (queryData.description !== undefined) requestData.description = queryData.description;
        if (queryData.options !== undefined) requestData.options = queryData.options;
        if (queryData.schedule !== undefined) requestData.schedule = queryData.schedule;
        if (queryData.tags !== undefined) requestData.tags = queryData.tags;
        if (queryData.is_archived !== undefined) requestData.is_archived = queryData.is_archived;
        if (queryData.is_draft !== undefined) requestData.is_draft = queryData.is_draft;
        
        logger.debug(`Request data for update: ${JSON.stringify(requestData)}`);
        const response = await this.client.post(`/api/queries/${queryId}`, requestData);
        logger.debug(`Updated query ${queryId}`);
        return response.data;
      } catch (axiosError: any) {
        // Log detailed axios error information
        logger.error(`Axios error in updateQuery - Status: ${axiosError.response?.status || 'unknown'}`);
        logger.error(`Response data: ${JSON.stringify(axiosError.response?.data || {}, null, 2)}`);
        logger.error(`Request config: ${JSON.stringify({
          url: axiosError.config?.url,
          method: axiosError.config?.method,
          headers: axiosError.config?.headers,
          data: axiosError.config?.data
        }, null, 2)}`);
        
        if (axiosError.response) {
          throw new Error(`Redash API error (${axiosError.response.status}): ${JSON.stringify(axiosError.response.data)}`);
        } else if (axiosError.request) {
          throw new Error(`No response received from Redash API: ${axiosError.message}`);
        } else {
          throw axiosError;
        }
      }
    } catch (error) {
      logger.error(`Error updating query ${queryId}: ${error}`);
      throw new Error(`Failed to update query ${queryId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Archive (soft delete) a query
  async archiveQuery(queryId: number): Promise<{ success: boolean }> {
    try {
      logger.debug(`Archiving query ${queryId}`);
      await this.client.delete(`/api/queries/${queryId}`);
      logger.debug(`Archived query ${queryId}`);
      return { success: true };
    } catch (error) {
      logger.error(`Error archiving query ${queryId}: ${error}`);
      throw new Error(`Failed to archive query ${queryId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // List available data sources
  async getDataSources(): Promise<any[]> {
    try {
      const response = await this.client.get('/api/data_sources');
      return response.data;
    } catch (error) {
      logger.error(`Error fetching data sources: ${error}`);
      throw new Error('Failed to fetch data sources from Redash');
    }
  }

  // Execute a query and return results
  async executeQuery(queryId: number, parameters?: Record<string, any>): Promise<RedashQueryResult> {
    try {
      const response = await this.client.post(`/api/queries/${queryId}/results`, { parameters });
      
      if (response.data.job) {
        // Query is being executed asynchronously, poll for results
        return await this.pollQueryResults(response.data.job.id);
      }
      
      return response.data;
    } catch (error) {
      console.error(`Error executing query ${queryId}:`, error);
      throw new Error(`Failed to execute query ${queryId}`);
    }
  }

  // Poll for query execution results
  private async pollQueryResults(jobId: string, timeout = 60000, interval = 1000): Promise<RedashQueryResult> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const response = await this.client.get(`/api/jobs/${jobId}`);
        
        if (response.data.job.status === 3) { // Completed
          return response.data.job.result;
        } else if (response.data.job.status === 4) { // Error
          throw new Error(`Query execution failed: ${response.data.job.error}`);
        }
        
        // Wait for the next poll
        await new Promise(resolve => setTimeout(resolve, interval));
      } catch (error) {
        console.error(`Error polling for query results (job ${jobId}):`, error);
        throw new Error(`Failed to poll for query results (job ${jobId})`);
      }
    }
    
    throw new Error(`Query execution timed out after ${timeout}ms`);
  }

  // Get all dashboards
  async getDashboards(page = 1, pageSize = 25): Promise<{ count: number; page: number; pageSize: number; results: RedashDashboard[] }> {
    try {
      const response = await this.client.get('/api/dashboards', {
        params: { page, page_size: pageSize }
      });
      
      return {
        count: response.data.count,
        page: response.data.page,
        pageSize: response.data.page_size,
        results: response.data.results
      };
    } catch (error) {
      console.error('Error fetching dashboards:', error);
      throw new Error('Failed to fetch dashboards from Redash');
    }
  }

  // Get a specific dashboard by ID
  async getDashboard(dashboardId: number): Promise<RedashDashboard> {
    try {
      const response = await this.client.get(`/api/dashboards/${dashboardId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching dashboard ${dashboardId}:`, error);
      throw new Error(`Failed to fetch dashboard ${dashboardId} from Redash`);
    }
  }

  // Get a specific visualization by ID
  async getVisualization(visualizationId: number): Promise<RedashVisualization> {
    try {
      const response = await this.client.get(`/api/visualizations/${visualizationId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching visualization ${visualizationId}:`, error);
      throw new Error(`Failed to fetch visualization ${visualizationId} from Redash`);
    }
  }
}

// Export a singleton instance
export const redashClient = new RedashClient();
