// Windows-safe postinstall for the anakot-agent monorepo.
//
// The previous inline form (`echo '...' && npm run dedupe-shiki 2>/dev/null || true`)
// is Unix syntax: under Windows cmd.exe, `2>/dev/null` and `|| true` make every
// root-level `npm install` exit 1 (observed in installer logs as "The system
// cannot find the path specified." / "'true' is not recognized"). A real .cjs
// file runs under node directly, so cmd never has to parse quotes, emoji,
// redirections, or `||` chains.
'use strict';

const fs = require('fs');
const path = require('path');

console.log('[OK] Browser tools ready. Run: python run_agent.py --help');

// Prune duplicated shiki bundles that @streamdown/code drags in (mirrors the
// old `npm run dedupe-shiki` step). Best-effort: missing dirs are fine.
const pruneTargets = [
  'node_modules/@streamdown/code/node_modules/shiki',
  'node_modules/@streamdown/code/node_modules/@shikijs',
];

for (const target of pruneTargets) {
  try {
    fs.rmSync(path.join(__dirname, '..', target), { recursive: true, force: true });
  } catch {
    // ignore
  }
}
