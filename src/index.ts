#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { 
  ListToolsRequestSchema, 
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import * as dotenv from 'dotenv';
import { redashClient, CreateQueryRequest, UpdateQueryRequest } from "./redashClient.js";
import { logger, LogLevel } from "./logger.js";

// Load environment variables
dotenv.config();

// Create MCP server instance
const server = new Server(
  {
    name: "redash-mcp",
    version: "1.1.0"
  },
  {
    capabilities: {
      tools: {},
      resources: {}
    }
  }
);

// Set up server logging
logger.info('Starting Redash MCP server...');

// ----- Tools Implementation -----

// Tool: get-query
const getQuerySchema = z.object({
  queryId: z.number()
});

async function getQuery(params: z.infer<typeof getQuerySchema>) {
  try {
    const { queryId } = params;
    const query = await redashClient.getQuery(queryId);
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(query, null, 2)
        }
      ]
    };
  } catch (error) {
    logger.error(`Error getting query ${params.queryId}: ${error}`);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error getting query ${params.queryId}: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
}

// Tool: create-query
const createQuerySchema = z.object({
  name: z.string(),
  data_source_id: z.number(),
  query: z.string(),
  description: z.string().optional(),
  options: z.any().optional(),
  schedule: z.any().optional(),
  tags: z.array(z.string()).optional()
});

async function createQuery(params: z.infer<typeof createQuerySchema>) {
  try {
    logger.debug(`Create query params: ${JSON.stringify(params)}`);
    
    // Convert params to CreateQueryRequest with proper defaults
    const queryData: CreateQueryRequest = {
      name: params.name,
      data_source_id: params.data_source_id,
      query: params.query,
      description: params.description || '',
      options: params.options || {},
      schedule: params.schedule || null,
      tags: params.tags || []
    };
    
    logger.debug(`Calling redashClient.createQuery with data: ${JSON.stringify(queryData)}`);
    const result = await redashClient.createQuery(queryData);
    logger.debug(`Create query result: ${JSON.stringify(result)}`);
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    logger.error(`Error creating query: ${error instanceof Error ? error.message : String(error)}`);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error creating query: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
}

// Tool: update-query
const updateQuerySchema = z.object({
  queryId: z.number(),
  name: z.string().optional(),
  data_source_id: z.number().optional(),
  query: z.string().optional(),
  description: z.string().optional(),
  options: z.any().optional(),
  schedule: z.any().optional(),
  tags: z.array(z.string()).optional(),
  is_archived: z.boolean().optional(),
  is_draft: z.boolean().optional()
});

async function updateQuery(params: z.infer<typeof updateQuerySchema>) {
  try {
    const { queryId, ...updateData } = params;
    
    logger.debug(`Update query ${queryId} params: ${JSON.stringify(updateData)}`);
    
    // Convert params to UpdateQueryRequest - only include non-undefined fields
    const queryData: UpdateQueryRequest = {};
    
    // Only add fields that are defined
    if (updateData.name !== undefined) queryData.name = updateData.name;
    if (updateData.data_source_id !== undefined) queryData.data_source_id = updateData.data_source_id;
    if (updateData.query !== undefined) queryData.query = updateData.query;
    if (updateData.description !== undefined) queryData.description = updateData.description;
    if (updateData.options !== undefined) queryData.options = updateData.options;
    if (updateData.schedule !== undefined) queryData.schedule = updateData.schedule;
    if (updateData.tags !== undefined) queryData.tags = updateData.tags;
    if (updateData.is_archived !== undefined) queryData.is_archived = updateData.is_archived;
    if (updateData.is_draft !== undefined) queryData.is_draft = updateData.is_draft;
    
    logger.debug(`Calling redashClient.updateQuery with data: ${JSON.stringify(queryData)}`);
    const result = await redashClient.updateQuery(queryId, queryData);
    logger.debug(`Update query result: ${JSON.stringify(result)}`);
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    logger.error(`Error updating query ${params.queryId}: ${error instanceof Error ? error.message : String(error)}`);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error updating query ${params.queryId}: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
}

// Tool: archive-query
const archiveQuerySchema = z.object({
  queryId: z.number()
});

async function archiveQuery(params: z.infer<typeof archiveQuerySchema>) {
  try {
    const { queryId } = params;
    const result = await redashClient.archiveQuery(queryId);
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    logger.error(`Error archiving query ${params.queryId}: ${error}`);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error archiving query ${params.queryId}: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
}

// Tool: list-data-sources
async function listDataSources() {
  try {
    const dataSources = await redashClient.getDataSources();
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(dataSources, null, 2)
        }
      ]
    };
  } catch (error) {
    logger.error(`Error listing data sources: ${error}`);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error listing data sources: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
}

// Tool: list-queries
const listQueriesSchema = z.object({
  page: z.number().optional().default(1),
  pageSize: z.number().optional().default(25)
});

async function listQueries(params: z.infer<typeof listQueriesSchema>) {
  try {
    const { page, pageSize } = params;
    const queries = await redashClient.getQueries(page, pageSize);
    
    logger.debug(`Listed ${queries.results.length} queries`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(queries, null, 2)
        }
      ]
    };
  } catch (error) {
    logger.error(`Error listing queries: ${error}`);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error listing queries: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
}

