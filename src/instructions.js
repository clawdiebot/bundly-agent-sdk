/**
 * Bundly Agent SDK - Instruction Builders
 * 
 * Build transactions for interacting with Bundly smart contract
 * using the Anchor IDL.
 */

import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { Connection, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, TransactionInstruction } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import BN from 'bn.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  BUNDLY_PROGRAM_ID,
  GLOBAL_FEE_WALLET,
  PUMPFUN_PROGRAM_ID,
  METADATA_PROGRAM_ID
} from './constants.js';

import {
  deriveBundlePda,
  deriveEscrowPda,
  deriveTokenVaultPda,
  deriveFeeVaultPda,
  deriveStakingVaultPda,
  deriveUserStakePda,
  deriveMintPda,
  deriveUnstakeRequestPda,
  deriveUnstakeVaultPda,
  deriveOrderPda,
  deriveOrderVaultPda,
  deriveGlobalFeeTokenAccount
} from './accounts.js';

// Load IDL
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const idlPath = path.join(__dirname, '../idl/bundly_program.json');
const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));

/**
 * Create an Anchor Program instance
 */
export function createProgram(connection, wallet) {
  const provider = new AnchorProvider(
    connection,
    new Wallet(wallet),
    { commitment: 'confirmed' }
  );
  
  return new Program(idl, provider);
}

/**
 * Build init_bundle instruction (create new bundle)
 */
export async function buildInitBundleInstruction({ 
  program, 
  creator, 
  nonce, 
  decimals = 6,
  capLamports,
  totalSupply,
  unstakeCooldown = 86400 // 24 hours default
}) {
  const [mintPda] = await deriveMintPda(creator, nonce);
  const [bundlePda] = await deriveBundlePda(mintPda);
  const [escrowPda] = await deriveEscrowPda(mintPda);
  
  const ix = await program.methods
    .initBundle(
      new BN(nonce),
      decimals,
      new BN(capLamports),
      new BN(totalSupply),
      new BN(unstakeCooldown)
    )
    .accounts({
      creator,
      mint: mintPda,
      bundle: bundlePda,
      escrow: escrowPda,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY
    })
    .instruction();
  
  return { instruction: ix, mint: mintPda, bundle: bundlePda };
}

/**
 * Build swap (buy/sell) instruction
 */
export async function buildSwapInstruction({ program, mint, user, amountLamports, minTokensOut = 0 }) {
  const [bundlePda] = await deriveBundlePda(mint);
  const [escrowPda] = await deriveEscrowPda(mint);
  const [userStakePda] = await deriveUserStakePda(bundlePda, user);
  
  const userTokenAccount = getAssociatedTokenAddressSync(mint, user);
  
  const ix = await program.methods
    .swap(new BN(amountLamports), new BN(minTokensOut))
    .accounts({
      buyer: user,
      bundle: bundlePda,
      escrow: escrowPda,
      mint,
      buyerTokens: userTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      globalFeeWallet: GLOBAL_FEE_WALLET,
      userStake: userStakePda
    })
    .instruction();
  
  return { instruction: ix };
}

/**
 * Build presale_exit instruction (exit fundraising before finalization)
 */
export async function buildPresaleExitInstruction({ program, mint, user, amountBtoken }) {
  const [bundlePda] = await deriveBundlePda(mint);
  const [escrowPda] = await deriveEscrowPda(mint);
  const [userStakePda] = await deriveUserStakePda(bundlePda, user);
  
  const userBtokenAccount = getAssociatedTokenAddressSync(mint, user);
  
  const ix = await program.methods
    .presaleExit(new BN(amountBtoken))
    .accounts({
      user,
      bundle: bundlePda,
      mint,
      userBtoken: userBtokenAccount,
      escrow: escrowPda,
      userStake: userStakePda,
      globalFeeWallet: GLOBAL_FEE_WALLET,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
    })
    .instruction();
  
  return { instruction: ix };
}

