/**
 * Bundly Agent SDK - Buy and Stake Example
 * 
 * Shows how an AI agent can buy tokens and stake them.
 */

import { Keypair, PublicKey } from '@solana/web3.js';
import { BundlyAgent } from '../src/BundlyAgent.js';
import fs from 'fs';

async function main() {
  console.log('🦞 Bundly Agent SDK - Buy and Stake Example\n');

  // Configuration
  const BUNDLE_MINT = process.env.BUNDLE_MINT || 'YOUR_BUNDLE_MINT_HERE';
  const SOL_TO_SPEND = parseFloat(process.env.SOL_AMOUNT || '0.1');
  const TOKENS_TO_STAKE = parseFloat(process.env.STAKE_AMOUNT || '1000');

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

  // Validate bundle mint
  if (BUNDLE_MINT === 'YOUR_BUNDLE_MINT_HERE') {
    console.error('❌ Please set BUNDLE_MINT environment variable');
    console.error('   Example: BUNDLE_MINT=7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU node buy-and-stake.js');
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
  
  const initialTokens = await agent.getTokenBalance(BUNDLE_MINT);
  console.log(`Token Balance: ${initialTokens} tokens`);
  console.log();

  // Buy tokens
  console.log(`🛒 Buying ${SOL_TO_SPEND} SOL worth of tokens...`);
  try {
    const buySig = await agent.buy(BUNDLE_MINT, {
      solAmount: SOL_TO_SPEND,
      minTokensOut: 0 // No slippage protection for demo
    });
    console.log(`   Signature: ${buySig}`);
    console.log();
  } catch (error) {
    console.error(`❌ Buy failed: ${error.message}`);
    process.exit(1);
  }

  // Check new balance
  const tokensAfterBuy = await agent.getTokenBalance(BUNDLE_MINT);
  const tokensBought = tokensAfterBuy - initialTokens;
  console.log(`✅ Purchased ${tokensBought} tokens`);
  console.log();

  // Stake tokens
  if (tokensBought >= TOKENS_TO_STAKE) {
    console.log(`🔒 Staking ${TOKENS_TO_STAKE} tokens...`);
    try {
      const stakeSig = await agent.stake(BUNDLE_MINT, {
        amount: TOKENS_TO_STAKE
      });
      console.log(`   Signature: ${stakeSig}`);
      console.log();
    } catch (error) {
      console.error(`❌ Stake failed: ${error.message}`);
      process.exit(1);
    }
  } else {
    console.log(`⚠️  Not enough tokens to stake (have ${tokensBought}, need ${TOKENS_TO_STAKE})`);
    console.log();
  }

  // Final state
  console.log('📊 Final State');
  console.log('─'.repeat(50));
  
  const finalSol = await agent.getBalance();
  const finalTokens = await agent.getTokenBalance(BUNDLE_MINT);
  
  console.log(`SOL Balance: ${finalSol.toFixed(4)} SOL (Δ ${(finalSol - initialSol).toFixed(4)})`);
  console.log(`Token Balance: ${finalTokens} tokens (Δ +${tokensBought})`);
  console.log();

  console.log('✅ Example complete!');
}

main().catch(err => {
  console.error('\n❌ Error:', err);
  process.exit(1);
});
