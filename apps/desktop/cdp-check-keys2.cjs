const WebSocket = require('ws');
const http = require('http');
const PORT = '9223';

function getTargets() {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${PORT}/json`, (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });
}

async function main() {
  const targets = await getTargets();
  const page = targets.find(t => t.type === 'page');
  console.log('Target:', page?.url);
  
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/devtools/page/${page.id}`);
  let id = 1;
  const pending = new Map();

  function send(m, p = {}) {
    return new Promise((res, rej) => {
      const mid = id++; pending.set(mid, res);
      ws.send(JSON.stringify({ id: mid, method: m, params: p }));
      setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); rej(new Error(`Timeout: ${m}`)); } }, 15000);
    });
  }

  ws.on('open', async () => {
    try {
      await send('Runtime.enable');
      await send('Log.enable');
      
      // Wait a moment for the page to be ready
      await new Promise(r => setTimeout(r, 1000));
      
      // List all keys on window.anakotDesktop
      const keys = await send('Runtime.evaluate', {
        expression: `Object.keys(window.anakotDesktop).join('\\n')`,
        returnByValue: true
      });
      console.log('=== anakotDesktop keys ===');
      console.log(keys?.result?.value);

      // Check specific methods
      for (const method of ['__setPreviewTarget', 'onSetPreviewTarget', 'normalizePreviewTarget', 'readFileText']) {
        const check = await send('Runtime.evaluate', {
          expression: `typeof window.anakotDesktop.${method}`,
          returnByValue: true
        });
        console.log(`${method}: ${check?.result?.value}`);
      }
    } catch(e) {
      console.error('Error:', e.message);
    }
    
    ws.close();
    process.exit(0);
  });

  ws.on('error', e => { console.error('WS Error:', e.message); process.exit(1); });
  ws.on('close', () => process.exit(0));
}

main().catch(console.error);
