const WebSocket = require('ws');
const http = require('http');

const PORT = process.argv[2] || '9223';
const DURATION = parseInt(process.argv[3]) || 60;

function getTargets() {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${PORT}/json`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function main() {
  const targets = await getTargets();
  const page = targets.find(t => t.type === 'page');
  if (!page) { console.error('No page target'); process.exit(1); }
  
  console.log(`[CDP] Target: ${page.id}`);

  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/devtools/page/${page.id}`);
  let id = 1;
  const pending = new Map();
  const allMessages = [];

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = id++;
      pending.set(msgId, resolve);
      ws.send(JSON.stringify({ id: msgId, method, params }));
      setTimeout(() => {
        if (pending.has(msgId)) { pending.delete(msgId); reject(new Error(`Timeout: ${method}`)); }
      }, 15000);
    });
  }

  async function evaluate(expression, awaitPromise = false) {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
    if (r?.exceptionDetails) throw new Error(r.exceptionDetails.text || r.exceptionDetails.exception?.description);
    return r?.result?.value;
  }

  ws.on('open', async () => {
    console.log(`[CDP] Connected.`);
    await send('Runtime.enable');
    await send('Log.enable');

    // Wait for app to be ready
    await new Promise(r => setTimeout(r, 3000));

    // Step 1: Check if the auto-open effect fired
    console.log('\n--- Step 1: Check current state ---');
    const state = await evaluate(`
      JSON.stringify({
        hasMonaco: !!document.querySelector('.monaco-editor'),
        hasPreview: !!document.querySelector('[class*="preview"]'),
        bodyText: document.body.innerText.slice(0, 200)
      })
    `);
    console.log('State:', state);

    // Step 2: Try to manually trigger the preview
    console.log('\n--- Step 2: Manually trigger preview ---');
    try {
      const result = await evaluate(`
        (async function() {
          const desktop = window.anakotDesktop;
          if (!desktop) return 'no desktop API';
          
          const testFile = 'D:\\\\School\\\\PROJECT\\\\anakot-agent\\\\apps\\\\desktop\\\\package.json';
          const preview = await desktop.normalizePreviewTarget(testFile);
          
          // Now we need to call setPreviewTarget from the store
          // The store is bundled, but we can try to find it via the module system
          // Or we can try to trigger the preview via the app's own mechanisms
          
          // Try to find the store by looking at the React fiber tree
          const root = document.getElementById('root');
          const fiberKey = Object.keys(root).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
          
          return JSON.stringify({
            preview,
            hasRoot: !!root,
            fiberKey: fiberKey || 'none',
            desktopMethods: Object.keys(desktop).filter(k => typeof desktop[k] === 'function')
          });
        })()
      `, true);
      console.log('Manual trigger result:', result);
    } catch(e) {
      console.log('Manual trigger error:', e.message);
    }

    // Step 3: Try to find and call setPreviewTarget via webpack module system
    console.log('\n--- Step 3: Try module system access ---');
    try {
      const moduleResult = await evaluate(`
        (async function() {
          // In Vite builds, modules are ES modules bundled together
          // Try to find the store via the global module cache
          // Vite doesn't expose modules globally, but we can try __vite__modules__
          
          // Check for any global module registry
          const globalKeys = Object.keys(window).filter(k => 
            k.includes('module') || k.includes('Module') || k.includes('chunk') || k.includes('Chunk')
          );
          
          // Try to find the preview store by searching for its distinctive string
          // The store has a specific key 'anakot.desktop.sessionPreviews.v1'
          
          // Actually, let's try a different approach:
          // Override the $previewTarget atom to intercept the set call
          // We need to find the atom instance
          
          // Let's check if there's a way to access the store through the DOM
          // by finding a component that uses it
          
          return JSON.stringify({
            globalKeys,
            hasRequire: typeof require !== 'undefined',
            hasImport: typeof import !== 'undefined'
          });
        })()
      `, true);
      console.log('Module system:', moduleResult);
    } catch(e) {
      console.log('Module system error:', e.message);
    }

    // Step 4: Try to use the app's URL routing to trigger a preview
    console.log('\n--- Step 4: Try URL-based preview trigger ---');
    try {
      const urlResult = await evaluate(`
        (async function() {
          // Check current URL
          const currentUrl = window.location.href;
          const hash = window.location.hash;
          
          // Try navigating to a preview URL
          // The app uses react-router, so we might be able to trigger via hash
          
          return JSON.stringify({ currentUrl, hash });
        })()
      `, true);
      console.log('URL info:', urlResult);
    } catch(e) {
      console.log('URL error:', e.message);
    }

    // Step 5: Try to directly manipulate the DOM to trigger a file preview
    // by simulating a file click in the explorer
    console.log('\n--- Step 5: Check if we can trigger via DOM ---');
    try {
      const domResult = await evaluate(`
        (async function() {
          // Check if there's a file browser component with clickable items
          const allElements = Array.from(document.querySelectorAll('*'));
          
          // Look for the "No folder selected" button
          const folderBtn = allElements.find(el => el.textContent.trim() === 'No folder selected' && el.children.length === 0);
          
          // Look for any file tree items
          const treeItems = allElements.filter(el => {
            const cls = el.className || '';
            return (cls.includes('tree') || cls.includes('file') || cls.includes('item')) && el.children.length < 3;
          }).slice(0, 10).map(el => ({
            tag: el.tagName,
            class: (el.className || '').slice(0, 60),
            text: el.textContent.trim().slice(0, 40)
          }));
          
          return JSON.stringify({
            hasFolderBtn: !!folderBtn,
            folderBtnClass: folderBtn?.className?.slice(0, 80),
            treeItems
          });
        })()
      `, true);
      console.log('DOM result:', domResult);
    } catch(e) {
      console.log('DOM error:', e.message);
    }

    console.log('\n--- Waiting for remaining time to capture console messages ---');
  });

  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); return; }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const args = msg.params.args.map(a => a.value || a.description || '').join(' ');
      const entry = `[${msg.params.type.toUpperCase()}] ${args}`;
      allMessages.push(entry);
      if (args.includes('[MonacoDiag]') || msg.params.type === 'error' || msg.params.type === 'warning') {
        console.log(entry);
      }
    }
  });

  ws.on('error', (err) => console.error('[CDP] Error:', err.message));

  setTimeout(() => {
    console.log('\n=== ALL MESSAGES ===');
    allMessages.forEach(m => console.log(m));
    console.log(`\n=== TOTAL: ${allMessages.length} ===`);
    ws.close();
    process.exit(0);
  }, DURATION * 1000);
}

main().catch(console.error);
