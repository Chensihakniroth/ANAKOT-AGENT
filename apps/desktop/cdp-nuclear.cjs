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
      console.error('Evaluate error:', r.exceptionDetails.text, r.exceptionDetails.exception?.description);
      return null;
    }
    return r?.result?.value;
  }

  ws.on('open', async () => {
    console.log(`[CDP] Connected.`);
    await send('Runtime.enable');
    await send('Log.enable');

    await new Promise(r => setTimeout(r, 2000));

    // The most direct approach: use the app's own IPC to trigger a file preview
    // by calling window.anakotDesktop methods and then dispatching a custom event
    // that the app listens to
    
    // First, let's check if there's a way to trigger the preview via window methods
    console.log('\n--- Step 1: Check for event-based preview triggers ---');
    const eventCheck = await evaluate(`
      (function() {
        // Check if the app has any global event handlers for preview
        // Look for custom events or IPC listeners
        
        // Check window.electron or similar
        const keys = Object.keys(window).filter(k => 
          k.startsWith('__') || k.startsWith('electron') || k.startsWith('ipc')
        );
        
        // Check if there's a way to trigger preview via window method
        const methods = [];
        for (const k of Object.keys(window)) {
          if (typeof window[k] === 'function' && k.includes('review')) {
            methods.push(k);
          }
        }
        
        return JSON.stringify({ keys: keys.slice(0, 20), methods });
      })()
    `);
    console.log('Event check:', eventCheck);

    // Try to trigger the preview by calling normalizePreviewTarget and then
    // dispatching a custom event that the app might listen to
    console.log('\n--- Step 2: Try to trigger preview via custom event ---');
    try {
      const customEventResult = await evaluate(`
        (async function() {
          const desktop = window.anakotDesktop;
          const preview = await desktop.normalizePreviewTarget('D:\\\\School\\\\PROJECT\\\\anakot-agent\\\\apps\\\\desktop\\\\package.json');
          
          // Try dispatching various events that might trigger the preview
          const events = [
            new CustomEvent('preview', { detail: preview }),
            new CustomEvent('file-preview', { detail: preview }),
            new CustomEvent('open-preview', { detail: preview }),
            new CustomEvent('set-preview-target', { detail: preview }),
          ];
          
          events.forEach(e => {
            window.dispatchEvent(e);
            document.dispatchEvent(e);
          });
          
          return 'dispatched ' + events.length + ' events';
        })()
      `, true);
      console.log('Custom event result:', customEventResult);
    } catch(e) {
      console.log('Custom event error:', e.message);
    }

    await new Promise(r => setTimeout(r, 2000));

    // Check if any of those events triggered Monaco
    const afterEvent = await evaluate(`
      JSON.stringify({
        hasMonaco: !!document.querySelector('.monaco-editor'),
        bodyText: document.body.innerText.slice(0, 200)
      })
    `);
    console.log('After custom events:', afterEvent);

    // Try a completely different approach:
    // Use the keyboard shortcut to open the preview
    console.log('\n--- Step 3: Try keyboard shortcut ---');
    try {
      // Send Ctrl+K or whatever the preview shortcut is
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'p', code: 'KeyP', modifiers: 2 }); // Ctrl+P
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'p', code: 'KeyP', modifiers: 2 });
      await new Promise(r => setTimeout(r, 500));
    } catch(e) {
      console.log('Keyboard error:', e.message);
    }

    // The nuclear option: add a temporary global function that the app can call
    // and then trigger it from the console
    console.log('\n--- Step 4: Set up global trigger function ---');
    try {
      await evaluate(`
        (function() {
          // Create a global function that can be called from DevTools console
          window.__triggerPreview = async function() {
            const desktop = window.anakotDesktop;
            if (!desktop) return 'no desktop API';
            
            const files = [
              'D:\\\\School\\\\PROJECT\\\\anakot-agent\\\\apps\\\\desktop\\\\package.json',
              'D:\\\\School\\\\PROJECT\\\\anakot-agent\\\\apps\\\\desktop\\\\tsconfig.json',
              'D:\\\\School\\\\PROJECT\\\\anakot-agent\\\\apps\\\\desktop\\\\electron\\\\main.cjs',
            ];
            
            for (const f of files) {
              try {
                const preview = await desktop.normalizePreviewTarget(f);
                console.log('[ManualTrigger] Got preview for', f, ':', JSON.stringify(preview));
                return preview;
              } catch(e) {
                console.log('[ManualTrigger] Failed for', f, ':', e.message);
              }
            }
            return 'all files failed';
          };
          
          console.log('[ManualTrigger] Window function __triggerPreview() is ready');
        })()
      `);
      console.log('Global function set up. Call window.__triggerPreview() from DevTools console to test.');
    } catch(e) {
      console.log('Global function error:', e.message);
    }

    // Also try to inject a script that modifies the store directly
    // by intercepting the next nanostores atom creation
    console.log('\n--- Step 5: Try to intercept nanostores ---');
    try {
      await evaluate(`
        (function() {
          // Override defineProperty to intercept when nanostores sets up atoms
          // This is a hack but might work
          
          // Actually, let's try to find the store by its storage key
          const storageKey = 'anakot.desktop.sessionPreviews.v1';
          const stored = localStorage.getItem(storageKey);
          console.log('[ManualTrigger] Stored preview registry:', stored);
          
          // Try to write to localStorage to trigger a preview
          // The app persists the registry, so writing to it might trigger a re-read
          const fakeRegistry = {
            'fake-session': [{
              autoOpen: true,
              createdAt: Date.now(),
              id: 'fake-session:file:///D:/School/PROJECT/anakot-agent/apps/desktop/package.json',
              normalized: {
                kind: 'file',
                label: 'package.json',
                language: 'json',
                path: 'D:\\\\School\\\\PROJECT\\\\anakot-agent\\\\apps\\\\desktop\\\\package.json',
                previewKind: 'text',
                source: 'D:\\\\School\\\\PROJECT\\\\anakot-agent\\\\apps\\\\desktop\\\\package.json',
                url: 'file:///D:/School/PROJECT/anakot-agent/apps/desktop/package.json'
              },
              sessionId: 'fake-session',
              source: 'manual',
              target: 'D:\\\\School\\\\PROJECT\\\\anakot-agent\\\\apps\\\\desktop\\\\package.json'
            }]
          };
          
          localStorage.setItem(storageKey, JSON.stringify(fakeRegistry));
          console.log('[ManualTrigger] Wrote fake registry to localStorage');
        })()
      `);
    } catch(e) {
      console.log('Nanostores intercept error:', e.message);
    }

    await new Promise(r => setTimeout(r, 2000));

    // Check if the fake registry triggered anything
    const afterFake = await evaluate(`
      JSON.stringify({
        hasMonaco: !!document.querySelector('.monaco-editor'),
        previewTarget: document.querySelector('[class*="preview"]')?.className?.slice(0, 80),
        bodyText: document.body.innerText.slice(0, 200)
      })
    `);
    console.log('After fake registry:', afterFake);

    console.log('\n--- Waiting for remaining time ---');
  });

  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); return; }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const args = msg.params.args.map(a => a.value || a.description || '').join(' ');
      const entry = `[${msg.params.type.toUpperCase()}] ${args}`;
      allMessages.push(entry);
      if (args.includes('[MonacoDiag]') || args.includes('[ManualTrigger]') || msg.params.type === 'error' || msg.params.type === 'warning') {
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
