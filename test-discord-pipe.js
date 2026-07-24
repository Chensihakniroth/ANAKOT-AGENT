/**
 * Quick test: can we connect to Discord IPC pipes?
 */
const net = require('net');
const { Client } = require('discord-rpc');

async function test() {
  console.log('1️⃣  Testing raw pipe connection...');
  for (let id = 0; id < 5; id++) {
    try {
      await new Promise((resolve, reject) => {
        const pipePath = `\\\\?\\pipe\\discord-ipc-${id}`;
        const sock = net.createConnection(pipePath, () => {
          console.log(`   ✅ discord-ipc-${id} accepts connections`);
          sock.end();
          resolve(true);
        });
        sock.on('error', () => {
          console.log(`   ❌ discord-ipc-${id}: not available`);
          sock.destroy();
          resolve(false);
        });
        sock.setTimeout(1000, () => {
          sock.destroy();
          resolve(false);
        });
      });
    } catch (e) {
      console.log(`   error: ${e.message}`);
    }
  }

  console.log('\n2️⃣  Testing discord-rpc library connect...');
  const client = new Client({ transport: 'ipc' });
  client.on('ready', () => {
    console.log('   ✅ Connected! User:', client.user?.username || 'unknown');
    client.destroy();
    process.exit(0);
  });
  client.on('disconnected', () => console.log('   ⚠️  disconnected'));
  try {
    await client.login({ clientId: '1529157253356327114' });
    console.log('   login() returned OK');
  } catch (e) {
    console.log('   ❌ login failed:', e.message);
  }
  setTimeout(() => {
    console.log('   ⏱️  timed out waiting for ready');
    process.exit(1);
  }, 15000);
}

test().catch(e => {
  console.log('❌ Fatal:', e.message);
  process.exit(1);
});
