const WebSocket = require('ws');

const TARGET_ID = process.argv[2] || '2C3F80F2C9FE52A9190B64E3E71041C2';
const PORT = process.argv[3] || '9223';
const DURATION = parseInt(process.argv[4]) || 90;

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

  // Step 1: Wait for app to fully load, then explore the DOM
  await new Promise(r => setTimeout(r, 3000));

  // Step 2: Try to find and click the "Set working directory" button or folder picker
  const folderPickerResult = await evaluate(`
    (function() {
      // Look for buttons related to folder selection
      const buttons = Array.from(document.querySelectorAll('button, [role="button"], .btn, [class*="button"]'));
      const folderBtns = buttons.filter(b => {
        const text = b.textContent.toLowerCase();
        return text.includes('folder') || text.includes('directory') || text.includes('open') || text.includes('browse') || text.includes('set');
      });
      
      // Also look for the status bar area
      const statusBar = document.querySelector('[class*="status"], [class*="footer"], [class*="bar"]');
      
      // Look for any input that might be a folder picker
      const inputs = Array.from(document.querySelectorAll('input'));
      
      return JSON.stringify({
        folderButtons: folderBtns.map(b => ({ text: b.textContent.trim().slice(0,50), class: b.className.slice(0,80) })),
        statusBar: statusBar ? statusBar.className : 'not found',
        inputs: inputs.map(i => ({ type: i.type, placeholder: i.placeholder, class: i.className.slice(0,50) })),
        allButtonText: buttons.map(b => b.textContent.trim()).filter(t => t.length > 0 && t.length < 30).slice(0, 20)
      });
    })()
  `);
  console.log('[CDP] Folder picker probe:', folderPickerResult);

  // Step 3: Try to use the app's internal store/API to set a folder
  const storeResult = await evaluate(`
    (function() {
      // Check if there's a nanostore or React fiber we can access
      const root = document.querySelector('#root');
      if (!root) return 'no root element';
      
      // Try to find React fiber
      const fiber = root[Object.keys(root).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'))];
      if (!fiber) return 'no fiber found';
      
      return 'fiber found, traversing...';
    })()
  `);
  console.log('[CDP] Store probe:', storeResult);

  // Step 4: Try to directly invoke the file browser's folder selection
  // by finding the folder input or triggering a click on the folder picker
  const clickResult = await evaluate(`
    (function() {
      // The Explorer component has a folder picker button
      // Look for it by text content
      const allElements = Array.from(document.querySelectorAll('*'));
      const folderPicker = allElements.find(el => {
        const text = el.textContent.trim();
        return (text === 'Open Folder' || text === 'Select Folder' || text === 'Browse...' || text === 'Set Root') 
          && el.children.length === 0;
      });
      
      if (folderPicker) {
        folderPicker.click();
        return 'clicked: ' + folderPicker.textContent.trim();
      }
      
      // Try clicking on "NO PROJECT" text area
      const noProject = allElements.find(el => el.textContent.trim() === 'NO PROJECT' && el.children.length === 0);
      if (noProject) {
        noProject.click();
        return 'clicked NO PROJECT: ' + noProject.tagName + ' ' + noProject.className.slice(0, 50);
      }
      
      return 'nothing clickable found';
    })()
  `);
  console.log('[CDP] Click attempt:', clickResult);

  // Step 5: Wait and check if a file dialog appeared or if the explorer now shows files
  await new Promise(r => setTimeout(r, 2000));

  // Step 6: Check the DOM again for any file tree items
  const treeResult = await evaluate(`
    (function() {
      const allText = document.body.innerText;
      const hasFiles = allText.includes('.ts') || allText.includes('.tsx') || allText.includes('.js') || allText.includes('.json') || allText.includes('.cjs');
      
      // Look for any clickable file items
      const items = Array.from(document.querySelectorAll('div, span, li, a')).filter(el => {
        const text = el.textContent.trim();
        return (text.endsWith('.ts') || text.endsWith('.tsx') || text.endsWith('.js') || text.endsWith('.cjs') || text.endsWith('.json')) 
          && el.children.length === 0 && text.length < 100;
      });
      
      return JSON.stringify({
        hasFiles,
        fileItems: items.map(i => ({ text: i.textContent.trim(), tag: i.tagName, class: i.className.slice(0,60) })).slice(0, 10),
        bodyTextPreview: allText.slice(0, 500)
      });
    })()
  `);
  console.log('[CDP] Tree probe:', treeResult);

  // Step 7: If we have file items, click the first .cjs or .ts file to trigger Monaco
  const openFileResult = await evaluate(`
    (function() {
      const items = Array.from(document.querySelectorAll('div, span, li, a')).filter(el => {
        const text = el.textContent.trim();
        return (text.endsWith('.cjs') || text.endsWith('.ts') || text.endsWith('.tsx') || text.endsWith('.js'))
          && el.children.length === 0 && text.length < 100;
      });
      
      if (items.length > 0) {
        // Double-click to open in editor
        items[0].dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
        return 'double-clicked: ' + items[0].textContent.trim();
      }
      
      // If no file items, try to look at the right rail / preview area
      const previewArea = document.querySelector('[class*="preview"], [class*="right"]');
      return 'no files to click. Preview area: ' + (previewArea ? previewArea.className.slice(0,80) : 'not found');
    })()
  `);
  console.log('[CDP] Open file attempt:', openFileResult);

  // Step 8: Wait for Monaco to potentially mount
  await new Promise(r => setTimeout(r, 3000));

  // Step 9: Check if Monaco is now mounted
  const monacoResult = await evaluate(`
    (function() {
      const monacoEditor = document.querySelector('.monaco-editor');
      const monacoBackground = document.querySelector('.monaco-editor-background');
      const lineNumbers = document.querySelectorAll('.monaco-editor .line-numbers');
      
      return JSON.stringify({
        monacoEditor: !!monacoEditor,
        monacoBackground: !!monacoBackground,
        lineNumbersCount: lineNumbers.length,
        lineNumbersText: Array.from(lineNumbers).slice(0,5).map(el => el.textContent.trim()),
        monacoEditorClass: monacoEditor?.className?.slice(0, 100) || 'N/A',
        allText: document.body.innerText.slice(0, 300)
      });
    })()
  `);
  console.log('[CDP] Monaco probe:', monacoResult);

  // Step 10: If still no Monaco, try to find and use the preview file functionality
  // by looking at the chat messages for file attachments
  const chatResult = await evaluate(`
    (function() {
      // Look for any file references in the chat area
      const chatArea = document.querySelector('[class*="chat"], [class*="message"]');
      
      // Look for the right rail tabs (Preview, Files, etc.)
      const tabs = Array.from(document.querySelectorAll('[role="tab"], [class*="tab"]'));
      
      // Look for any "Preview" button
      const previewBtns = Array.from(document.querySelectorAll('button, [role="button"], span, div')).filter(el => {
        const text = el.textContent.trim().toLowerCase();
        return (text === 'preview' || text === 'files' || text === 'editor') && el.children.length === 0;
      });
      
      return JSON.stringify({
        chatArea: chatArea ? chatArea.className.slice(0,80) : 'not found',
        tabs: tabs.map(t => ({ text: t.textContent.trim().slice(0,30), class: t.className.slice(0,50) })).slice(0,10),
        previewBtns: previewBtns.map(b => ({ text: b.textContent.trim(), class: b.className.slice(0,50) }))
      });
    })()
  `);
  console.log('[CDP] Chat/preview probe:', chatResult);

  console.log('[CDP] Waiting for remaining time to capture any late console messages...');
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
