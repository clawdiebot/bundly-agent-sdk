/**
 * Bundly Agent SDK - Create Bundle Example
 * 
 * Shows how to create a new bundle with 0.1 SOL cap for testing.
 */

import { Keypair } from '@solana/web3.js';
import { BundlyAgent } from '../src/BundlyAgent.js';
import fs from 'fs';

async function main() {
  console.log('🦞 Bundly Agent SDK - Create Bundle Example\n');

  // Configuration
  const CAP_SOL = parseFloat(process.env.CAP_SOL || '0.1');
  const TOTAL_SUPPLY = parseFloat(process.env.TOTAL_SUPPLY || '1000000000'); // 1 billion tokens
  const NAME = process.env.NAME || 'Test Bundle';
  const SYMBOL = process.env.SYMBOL || 'TEST';

  // Load wallet
  const walletPath = process.env.AGENT_WALLET;
  
  let wallet;
  try {
    const keypairData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
    wallet = Keypair.fromSecretKey(new Uint8Array(keypairData));
    console.log(`✅ Loaded wallet: ${wallet.publicKey.toString()}\n`);
  } catch (e) {
    console.error(`❌ Failed to load wallet from ${walletPath}`);
    console.error(`   Error: ${e.message}`);
    process.exit(1);
  }

  // Initialize agent
  const agent = new BundlyAgent({
    wallet,
    network: 'devnet'
  });

  console.log('📊 Initial State');
  console.log('─'.repeat(50));
  
  const initialSol = await agent.getBalance();
  console.log(`SOL Balance: ${initialSol.toFixed(4)} SOL`);
  console.log();

  // Check if we have enough SOL
  if (initialSol < 0.5) {
    console.log(`⚠️  Low SOL balance. Requesting airdrop...`);
    try {
      await agent.requestAirdrop(2);
      const newBalance = await agent.getBalance();
      console.log(`✅ New balance: ${newBalance.toFixed(4)} SOL\n`);
    } catch (e) {
      console.error(`❌ Airdrop failed: ${e.message}`);
      console.error(`   Please airdrop manually at https://faucet.solana.com`);
      process.exit(1);
    }
  }

  // Create bundle
  console.log(`🎉 Creating bundle...`);
  console.log(`   Name: ${NAME}`);
  console.log(`   Symbol: ${SYMBOL}`);
  console.log(`   Cap: ${CAP_SOL} SOL`);
  console.log(`   Total Supply: ${TOTAL_SUPPLY.toLocaleString()} tokens`);
  console.log();

  try {
    const { signature, mint, bundle } = await agent.createBundle({
      name: NAME,
      symbol: SYMBOL,
      capSol: CAP_SOL,
      totalSupply: TOTAL_SUPPLY,
      unstakeCooldown: 3600 // 1 hour for testing
    });

    console.log();
    console.log('✅ Bundle Created Successfully!');
    console.log('─'.repeat(50));
    console.log(`Signature: ${signature}`);
    console.log(`Mint: ${mint.toString()}`);
    console.log(`Bundle PDA: ${bundle.toString()}`);
    console.log();
    console.log(`🔗 View on Solana Explorer:`);
    console.log(`   https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    console.log(`   https://explorer.solana.com/address/${mint.toString()}?cluster=devnet`);
    console.log();

    // Test buying into the bundle
    console.log(`🛒 Testing buy with 0.01 SOL...`);
    try {
      const buySig = await agent.buy(mint, { solAmount: 0.01 });
      console.log(`   ✅ Buy successful: ${buySig}`);
      
      const tokenBalance = await agent.getTokenBalance(mint);
      console.log(`   Token balance: ${tokenBalance} tokens`);
    } catch (buyError) {
      console.error(`   ❌ Buy failed: ${buyError.message}`);
    }
    console.log();

    // Save bundle info
    const bundleInfo = {
      mint: mint.toString(),
      bundle: bundle.toString(),
      name: NAME,
      symbol: SYMBOL,
      cap: CAP_SOL,
      totalSupply: TOTAL_SUPPLY,
      createdAt: new Date().toISOString(),
      signature
    };

    const bundleInfoPath = './test-bundle-info.json';
    fs.writeFileSync(bundleInfoPath, JSON.stringify(bundleInfo, null, 2));
    console.log(`📝 Bundle info saved to: ${bundleInfoPath}`);
    console.log();

  } catch (error) {
    console.error(`❌ Bundle creation failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }

  // Final state
  console.log('📊 Final State');
  console.log('─'.repeat(50));
  
  const finalSol = await agent.getBalance();
  console.log(`SOL Balance: ${finalSol.toFixed(4)} SOL`);
  console.log();

  console.log('✅ Example complete!');
}

main().catch(err => {
  console.error('\n❌ Error:', err);
  process.exit(1);
});
