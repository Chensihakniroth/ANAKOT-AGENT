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

    // Wait for app to fully load and auto-open to trigger
    await new Promise(r => setTimeout(r, 5000));

    // Check if Monaco mounted
    const monacoCheck = await evaluate(`
      (function() {
        const monaco = document.querySelector('.monaco-editor');
        const bg = document.querySelector('.monaco-editor-background');
        const lineNums = document.querySelectorAll('.monaco-editor .line-numbers');
        const toolbar = document.querySelector('[class*="toolbar"]');
        
        return JSON.stringify({
          hasMonaco: !!monaco,
          hasBg: !!bg,
          lineNumCount: lineNums.length,
          lineNumSample: Array.from(lineNums).slice(0,5).map(el => el.textContent.trim()),
          monacoClass: monaco?.className?.slice(0,100),
          bodyTextPreview: document.body.innerText.slice(0, 300)
        });
      })()
    `);
    console.log('[CDP] Monaco check:', monacoCheck);

    // Check if the preview pane is visible
    const previewCheck = await evaluate(`
      (function() {
        const preview = document.querySelector('[class*="preview"]');
        const rightRail = document.querySelector('[class*="right"]');
        const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
        
        return JSON.stringify({
          preview: preview ? preview.className.slice(0,80) : 'not found',
          rightRail: rightRail ? rightRail.className.slice(0,80) : 'not found',
          tabs: tabs.map(t => t.textContent.trim()).filter(t => t.length < 30)
        });
      })()
    `);
    console.log('[CDP] Preview check:', previewCheck);

    console.log('[CDP] Waiting for remaining time...');
  });

  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); return; }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const args = msg.params.args.map(a => {
        if (a.type === 'string') return a.value;
        if (a.type === 'number' || a.type === 'boolean') return String(a.value);
        if (a.description) return a.description;
        try { return JSON.stringify(a); } catch { return String(a); }
      }).join(' ');
      const entry = `[CONSOLE ${msg.params.type.toUpperCase()}] ${args}`;
      allMessages.push(entry);
      // Print everything that's MonacoDiag or layout-related
      if (args.includes('[MonacoDiag]') || args.includes('layout') || args.includes('Layout') || 
          msg.params.type === 'error' || msg.params.type === 'warning') {
        console.log(entry);
      }
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
