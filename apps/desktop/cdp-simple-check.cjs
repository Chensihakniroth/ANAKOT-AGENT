const WebSocket = require('ws');
const http = require('http');
const PORT = '9223';

http.get(`http://127.0.0.1:${PORT}/json`, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', async () => {
    const targets = JSON.parse(d);
    const page = targets.find(t => t.type === 'page');
    console.log('Connecting to:', page.url);
    
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/devtools/page/${page.id}`);
    
    ws.on('open', () => {
      // Send Runtime.evaluate directly without enabling
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: {
          expression: `JSON.stringify({keys: Object.keys(window.anakotDesktop), hasSetPreview: typeof window.anakotDesktop.__setPreviewTarget, hasOnSet: typeof window.anakotDesktop.onSetPreviewTarget})`,
          returnByValue: true
        }
      }));
    });
    
    ws.on('message', d => {
      const m = JSON.parse(d.toString());
      if (m.id === 1) {
        console.log('Result:', m.result?.result?.value);
        ws.close();
        process.exit(0);
      }
    });
    
    ws.on('error', e => { console.error('Error:', e.message); process.exit(1); });
    
    setTimeout(() => { console.error('Timeout'); process.exit(1); }, 10000);
  });
});
