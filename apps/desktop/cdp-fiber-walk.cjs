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
    if (r?.exceptionDetails) {
      console.error('JS Error:', r.exceptionDetails.text);
      return null;
    }
    return r?.result?.value;
  }

  ws.on('open', async () => {
    console.log('[CDP] Connected.');
    await send('Runtime.enable');
    await send('Log.enable');

    await new Promise(r => setTimeout(r, 3000));

    // The key insight: the preview pane is disabled because !previewTarget && !filePreviewTarget
    // We need to set $previewTarget to make the pane enabled, which will mount ChatPreviewRail,
    // which will render LocalFilePreview, which will render MonacoEditorPane
    
    // Approach: Find the nanostores atom by walking ALL objects in the JS heap
    // This is expensive but should work
    
    console.log('\n=== Approach: Direct store manipulation via global override ===');
    
    // Override nanostores' atom function to intercept the next atom creation
    // Actually, the atoms already exist. We need to find them.
    
    // Better approach: The app uses nanostores which stores atoms with a specific symbol
    // Let's try to find atoms by looking for objects with nanostore metadata
    
    const result = await evaluate(`
      (async function() {
        try {
          // The app bundle is a single JS file. All modules are closures.
          // But nanostores atoms have a specific structure.
          // Let's try to find them by looking at the React fiber tree more carefully.
          
          const root = document.getElementById('root');
          const containerKey = Object.keys(root).find(k => k.startsWith('__reactContainer'));
          const fiberRoot = root[containerKey];
          
          // Walk the entire fiber tree and look for any memoized state that references
          // the preview store atoms
          const found = [];
          const visited = new Set();
          
          function walk(fiber, depth) {
            if (!fiber || depth > 100 || visited.has(fiber)) return;
            visited.add(fiber);
            
            // Check memoized props
            if (fiber.memoizedProps) {
              const props = fiber.memoizedProps;
              // Look for store-related props
              for (const key of Object.keys(props)) {
                const val = props[key];
                if (val && typeof val === 'object' && val.kind === 'file') {
                  found.push({ depth, source: 'props', key, val: JSON.stringify(val).slice(0, 100) });
                }
              }
            }
            
            // Check memoized state (hooks)
            if (fiber.memoizedState) {
              let state = fiber.memoizedState;
              for (let i = 0; i < 50; i++) {
                if (state && typeof state === 'object') {
                  const ms = state.memoizedState;
                  if (ms && typeof ms === 'object') {
                    // Check if this is a nanostore atom reference
                    const keys = Object.keys(ms);
                    if (keys.includes('kind') && (ms.kind === 'file' || ms.kind === 'url')) {
                      found.push({ depth, source: 'hook', val: JSON.stringify(ms).slice(0, 100) });
                    }
                    // Check for atom-like objects (have .get, .set, .subscribe)
                    if (typeof ms.get === 'function' && typeof ms.set === 'function' && typeof ms.subscribe === 'function') {
                      found.push({ depth, source: 'atom', val: ms.get() ? JSON.stringify(ms.get()).slice(0, 100) : 'null' });
                    }
                  }
                }
                state = state?.next;
              }
            }
            
            // Check the component type name
            const name = fiber.type?.name || fiber.type?.displayName || '';
            
            if (fiber.child) walk(fiber.child, depth + 1);
            if (fiber.sibling && depth < 15) walk(fiber.sibling, depth + 1);
          }
          
          walk(fiberRoot.current, 0);
          
          return JSON.stringify({ found: found.slice(0, 30), visitedCount: visited.size });
        } catch(e) {
          return 'error: ' + e.message;
        }
      })()
    `, true);
    console.log('Fiber walk result:', result);

    // Alternative: Try to use the app's own routing to navigate to a preview
    console.log('\n=== Approach: URL navigation ===');
    const navResult = await evaluate(`
      (function() {
        // Check if there's a router we can use
        // The app uses react-router HashRouter
        // Try navigating to a route that might trigger the preview
        
        // Check current route
        const hash = window.location.hash;
        
        // Try to find the router's navigate function
        // by looking at the fiber tree for a Router component
        const root = document.getElementById('root');
        const containerKey = Object.keys(root).find(k => k.startsWith('__reactContainer'));
        const fiberRoot = root[containerKey];
        
        let navigateFound = null;
        function findNavigate(fiber, depth) {
          if (!fiber || depth > 50) return;
          if (fiber.memoizedState) {
            let state = fiber.memoizedState;
            for (let i = 0; i < 20; i++) {
              if (state && typeof state === 'object' && typeof state.memoizedState === 'function') {
                const name = fiber.type?.name || fiber.type?.displayName || '';
                if (name.includes('Router') || name.includes('Route')) {
                  navigateFound = name;
                }
              }
              state = state?.next;
            }
          }
          if (fiber.child) findNavigate(fiber.child, depth + 1);
        }
        findNavigate(fiberRoot.current, 0);
        
        return JSON.stringify({ hash, navigateFound });
      })()
    `);
    console.log('Navigation:', navResult);

    console.log('\n=== Waiting ===');
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
