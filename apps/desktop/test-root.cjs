const path = require('path');
const fs = require('fs');

function findGitRoot(startDir) {
  let dir = startDir;
  for (let i = 0; i < 50; i++) {
    try {
      if (fs.existsSync(path.join(dir, '.git'))) {
        return dir;
      }
    } catch {
      return null;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

const root = findGitRoot('D:\\School\\PROJECT\\anakot-agent\\apps\\desktop');
console.log('root:', JSON.stringify(root));

// Now test path.join with this root
const filePath = 'apps/desktop/electron/main.cjs';
const fullPath = path.join(root, filePath);
console.log('fullPath:', fullPath);
console.log('exists:', fs.existsSync(fullPath));
