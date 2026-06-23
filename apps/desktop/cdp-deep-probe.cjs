const WebSocket = require('ws');
const http = require('http');

const PORT = process.argv[2] || '9223';
const DURATION = parseInt(process.argv[3]) || 90;

function getTargetId() {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${PORT}/json`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const targets = JSON.parse(data);
        const page = targets.find(t => t.type === 'page');
        if (page) resolve(page.id);
        else reject(new Error('No page target found'));
      });
    }).on('error', reject);
  });
}

async function main() {
  const TARGET_ID = await getTargetId();
  console.log(`[CDP] Target: ${TARGET_ID}`);

  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/devtools/page/${TARGET_ID}`);
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
      }, 10000);
    });
  }

  async function evaluate(expression) {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true });
    return r?.result?.value;
  }

  ws.on('open', async () => {
    console.log(`[CDP] Connected. Collecting for ${DURATION}s...`);
    await send('Runtime.enable');
    await send('Log.enable');

    await new Promise(r => setTimeout(r, 2000));

    // Try to access the nanostore via the module system
    // In a Vite bundled app, the stores are module-scoped, but we can try
    // to find them on the window object or via the React fiber

    // First, let's check if nanostores are exposed anywhere
    const storeCheck = await evaluate(`
      (function() {
        // Check for common store locations
        const checks = {
          'window.__NANOSTORES__': !!(window).__NANOSTORES__,
          'window.__stores__': !!(window).__stores__,
          'window.stores': typeof window.stores,
          'window.$previewTarget': typeof window.$previewTarget,
        };
        
        // Look for any global that might be a store
        const storeLike = Object.keys(window).filter(k => {
          const v = window[k];
          return v && typeof v === 'object' && typeof v?.get === 'function' && typeof v?.set === 'function';
        }).slice(0, 10);
        
        return JSON.stringify({ checks, storeLike });
      })()
    `);
    console.log('[CDP] Store check:', storeCheck);

    // Try to find the React root and traverse fibers to find store references
    const fiberCheck = await evaluate(`
      (function() {
        const root = document.getElementById('root');
        if (!root) return 'no root';
        
        // Find React internal key
        const fiberKey = Object.keys(root).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
        if (!fiberKey) return 'no fiber key found';
        
        let fiber = root[fiberKey];
        let found = [];
        
        // Walk up and down the fiber tree to find components that use preview stores
        function walk(node, depth) {
          if (!node || depth > 30) return;
          if (node.memoizedState) {
            // Check if this is a useState or useAtom hook
            let s = node.memoizedState;
            for (let i = 0; i < 10; i++) {
              if (s && s.memoizedState && typeof s.memoizedState === 'object') {
                const ms = s.memoizedState;
                if (ms.kind && (ms.kind === 'file' || ms.kind === 'url')) {
                  found.push({ type: 'previewTarget', depth });
                }
              }
              s = s && s.next;
            }
          }
          if (node.child) walk(node.child, depth + 1);
          if (node.sibling && depth < 5) walk(node.sibling, depth + 1);
        }
        
        walk(fiber, 0);
        return JSON.stringify({ fiberKey, found });
      })()
    `);
    console.log('[CDP] Fiber check:', fiberCheck);

    // Try using Vite's module hot injection or require
    const moduleCheck = await evaluate(`
      (function() {
        // Check for __vite_plugin_react_preamble_installed__ etc
        const viteKeys = Object.keys(window).filter(k => k.startsWith('__vite') || k.startsWith('__VITE'));
        
        // Check for __webpack_modules__ (if bundled with webpack)
        const webpackKeys = Object.keys(window).filter(k => k.startsWith('__webpack'));
        
        // Check for require (CommonJS)
        const hasRequire = typeof require === 'function';
        
        // Check for import.meta equivalents
        const importMeta = typeof import.meta;
        
        return JSON.stringify({ viteKeys, webpackKeys, hasRequire, importMeta });
      })()
    `);
    console.log('[CDP] Module check:', moduleCheck);

    // The most reliable approach: use the IPC bridge to trigger a file open
    // The preload exposes window.anakotDesktop
    // Let's try to use it via a different CDP method - maybe we can access
    // the isolated world's globals

    // Actually, let's try a completely different approach:
    // Just directly simulate the file preview by injecting a script that
    // imports the store module and calls setPreviewTarget
    const injectCheck = await evaluate(`
      (function() {
        // Check if we can access the preload bridge
        try {
          const desktop = window.anakotDesktop;
          if (desktop) {
            return 'anakotDesktop available: ' + Object.keys(desktop).filter(k => typeof desktop[k] === 'function').join(', ');
          }
        } catch(e) {}
        return 'no desktop bridge';
      })()
    `);
    console.log('[CDP] Preload bridge:', injectCheck);

    // Try to use nodeIntegration or contextIsolation settings
    // to access Electron APIs
    const electronCheck = await evaluate(`
      (function() {
        try {
          // Try to access electron through the context bridge
          const { ipcRenderer } = require('electron');
          return 'ipcRenderer available';
        } catch(e) {
          return 'no direct electron access: ' + e.message;
        }
      })()
    `);
    console.log('[CDP] Electron check:', electronCheck);

    // Try to find the store by looking at the app's source maps or module cache
    const sourceMapCheck = await evaluate(`
      (function() {
        // In Vite production build, modules are bundled
        // But we can try to find the store by looking at the script sources
        const scripts = Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
        return JSON.stringify({ scripts: scripts.slice(0, 5) });
      })()
    `);
    console.log('[CDP] Scripts:', sourceMapCheck);

    // Last resort: try to trigger a file preview by simulating a file drop
    // or by using the app's URL hash routing
    const hashCheck = await evaluate(`
      (function() {
        const hash = window.location.hash;
        const pathname = window.location.pathname;
        
        // Check if there's a router
        const router = window.__router || window.router;
        
        return JSON.stringify({ hash, pathname, hasRouter: !!router });
      })()
    `);
    console.log('[CDP] URL check:', hashCheck);

    // Try to use the file input approach - create a hidden file input
    // and use it to trigger the folder selection
    const fileInputCheck = await evaluate(`
      (function() {
        // Look for any existing file inputs
        const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
        
        // Check if the app uses a specific file picker library
        const pickers = Array.from(document.querySelectorAll('[class*="picker"], [class*="file-input"], [class*="dropzone"]'));
        
        return JSON.stringify({ 
          fileInputs: inputs.length, 
          pickers: pickers.map(p => ({ tag: p.tagName, class: p.className.slice(0,60) }))
        });
      })()
    `);
    console.log('[CDP] File input check:', fileInputCheck);

    // Try to directly call the store by finding it in the bundled JS
    // The store uses nanostores which has a specific pattern
    const nanostoreHack = await evaluate(`
      (function() {
        // nanostores uses a specific pattern - atoms have a Symbol.for('nanostore') key
        // Let's try to find all atoms in memory
        // This is a hack but might work
        
        // Actually, let's try a different approach:
        // Override the $previewTarget atom's set method to intercept calls
        // First we need to find it
        
        // In the bundled code, the store is likely in a specific chunk
        // Let's look for the string 'anakot.desktop.sessionPreviews.v1' in memory
        // by searching through all text nodes
        
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node;
        const matches = [];
        while (node = walker.nextNode()) {
          if (node.textContent.includes('sessionPreviews')) {
            matches.push(node.textContent.slice(0, 100));
          }
        }
        
        return JSON.stringify({ matches });
      })()
    `);
    console.log('[CDP] Nanostore hack:', nanostoreHack);

    // The most practical approach: use CDP to set a folder via the native dialog
    // by intercepting the dialog and setting a path
    // Or: just directly manipulate localStorage to set a preview target
    
    // Actually, the simplest approach: use the app's own IPC to read a file
    // and then set the preview target via the store
    // But we can't access the store from here...
    
    // Let me try one more thing: inject a script tag that runs in the page context
    // and has access to the module system
    const injectScript = await evaluate(`
      (function() {
        // Create a script that will run in the page's module context
        const script = document.createElement('script');
        script.textContent = \`
          (function() {
            // Try to find the store in the global scope
            // In Vite builds, the store might be accessible via window.__vite_plugin__
            
            // Let's try to trigger a file preview by directly manipulating the DOM
            // Find the "No folder selected" button and see what happens when we click it
            const btn = Array.from(document.querySelectorAll('div, button, span')).find(el => 
              el.textContent.trim() === 'No folder selected'
            );
            
            if (btn) {
              // Get the click event handler
              // In React, the handler is attached via synthetic events
              // We can try to find the fiber and call the onClick directly
              const fiberKey = Object.keys(btn).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
              if (fiberKey) {
                let fiber = btn[fiberKey];
                let onClick = null;
                for (let i = 0; i < 10; i++) {
                  if (fiber && fiber.memoizedProps && fiber.memoizedProps.onClick) {
                    onClick = fiber.memoizedProps.onClick;
                    break;
                  }
                  fiber = fiber && fiber.return;
                }
                if (onClick) {
                  onClick({ preventDefault: () => {}, stopPropagation: () => {} });
                  return 'called onClick';
                }
              }
            }
            return 'could not find onClick';
          })();
        \`;
        document.head.appendChild(script);
        script.remove();
        return 'script injected';
      })()
    `);
    console.log('[CDP] Script injection:', injectScript);

    await new Promise(r => setTimeout(r, 2000));

    // Check if anything changed
    const afterInject = await evaluate(`
      (function() {
        return JSON.stringify({
          bodyText: document.body.innerText.slice(0, 300),
          hasMonaco: !!document.querySelector('.monaco-editor'),
          hasFolder: document.body.innerText.includes('ANAKOT-AGENT') || document.body.innerText.includes('.git'),
        });
      })()
    `);
    console.log('[CDP] After inject:', afterInject);

    console.log('[CDP] Waiting for remaining time...');
  });

  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); return; }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const args = msg.params.args.map(a => a.value || a.description || '').join(' ');
      const entry = `[CONSOLE ${msg.params.type.toUpperCase()}] ${args}`;
      allMessages.push(entry);
      if (args.includes('[MonacoDiag]') || msg.params.type === 'error' || msg.params.type === 'warning') console.log(entry);
    }
    if (msg.method === 'Log.entryAdded') {
      const line = `[LOG ${msg.params.entry.level.toUpperCase()}] ${msg.params.entry.text}`;
      allMessages.push(line);
      if (msg.params.entry.text.includes('[MonacoDiag]')) console.log(line);
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
