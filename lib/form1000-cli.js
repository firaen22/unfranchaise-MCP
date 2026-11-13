import { formatForm1000Report, optimiseForm1000 } from './form1000-optimise.js';
import { loadSheetFromFile } from './form1000-sheet.js';
import {
  formatQuartersReport,
  quarterWindowFromQuarterDate,
  readQuartersDocument,
  recordQuarter,
} from './form1000-quarters.js';

export function runForm1000OptimiseCli(argv) {
  const sheetPath = argv[0];
  if (!sheetPath || sheetPath === '-h' || sheetPath === '--help' || argv.length !== 1) {
    console.error('Usage: unfranchaise form1000-optimise <sheet.csv>');
    return 2;
  }
  try {
    const result = optimiseForm1000(loadSheetFromFile(sheetPath));
    console.log(formatForm1000Report(result));
    return 0;
  } catch (error) {
    console.error(error.message ?? String(error));
    return 1;
  }
}

export function runForm1000QuartersCli(argv) {
  const [sub, ...rest] = argv;
  try {
    if (sub === 'read') {
      if (rest.length > 1) throw new Error('Usage: unfranchaise form1000-quarters read [quarters.json]');
      console.log(formatQuartersReport(readQuartersDocument(rest[0])));
      return 0;
    }
    if (sub === 'record') {
      const quarterDate = rest[0];
      if (!quarterDate || quarterDate.startsWith('-')) {
        console.error('Usage: unfranchaise form1000-quarters record <DD/MM/YYYY-DD/MM/YYYY> [--out quarters.json]');
        return 2;
      }
      let outPath = null;
      for (let i = 1; i < rest.length; i++) {
        if (rest[i] === '--out') {
          outPath = rest[i + 1];
          i += 1;
          continue;
        }
        throw new Error('Usage: unfranchaise form1000-quarters record <DD/MM/YYYY-DD/MM/YYYY> [--out quarters.json]');
      }
      const window = quarterWindowFromQuarterDate(quarterDate);
      if (!outPath) {
        console.log(formatQuartersReport({ document: { example: false, quarters: [window] } }));
        console.log('Not saved (pass --out to write a local quarter file).');
        return 0;
      }
      recordQuarter(outPath, quarterDate);
      console.log(`Saved ${window.quarterDate}`);
      console.log(formatQuartersReport({ document: { example: false, quarters: [window] } }));
      return 0;
    }
  } catch (error) {
    console.error(error.message ?? String(error));
    return 1;
  }
  console.error(
    'Usage:\n  unfranchaise form1000-quarters read [quarters.json]\n  unfranchaise form1000-quarters record <DD/MM/YYYY-DD/MM/YYYY> [--out quarters.json]',
  );
  return 2;
}
