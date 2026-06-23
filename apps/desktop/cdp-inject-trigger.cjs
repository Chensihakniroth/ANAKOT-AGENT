const WebSocket = require('ws');
const http = require('http');

const PORT = process.argv[2] || '9223';
const DURATION = parseInt(process.argv[3]) || 90;

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

    // Wait for app to fully load
    await new Promise(r => setTimeout(r, 5000));

    // Step 1: Verify app is rendering by checking for known elements
    console.log('\n=== Step 1: App render check ===');
    const appState = await evaluate(`
      JSON.stringify({
        bodyText: document.body.innerText.slice(0, 200),
        hasMonaco: !!document.querySelector('.monaco-editor'),
        hasChat: document.body.innerText.includes('ANAKOT AGENT'),
        hasTerminal: document.body.innerText.includes('Terminal'),
      })
    `);
    console.log('App state:', appState);

    // Step 2: Set up a global trigger function that we can call from DevTools console
    // This function will be injected into the page and will have access to the same
    // module scope as the app
    console.log('\n=== Step 2: Inject global trigger ===');
    await evaluate(`
      (function() {
        // Store a reference to the preview target setter
        // We'll find it by intercepting the next React render cycle
        
        // Method 1: Override console.log to capture store-related logs
        const origLog = console.log;
        window.__capturedLogs = [];
        console.log = function(...args) {
          const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
          window.__capturedLogs.push(msg);
          origLog.apply(console, args);
        };
        
        // Method 2: Set up a function that triggers the preview via IPC
        window.__triggerMonacoDiag = async function() {
          try {
            const desktop = window.anakotDesktop;
            if (!desktop) return 'no desktop API';
            
            // Get a preview target
            const preview = await desktop.normalizePreviewTarget(
              'D:\\\\School\\\\PROJECT\\\\anakot-agent\\\\apps\\\\desktop\\\\package.json'
            );
            
            // Store it globally so we can access it
            window.__lastPreview = preview;
            
            // Now we need to get the store's setPreviewTarget function
            // Try to find it via React fiber
            const root = document.getElementById('root');
            
            // React 18 uses __reactContainer$<id> for the root
            const containerKey = Object.keys(root).find(k => k.startsWith('__reactContainer'));
            if (!containerKey) {
              return 'no React container key found. Keys: ' + Object.keys(root).filter(k => k.startsWith('__react')).join(', ');
            }
            
            // Get the fiber root
            const fiberRoot = root[containerKey];
            
            // Walk the fiber tree to find a component that uses $previewTarget
            const results = [];
            function walk(fiber, depth) {
              if (!fiber || depth > 50) return;
              
              // Check memoized state for hooks that might reference the store
              if (fiber.memoizedState) {
                let state = fiber.memoizedState;
                for (let i = 0; i < 20; i++) {
                  if (state && state.memoizedState !== undefined) {
                    const ms = state.memoizedState;
                    // Check if this looks like a preview target
                    if (ms && typeof ms === 'object' && ms.kind === 'file') {
                      results.push({ depth, type: 'previewTarget', fiberType: fiber.type?.name || fiber.type?.displayName || 'anonymous' });
                    }
                  }
                  state = state?.next;
                }
              }
              
              // Check component name
              const name = fiber.type?.name || fiber.type?.displayName || '';
              if (name.includes('Preview') || name.includes('preview')) {
                results.push({ depth, type: 'component', name });
              }
              
              if (fiber.child) walk(fiber.child, depth + 1);
              if (fiber.sibling && depth < 10) walk(fiber.sibling, depth + 1);
            }
            
            walk(fiberRoot.current, 0);
            
            return JSON.stringify({
              preview,
              containerKey,
              results: results.slice(0, 20)
            });
          } catch(e) {
            return 'error: ' + e.message + '\\n' + e.stack;
          }
        };
        
        console.log('[Inject] __triggerMonacoDiag() is ready. Call it from console.');
      })()
    `);

    // Step 3: Call the trigger function
    console.log('\n=== Step 3: Call trigger function ===');
    const triggerResult = await evaluate(`(async () => await window.__triggerMonacoDiag())()`, true);
    console.log('Trigger result:', triggerResult);

    // Step 4: Try a different approach — use the app's own event system
    // The app listens for 'preview-file-change' events from the main process
    // Let's try to simulate that
    console.log('\n=== Step 4: Try event-based trigger ===');
    const eventResult = await evaluate(`
      (async function() {
        // Check if there are any IPC listeners we can trigger
        const desktop = window.anakotDesktop;
        
        // Try watchPreviewFile — this might trigger the preview
        try {
          const result = await desktop.watchPreviewFile(
            'D:\\\\School\\\\PROJECT\\\\anakot-agent\\\\apps\\\\desktop\\\\package.json'
          );
          return 'watchPreviewFile result: ' + JSON.stringify(result);
        } catch(e) {
          return 'watchPreviewFile error: ' + e.message;
        }
      })()
    `, true);
    console.log('Event result:', eventResult);

    await new Promise(r => setTimeout(r, 2000));

    // Step 5: Check if anything changed
    console.log('\n=== Step 5: Post-trigger state ===');
    const postState = await evaluate(`
      JSON.stringify({
        hasMonaco: !!document.querySelector('.monaco-editor'),
        bodyText: document.body.innerText.slice(0, 300),
        capturedLogs: (window.__capturedLogs || []).filter(l => l.includes('MonacoDiag')).join('\\n')
      })
    `);
    console.log('Post state:', postState);

    // Step 6: Try to directly manipulate the store via localStorage
    // The preview registry is stored in localStorage
    console.log('\n=== Step 6: Try localStorage manipulation ===');
    const lsResult = await evaluate(`
      (function() {
        // The app stores session previews in localStorage
        const key = 'anakot.desktop.sessionPreviews.v1';
        const current = localStorage.getItem(key);
        console.log('[LS] Current preview registry:', current);
        
        // Try to set a fake preview target that the app will pick up
        // We need to find a valid session ID first
        const allKeys = Object.keys(localStorage);
        const sessionKeys = allKeys.filter(k => k.includes('session'));
        
        return JSON.stringify({
          current,
          sessionKeys,
          allKeys: allKeys.slice(0, 20)
        });
      })()
    `);
    console.log('LocalStorage:', lsResult);

    console.log('\n=== Waiting for remaining time ===');
  });

  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); return; }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const args = msg.params.args.map(a => a.value || a.description || '').join(' ');
      const entry = `[${msg.params.type.toUpperCase()}] ${args}`;
      allMessages.push(entry);
      if (args.includes('[MonacoDiag]') || args.includes('[Inject]') || args.includes('[LS]') || 
          msg.params.type === 'error' || msg.params.type === 'warning') {
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
