/**
 * Bundly Agent SDK - Basic Usage Example
 * 
 * Shows how an AI agent can interact with Bundly contracts.
 */

import { Keypair } from '@solana/web3.js';
import { BundlyAgent } from '../src/BundlyAgent.js';
import fs from 'fs';

async function main() {
  console.log('🦞 Bundly Agent SDK - Basic Usage Example\n');

  // Load wallet from environment variable or generate a new one
  // Set AGENT_WALLET to path of your keypair JSON file
  let wallet;
  
  if (process.env.AGENT_WALLET) {
    try {
      const keypairData = JSON.parse(fs.readFileSync(process.env.AGENT_WALLET, 'utf8'));
      wallet = Keypair.fromSecretKey(new Uint8Array(keypairData));
      console.log(`✅ Loaded wallet: ${wallet.publicKey.toString()}\n`);
    } catch (e) {
      console.error(`❌ Failed to load wallet from ${process.env.AGENT_WALLET}`);
      console.error(`   Make sure the file exists and contains a valid Solana keypair`);
      process.exit(1);
    }
  } else {
    // Generate a new keypair for testing
    wallet = Keypair.generate();
    console.log(`✅ Generated new wallet: ${wallet.publicKey.toString()}`);
    console.log(`⚠️  This is a temporary wallet. Set AGENT_WALLET env var to use your own.\n`);
  }

  // Initialize agent
  const agent = new BundlyAgent({
    wallet,
    network: 'devnet'
  });

  console.log('\n📊 Checking balance...');
  const balance = await agent.getBalance();
  console.log(`   SOL Balance: ${balance.toFixed(4)} SOL`);

  // Request airdrop if balance is low (devnet only)
  if (balance < 0.1) {
    console.log('\n💧 Balance low, requesting airdrop...');
    await agent.requestAirdrop(1);
    const newBalance = await agent.getBalance();
    console.log(`   New Balance: ${newBalance.toFixed(4)} SOL`);
  }

  console.log('\n🔍 Getting my bundles...');
  const bundles = await agent.getMyBundles();
  console.log(`   Found ${bundles.length} token holdings:`);
  bundles.forEach(bundle => {
    console.log(`     - ${bundle.mint}: ${bundle.balance} tokens`);
  });

  console.log('\n✅ Basic usage example complete!');
  console.log('\nNext steps:');
  console.log('  - Use agent.buy(mint, { solAmount: 0.5 }) to buy tokens');
  console.log('  - Use agent.stake(mint, { amount: 1000000 }) to stake');
  console.log('  - Check examples/coordinate-launch.js for multi-agent coordination');
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