// Tool: execute-query
const executeQuerySchema = z.object({
  queryId: z.number(),
  parameters: z.record(z.any()).optional()
});

async function executeQuery(params: z.infer<typeof executeQuerySchema>) {
  try {
    const { queryId, parameters } = params;
    const result = await redashClient.executeQuery(queryId, parameters);
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    console.error(`Error executing query ${params.queryId}:`, error);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error executing query ${params.queryId}: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
}

// Tool: list-dashboards
const listDashboardsSchema = z.object({
  page: z.number().optional().default(1),
  pageSize: z.number().optional().default(25)
});

async function listDashboards(params: z.infer<typeof listDashboardsSchema>) {
  try {
    const { page, pageSize } = params;
    const dashboards = await redashClient.getDashboards(page, pageSize);
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(dashboards, null, 2)
        }
      ]
    };
  } catch (error) {
    console.error('Error listing dashboards:', error);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error listing dashboards: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
}

// Tool: get-dashboard
const getDashboardSchema = z.object({
  dashboardId: z.number()
});

async function getDashboard(params: z.infer<typeof getDashboardSchema>) {
  try {
    const { dashboardId } = params;
    const dashboard = await redashClient.getDashboard(dashboardId);
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(dashboard, null, 2)
        }
      ]
    };
  } catch (error) {
    console.error(`Error getting dashboard ${params.dashboardId}:`, error);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error getting dashboard ${params.dashboardId}: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
}

// Tool: get-visualization
const getVisualizationSchema = z.object({
  visualizationId: z.number()
});

async function getVisualization(params: z.infer<typeof getVisualizationSchema>) {
  try {
    const { visualizationId } = params;
    const visualization = await redashClient.getVisualization(visualizationId);
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(visualization, null, 2)
        }
      ]
    };
  } catch (error) {
    console.error(`Error getting visualization ${params.visualizationId}:`, error);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error getting visualization ${params.visualizationId}: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
}

// ----- Resources Implementation -----

// List available resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  try {
    // List queries as resources
    const queries = await redashClient.getQueries(1, 100);
    const queryResources = queries.results.map(query => ({
      uri: `redash://query/${query.id}`,
      name: query.name,
      description: query.description || `Query ID: ${query.id}`
    }));

    // List dashboards as resources
    const dashboards = await redashClient.getDashboards(1, 100);
    const dashboardResources = dashboards.results.map(dashboard => ({
      uri: `redash://dashboard/${dashboard.id}`,
      name: dashboard.name,
      description: `Dashboard ID: ${dashboard.id}`
    }));

    return {
      resources: [...queryResources, ...dashboardResources]
    };
  } catch (error) {
    console.error('Error listing resources:', error);
    return {
      resources: []
    };
  }
});

