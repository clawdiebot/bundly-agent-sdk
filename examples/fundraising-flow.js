/**
 * Bundly Agent SDK - Fundraising Flow Example
 * 
 * Demonstrates the complete fundraising lifecycle:
 * 1. Create bundle
 * 2. Multiple agents contribute
 * 3. Agent exits before finalization
 * 4. Bundle finalizes when cap is hit
 */

import { Keypair } from '@solana/web3.js';
import { BundlyAgent } from '../src/BundlyAgent.js';
import fs from 'fs';

async function main() {
  console.log('🦞 Bundly Agent SDK - Fundraising Flow Example\n');

  // Configuration
  const CAP_SOL = parseFloat(process.env.CAP_SOL || '0.1');
  const TOTAL_SUPPLY = 1_000_000_000;

  // Load wallet
  const walletPath = process.env.AGENT_WALLET;
  
  let wallet;
  try {
    const keypairData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
    wallet = Keypair.fromSecretKey(new Uint8Array(keypairData));
    console.log(`✅ Loaded wallet: ${wallet.publicKey.toString()}\n`);
  } catch (e) {
    console.error(`❌ Failed to load wallet from ${walletPath}`);
    process.exit(1);
  }

  // Initialize agent
  const agent = new BundlyAgent({
    wallet,
    network: 'devnet'
  });

  console.log('═'.repeat(60));
  console.log('PHASE 1: CREATE FUNDRAISING BUNDLE');
  console.log('═'.repeat(60));
  console.log();

  const initialSol = await agent.getBalance();
  console.log(`Initial SOL Balance: ${initialSol.toFixed(4)} SOL\n`);

  // Create bundle
  console.log(`🎉 Creating fundraising bundle...`);
  console.log(`   Cap: ${CAP_SOL} SOL`);
  console.log(`   Total Supply: ${TOTAL_SUPPLY.toLocaleString()} tokens`);
  console.log(`   Unstake Cooldown: 1 hour`);
  console.log();

  let mint, bundle;
  try {
    const result = await agent.createBundle({
      name: "Agent Fundraise Test",
      symbol: "bAFT",
      capSol: CAP_SOL,
      totalSupply: TOTAL_SUPPLY,
      unstakeCooldown: 3600
    });
    mint = result.mint;
    bundle = result.bundle;

    console.log();
    console.log('✅ Bundle created!');
    console.log(`   Mint: ${mint.toString()}`);
    console.log(`   Bundle PDA: ${bundle.toString()}`);
    console.log();
  } catch (error) {
    console.error(`❌ Bundle creation failed: ${error.message}`);
    process.exit(1);
  }

  console.log('═'.repeat(60));
  console.log('PHASE 2: FUNDRAISING CONTRIBUTIONS');
  console.log('═'.repeat(60));
  console.log();

  // Contribution 1: 30% of cap
  const contribution1 = CAP_SOL * 0.3;
  console.log(`🛒 Contribution 1: ${contribution1} SOL (30% of cap)`);
  try {
    await agent.buy(mint, { solAmount: contribution1 });
    const balance1 = await agent.getTokenBalance(mint);
    console.log(`   ✅ Received ${balance1.toFixed(2)} tokens`);
    console.log();
  } catch (error) {
    console.error(`   ❌ Buy failed: ${error.message}`);
  }

  // Contribution 2: 20% of cap
  const contribution2 = CAP_SOL * 0.2;
  console.log(`🛒 Contribution 2: ${contribution2} SOL (20% of cap)`);
  try {
    await agent.buy(mint, { solAmount: contribution2 });
    const balance2 = await agent.getTokenBalance(mint);
    console.log(`   ✅ Total balance: ${balance2.toFixed(2)} tokens`);
    console.log();
  } catch (error) {
    console.error(`   ❌ Buy failed: ${error.message}`);
  }

  console.log('═'.repeat(60));
  console.log('PHASE 3: PRESALE EXIT (OPTIONAL)');
  console.log('═'.repeat(60));
  console.log();

  const shouldExit = process.env.TEST_EXIT === 'true';
  
  if (shouldExit) {
    console.log('🚪 Testing presale exit...');
    console.log('   ⚠️  This will return SOL minus 1% protocol fee');
    console.log();

    const balanceBefore = await agent.getTokenBalance(mint);
    const solBefore = await agent.getBalance();

    try {
      await agent.presaleExit(mint, { amount: balanceBefore * 0.5 }); // Exit 50%
      
      const balanceAfter = await agent.getTokenBalance(mint);
      const solAfter = await agent.getBalance();
      
      console.log();
      console.log(`   Token balance: ${balanceBefore.toFixed(2)} → ${balanceAfter.toFixed(2)}`);
      console.log(`   SOL balance: ${solBefore.toFixed(4)} → ${solAfter.toFixed(4)}`);
      console.log(`   ✅ Successfully exited 50% of position`);
    } catch (error) {
      console.error(`   ❌ Exit failed: ${error.message}`);
    }
  } else {
    console.log('ℹ️  Skipping presale exit test');
    console.log('   Set TEST_EXIT=true to test exit functionality');
  }
  console.log();

  console.log('═'.repeat(60));
  console.log('SUMMARY');
  console.log('═'.repeat(60));
  console.log();

  const finalSol = await agent.getBalance();
  const finalTokens = await agent.getTokenBalance(mint);
  const solSpent = initialSol - finalSol;

  console.log(`📊 Final State:`);
  console.log(`   SOL Balance: ${finalSol.toFixed(4)} SOL (spent: ${solSpent.toFixed(4)})`);
  console.log(`   Token Balance: ${finalTokens.toFixed(2)} tokens`);
  console.log();
  console.log(`📝 Bundle Info:`);
  console.log(`   Mint: ${mint.toString()}`);
  console.log(`   Cap: ${CAP_SOL} SOL`);
  console.log(`   Progress: ${(solSpent / CAP_SOL * 100).toFixed(1)}%`);
  console.log();
  console.log(`🔗 View on Explorer:`);
  console.log(`   https://explorer.solana.com/address/${mint.toString()}?cluster=devnet`);
  console.log();

  console.log('✅ Fundraising flow example complete!');
  console.log();
  console.log('💡 Next Steps:');
  console.log('   1. Have other agents contribute to reach the cap');
  console.log('   2. Once cap is hit, bundle auto-finalizes to pump.fun');
  console.log('   3. After finalization, stake tokens for rewards');
  console.log();
}

main().catch(err => {
  console.error('\n❌ Error:', err);
  process.exit(1);
});
