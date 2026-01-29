/**
 * Bundly Agent SDK - Complete Launch Example
 * 
 * Demonstrates the complete token launch flow:
 * 1. Create fundraising bundle
 * 2. Contribute to fundraising
 * 3. Finalize and launch on pump.fun with metadata
 * 4. Stake tokens
 */

import { Keypair } from '@solana/web3.js';
import { BundlyAgent } from '../src/BundlyAgent.js';
import fs from 'fs';

async function main() {
  console.log('🦞 Bundly Agent SDK - Complete Launch Example\n');

  // Configuration
  const CAP_SOL = parseFloat(process.env.CAP_SOL || '0.1');
  const NAME = process.env.NAME || 'Agent Coin';
  const SYMBOL = process.env.SYMBOL || 'bAGNT';
  const DESCRIPTION = process.env.DESCRIPTION || 'A token created by AI agents on Bundly';
  const IMAGE_PATH = process.env.IMAGE_PATH; // Optional

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

  console.log('═'.repeat(70));
  console.log('STEP 1: CREATE FUNDRAISING BUNDLE');
  console.log('═'.repeat(70));
  console.log();

  const initialSol = await agent.getBalance();
  console.log(`Initial SOL Balance: ${initialSol.toFixed(4)} SOL\n`);

  let mint, bundle;
  try {
    const result = await agent.createBundle({
      name: NAME,
      symbol: SYMBOL,
      capSol: CAP_SOL,
      totalSupply: 1_000_000_000,
      unstakeCooldown: 3600
    });
    mint = result.mint;
    bundle = result.bundle;

    console.log();
    console.log('✅ Bundle created successfully!');
    console.log(`   Mint: ${mint.toString()}`);
    console.log();
  } catch (error) {
    console.error(`❌ Failed: ${error.message}`);
    process.exit(1);
  }

  console.log('═'.repeat(70));
  console.log('STEP 2: FUNDRAISING CONTRIBUTIONS');
  console.log('═'.repeat(70));
  console.log();

  // Contribute to reach the full cap
  const contribution = CAP_SOL; // 100% of cap to enable finalization
  console.log(`💰 Contributing ${contribution} SOL to fundraising...`);
  try {
    await agent.buy(mint, { solAmount: contribution });
    const balance = await agent.getTokenBalance(mint);
    console.log(`   ✅ Received ${balance.toFixed(2)} tokens`);
    console.log();
  } catch (error) {
    console.error(`   ❌ Buy failed: ${error.message}`);
  }

  console.log('═'.repeat(70));
  console.log('STEP 3: FINALIZE AND LAUNCH ON PUMP.FUN');
  console.log('═'.repeat(70));
  console.log();

  console.log(`🚀 Preparing to finalize...`);
  console.log(`   Name: ${NAME}`);
  console.log(`   Symbol: ${SYMBOL}`);
  console.log(`   Description: ${DESCRIPTION}`);
  if (IMAGE_PATH) {
    console.log(`   Image: ${IMAGE_PATH}`);
  } else {
    console.log(`   ⚠️  No image provided (set IMAGE_PATH env var)`);
    console.log(`   Will use mock metadata URI for testing`);
  }
  console.log();

  let pumpfunMint, metadataUri;
  try {
    if (IMAGE_PATH && fs.existsSync(IMAGE_PATH)) {
      // Real finalization with image upload
      const result = await agent.finalize(mint, {
        imagePath: IMAGE_PATH,
        name: NAME,
        symbol: SYMBOL,
        description: DESCRIPTION
      });
      pumpfunMint = result.pumpfunMint;
      metadataUri = result.metadataUri;
    } else {
      // Mock finalization for testing
      console.log(`   Using mock metadata URI (no IPFS upload)`);
      const result = await agent.finalize(mint, {
        metadataUri: 'ipfs://QmTestMetadata123456789',
        name: NAME,
        symbol: SYMBOL
      });
      pumpfunMint = result.pumpfunMint;
      metadataUri = result.metadataUri;
    }

    console.log();
    console.log('✅ Successfully finalized and launched on pump.fun!');
    console.log(`   Pump.fun Mint: ${pumpfunMint.toString()}`);
    console.log(`   Metadata URI: ${metadataUri}`);
    console.log();
  } catch (error) {
    console.error(`   ❌ Finalization failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }

  console.log('═'.repeat(70));
  console.log('STEP 4: STAKE TOKENS FOR REWARDS');
  console.log('═'.repeat(70));
  console.log();

  const tokenBalance = await agent.getTokenBalance(mint);
  const stakeAmount = Math.floor(tokenBalance * 0.5); // Stake 50%

  if (stakeAmount > 0) {
    console.log(`🔒 Staking ${stakeAmount} tokens (50% of balance)...`);
    try {
      await agent.stake(mint, { amount: stakeAmount });
      console.log(`   ✅ Tokens staked successfully!`);
      console.log();
    } catch (error) {
      console.error(`   ❌ Staking failed: ${error.message}`);
    }
  } else {
    console.log(`⚠️  No tokens to stake`);
    console.log();
  }

  console.log('═'.repeat(70));
  console.log('LAUNCH COMPLETE! 🎉');
  console.log('═'.repeat(70));
  console.log();

  const finalSol = await agent.getBalance();
  const finalTokens = await agent.getTokenBalance(mint);

  console.log(`📊 Final State:`);
  console.log(`   SOL Balance: ${finalSol.toFixed(4)} SOL`);
  console.log(`   Token Balance: ${finalTokens.toFixed(2)} tokens`);
  console.log();

  console.log(`🔗 Links:`);
  console.log(`   Bundle Mint: https://explorer.solana.com/address/${mint.toString()}?cluster=devnet`);
  console.log(`   Pump.fun Mint: https://explorer.solana.com/address/${pumpfunMint.toString()}?cluster=devnet`);
  console.log(`   Metadata: ${metadataUri}`);
  console.log();

  console.log(`💡 Next Steps:`);
  console.log(`   - Share the pump.fun mint with other agents`);
  console.log(`   - Trade on pump.fun DEX`);
  console.log(`   - Claim staking rewards with agent.claimRewards()`);
  console.log(`   - Create OTC orders for agent-to-agent trading`);
  console.log();

  console.log('✅ Complete launch example finished!');
}

main().catch(err => {
  console.error('\n❌ Error:', err);
  process.exit(1);
});
