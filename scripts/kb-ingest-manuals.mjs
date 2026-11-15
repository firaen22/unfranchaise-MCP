#!/usr/bin/env node
import { ingestManualChapters04 } from '../kb/ingest/manual-chapters.js';

const stats = await ingestManualChapters04();
console.log(JSON.stringify(stats, null, 2));