#!/usr/bin/env node
// Knowledge plane MCP — kb_search / kb_get only (no cookie, plan §2 A5).

import { applyKnowledgeEnvSanitize } from './kb/lib/kb-env.js';
applyKnowledgeEnvSanitize();

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { handleKbTool } from './kb/lib/kb-handlers.js';

const TOOLS = [
  {
    name: 'kb_search',
    description:
      'Search local product knowledge corpus (policy, Obsidian synthesis). Not for live BV/price/cart — use unfranchaise-MCP.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', minimum: 1, maximum: 20 },
      },
      required: ['query'],
    },
  },
  {
    name: 'kb_get',
    description: 'Fetch a knowledge chunk by chunk_id from local corpus.',
    inputSchema: {
      type: 'object',
      properties: {
        chunk_id: { type: 'string' },
      },
      required: ['chunk_id'],
    },
  },
];

const server = new Server({ name: 'unfranchaise-kb', version: '0.1.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  try {
  const result = await handleKbTool(name, args);
  return { content: [{ type: 'text', text: result.text }], isError: result.isError };
  } catch (err) {
    return {
      content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);