// Read resource content
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  
  try {
    const match = uri.match(/^redash:\/\/(query|dashboard)\/(\d+)$/);
    
    if (!match) {
      throw new Error(`Invalid resource URI: ${uri}`);
    }
    
    const [, type, id] = match;
    const resourceId = parseInt(id, 10);
    
    if (type === 'query') {
      const query = await redashClient.getQuery(resourceId);
      const result = await redashClient.executeQuery(resourceId);
      
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify({
              query: query,
              result: result
            }, null, 2)
          }
        ]
      };
    } else if (type === 'dashboard') {
      const dashboard = await redashClient.getDashboard(resourceId);
      
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(dashboard, null, 2)
          }
        ]
      };
    }
    
    throw new Error(`Unsupported resource type: ${type}`);
  } catch (error) {
    console.error(`Error reading resource ${uri}:`, error);
    throw error;
  }
});

// ----- Register Tools -----
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list-queries",
        description: "List all available queries in Redash",
        inputSchema: {
          type: "object",
          properties: {
            page: { type: "number", description: "Page number (starts at 1)" },
            pageSize: { type: "number", description: "Number of results per page" }
          }
        }
      },
      {
        name: "get-query",
        description: "Get details of a specific query",
        inputSchema: {
          type: "object",
          properties: {
            queryId: { type: "number", description: "ID of the query to get" }
          },
          required: ["queryId"]
        }
      },
      {
        name: "create-query",
        description: "Create a new query in Redash",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Name of the query" },
            data_source_id: { type: "number", description: "ID of the data source to use" },
            query: { type: "string", description: "SQL query text" },
            description: { type: "string", description: "Description of the query" },
            options: { type: "object", description: "Query options" },
            schedule: { type: "object", description: "Query schedule" },
            tags: { type: "array", items: { type: "string" }, description: "Tags for the query" }
          },
          required: ["name", "data_source_id", "query"]
        }
      },
      {
        name: "update-query",
        description: "Update an existing query in Redash",
        inputSchema: {
          type: "object",
          properties: {
            queryId: { type: "number", description: "ID of the query to update" },
            name: { type: "string", description: "New name of the query" },
            data_source_id: { type: "number", description: "ID of the data source to use" },
            query: { type: "string", description: "SQL query text" },
            description: { type: "string", description: "Description of the query" },
            options: { type: "object", description: "Query options" },
            schedule: { type: "object", description: "Query schedule" },
            tags: { type: "array", items: { type: "string" }, description: "Tags for the query" },
            is_archived: { type: "boolean", description: "Whether the query is archived" },
            is_draft: { type: "boolean", description: "Whether the query is a draft" }
          },
          required: ["queryId"]
        }
      },
      {
        name: "archive-query",
        description: "Archive (soft-delete) a query in Redash",
        inputSchema: {
          type: "object",
          properties: {
            queryId: { type: "number", description: "ID of the query to archive" }
          },
          required: ["queryId"]
        }
      },
      {
        name: "list-data-sources",
        description: "List all available data sources in Redash",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "execute-query",
        description: "Execute a Redash query and return results",
        inputSchema: {
          type: "object",
          properties: {
            queryId: { type: "number", description: "ID of the query to execute" },
            parameters: { 
              type: "object", 
              description: "Parameters to pass to the query (if any)",
              additionalProperties: true
            }
          },
          required: ["queryId"]
        }
      },
      {
        name: "list-dashboards",
        description: "List all available dashboards in Redash",
        inputSchema: {
          type: "object",
          properties: {
            page: { type: "number", description: "Page number (starts at 1)" },
            pageSize: { type: "number", description: "Number of results per page" }
          }
        }
      },
      {
        name: "get-dashboard",
        description: "Get details of a specific dashboard",
        inputSchema: {
          type: "object",
          properties: {
            dashboardId: { type: "number", description: "ID of the dashboard to get" }
          },
          required: ["dashboardId"]
        }
      },
      {
        name: "get-visualization",
        description: "Get details of a specific visualization",
        inputSchema: {
          type: "object",
          properties: {
            visualizationId: { type: "number", description: "ID of the visualization to get" }
          },
          required: ["visualizationId"]
        }
      }
    ]
  };
});

