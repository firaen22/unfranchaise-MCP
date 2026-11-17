#!/usr/bin/env node
import { applyKnowledgeEnvSanitize } from './lib/kb-env.js';

applyKnowledgeEnvSanitize();

import { ingestObsidianAllowlist } from './ingest/obsidian.js';
import { ingestManualChapters04 } from './ingest/manual-chapters.js';
import { handleKbTool } from './lib/kb-handlers.js';
import { rebuildIndex } from './lib/index-db.js';
import { getCorpusRoot } from './lib/paths.js';

const [cmd, ...rest] = process.argv.slice(2);

async function main() {
  switch (cmd) {
    case 'ingest-obsidian': {
      const stats = await ingestObsidianAllowlist();
      console.log(JSON.stringify(stats, null, 2));
      break;
    }
    case 'ingest-manuals': {
      const stats = await ingestManualChapters04();
      console.log(JSON.stringify(stats, null, 2));
      break;
    }
    case 'reindex': {
      const stats = await rebuildIndex(getCorpusRoot());
      console.log(JSON.stringify(stats, null, 2));
      break;
    }
    case 'search': {
      const query = rest.join(' ').trim();
      if (!query) {
        console.error('usage: kb search <query>');
        process.exit(2);
      }
      const op = process.env.UNF_KB_OP_CONTEXT ?? '';
      const result = await handleKbTool('kb_search', { query, limit: 8 }, { operationalContext: op });
      if (result.isError) {
        console.error(result.text);
        process.exit(1);
      }
      console.log(result.text);
      break;
    }
    case 'get': {
      const id = rest[0];
      if (!id) {
        console.error('usage: kb get <chunk_id>');
        process.exit(2);
      }
      const op = process.env.UNF_KB_OP_CONTEXT ?? '';
      const result = await handleKbTool('kb_get', { chunk_id: id }, { operationalContext: op });
      if (result.isError) {
        console.error(result.text);
        process.exit(1);
      }
      console.log(result.text);
      break;
    }
    default:
      console.error(`usage: kb <ingest-obsidian|ingest-manuals|reindex|search|get> ...`);
      process.exit(2);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});