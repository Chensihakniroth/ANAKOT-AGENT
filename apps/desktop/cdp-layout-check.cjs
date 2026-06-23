const WebSocket = require('ws');
const http = require('http');
const PORT = '9223';
const DURATION = 20;

http.get(`http://127.0.0.1:${PORT}/json`, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', async () => {
    const targets = JSON.parse(d);
    const page = targets.find(t => t.type === 'page');
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
      await send('Runtime.enable');
      
      // Get layout info
      const layout = await send('Runtime.evaluate', {
        expression: `(function() {
          const editors = document.querySelectorAll('.monaco-editor');
          if (!editors.length) return 'no editors';
          // Find the editor instance via the data attribute or internal key
          const editorEl = editors[0];
          // Try to get the editor instance from the internal Monaco registry
          const editorKey = Object.keys(editorEl).find(k => k.startsWith('_reactFiber') || k.startsWith('__vue'));
          
          // Get layout info from the DOM
          const viewZone = editorEl.querySelector('.view-lines');
          const gutter = editorEl.querySelector('.margin-view-overlays');
          const lineNums = editorEl.querySelectorAll('.line-numbers');
          
          return JSON.stringify({
            editorCount: editors.length,
            viewZoneHeight: viewZone?.offsetHeight,
            gutterWidth: gutter?.offsetWidth,
            lineNumCount: lineNums.length,
            firstLineNum: lineNums[0]?.textContent?.trim(),
            lastLineNum: lineNums[lineNums.length - 1]?.textContent?.trim(),
            lineNumSample: Array.from(lineNums).slice(0, 10).map(l => l.textContent.trim()),
            editorBg: getComputedStyle(editorEl.querySelector('.monaco-editor-background') || editorEl).backgroundColor,
            gutterBg: gutter ? getComputedStyle(gutter).backgroundColor : 'no gutter',
          });
        })()`,
        returnByValue: true
      });
      console.log('Layout info:', layout?.result?.value);

      // Take a screenshot
      const screenshot = await send('Page.captureScreenshot', { format: 'png', quality: 80 });
      if (screenshot?.result?.data) {
        const fs = require('fs');
        fs.writeFileSync('D:\\School\\PROJECT\\anakot-agent\\apps\\desktop\\monaco-screenshot.png', Buffer.from(screenshot.result.data, 'base64'));
        console.log('Screenshot saved to monaco-screenshot.png');
      }

      ws.close();
      process.exit(0);
    });

    ws.on('error', e => { console.error('Error:', e.message); process.exit(1); });
  });
});
