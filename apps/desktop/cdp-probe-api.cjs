const WebSocket = require('ws');

const TARGET_ID = process.argv[2] || '2C3F80F2C9FE52A9190B64E3E71041C2';
const PORT = process.argv[3] || '9223';
const DURATION = parseInt(process.argv[4]) || 120;

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
      if (pending.has(msgId)) {
        pending.delete(msgId);
        reject(new Error(`Timeout for method ${method}`));
      }
    }, 10000);
  });
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: false,
  });
  return result?.result?.value;
}

ws.on('open', async () => {
  console.log(`[CDP] Connected. Collecting console for ${DURATION}s...`);
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');

  await new Promise(r => setTimeout(r, 2000));

  // Step 1: Try to find the folder picker button and understand its behavior
  const btnInfo = await evaluate(`
    (function() {
      const btns = Array.from(document.querySelectorAll('button, [role="button"], div, span'));
      const folderBtn = btns.find(b => b.textContent.trim() === 'No folder selected');
      if (!folderBtn) return 'no folder button found';
      
      // Get all event listeners (if any)
      const info = {
        tag: folderBtn.tagName,
        class: folderBtn.className,
        id: folderBtn.id,
        onclick: folderBtn.onclick ? 'has onclick' : 'no onclick',
        parentClass: folderBtn.parentElement?.className?.slice(0,80),
        grandparentClass: folderBtn.parentElement?.parentElement?.className?.slice(0,80),
      };
      return JSON.stringify(info);
    })()
  `);
  console.log('[CDP] Folder button info:', btnInfo);

  // Step 2: Click the "No folder selected" button
  const clickResult = await evaluate(`
    (function() {
      const btns = Array.from(document.querySelectorAll('button, [role="button"], div, span'));
      const folderBtn = btns.find(b => b.textContent.trim() === 'No folder selected');
      if (folderBtn) {
        folderBtn.click();
        return 'clicked: ' + folderBtn.tagName + ' ' + folderBtn.className.slice(0,50);
      }
      return 'not found';
    })()
  `);
  console.log('[CDP] Click result:', clickResult);

  // Step 3: Wait and check if a native dialog appeared or if there's an input
  await new Promise(r => setTimeout(r, 2000));

  const afterClick = await evaluate(`
    (function() {
      // Check for any new inputs, dialogs, or changes
      const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
      const dialogs = Array.from(document.querySelectorAll('dialog, [role="dialog"], [class*="dialog"], [class*="modal"]'));
      const allText = document.body.innerText.slice(0, 500);
      
      return JSON.stringify({
        fileInputs: inputs.map(i => ({ accept: i.accept, class: i.className })),
        dialogs: dialogs.map(d => ({ tag: d.tagName, class: d.className.slice(0,80), text: d.textContent.slice(0,100) })),
        bodyText: allText
      });
    })()
  `);
  console.log('[CDP] After click:', afterClick);

  // Step 4: If there's a file input, try to set a directory
  const setDirResult = await evaluate(`
    (function() {
      const fileInputs = document.querySelectorAll('input[type="file"]');
      if (fileInputs.length > 0) {
        return 'found ' + fileInputs.length + ' file inputs';
      }
      
      // Check if the app has an IPC method to set folder
      // Look for window.anakotDesktop or similar
      const desktop = (window as any).anakotDesktop;
      if (desktop) {
        return 'anakotDesktop API: ' + Object.keys(desktop).join(', ');
      }
      
      return 'no file inputs, no desktop API';
    })()
  `);
  console.log('[CDP] Set dir result:', setDirResult);

  // Step 5: Try to use the Electron IPC to set a folder directly
  // Or try to find the app's internal store
  const ipcResult = await evaluate(`
    (function() {
      // Check for electron IPC
      const electron = (window as any).electron;
      const ipcRenderer = (window as any).ipcRenderer;
      const desktop = (window as any).anakotDesktop;
      
      // Try to find the store via window
      const storeKeys = Object.keys(window).filter(k => k.startsWith('$') || k.includes('store') || k.includes('Store'));
      
      return JSON.stringify({
        hasElectron: !!electron,
        hasIpcRenderer: !!ipcRenderer,
        hasDesktop: !!desktop,
        desktopMethods: desktop ? Object.keys(desktop) : [],
        storeKeys: storeKeys.slice(0, 20)
      });
    })()
  `);
  console.log('[CDP] IPC probe:', ipcResult);

  // Step 6: Try to directly invoke the file system API to set a folder
  const fsResult = await evaluate(`
    (function() {
      const desktop = (window as any).anakotDesktop;
      if (!desktop) return 'no desktop API';
      
      // Check what methods are available
      const methods = Object.keys(desktop);
      
      // Try to read a known file to test the API
      if (desktop.readFileText) {
        return 'readFileText available. Methods: ' + methods.join(', ');
      }
      
      return 'Methods: ' + methods.join(', ');
    })()
  `);
  console.log('[CDP] FS probe:', fsResult);

  // Step 7: Try to use the preload API to set the working directory
  // The app likely has a way to set the folder via IPC
  const wdResult = await evaluate(`
    (function() {
      const desktop = (window as any).anakotDesktop;
      if (!desktop) return 'no desktop API';
      
      // Look for setWorkingDirectory, setFolder, openFolder, etc.
      const methods = Object.keys(desktop);
      const folderMethods = methods.filter(m => 
        m.toLowerCase().includes('folder') || 
        m.toLowerCase().includes('directory') || 
        m.toLowerCase().includes('root') ||
        m.toLowerCase().includes('path') ||
        m.toLowerCase().includes('work')
      );
      
      return JSON.stringify({ allMethods: methods, folderMethods });
    })()
  `);
  console.log('[CDC] Working directory API:', wdResult);

  console.log('[CDP] Waiting for remaining time...');
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg.result);
    pending.delete(msg.id);
    return;
  }

  if (msg.method === 'Runtime.consoleAPICalled') {
    const args = msg.params.args.map(a => {
      if (a.type === 'string') return a.value;
      if (a.type === 'number' || a.type === 'boolean') return String(a.value);
      if (a.description) return a.description;
      try { return JSON.stringify(a); } catch { return String(a); }
    }).join(' ');
    const entry = `[CONSOLE ${msg.params.type.toUpperCase()}] ${args}`;
    allMessages.push(entry);
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
