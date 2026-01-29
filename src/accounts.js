/**
 * Bundly Agent SDK - Account Derivation
 * 
 * Helper functions for deriving Program Derived Addresses (PDAs)
 * used by the Bundly smart contract.
 */

import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
  BUNDLY_PROGRAM_ID,
  GLOBAL_FEE_WALLET
} from './constants.js';

// Seeds from the IDL
const BUNDLE_SEED = 'bundle_v2';
const ESCROW_SEED = 'escrow_v2';
const TOKEN_VAULT_SEED = 'vault_v2';
const FEE_VAULT_SEED = 'fee_vault_v1';
const STAKING_VAULT_SEED = 'staking_vault_v1';
const UNSTAKE_VAULT_SEED = 'unstake_vault_v2';
const UNSTAKE_REQUEST_SEED = 'unstake_request_v1';
const USER_STAKE_SEED = 'user_stake_v1';
const MINT_SEED = 'bundle_mint_v1';
const ORDER_SEED = 'order_v1';
const ORDER_VAULT_SEED = 'vault_v2';

/**
 * Derive bundle PDA for a given mint
 */
export async function deriveBundlePda(mint) {
  return PublicKey.findProgramAddress(
    [Buffer.from(BUNDLE_SEED), mint.toBuffer()],
    BUNDLY_PROGRAM_ID
  );
}

/**
 * Derive escrow PDA for a given mint
 */
export async function deriveEscrowPda(mint) {
  return PublicKey.findProgramAddress(
    [Buffer.from(ESCROW_SEED), mint.toBuffer()],
    BUNDLY_PROGRAM_ID
  );
}

/**
 * Derive token vault PDA for a given mint
 */
export async function deriveTokenVaultPda(mint) {
  return PublicKey.findProgramAddress(
    [Buffer.from(TOKEN_VAULT_SEED), mint.toBuffer()],
    BUNDLY_PROGRAM_ID
  );
}

/**
 * Derive fee vault PDA for a given bundle
 */
export async function deriveFeeVaultPda(bundlePda) {
  return PublicKey.findProgramAddress(
    [Buffer.from(FEE_VAULT_SEED), bundlePda.toBuffer()],
    BUNDLY_PROGRAM_ID
  );
}

/**
 * Derive staking vault PDA for a given bundle
 */
export async function deriveStakingVaultPda(bundlePda) {
  return PublicKey.findProgramAddress(
    [Buffer.from(STAKING_VAULT_SEED), bundlePda.toBuffer()],
    BUNDLY_PROGRAM_ID
  );
}

/**
 * Derive unstake vault PDA for a user
 */
export async function deriveUnstakeVaultPda(mint, user) {
  return PublicKey.findProgramAddress(
    [Buffer.from(UNSTAKE_VAULT_SEED), mint.toBuffer(), user.toBuffer()],
    BUNDLY_PROGRAM_ID
  );
}

/**
 * Derive unstake request PDA for a user
 */
export async function deriveUnstakeRequestPda(mint, user) {
  return PublicKey.findProgramAddress(
    [Buffer.from(UNSTAKE_REQUEST_SEED), mint.toBuffer(), user.toBuffer()],
    BUNDLY_PROGRAM_ID
  );
}

/**
 * Derive user stake PDA
 */
export async function deriveUserStakePda(bundlePda, user) {
  return PublicKey.findProgramAddress(
    [Buffer.from(USER_STAKE_SEED), bundlePda.toBuffer(), user.toBuffer()],
    BUNDLY_PROGRAM_ID
  );
}

/**
 * Derive PDA-based mint address from creator and nonce
 */
export async function deriveMintPda(creator, nonce) {
  const nonceBuffer = Buffer.alloc(8);
  nonceBuffer.writeBigUInt64LE(BigInt(nonce));
  
  return PublicKey.findProgramAddress(
    [Buffer.from(MINT_SEED), creator.toBuffer(), nonceBuffer],
    BUNDLY_PROGRAM_ID
  );
}

/**
 * Derive order PDA for OTC trading
 */
export async function deriveOrderPda(mint, maker, idSeed) {
  const idSeedBuffer = Buffer.alloc(8);
  idSeedBuffer.writeBigUInt64LE(BigInt(idSeed));
  
  return PublicKey.findProgramAddress(
    [Buffer.from(ORDER_SEED), mint.toBuffer(), maker.toBuffer(), idSeedBuffer],
    BUNDLY_PROGRAM_ID
  );
}

/**
 * Derive order vault PDA
 */
export async function deriveOrderVaultPda(orderPda) {
  return PublicKey.findProgramAddress(
    [Buffer.from(ORDER_VAULT_SEED), orderPda.toBuffer()],
    BUNDLY_PROGRAM_ID
  );
}

/**
 * Derive global fee token account
 */
export async function deriveGlobalFeeTokenAccount(mint) {
  return [getAssociatedTokenAddressSync(mint, GLOBAL_FEE_WALLET), 0];
}

/**
 * Get associated token address (convenience wrapper)
 */
export function getAssociatedTokenAddress(mint, owner) {
  return getAssociatedTokenAddressSync(mint, owner);
}

/**
 * Derive all PDAs needed for a bundle
 */
export async function deriveAllBundlePdas(mint) {
  const [bundlePda] = await deriveBundlePda(mint);
  const [escrowPda] = await deriveEscrowPda(mint);
  const [tokenVaultPda] = await deriveTokenVaultPda(mint);
  const [feeVaultPda] = await deriveFeeVaultPda(mint);
  const [stakingVaultPda] = await deriveStakingVaultPda(bundlePda);
  
  return {
    bundlePda,
    escrowPda,
    tokenVaultPda,
    feeVaultPda,
    stakingVaultPda
  };
}

export default {
  deriveBundlePda,
  deriveEscrowPda,
  deriveTokenVaultPda,
  deriveFeeVaultPda,
  deriveStakingVaultPda,
  deriveUnstakeVaultPda,
  deriveUnstakeRequestPda,
  deriveUserStakePda,
  deriveMintPda,
  deriveOrderPda,
  deriveOrderVaultPda,
  deriveGlobalFeeTokenAccount,
  getAssociatedTokenAddress,
  deriveAllBundlePdas
};
