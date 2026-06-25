const path = require('path');
const fs = require('fs');

const root = 'D:\\School\\PROJECT\\anakot-agent';
const files = [
  'apps/desktop/electron/main.cjs',
  'apps/desktop/electron/preload.cjs',
  'apps/desktop/src/components/workbench/GitSourceControl.tsx',
  'apps/desktop/src/store/git.ts',
];

for (const f of files) {
  const fullPath = path.join(root, f);
  console.log(f, '->', fs.existsSync(fullPath));
}