/**
 * Build deposit_stake instruction
 */
export async function buildDepositStakeInstruction({ program, mint, user, amount, realMint }) {
  const [bundlePda] = await deriveBundlePda(mint);
  const [userStakePda] = await deriveUserStakePda(bundlePda, user);
  const [stakingVaultPda] = await deriveStakingVaultPda(bundlePda);
  const [feeVaultPda] = await deriveFeeVaultPda(bundlePda);
  const resolvedRealMint = realMint || mint;

  const userBtokenAccount = getAssociatedTokenAddressSync(mint, user);
  const userRealTokenAccount = getAssociatedTokenAddressSync(resolvedRealMint, user);
  
  const ix = await program.methods
    .depositStake(new BN(amount))
    .accounts({
      user,
      bundle: bundlePda,
      mint,
      realMint: resolvedRealMint,
      userRealToken: userRealTokenAccount,
      userBtoken: userBtokenAccount,
      stakingVault: stakingVaultPda,
      feeVault: feeVaultPda,
      userStake: userStakePda,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId
    })
    .instruction();
  
  return { instruction: ix };
}

/**
 * Build prepare_unstake instruction
 */
export async function buildPrepareUnstakeInstruction({ program, mint, user }) {
  const [bundlePda] = await deriveBundlePda(mint);
  const [userStakePda] = await deriveUserStakePda(bundlePda, user);
  const [unstakeRequestPda] = await deriveUnstakeRequestPda(bundlePda, user);
  
  const ix = await program.methods
    .prepareUnstake()
    .accounts({
      user,
      bundle: bundlePda,
      mint,
      unstakeRequest: unstakeRequestPda,
      userStake: userStakePda,
      systemProgram: SystemProgram.programId
    })
    .instruction();
  
  return { instruction: ix };
}

/**
 * Build execute_unstake instruction
 */
export async function buildExecuteUnstakeInstruction({ program, mint, user, amountBtoken, realMint }) {
  const [bundlePda] = await deriveBundlePda(mint);
  const [userStakePda] = await deriveUserStakePda(bundlePda, user);
  const [unstakeRequestPda] = await deriveUnstakeRequestPda(bundlePda, user);
  const [unstakeVaultPda] = await deriveUnstakeVaultPda(mint);
  const [stakingVaultPda] = await deriveStakingVaultPda(bundlePda);
  const [feeVaultPda] = await deriveFeeVaultPda(bundlePda);
  const resolvedRealMint = realMint || mint;
  const [globalFeeTokenAccount] = await deriveGlobalFeeTokenAccount(resolvedRealMint);
  
  const userBtokenAccount = getAssociatedTokenAddressSync(mint, user);
  const resolvedRealMintPubkey = resolvedRealMint;
  
  const ix = await program.methods
    .executeUnstake(new BN(amountBtoken))
    .accounts({
      user,
      bundle: bundlePda,
      mint,
      realMint: resolvedRealMintPubkey,
      userBtoken: userBtokenAccount,
      stakingVault: stakingVaultPda,
      feeVault: feeVaultPda,
      unstakeRequest: unstakeRequestPda,
      unstakeVault: unstakeVaultPda,
      userStake: userStakePda,
      tokenProgram: TOKEN_PROGRAM_ID,
      globalFeeTokenAccount,
      globalFeeWallet: GLOBAL_FEE_WALLET
    })
    .instruction();
  
  return { instruction: ix };
}

/**
 * Build withdraw_unstaked instruction
 */
