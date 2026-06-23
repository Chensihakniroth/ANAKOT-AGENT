const WebSocket = require('ws');
const http = require('http');
const PORT = '9223';
const DURATION = 30;

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
  const msgs = [];

  function send(m, p = {}) {
    return new Promise((res, rej) => {
      const mid = id++; pending.set(mid, res);
      ws.send(JSON.stringify({ id: mid, method: m, params: p }));
      setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); rej(new Error(`Timeout: ${m}`)); } }, 10000);
    });
  }

  async function eval_(expr, awaitPromise = false) {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise });
    if (r?.exceptionDetails) console.error('JS Error:', r.exceptionDetails.text);
    return r?.result?.value;
  }

  ws.on('open', async () => {
    await send('Runtime.enable');
    await send('Log.enable');
    await new Promise(r => setTimeout(r, 2000));

    // Step 1: Get preview target
    console.log('=== Getting preview target ===');
    const preview = await eval_(`
      (async () => {
        const d = window.anakotDesktop;
        if (!d) return 'no desktop';
        const p = await d.normalizePreviewTarget('D:\\\\School\\\\PROJECT\\\\anakot-agent\\\\apps\\\\desktop\\\\package.json');
        return JSON.stringify(p);
      })()
    `, true);
    console.log('Preview:', preview);

    // Step 2: Send to main process which will forward to renderer
    console.log('=== Sending setPreviewTarget IPC ===');
    if (preview && preview !== 'no desktop') {
      const parsed = JSON.parse(preview);
      // Call the preload method that sends IPC to main process
      const result = await eval_(`
        (async () => {
          try {
            const r = await window.anakotDesktop.__setPreviewTarget(${JSON.stringify(parsed)});
            return 'IPC result: ' + JSON.stringify(r);
          } catch(e) {
            return 'IPC error: ' + e.message;
          }
        })()
      `, true);
      console.log('IPC result:', result);
    }

    // Step 3: Wait and check
    await new Promise(r => setTimeout(r, 3000));
    console.log('=== Checking state ===');
    const state = await eval_(`
      JSON.stringify({
        hasMonaco: !!document.querySelector('.monaco-editor'),
        hasPreview: document.body.innerText.includes('package.json'),
        bodyText: document.body.innerText.slice(0, 300)
      })
    `);
    console.log('State:', state);

    // Step 4: If Monaco mounted, wait more for the 500ms delayed logs
    await new Promise(r => setTimeout(r, 2000));
    console.log('=== Final check ===');
    const final = await eval_(`
      JSON.stringify({
        hasMonaco: !!document.querySelector('.monaco-editor'),
        lineNums: document.querySelectorAll('.monaco-editor .line-numbers').length,
        bodyText: document.body.innerText.slice(0, 300)
      })
    `);
    console.log('Final:', final);
  });

  ws.on('message', d => {
    const m = JSON.parse(d.toString());
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); return; }
    if (m.method === 'Runtime.consoleAPICalled') {
      const args = m.params.args.map(a => a.value || a.description || '').join(' ');
      const entry = `[${m.params.type.toUpperCase()}] ${args}`;
      msgs.push(entry);
      if (args.includes('[MonacoDiag]') || m.params.type === 'error' || m.params.type === 'warning') console.log(entry);
    }
  });

  ws.on('error', e => console.error('Error:', e.message));

  setTimeout(() => {
    console.log('\n=== ALL MESSAGES ===');
    msgs.forEach(m => console.log(m));
    ws.close(); process.exit(0);
  }, DURATION * 1000);
}

main().catch(console.error);
