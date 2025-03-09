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
import { redashClient } from "./redashClient.js";
import { logger, LogLevel } from "./logger.js";

// Load environment variables
dotenv.config();

// Create MCP server instance
const server = new Server(
  {
    name: "redash-mcp",
    version: "1.0.0"
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
  
  try {
    switch (name) {
      case "list-queries":
        return await listQueries(listQueriesSchema.parse(args));
      
      case "execute-query":
        return await executeQuery(executeQuerySchema.parse(args));
      
      case "list-dashboards":
        return await listDashboards(listDashboardsSchema.parse(args));
      
      case "get-dashboard":
        return await getDashboard(getDashboardSchema.parse(args));
      
      case "get-visualization":
        return await getVisualization(getVisualizationSchema.parse(args));
      
      default:
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
    console.error(`Error executing tool ${name}:`, error);
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