export async function buildWithdrawUnstakedInstruction({ program, mint, user, destination, realMint }) {
  const [bundlePda] = await deriveBundlePda(mint);
  const [userStakePda] = await deriveUserStakePda(bundlePda, user);
  const [unstakeRequestPda] = await deriveUnstakeRequestPda(bundlePda, user);
  const [unstakeVaultPda] = await deriveUnstakeVaultPda(mint);

  const resolvedRealMint = realMint || mint;
  const destinationAccount = destination || getAssociatedTokenAddressSync(resolvedRealMint, user);
  
  const ix = await program.methods
    .withdrawUnstaked()
    .accounts({
      user,
      bundle: bundlePda,
      mint,
      realMint: resolvedRealMint,
      unstakeRequest: unstakeRequestPda,
      unstakeVault: unstakeVaultPda,
      destination: destinationAccount,
      userStake: userStakePda,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId
    })
    .instruction();
  
  return { instruction: ix };
}

/**
 * Build claim_rewards instruction
 */
export async function buildClaimRewardsInstruction({ program, mint, user, realMint }) {
  const [bundlePda] = await deriveBundlePda(mint);
  const [userStakePda] = await deriveUserStakePda(bundlePda, user);
  const [stakingVaultPda] = await deriveStakingVaultPda(bundlePda);
  const [feeVaultPda] = await deriveFeeVaultPda(bundlePda);
  const resolvedRealMint = realMint || mint;
  const [globalFeeTokenAccount] = await deriveGlobalFeeTokenAccount(resolvedRealMint);
  
  const userBtokenAccount = getAssociatedTokenAddressSync(mint, user);
  const userRealTokenAccount = getAssociatedTokenAddressSync(resolvedRealMint, user);
  
  const ix = await program.methods
    .claimRewards()
    .accounts({
      user,
      bundle: bundlePda,
      mint,
      realMint: resolvedRealMint,
      userBtoken: userBtokenAccount,
      userRealToken: userRealTokenAccount,
      stakingVault: stakingVaultPda,
      feeVault: feeVaultPda,
      userStake: userStakePda,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      globalFeeTokenAccount,
      globalFeeWallet: GLOBAL_FEE_WALLET
    })
    .instruction();
  
  return { instruction: ix };
}

/**
 * Build claim_rewards instruction (RAW - forces mint writable)
 * Workaround for CPI permission issues
 */
export async function buildClaimRewardsInstructionRaw({ programId, mint, user, realMint }) {
  const [bundlePda] = await deriveBundlePda(mint);
  const [userStakePda] = await deriveUserStakePda(bundlePda, user);
  const [stakingVaultPda] = await deriveStakingVaultPda(bundlePda);
  const [feeVaultPda] = await deriveFeeVaultPda(bundlePda);
  const resolvedRealMint = realMint || mint;
  const [globalFeeTokenAccount] = await deriveGlobalFeeTokenAccount(resolvedRealMint);
  
  const userBtokenAccount = getAssociatedTokenAddressSync(mint, user);
  const userRealTokenAccount = getAssociatedTokenAddressSync(resolvedRealMint, user);
  
  const data = getInstructionDiscriminator('claim_rewards');
  
  const keys = [
    { pubkey: user, isSigner: true, isWritable: true },
    { pubkey: bundlePda, isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: true }, // force writable
    { pubkey: resolvedRealMint, isSigner: false, isWritable: false },
    { pubkey: userBtokenAccount, isSigner: false, isWritable: true },
    { pubkey: userRealTokenAccount, isSigner: false, isWritable: true },
    { pubkey: stakingVaultPda, isSigner: false, isWritable: true },
    { pubkey: feeVaultPda, isSigner: false, isWritable: true },
    { pubkey: userStakePda, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: globalFeeTokenAccount, isSigner: false, isWritable: true },
    { pubkey: GLOBAL_FEE_WALLET, isSigner: false, isWritable: false }
  ];
  
  return { 
    instruction: new TransactionInstruction({ 
      programId: programId || BUNDLY_PROGRAM_ID, 
      keys, 
      data 
    }) 
  };
}

/**
 * Build create_order instruction (OTC order)
 */
