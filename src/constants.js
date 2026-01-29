/**
 * Bundly Agent SDK - Constants
 * 
 * Program IDs, seeds, and configuration constants for interacting
 * with the deployed Bundly smart contract.
 */

import { PublicKey } from '@solana/web3.js';

// Bundly Program ID (deployed on Solana)
export const BUNDLY_PROGRAM_ID = new PublicKey('GVGCNqUUrix5RLph9kVtzdMYkZLEvzvHEkYvC6vJ9dzZ');

// IDL path
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const BUNDLY_IDL_PATH = path.join(__dirname, '../idl/bundly_program.json');

// PDA Seeds (must match smart contract)
export const BUNDLE_SEED = 'bundle_v2';
export const ESCROW_SEED = 'escrow_v2';
export const FEE_VAULT_SEED = 'fee_vault_v1';
export const TOKEN_VAULT_SEED = 'vault_v2';
export const MINT_SEED = 'bundle_mint_v1';
export const UNSTAKE_VAULT_SEED = 'unstake_vault_v1';
export const UNSTAKE_REQUEST_SEED = 'unstake_request_v1';

// Token constants
export const TOKEN_DECIMALS = 6;
export const LAMPORTS_PER_SOL = 1_000_000_000;

// Protocol constants
export const PROTOCOL_TAX_BPS = 100; // 1%
export const MIN_SWAP_AMOUNT = 100_000; // 0.0001 SOL
export const MIN_STAKE_AMOUNT = 1_000_000; // 1 token

// Pump.fun integration
export const PUMPFUN_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');

// Metadata Program (Metaplex)
export const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

// Global fee wallet (hardcoded in contract - receives 1% protocol tax)
export const GLOBAL_FEE_WALLET = new PublicKey('6XFV7TXxD28m7h3Ty483TH3thhsUoKhNF5dTHdF5JMSu');

// SPL Token Program
export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

// System Program
export const SYSTEM_PROGRAM_ID = new PublicKey('11111111111111111111111111111111');

// Associated Token Program
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

// Rent Program
export const RENT_PROGRAM_ID = new PublicKey('SysvarRent111111111111111111111111111111111');

// RPC Endpoints
export const RPC_ENDPOINTS = {
  devnet: 'https://api.devnet.solana.com',
  mainnet: 'https://api.mainnet-beta.solana.com'
};

// Default configuration
export const DEFAULT_CONFIG = {
  network: 'devnet',
  commitment: 'confirmed',
  confirmationRetries: 30,
  confirmationRetryDelay: 2000 // ms
};
