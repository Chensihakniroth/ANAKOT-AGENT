const WebSocket = require('ws');
const http = require('http');

const PORT = process.argv[2] || '9223';
const DURATION = parseInt(process.argv[3]) || 60;

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
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r?.result?.subtype === 'error') throw new Error(r.result.description);
    return r?.result?.value;
  }

  ws.on('open', async () => {
    console.log(`[CDP] Connected. Collecting for ${DURATION}s...`);
    await send('Runtime.enable');
    await send('Log.enable');

    await new Promise(r => setTimeout(r, 2000));

    // Try to use selectPaths with a specific path
    try {
      const selectResult = await evaluate(`
        (async function() {
          try {
            const desktop = window.anakotDesktop;
            if (!desktop || !desktop.selectPaths) return 'no selectPaths';
            
            // Try calling with a path argument
            const result = await desktop.selectPaths({
              defaultPath: 'D:\\\\School\\\\PROJECT\\\\anakot-agent\\\\apps\\\\desktop',
              properties: ['openDirectory']
            });
            return 'selectPaths result: ' + JSON.stringify(result);
          } catch(e) {
            return 'selectPaths error: ' + e.message;
          }
        })()
      `);
      console.log('[CDP] selectPaths:', selectResult);
    } catch(e) {
      console.log('[CDP] selectPaths error:', e.message);
    }

    await new Promise(r => setTimeout(r, 2000));

    // Check if folder was set
    const afterSelect = await evaluate(`
      (function() {
        return JSON.stringify({
          bodyText: document.body.innerText.slice(0, 400),
          hasMonaco: !!document.querySelector('.monaco-editor'),
          hasFileTree: document.body.innerText.includes('.git') || document.body.innerText.includes('src'),
        });
      })()
    `);
    console.log('[CDP] After select:', afterSelect);

    // If that didn't work, try to use readFileText to read a known file
    // and then try to trigger the preview via the app's internal mechanisms
    try {
      const readResult = await evaluate(`
        (async function() {
          try {
            const desktop = window.anakotDesktop;
            if (!desktop || !desktop.readFileText) return 'no readFileText';
            
            // Read a small known file
            const result = await desktop.readFileText('D:\\\\School\\\\PROJECT\\\\anakot-agent\\\\apps\\\\desktop\\\\package.json');
            return 'readFileText result: ' + result.slice(0, 200);
          } catch(e) {
            return 'readFileText error: ' + e.message;
          }
        })()
      `);
      console.log('[CDP] readFileText:', readResult);
    } catch(e) {
      console.log('[CDP] readFileText error:', e.message);
    }

    // Try normalizePreviewTarget
    try {
      const normalizeResult = await evaluate(`
        (async function() {
          try {
            const desktop = window.anakotDesktop;
            if (!desktop || !desktop.normalizePreviewTarget) return 'no normalizePreviewTarget';
            
            const result = await desktop.normalizePreviewTarget('file:///D:/School/PROJECT/anakot-agent/apps/desktop/package.json');
            return 'normalizePreviewTarget result: ' + JSON.stringify(result);
          } catch(e) {
            return 'normalizePreviewTarget error: ' + e.message;
          }
        })()
      `);
      console.log('[CDP] normalizePreviewTarget:', normalizeResult);
    } catch(e) {
      console.log('[CDP] normalizePreviewTarget error:', e.message);
    }

    // Try readDir to list files in a directory
    try {
      const readDirResult = await evaluate(`
        (async function() {
          try {
            const desktop = window.anakotDesktop;
            if (!desktop || !desktop.readDir) return 'no readDir';
            
            const result = await desktop.readDir('D:\\\\School\\\\PROJECT\\\\anakot-agent\\\\apps\\\\desktop');
            return 'readDir result: ' + JSON.stringify(result).slice(0, 500);
          } catch(e) {
            return 'readDir error: ' + e.message;
          }
        })()
      `);
      console.log('[CDP] readDir:', readDirResult);
    } catch(e) {
      console.log('[CDP] readDir error:', e.message);
    }

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
