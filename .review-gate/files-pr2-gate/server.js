#!/usr/bin/env node
// stdio MCP — register in .cursor/mcp.json or Claude mcpServers:
// { "command": "node", "args": ["/Users/yauch/Documents/unfranchaise/server.js"] }

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { TOOL_DEFINITIONS, callTool } from './lib/tools.js';

const server = new Server(
  { name: 'unfranchaise-hk', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOL_DEFINITIONS,
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  return callTool(req.params.name, req.params.arguments ?? {});
});

const transport = new StdioServerTransport();
await server.connect(transport);
