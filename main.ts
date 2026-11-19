// Leonida Platinum — entrypoint.
//
// This program packages the trophy guide web app for grading. It copies
// the app folder and the screenshots folder into an output directory, counts
// what it copied, and asks the vendored make.fun library to build the
// dossier file that describes the whole entry. It only uses the Node
// standard library, and it never touches the network.

import { buildDossier } from './vendor/makefun-frontend.ts';
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The repository root is the folder that holds this file.
const repoRoot = dirname(fileURLToPath(import.meta.url));

// The grader tells us where to put the output; locally we default to /output.
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

type Totals = { files: number; bytes: number };

function copyTree(fromDir: string, toDir: string): Totals {
  const totals: Totals = { files: 0, bytes: 0 };
  mkdirSync(toDir, { recursive: true });
  for (const entry of readdirSync(fromDir, { withFileTypes: true })) {
    const from = join(fromDir, entry.name);
    const to = join(toDir, entry.name);
    if (entry.isDirectory()) {
      const sub = copyTree(from, to);
      totals.files += sub.files;
      totals.bytes += sub.bytes;
    } else if (entry.isFile()) {
      copyFileSync(from, to);
      totals.files += 1;
      totals.bytes += statSync(from).size;
    }
  }
  return totals;
}

mkdirSync(outDir, { recursive: true });

const appDir = join(repoRoot, 'app');
if (!existsSync(join(appDir, 'index.html'))) {
  console.error('error: app/index.html is missing — the app folder is not a complete static app');
  process.exit(1);
}

const appTotals = copyTree(appDir, join(outDir, 'app'));

let shotTotals: Totals = { files: 0, bytes: 0 };
const shotsDir = join(repoRoot, 'screenshots');
if (existsSync(shotsDir)) {
  shotTotals = copyTree(shotsDir, join(outDir, 'screenshots'));
}

console.log(
  `copied app: ${appTotals.files} files, ${appTotals.bytes} bytes; ` +
    `screenshots: ${shotTotals.files} files, ${shotTotals.bytes} bytes`,
);

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});

writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`wrote dossier.json (${dossier.length} bytes) to ${outDir}`);
