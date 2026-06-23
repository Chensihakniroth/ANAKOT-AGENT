const WebSocket = require('ws');
const http = require('http');
const PORT = '9223';
const DURATION = 45;

http.get(`http://127.0.0.1:${PORT}/json`, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', async () => {
    const targets = JSON.parse(d);
    const page = targets.find(t => t.type === 'page');
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/devtools/page/${page.id}`);
    let id = 1;
    const pending = new Map();
    const msgs = [];

    function send(m, p = {}) {
      return new Promise((res, rej) => {
        const mid = id++; pending.set(mid, res);
        ws.send(JSON.stringify({ id: mid, method: m, params: p }));
        setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); rej(new Error(`Timeout: ${m}`)); } }, 15000);
      });
    }

    ws.on('open', async () => {
      await send('Runtime.enable');
      await send('Log.enable');
      await new Promise(r => setTimeout(r, 1000));

      // Step 1: Get preview target
      console.log('=== Step 1: Get preview target ===');
      const previewResult = await send('Runtime.evaluate', {
        expression: `(async () => {
          const p = await window.anakotDesktop.normalizePreviewTarget('D:\\\\School\\\\PROJECT\\\\anakot-agent\\\\apps\\\\desktop\\\\package.json');
          return JSON.stringify(p);
        })()`,
        returnByValue: true,
        awaitPromise: true
      });
      const previewStr = previewResult?.result?.value;
      console.log('Preview:', previewStr);

      // Step 2: Send to main process
      console.log('=== Step 2: Trigger preview via IPC ===');
      if (previewStr) {
        const parsed = JSON.parse(previewStr);
        const ipcResult = await send('Runtime.evaluate', {
          expression: `(async () => {
            try {
              const r = await window.anakotDesktop.__setPreviewTarget(${JSON.stringify(parsed)});
              return 'success: ' + JSON.stringify(r);
            } catch(e) {
              return 'error: ' + e.message;
            }
          })()`,
          returnByValue: true,
          awaitPromise: true
        });
        console.log('IPC result:', ipcResult?.result?.value);
      }

      // Step 3: Wait for React to render
      console.log('=== Step 3: Wait for render ===');
      await new Promise(r => setTimeout(r, 3000));

      // Step 4: Check state
      const state = await send('Runtime.evaluate', {
        expression: `JSON.stringify({
          hasMonaco: !!document.querySelector('.monaco-editor'),
          lineNums: document.querySelectorAll('.monaco-editor .line-numbers').length,
          bgColor: (el => el ? getComputedStyle(el).backgroundColor : 'not found')(document.querySelector('.monaco-editor-background')),
          bodyText: document.body.innerText.slice(0, 300)
        })`,
        returnByValue: true
      });
      console.log('State:', state?.result?.value);

      // Step 5: Wait more for delayed logs
      await new Promise(r => setTimeout(r, 3000));
    });

    ws.on('message', d => {
      const m = JSON.parse(d.toString());
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); return; }
      if (m.method === 'Runtime.consoleAPICalled') {
        const args = m.params.args.map(a => a.value || a.description || '').join(' ');
        const entry = `[${m.params.type.toUpperCase()}] ${args}`;
        msgs.push(entry);
        if (args.includes('[MonacoDiag]') || m.params.type === 'error' || m.params.type === 'warning') {
          console.log(entry);
        }
      }
    });

    ws.on('error', e => { console.error('Error:', e.message); process.exit(1); });

    setTimeout(() => {
      console.log('\n=== ALL MESSAGES ===');
      msgs.forEach(m => console.log(m));
      ws.close(); process.exit(0);
    }, DURATION * 1000);
  });
});
