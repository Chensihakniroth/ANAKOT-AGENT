const WebSocket = require('ws');

const TARGET_ID = process.argv[2] || '2C3F80F2C9FE52A9190B64E3E71041C2';
const PORT = process.argv[3] || '9223';
const DURATION = parseInt(process.argv[4]) || 60;

const ws = new WebSocket(`ws://127.0.0.1:${PORT}/devtools/page/${TARGET_ID}`);
let id = 1;
const pending = new Map();
const allMessages = [];

function send(method, params = {}) {
  return new Promise((resolve) => {
    const msgId = id++;
    pending.set(msgId, resolve);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
}

ws.on('open', async () => {
  console.log(`[CDP] Connected. Collecting console for ${DURATION}s...`);
  
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');

  // Try to find and click a file in the Explorer to trigger Monaco
  // Wait 3s for app to fully render, then try
  setTimeout(async () => {
    try {
      // Try to find file tree items in the sidebar
      const result = await send('Runtime.evaluate', {
        expression: `
          (function() {
            // Look for file tree items
            const items = document.querySelectorAll('[class*="tree"], [class*="file"], [class*="explorer"]');
            const info = {
              treeItems: items.length,
              bodyClasses: document.body.className,
              mainContent: document.querySelector('main')?.className || 'no main',
              sidebarContent: document.querySelector('[data-sidebar]')?.className || 'no sidebar',
              panes: Array.from(document.querySelectorAll('[class*="pane"]')).slice(0,5).map(e => e.className.slice(0,80)),
              allText: document.body.innerText.slice(0, 500)
            };
            return JSON.stringify(info);
          })()
        `,
        returnByValue: true
      });
      console.log('[CDP] DOM probe:', result?.result?.value);
    } catch (e) {
      console.log('[CDP] DOM probe error:', e.message);
    }
  }, 3000);

  // After 5s, try to trigger a file open via the app's internal API
  setTimeout(async () => {
    try {
      const result = await send('Runtime.evaluate', {
        expression: `
          (function() {
            // Check if there's a file browser or explorer with clickable items
            const allClickable = Array.from(document.querySelectorAll('div, span, li')).filter(el => {
              const text = el.textContent.trim();
              return text.endsWith('.cjs') || text.endsWith('.ts') || text.endsWith('.tsx') || text.endsWith('.js') || text.endsWith('.json');
            });
            if (allClickable.length > 0) {
              // Click the first one
              allClickable[0].click();
              return 'clicked: ' + allClickable[0].textContent.trim().slice(0, 50);
            }
            return 'no clickable files found. Visible text: ' + document.body.innerText.slice(0, 300);
          })()
        `,
        returnByValue: true
      });
      console.log('[CDP] File click attempt:', result?.result?.value);
    } catch (e) {
      console.log('[CDP] File click error:', e.message);
    }
  }, 5000);
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  
  // Handle responses
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg.result);
    pending.delete(msg.id);
    return;
  }

  // Handle console messages
  if (msg.method === 'Runtime.consoleAPICalled') {
    const args = msg.params.args.map(a => {
      if (a.type === 'string') return a.value;
      if (a.type === 'number' || a.type === 'boolean') return String(a.value);
      if (a.description) return a.description;
      return JSON.stringify(a);
    }).join(' ');
    const entry = `[CONSOLE ${msg.params.type.toUpperCase()}] ${args}`;
    allMessages.push(entry);
    // Only print MonacoDiag messages and errors
    if (args.includes('[MonacoDiag]') || msg.params.type === 'error' || msg.params.type === 'warning') {
      console.log(entry);
    }
  }

  if (msg.method === 'Log.entryAdded') {
    const entry = msg.params.entry;
    const line = `[LOG ${entry.level.toUpperCase()}] ${entry.text}`;
    allMessages.push(line);
    if (entry.text.includes('[MonacoDiag]')) {
      console.log(line);
    }
  }
});

ws.on('error', (err) => console.error('[CDP] WS Error:', err.message));

setTimeout(() => {
  console.log('\n=== ALL CAPTURED MESSAGES ===');
  allMessages.forEach(m => console.log(m));
  console.log(`\n=== TOTAL: ${allMessages.length} messages ===`);
  ws.close();
  process.exit(0);
}, DURATION * 1000);
