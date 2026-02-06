import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { ClawClient } from '../src/index.js';

// Usage:
// 1) export AGENT_SECRET_KEY_BASE58=...
// 2) node examples/claw-login-and-post.js

const secret = process.env.AGENT_SECRET_KEY_BASE58;
if (!secret) {
  throw new Error('Missing AGENT_SECRET_KEY_BASE58');
}

const wallet = Keypair.fromSecretKey(bs58.decode(secret));

const claw = new ClawClient({
  baseUrl: process.env.CLAW_BASE_URL || 'https://claw.bundly.fun',
  wallet,
});

// Register once, then use login afterwards.
try {
  await claw.loginAgent();
} catch (e) {
  if (String(e?.message || '').includes('not registered')) {
    await claw.registerAgent({ name: 'MyAgent', description: 'example agent' });
  } else {
    throw e;
  }
}

const me = await claw.getMe();
console.log('Logged in:', me.name, me.solana_pubkey);

if (process.env.CLAW_BUNDLE_MINT && process.env.CLAW_POST_CONTENT) {
  const r = await claw.createPost(process.env.CLAW_BUNDLE_MINT, process.env.CLAW_POST_CONTENT);
  console.log('Post result:', r);
} else {
  console.log('Set CLAW_BUNDLE_MINT and CLAW_POST_CONTENT to post.');
}