export async function buildCreateOrderInstruction({ 
  program, 
  mint, 
  maker, 
  amount, 
  price, 
  isBuySide,
  idSeed 
}) {
  const [bundlePda] = await deriveBundlePda(mint);
  const [userStakePda] = await deriveUserStakePda(bundlePda, maker);
  const [orderPda] = await deriveOrderPda(mint, maker, idSeed);
  const [orderVaultPda] = await deriveOrderVaultPda(orderPda);
  
  const makerTokenAccount = getAssociatedTokenAddressSync(mint, maker);
  
  const ix = await program.methods
    .createOrder(
      new BN(amount),
      new BN(price),
      isBuySide,
      new BN(idSeed)
    )
    .accounts({
      maker,
      order: orderPda,
      orderVault: orderVaultPda,
      makerTokenAccount,
      mint,
      bundle: bundlePda,
      userStake: userStakePda,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID
    })
    .instruction();
  
  return { instruction: ix, order: orderPda };
}

/**
 * Build fill_order instruction
 */
export async function buildFillOrderInstruction({ program, mint, taker, maker, orderPda }) {
  const [bundlePda] = await deriveBundlePda(mint);
  const [takerStakePda] = await deriveUserStakePda(bundlePda, taker);
  const [makerStakePda] = await deriveUserStakePda(bundlePda, maker);
  const [orderVaultPda] = await deriveOrderVaultPda(orderPda);
  
  const takerTokenAccount = getAssociatedTokenAddressSync(mint, taker);
  const makerTokenAccount = getAssociatedTokenAddressSync(mint, maker);
  
  const ix = await program.methods
    .fillOrder()
    .accounts({
      taker,
      maker,
      order: orderPda,
      orderVault: orderVaultPda,
      mint,
      bundle: bundlePda,
      takerStake: takerStakePda,
      makerStake: makerStakePda,
      takerTokenAccount,
      makerTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId
    })
    .instruction();
  
  return { instruction: ix };
}

/**
 * Build cancel_order instruction
 */
export async function buildCancelOrderInstruction({ program, mint, maker, orderPda }) {
  const [orderVaultPda] = await deriveOrderVaultPda(orderPda);
  const makerTokenAccount = getAssociatedTokenAddressSync(mint, maker);
  
  const ix = await program.methods
    .cancelOrder()
    .accounts({
      maker,
      order: orderPda,
      orderVault: orderVaultPda,
      mint,
      makerTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId
    })
    .instruction();
  
  return { instruction: ix };
}

/**
 * Calculate minimum tokens needed to graduate pump.fun bonding curve (reach 85 SOL)
 * Uses constant product AMM formula: (virtualSol + realSol) * (virtualTokens - tokensSold) = k
 */
