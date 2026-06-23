const WebSocket = require('ws');
const http = require('http');
const PORT = '9223';
const fs = require('fs');

http.get(`http://127.0.0.1:${PORT}/json`, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const page = JSON.parse(d).find(t => t.type === 'page');
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/devtools/page/${page.id}`);
    
    ws.on('open', () => {
      // Get layout info
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: {
          expression: `(function() {
            const editors = document.querySelectorAll('.monaco-editor');
            if (!editors.length) return JSON.stringify({error: 'no editors'});
            const editorEl = editors[0];
            const viewZone = editorEl.querySelector('.view-lines');
            const gutter = editorEl.querySelector('.margin-view-overlays');
            const lineNums = editorEl.querySelectorAll('.line-numbers');
            const bg = editorEl.querySelector('.monaco-editor-background');
            return JSON.stringify({
              editorCount: editors.length,
              viewZoneHeight: viewZone?.offsetHeight,
              gutterWidth: gutter?.offsetWidth,
              lineNumCount: lineNums.length,
              firstLineNum: lineNums[0]?.textContent?.trim(),
              lastLineNum: lineNums[lineNums.length - 1]?.textContent?.trim(),
              lineNumSample: Array.from(lineNums).slice(0, 15).map(l => l.textContent.trim()),
              editorBg: bg ? getComputedStyle(bg).backgroundColor : 'no bg',
              gutterBg: gutter ? getComputedStyle(gutter).backgroundColor : 'no gutter',
            });
          })()`,
          returnByValue: true
        }
      }));
    });
    
    ws.on('message', d => {
      const m = JSON.parse(d.toString());
      if (m.id === 1) {
        console.log('Layout:', m.result?.result?.value);
        
        // Now take screenshot
        ws.send(JSON.stringify({
          id: 2,
          method: 'Page.captureScreenshot',
          params: { format: 'png' }
        }));
      }
      if (m.id === 2) {
        if (m.result?.data) {
          fs.writeFileSync('D:\\School\\PROJECT\\anakot-agent\\apps\\desktop\\monaco-screenshot.png', Buffer.from(m.result.data, 'base64'));
          console.log('Screenshot saved');
        }
        ws.close();
        process.exit(0);
      }
    });
    
    ws.on('error', e => { console.error('Error:', e.message); process.exit(1); });
    setTimeout(() => { console.error('Timeout'); process.exit(1); }, 10000);
  });
});
