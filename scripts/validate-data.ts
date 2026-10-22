// `npm run validate` — check src/data/*.json without a full build.
import fs from 'node:fs';
import { parseAll, hasPlaceholders } from '../src/data/schema.ts';

const files = ['trip', 'places', 'prices', 'phrases', 'banknotes', 'emergency'] as const;
const raw = Object.fromEntries(
  files.map((f) => {
    const path = `src/data/${f}.json`;
    try {
      return [f, JSON.parse(fs.readFileSync(path, 'utf8'))];
    } catch (e) {
      console.error(`\n${path} is not valid JSON: ${(e as Error).message}\n`);
      process.exit(1);
    }
  }),
) as Record<(typeof files)[number], unknown>;

try {
  parseAll(raw);
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
console.log(`Data OK.${hasPlaceholders(raw) ? ' (Placeholder entries remain — the banner will show.)' : ''}`);