// Handle tool execution requests
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  logger.debug(`Tool request received: ${name} with args: ${JSON.stringify(args)}`);
  
  try {
    // 最初に型チェック用の事前検証を行い、想定されたスキーマと一致しない場合のエラーを早期に補足する
    // これにより、例えば create-query と execute-query のような似た名前のツール間の混同を防ぐ
    if (name === "create-query") {
      try {
        logger.debug(`Validating create-query schema`);
        const validatedArgs = createQuerySchema.parse(args);
        logger.debug(`Schema validation passed for create-query: ${JSON.stringify(validatedArgs)}`);
        return await createQuery(validatedArgs);
      } catch (validationError) {
        logger.error(`Schema validation failed for create-query: ${validationError}`);
        return {
          isError: true,
          content: [{
            type: "text",
            text: `Invalid parameters for create-query: ${validationError instanceof Error ? validationError.message : String(validationError)}`
          }]
        };
      }
    } else if (name === "update-query") {
      try {
        logger.debug(`Validating update-query schema`);
        const validatedArgs = updateQuerySchema.parse(args);
        logger.debug(`Schema validation passed for update-query: ${JSON.stringify(validatedArgs)}`);
        return await updateQuery(validatedArgs);
      } catch (validationError) {
        logger.error(`Schema validation failed for update-query: ${validationError}`);
        return {
          isError: true,
          content: [{
            type: "text",
            text: `Invalid parameters for update-query: ${validationError instanceof Error ? validationError.message : String(validationError)}`
          }]
        };
      }
    }

    // 他のツールのための switch 文
    switch (name) {
      case "list-queries":
        logger.debug(`Handling list-queries`);
        return await listQueries(listQueriesSchema.parse(args));
      
      case "get-query":
        logger.debug(`Handling get-query`);
        return await getQuery(getQuerySchema.parse(args));

      // create-query と update-query は上の if-else で処理済み

      case "archive-query":
        logger.debug(`Handling archive-query`);
        return await archiveQuery(archiveQuerySchema.parse(args));

      case "list-data-sources":
        logger.debug(`Handling list-data-sources`);
        return await listDataSources();
      
      case "execute-query":
        logger.debug(`Handling execute-query`);
        return await executeQuery(executeQuerySchema.parse(args));
      
      case "list-dashboards":
        logger.debug(`Handling list-dashboards`);
        return await listDashboards(listDashboardsSchema.parse(args));
      
      case "get-dashboard":
        logger.debug(`Handling get-dashboard`);
        return await getDashboard(getDashboardSchema.parse(args));
      
      case "get-visualization":
        logger.debug(`Handling get-visualization`);
        return await getVisualization(getVisualizationSchema.parse(args));
      
      default:
        logger.error(`Unknown tool requested: ${name}`);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Unknown tool: ${name}`
            }
          ]
        };
    }
  } catch (error) {
    logger.error(`Error executing tool ${name}: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof z.ZodError) {
      logger.error(`Validation error details: ${JSON.stringify(error.errors)}`);
    }
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error executing tool ${name}: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
});

// Start the server with stdio transport
async function main() {
  try {
    const transport = new StdioServerTransport();
    
    logger.info("Starting Redash MCP server...");
    await server.connect(transport);
    logger.setServer(server);
    logger.info("Redash MCP server connected!");
  } catch (error) {
    logger.error(`Failed to start server: ${error}`);
    process.exit(1);
  }
}

main();