async function calculateMinTokensForGraduation(connection, bundlePda, escrowPda, pumpfunMintPubkey) {
  try {
    // Get escrow balance (how much SOL we actually have to spend)
    const escrowBalance = await connection.getBalance(escrowPda);
    const escrowBalanceBN = new BN(escrowBalance);
    
    // Pump.fun bonding curve constants (from pump.fun documentation)
    const VIRTUAL_SOL_RESERVES = new BN('30000000000'); // 30 SOL in lamports
    const VIRTUAL_TOKEN_RESERVES = new BN('1073000000000000'); // 1.073B tokens (6 decimals)
    const INITIAL_REAL_TOKEN_RESERVES = new BN('793100000000000'); // 793.1M tokens available
    
    // The contract deducts rent and buffer costs before buying
    // From contract: rent_cost_staking + rent_cost_fee + 0.01 SOL buffer
    // Staking vault rent: ~2M lamports
    // Fee vault rent: ~2M lamports  
    // Buffer: 10M lamports
    // Total costs: ~14M lamports
    const ESTIMATED_COSTS = new BN('14500000'); // 14.5M lamports (conservative estimate)
    
    // Calculate spendable SOL (what the contract will actually use for the buy)
    const SOL_TO_SPEND = escrowBalanceBN.sub(ESTIMATED_COSTS);
    
    // Constant product AMM formula:
    // k = (virtual_sol + real_sol) * (virtual_tokens - tokens_sold)
    // When buying:
    // tokens_out = virtual_tokens - k / (virtual_sol + real_sol + sol_in)
    
    // Initial state (fresh bonding curve):
    // real_sol = 0
    // tokens_sold = 0
    const initialSol = VIRTUAL_SOL_RESERVES; // virtual + 0 real
    const initialTokens = VIRTUAL_TOKEN_RESERVES; // virtual - 0 sold
    const k = initialSol.mul(initialTokens);
    
    // After buying with our actual escrow balance:
    const finalSol = VIRTUAL_SOL_RESERVES.add(SOL_TO_SPEND);
    const finalTokens = k.div(finalSol);
    
    // Tokens bought = initial_tokens - final_tokens
    const tokensOut = initialTokens.sub(finalTokens);
    
    // Apply 90% slippage tolerance (allow 10% less tokens than calculated)
    // This accounts for fees and rounding in the contract
    const minTokensOut = tokensOut.mul(new BN(90)).div(new BN(100));
    
    console.log(`📊 Bonding Curve Calculation:`);
    console.log(`   Escrow Balance: ${escrowBalance / 1e9} SOL`);
    console.log(`   SOL to Spend: ${SOL_TO_SPEND.toString()} lamports`);
    console.log(`   Initial reserves: ${initialSol.toString()} lamports SOL, ${initialTokens.toString()} tokens`);
    console.log(`   k (constant product): ${k.toString()}`);
    console.log(`   Final reserves after buy: ${finalSol.toString()} lamports SOL, ${finalTokens.toString()} tokens`);
    console.log(`   Tokens Expected: ${tokensOut.toString()} (${tokensOut.div(new BN(1e6)).toString()}M tokens)`);
    console.log(`   Min Tokens (90%): ${minTokensOut.toString()} (${minTokensOut.div(new BN(1e6)).toString()}M tokens)`);
    
    // Warn if we won't reach graduation (85 SOL)
    const GRADUATION_THRESHOLD = new BN('85000000000');
    if (SOL_TO_SPEND.lt(GRADUATION_THRESHOLD)) {
      console.warn(`⚠️  WARNING: Escrow has ${escrowBalance / 1e9} SOL but graduation requires 85 SOL`);
      console.warn(`   Token will NOT graduate to Raydium - will stay on bonding curve`);
    }
    
    // Sanity check: ensure tokens_out is positive and reasonable
    if (tokensOut.lte(new BN(0))) {
      console.warn(`⚠️  WARNING: Calculated tokens_out <= 0, something is wrong with the math!`);
      return new BN(0);
    }
    
    if (tokensOut.gt(INITIAL_REAL_TOKEN_RESERVES)) {
      console.warn(`⚠️  WARNING: Calculated tokens_out exceeds initial reserves, capping to max available`);
      return INITIAL_REAL_TOKEN_RESERVES.mul(new BN(90)).div(new BN(100));
    }
    
    return minTokensOut;
  } catch (error) {
    console.error(`❌ Error calculating min tokens: ${error.message}`);
    console.error(error.stack);
    console.warn(`   Using minTokensOut = 0 (no slippage protection)`);
    return new BN(0);
  }
}

/**
 * Build finalize_pumpfun instruction (finalize fundraising and launch on pump.fun)
 */
