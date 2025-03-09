# Redash MCP Server

Model Context Protocol (MCP) server for integrating Redash with AI assistants like Claude.

## Features

- Connect to Redash instances via the Redash API
- List available queries and dashboards as resources
- Execute queries and retrieve results
- Create visualizations of query results
- Get dashboard details and visualizations

## Prerequisites

- Node.js (v18 or later)
- npm or yarn
- Access to a Redash instance
- Redash API key

## Installation

1. Clone this repository
2. Install dependencies: `npm install`
3. Create a `.env` file with your Redash configuration (see `.env.example`)
4. Build the project: `npm run build`
5. Start the server: `npm start`

## Direct Usage with npx

After the package is published to NPM, you can run it directly with npx without installing it globally:

```bash
# Using environment variables directly
REDASH_URL=https://your-redash-instance.com REDASH_API_KEY=your_key npx @suthio/redash-mcp

# Or using a .env file in current directory
# Create a .env file first, then:
npx @suthio/redash-mcp
```

## Usage with Claude

After installing the package globally or publishing it to NPM, you can configure Claude for Desktop to use this MCP server by adding it to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "redash": {
      "command": "npx",
      "args": ["-y", "@suthio/redash-mcp"],
      "env": {
        "REDASH_API_KEY": "your-api-key",
        "REDASH_URL": "https://your-redash-instance.com"
      }
    }
  }
}
```

If you're running from a local build instead of NPM, you can configure it like this:

```json
{
  "mcpServers": {
    "redash": {
      "command": "node",
      "args": ["/path/to/redash-mcp/dist/index.js"],
      "env": {
        "REDASH_API_KEY": "your-api-key",
        "REDASH_URL": "https://your-redash-instance.com"
      }
    }
  }
}
```

## Available Tools

- `list-queries`: List all available queries
- `execute-query`: Execute a query and return results
- `list-dashboards`: List all available dashboards
- `get-dashboard`: Get dashboard details and visualizations
- `get-visualization`: Get visualization details for a query

## Development

Run in development mode: `npm run dev`

## Publishing to NPM

To publish the package to NPM:

1. Create an NPM account if you don't have one: https://www.npmjs.com/signup
2. Login to NPM from the command line: `npm login`
3. Build the package: `npm run build`
4. Publish the package: `npm publish --access public`

After publishing, the package can be executed directly with npx:

```bash
npx @suthio/redash-mcp
```

Or installed globally:

```bash
npm install -g @suthio/redash-mcp
redash-mcp
```

## License

MIT
