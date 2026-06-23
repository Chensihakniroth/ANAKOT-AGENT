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
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/devtools/page/${page.id}`);
  let id = 1;
  const pending = new Map();

  function send(m, p = {}) {
    return new Promise((res, rej) => {
      const mid = id++; pending.set(mid, res);
      ws.send(JSON.stringify({ id: mid, method: m, params: p }));
      setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); rej(new Error(`Timeout: ${m}`)); } }, 10000);
    });
  }

  ws.on('open', async () => {
    await send('Runtime.enable');
    
    // List all keys on window.anakotDesktop
    const keys = await send('Runtime.evaluate', {
      expression: `Object.keys(window.anakotDesktop).join('\\n')`,
      returnByValue: true
    });
    console.log('anakotDesktop keys:', keys?.result?.value);

    // Check if __setPreviewTarget exists
    const check = await send('Runtime.evaluate', {
      expression: `typeof window.anakotDesktop.__setPreviewTarget`,
      returnByValue: true
    });
    console.log('__setPreviewTarget type:', check?.result?.value);

    // Check onSetPreviewTarget
    const check2 = await send('Runtime.evaluate', {
      expression: `typeof window.anakotDesktop.onSetPreviewTarget`,
      returnByValue: true
    });
    console.log('onSetPreviewTarget type:', check2?.result?.value);

    ws.close();
    process.exit(0);
  });

  ws.on('error', e => { console.error('Error:', e.message); process.exit(1); });
}

main().catch(console.error);