export async function buildFinalizePumpfunInstruction({ 
  program, 
  mint, 
  payer,
  pumpfunMint,
  tokenName,
  tokenSymbol,
  tokenUri,
  minTokensOut = null // null = auto-calculate, 0 = no slippage protection
}) {
  const [bundlePda] = await deriveBundlePda(mint);
  const [escrowPda] = await deriveEscrowPda(mint);
  const [stakingVaultPda] = await deriveStakingVaultPda(bundlePda);
  const [feeVaultPda] = await deriveFeeVaultPda(bundlePda);
  
  // Auto-calculate min tokens if not provided
  let minTokensBN;
  if (minTokensOut === null) {
    minTokensBN = await calculateMinTokensForGraduation(
      program.provider.connection,
      bundlePda,
      escrowPda,
      pumpfunMint
    );
  } else {
    minTokensBN = new BN(minTokensOut);
  }
  
  // Pump.fun hardcoded accounts (from IDL)
  const PUMPFUN_GLOBAL = new PublicKey('4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf');
  const PUMPFUN_MINT_AUTHORITY = new PublicKey('TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM');
  const PUMPFUN_FEE_RECIPIENT = new PublicKey('62qc2CNXwrYqQScmEdiZFFAnJR262PxWEuNQtxfafNgV');
  const PUMPFUN_GLOBAL_VOLUME = new PublicKey('Hq2wp8uJ9jCPsYgNHex8RtqdvMPfVGoYwjvF1ATiwn2Y');
  const PUMPFUN_FEE_PROGRAM = new PublicKey('pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ');
  const PUMPFUN_EVENT_AUTHORITY = new PublicKey('Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1');
  
  // Derive pump.fun specific PDAs
  const [bondingCurve] = await PublicKey.findProgramAddress(
    [Buffer.from('bonding-curve'), pumpfunMint.toBuffer()],
    PUMPFUN_PROGRAM_ID
  );
  
  const [associatedBondingCurve] = await PublicKey.findProgramAddress(
    [
      bondingCurve.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      pumpfunMint.toBuffer()
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  
  const [metadata] = await PublicKey.findProgramAddress(
    [
      Buffer.from('metadata'),
      METADATA_PROGRAM_ID.toBuffer(),
      pumpfunMint.toBuffer()
    ],
    METADATA_PROGRAM_ID
  );
  
  // Creator vault uses BUNDLE PDA as creator, not payer! (from contract: creator_key = bundle_key)
  const [creatorVault] = await PublicKey.findProgramAddress(
    [Buffer.from('creator-vault'), bundlePda.toBuffer()],
    PUMPFUN_PROGRAM_ID
  );
  
  const [userVolume] = await PublicKey.findProgramAddress(
    [Buffer.from('user_volume_accumulator'), payer.toBuffer()],
    PUMPFUN_PROGRAM_ID
  );
  
  // Fee config is derived with pump program ID in seeds, but uses FEE program as owner
  const [feeConfig] = await PublicKey.findProgramAddress(
    [Buffer.from('fee_config'), PUMPFUN_PROGRAM_ID.toBuffer()],
    PUMPFUN_FEE_PROGRAM
  );
  
  const ix = await program.methods
    .finalizePumpfun(
      tokenName,
      tokenSymbol,
      tokenUri,
      minTokensBN
    )
    .accounts({
      payer,
      bundle: bundlePda,
      mint,
      escrow: escrowPda,
      pumpfunMint,
      bondingCurve,
      associatedBondingCurve,
      metadata,
      stakingVault: stakingVaultPda,
      feeVault: feeVaultPda,
      pumpfunGlobal: PUMPFUN_GLOBAL,
      pumpfunMintAuthority: PUMPFUN_MINT_AUTHORITY,
      pumpfunFeeRecipientBuy: PUMPFUN_FEE_RECIPIENT,
      pumpfunGlobalVolume: PUMPFUN_GLOBAL_VOLUME,
      pumpfunFeeProgram: PUMPFUN_FEE_PROGRAM,
      pumpfunCreatorVault: creatorVault,
      pumpfunUserVolume: userVolume,
      pumpfunFeeConfig: feeConfig,
      pumpfunEventAuthority: PUMPFUN_EVENT_AUTHORITY,
      metadataProgram: METADATA_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY,
      pumpfunProgram: PUMPFUN_PROGRAM_ID
    })
    .instruction();
  
  return { instruction: ix };
}

/**
 * Build collect_pump_fees instruction
 * Collects SOL creator fees from Pump.fun and sends to fee_sol_vault
 */
export async function buildCollectPumpFeesInstruction({ program, mint, collector }) {
  const [bundlePda] = await deriveBundlePda(mint);
  
  // Derive fee_sol_vault PDA
  const [feeSolVault] = PublicKey.findProgramAddressSync(
    [Buffer.from('fee_sol_v1'), bundlePda.toBuffer()],
    program.programId
  );
  
  // Derive pumpfun creator vault PDA
  const [pumpfunCreatorVault] = PublicKey.findProgramAddressSync(
    [Buffer.from('creator-vault'), bundlePda.toBuffer()],
    PUMPFUN_PROGRAM_ID
  );
  
  const PUMPFUN_EVENT_AUTHORITY = new PublicKey('Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1');
  
  const ix = await program.methods
    .collectPumpFees()
    .accounts({
      collector,
      bundle: bundlePda,
      mint,
      feeSolVault,
      pumpfunCreatorVault,
      pumpfunEventAuthority: PUMPFUN_EVENT_AUTHORITY,
      pumpfunProgram: PUMPFUN_PROGRAM_ID,
      systemProgram: SystemProgram.programId
    })
    .instruction();
  
  return { instruction: ix };
}

/**
 * Build collect_pump_amm_fees instruction
 * Collects WSOL creator fees from Pump AMM and sends to bundle's WSOL account
 */
export async function buildCollectPumpAmmFeesInstruction({ program, mint, collector }) {
  const [bundlePda] = await deriveBundlePda(mint);
  
  const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
  const PUMP_AMM_PROGRAM_ID = new PublicKey('pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA');
  const PUMP_AMM_EVENT_AUTHORITY = new PublicKey('GS4CU59F31iL7aR2Q8zVS8DRrcRnXX1yjQ66TqNVQnaR');
  
  // Derive coin_creator_vault_authority PDA (from pump AMM program)
  const [coinCreatorVaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from('creator_vault'), bundlePda.toBuffer()],
    PUMP_AMM_PROGRAM_ID
  );
  
  // Get the WSOL ATA for vault authority
  const coinCreatorVaultAta = getAssociatedTokenAddressSync(
    WSOL_MINT,
    coinCreatorVaultAuthority,
    true
  );
  
  // Get bundle's WSOL account
  const bundleWsolAccount = getAssociatedTokenAddressSync(
    WSOL_MINT,
    bundlePda,
    true
  );
  
  const ix = await program.methods
    .collectPumpAmmFees()
    .accounts({
      collector,
      bundle: bundlePda,
      mint,
      quoteMint: WSOL_MINT,
      coinCreatorVaultAuthority,
      coinCreatorVaultAta,
      bundleWsolAccount,
      pumpAmmEventAuthority: PUMP_AMM_EVENT_AUTHORITY,
      pumpAmmProgram: PUMP_AMM_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID
    })
    .instruction();
  
  return { instruction: ix };
}

/**
 * Get instruction discriminator from IDL
 */
export function getInstructionDiscriminator(name) {
  const instruction = idl.instructions.find(ix => ix.name === name);
  if (!instruction) {
    throw new Error(`Instruction ${name} not found in IDL`);
  }
  return Buffer.from(instruction.discriminator);
}

export default {
  createProgram,
  buildInitBundleInstruction,
  buildSwapInstruction,
  buildPresaleExitInstruction,
  buildDepositStakeInstruction,
  buildPrepareUnstakeInstruction,
  buildExecuteUnstakeInstruction,
  buildWithdrawUnstakedInstruction,
  buildClaimRewardsInstruction,
  buildClaimRewardsInstructionRaw,
  buildCreateOrderInstruction,
  buildFillOrderInstruction,
  buildCancelOrderInstruction,
  buildFinalizePumpfunInstruction,
  buildCollectPumpFeesInstruction,
  buildCollectPumpAmmFeesInstruction,
  getInstructionDiscriminator
};
