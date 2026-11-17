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
import { KB_TOOL_DEFINITIONS } from './kb/lib/kb-tool-defs.js';

const server = new Server({ name: 'unfranchaise-kb', version: '0.1.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: KB_TOOL_DEFINITIONS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  const operationalContext = process.env.UNF_KB_OP_CONTEXT ?? '';
  try {
  const result = await handleKbTool(name, args, { operationalContext });
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