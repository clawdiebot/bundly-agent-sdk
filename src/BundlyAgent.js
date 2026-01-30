/**
 * Bundly Agent SDK - Main Class
 * 
 * High-level API for AI agents to interact with Bundly smart contracts.
 * Handles transaction building, signing, and submission.
 */

import { Connection, Keypair, PublicKey, Transaction, ComputeBudgetProgram } from '@solana/web3.js';
import { 
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import {
  BUNDLY_PROGRAM_ID,
  RPC_ENDPOINTS,
  DEFAULT_CONFIG,
  LAMPORTS_PER_SOL,
  TOKEN_DECIMALS
} from './constants.js';
import {
  deriveBundlePda,
  deriveAllBundlePdas,
  deriveUserStakePda,
  deriveUnstakeRequestPda
} from './accounts.js';
import {
  createProgram,
  buildInitBundleInstruction,
  buildSwapInstruction,
  buildPresaleExitInstruction,
  buildDepositStakeInstruction,
  buildPrepareUnstakeInstruction,
  buildExecuteUnstakeInstruction,
  buildWithdrawUnstakedInstruction,
  buildClaimRewardsInstruction,
  buildCreateOrderInstruction,
  buildFillOrderInstruction,
  buildCancelOrderInstruction,
  buildFinalizePumpfunInstruction
} from './instructions.js';
import { uploadBundleMetadata } from './metadata.js';

export class BundlyAgent {
  /**
   * Create a new BundlyAgent instance
   */
  constructor(config) {
    if (!config.wallet) {
      throw new Error('Wallet keypair is required');
    }
    
    this.wallet = config.wallet;
    this.network = config.network || DEFAULT_CONFIG.network;
    this.rpcUrl = config.rpcUrl || RPC_ENDPOINTS[this.network];
    this.commitment = config.commitment || DEFAULT_CONFIG.commitment;
    
    this.connection = new Connection(this.rpcUrl, this.commitment);
    this.publicKey = this.wallet.publicKey;
    
    // Create Anchor program instance
    this.program = createProgram(this.connection, this.wallet);
    
    console.log(`🦞 BundlyAgent initialized`);
    console.log(`   Wallet: ${this.publicKey.toString()}`);
    console.log(`   Network: ${this.network}`);
    console.log(`   RPC: ${this.rpcUrl}`);
  }

  // ============================================================================
  // WALLET & BALANCE
  // ============================================================================

  /**
   * Get agent's SOL balance
   */
  async getBalance() {
    const lamports = await this.connection.getBalance(this.publicKey);
    return lamports / LAMPORTS_PER_SOL;
  }

  /**
   * Get agent's token balance for a specific mint
   */
  async getTokenBalance(mint) {
    const mintPubkey = typeof mint === 'string' ? new PublicKey(mint) : mint;
    const tokenAccount = getAssociatedTokenAddressSync(mintPubkey, this.publicKey);
    
    try {
      const balance = await this.connection.getTokenAccountBalance(tokenAccount);
      return parseFloat(balance.value.uiAmount || 0);
    } catch (e) {
      return 0;
    }
  }

  /**
   * Get all bundles where agent is a holder
   */
  async getMyBundles() {
    const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
      this.publicKey,
      { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
    );
    
    return tokenAccounts.value
      .filter(account => account.account.data.parsed.info.tokenAmount.uiAmount > 0)
      .map(account => ({
        mint: account.account.data.parsed.info.mint,
        balance: account.account.data.parsed.info.tokenAmount.uiAmount
      }));
  }

  /**
   * Airdrop SOL (devnet only)
   */
  async requestAirdrop(amount = 1) {
    if (this.network !== 'devnet') {
      throw new Error('Airdrops only available on devnet');
    }
    
    console.log(`💧 Requesting ${amount} SOL airdrop...`);
    const signature = await this.connection.requestAirdrop(
      this.publicKey,
      amount * LAMPORTS_PER_SOL
    );
    
    await this.connection.confirmTransaction(signature);
    console.log(`✅ Airdrop confirmed: ${signature}`);
    return signature;
  }

  // ============================================================================
  // BUNDLE CREATION
  // ============================================================================

  /**
   * Create a new bundle
   */
  async createBundle(options) {
    const {
      nonce = Date.now(),
      name,
      symbol,
      decimals = 6,
      capSol,
      totalSupply,
      unstakeCooldown = 86400
    } = options;
    
    if (!capSol || !totalSupply) {
      throw new Error('capSol and totalSupply are required');
    }
    
    const capLamports = Math.floor(capSol * LAMPORTS_PER_SOL);
    const supply = Math.floor(totalSupply * Math.pow(10, decimals));
    
    console.log(`🎉 Creating bundle...`);
    console.log(`   Name: ${name || 'N/A'}`);
    console.log(`   Symbol: ${symbol || 'N/A'}`);
    console.log(`   Cap: ${capSol} SOL`);
    console.log(`   Supply: ${totalSupply} tokens`);
    console.log(`   Unstake cooldown: ${unstakeCooldown / 3600}h`);
    
    const { instruction, mint, bundle } = await buildInitBundleInstruction({
      program: this.program,
      creator: this.publicKey,
      nonce,
      decimals,
      capLamports,
      totalSupply: supply,
      unstakeCooldown
    });
    
    const transaction = new Transaction().add(instruction);
    const signature = await this.sendAndConfirm(transaction);
    
    console.log(`✅ Bundle created!`);
    console.log(`   Mint: ${mint.toString()}`);
    console.log(`   Bundle PDA: ${bundle.toString()}`);
    
    return { signature, mint, bundle };
  }

  /**
   * Finalize bundle and launch on pump.fun
   */
  async finalize(mint, options) {
    const {
      imagePath,
      name,
      symbol,
      description,
      metadataUri
    } = options;
    
    const mintPubkey = typeof mint === 'string' ? new PublicKey(mint) : mint;
    
    console.log(`🚀 Finalizing bundle and launching on pump.fun...`);
    console.log(`   Mint: ${mintPubkey.toString()}`);
    console.log(`   Name: ${name}`);
    console.log(`   Symbol: ${symbol}`);
    console.log();
    
    // Step 1: Upload metadata to IPFS (if not provided)
    let tokenUri = metadataUri;
    if (!tokenUri) {
      if (!imagePath || !name || !symbol || !description) {
        throw new Error('Either metadataUri OR (imagePath + name + symbol + description) required');
      }
      
      tokenUri = await uploadBundleMetadata({
        imagePath,
        name,
        symbol,
        description
      });
    }
    
    console.log(`✅ Metadata URI: ${tokenUri}\n`);
    
    // Step 2: Create new pumpfun mint keypair
    const pumpfunMint = Keypair.generate();
    console.log(`🔑 Generated pump.fun mint: ${pumpfunMint.publicKey.toString()}`);
    console.log();
    
    // Step 3: Build finalize instruction (auto-calculates min tokens for graduation)
    console.log(`📝 Building finalize transaction...`);
    console.log(`   Calculating tokens needed to graduate bonding curve...`);
    const { instruction } = await buildFinalizePumpfunInstruction({
      program: this.program,
      mint: mintPubkey,
      payer: this.publicKey,
      pumpfunMint: pumpfunMint.publicKey,
      tokenName: name,
      tokenSymbol: symbol,
      tokenUri
      // minTokensOut: null (default) = auto-calculate using pump SDK
    });
    
    // Step 4: Send transaction with maximum compute budget
    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({ 
      units: 1400000 
    });
    const transaction = new Transaction()
      .add(computeBudgetIx)
      .add(instruction);
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = this.publicKey;
    
    // Sign with both wallet and pumpfun mint
    transaction.sign(this.wallet, pumpfunMint);
    
    const signature = await this.connection.sendRawTransaction(
      transaction.serialize()
    );
    
    console.log(`📡 Transaction sent: ${signature}`);
    console.log(`   Confirming...`);
    
    await this.connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight
    });
    
    console.log(`✅ Bundle finalized and launched on pump.fun!`);
    console.log(`   Pump.fun mint: ${pumpfunMint.publicKey.toString()}`);
    console.log(`   Metadata: ${tokenUri}`);
    
    return {
      signature,
      pumpfunMint: pumpfunMint.publicKey,
      metadataUri: tokenUri
    };
  }

  // ============================================================================
  // TRADING
  // ============================================================================

  /**
   * Buy bundle tokens with SOL
   */
  async buy(mint, options) {
    const { solAmount, minTokensOut = 0 } = options;
    
    if (!solAmount || solAmount <= 0) {
      throw new Error('solAmount must be positive');
    }
    
    const mintPubkey = typeof mint === 'string' ? new PublicKey(mint) : mint;
    const lamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
    
    console.log(`🛒 Buying tokens...`);
    console.log(`   Mint: ${mintPubkey.toString()}`);
    console.log(`   SOL: ${solAmount} (${lamports} lamports)`);
    console.log(`   Min tokens out: ${minTokensOut}`);
    
    // Check if associated token account exists, create if needed
    const ataAddress = getAssociatedTokenAddressSync(mintPubkey, this.publicKey);
    const ataInfo = await this.connection.getAccountInfo(ataAddress);
    
    const transaction = new Transaction();
    
    if (!ataInfo) {
      console.log(`   Creating associated token account...`);
      const createAtaIx = createAssociatedTokenAccountInstruction(
        this.publicKey, // payer
        ataAddress,     // ata
        this.publicKey, // owner
        mintPubkey      // mint
      );
      transaction.add(createAtaIx);
    }
    
    const { instruction } = await buildSwapInstruction({
      program: this.program,
      mint: mintPubkey,
      user: this.publicKey,
      amountLamports: lamports,
      minTokensOut
    });
    
    transaction.add(instruction);
    const signature = await this.sendAndConfirm(transaction);
    
    console.log(`✅ Bought tokens!`);
    return signature;
  }

  /**
   * Exit presale position before finalization (recover SOL)
   */
  async presaleExit(mint, options = {}) {
    const { amount } = options;
    
    const mintPubkey = typeof mint === 'string' ? new PublicKey(mint) : mint;
    
    // If no amount specified, exit all tokens
    let tokenAmount;
    if (amount) {
      tokenAmount = Math.floor(amount * Math.pow(10, TOKEN_DECIMALS));
    } else {
      // Get current balance
      const balance = await this.getTokenBalance(mintPubkey);
      tokenAmount = Math.floor(balance * Math.pow(10, TOKEN_DECIMALS));
    }
    
    console.log(`🚪 Exiting presale position...`);
    console.log(`   Mint: ${mintPubkey.toString()}`);
    console.log(`   Amount: ${tokenAmount / Math.pow(10, TOKEN_DECIMALS)} tokens`);
    console.log(`   ⚠️  1% protocol fee will be deducted`);
    
    const { instruction } = await buildPresaleExitInstruction({
      program: this.program,
      mint: mintPubkey,
      user: this.publicKey,
      amountBtoken: tokenAmount
    });
    
    const transaction = new Transaction().add(instruction);
    const signature = await this.sendAndConfirm(transaction);
    
    console.log(`✅ Exited presale! SOL returned to wallet.`);
    return signature;
  }

  // ============================================================================
  // STAKING
  // ============================================================================

  /**
   * Stake bundle tokens
   */
  async stake(mint, options) {
    const { amount } = options;
    
    if (!amount || amount <= 0) {
      throw new Error('amount must be positive');
    }
    
    const mintPubkey = typeof mint === 'string' ? new PublicKey(mint) : mint;
    const tokenAmount = Math.floor(amount * Math.pow(10, TOKEN_DECIMALS));
    
    console.log(`🔒 Staking tokens...`);
    console.log(`   Mint: ${mintPubkey.toString()}`);
    console.log(`   Amount: ${amount} tokens`);
    
    const { instruction } = await buildDepositStakeInstruction({
      program: this.program,
      mint: mintPubkey,
      user: this.publicKey,
      amount: tokenAmount
    });
    
    const transaction = new Transaction().add(instruction);
    const signature = await this.sendAndConfirm(transaction);
    
    console.log(`✅ Staked tokens!`);
    return signature;
  }

  /**
   * Prepare to unstake (starts cooldown)
   */
  async prepareUnstake(mint) {
    const mintPubkey = typeof mint === 'string' ? new PublicKey(mint) : mint;
    
    console.log(`⏳ Preparing unstake...`);
    console.log(`   Mint: ${mintPubkey.toString()}`);
    
    const { instruction } = await buildPrepareUnstakeInstruction({
      program: this.program,
      mint: mintPubkey,
      user: this.publicKey
    });
    
    const transaction = new Transaction().add(instruction);
    const signature = await this.sendAndConfirm(transaction);
    
    console.log(`✅ Unstake prepared! Cooldown started.`);
    return signature;
  }

  /**
   * Execute unstake (after cooldown)
   */
  async executeUnstake(mint, options) {
    const { amount } = options;
    
    if (!amount || amount <= 0) {
      throw new Error('amount must be positive');
    }
    
    const mintPubkey = typeof mint === 'string' ? new PublicKey(mint) : mint;
    const tokenAmount = Math.floor(amount * Math.pow(10, TOKEN_DECIMALS));
    
    console.log(`🔓 Executing unstake...`);
    console.log(`   Mint: ${mintPubkey.toString()}`);
    console.log(`   Amount: ${amount} tokens`);
    
    const { instruction } = await buildExecuteUnstakeInstruction({
      program: this.program,
      mint: mintPubkey,
      user: this.publicKey,
      amountBtoken: tokenAmount
    });
    
    const transaction = new Transaction().add(instruction);
    const signature = await this.sendAndConfirm(transaction);
    
    console.log(`✅ Unstake executed!`);
    return signature;
  }

  /**
   * Withdraw unstaked tokens
   */
  async withdrawUnstaked(mint, destination = null) {
    const mintPubkey = typeof mint === 'string' ? new PublicKey(mint) : mint;
    
    console.log(`💸 Withdrawing unstaked tokens...`);
    console.log(`   Mint: ${mintPubkey.toString()}`);
    
    const { instruction } = await buildWithdrawUnstakedInstruction({
      program: this.program,
      mint: mintPubkey,
      user: this.publicKey,
      destination
    });
    
    const transaction = new Transaction().add(instruction);
    const signature = await this.sendAndConfirm(transaction);
    
    console.log(`✅ Withdrawn unstaked tokens!`);
    return signature;
  }

  /**
   * Claim staking rewards
   */
  async claimRewards(mint) {
    const mintPubkey = typeof mint === 'string' ? new PublicKey(mint) : mint;
    
    console.log(`💰 Claiming rewards...`);
    console.log(`   Mint: ${mintPubkey.toString()}`);
    
    const { instruction } = await buildClaimRewardsInstruction({
      program: this.program,
      mint: mintPubkey,
      user: this.publicKey
    });
    
    const transaction = new Transaction().add(instruction);
    const signature = await this.sendAndConfirm(transaction);
    
    console.log(`✅ Rewards claimed!`);
    return signature;
  }

  /**
   * Collect SOL creator fees from Pump.fun
   * Transfers accumulated creator fees from pump.fun's creator vault to bundly's fee_sol_vault
   * NOTE: Use the fundraiser mint, not the pump.fun token mint
   */
  async collectPumpFees(mint) {
    const mintPubkey = typeof mint === 'string' ? new PublicKey(mint) : mint;
    
    console.log(`💰 Collecting Pump.fun creator fees (SOL)...`);
    console.log(`   Mint: ${mintPubkey.toString()}`);
    
    const { buildCollectPumpFeesInstruction } = await import('./instructions.js');
    const { instruction } = await buildCollectPumpFeesInstruction({
      program: this.program,
      mint: mintPubkey,
      collector: this.publicKey
    });
    
    const transaction = new Transaction().add(instruction);
    const signature = await this.sendAndConfirm(transaction);
    
    console.log(`✅ Pump.fun fees collected!`);
    return signature;
  }

  /**
   * Collect WSOL creator fees from Pump AMM
   * Transfers accumulated creator fees from pump AMM's creator vault to bundly's WSOL account
   * NOTE: Use the fundraiser mint, not the pump.fun token mint
   */
  async collectPumpAmmFees(mint) {
    const mintPubkey = typeof mint === 'string' ? new PublicKey(mint) : mint;
    
    console.log(`💰 Collecting Pump AMM creator fees (WSOL)...`);
    console.log(`   Mint: ${mintPubkey.toString()}`);
    
    const { buildCollectPumpAmmFeesInstruction } = await import('./instructions.js');
    const { instruction } = await buildCollectPumpAmmFeesInstruction({
      program: this.program,
      mint: mintPubkey,
      collector: this.publicKey
    });
    
    const transaction = new Transaction().add(instruction);
    const signature = await this.sendAndConfirm(transaction);
    
    console.log(`✅ Pump AMM fees collected!`);
    return signature;
  }

  /**
   * Check staking position
   */
  async getStakingInfo(mint) {
    const mintPubkey = typeof mint === 'string' ? new PublicKey(mint) : mint;
    const [userStakePda] = await deriveUserStakePda(mintPubkey, this.publicKey);
    
    try {
      const accountInfo = await this.connection.getAccountInfo(userStakePda);
      if (!accountInfo) {
        return { staked: 0, rewards: 0 };
      }
      
      // TODO: Parse account data using Anchor
      return { staked: 0, rewards: 0, raw: accountInfo.data };
    } catch (e) {
      return { staked: 0, rewards: 0 };
    }
  }

  // ============================================================================
  // OTC TRADING
  // ============================================================================

  /**
   * Create an OTC order
   */
  async createOrder(mint, options) {
    const { amount, price, isBuySide, idSeed = Date.now() } = options;
    
    if (!amount || !price) {
      throw new Error('amount and price are required');
    }
    
    const mintPubkey = typeof mint === 'string' ? new PublicKey(mint) : mint;
    
    console.log(`📝 Creating OTC order...`);
    console.log(`   Mint: ${mintPubkey.toString()}`);
    console.log(`   Amount: ${amount}`);
    console.log(`   Price: ${price}`);
    console.log(`   Side: ${isBuySide ? 'BUY' : 'SELL'}`);
    
    const { instruction, order } = await buildCreateOrderInstruction({
      program: this.program,
      mint: mintPubkey,
      maker: this.publicKey,
      amount,
      price,
      isBuySide,
      idSeed
    });
    
    const transaction = new Transaction().add(instruction);
    const signature = await this.sendAndConfirm(transaction);
    
    console.log(`✅ Order created!`);
    console.log(`   Order PDA: ${order.toString()}`);
    
    return { signature, order };
  }

  /**
   * Fill an existing OTC order
   */
  async fillOrder(mint, maker, orderPda) {
    const mintPubkey = typeof mint === 'string' ? new PublicKey(mint) : mint;
    const makerPubkey = typeof maker === 'string' ? new PublicKey(maker) : maker;
    const orderPdaPubkey = typeof orderPda === 'string' ? new PublicKey(orderPda) : orderPda;
    
    console.log(`✅ Filling OTC order...`);
    console.log(`   Order: ${orderPdaPubkey.toString()}`);
    
    const { instruction } = await buildFillOrderInstruction({
      program: this.program,
      mint: mintPubkey,
      taker: this.publicKey,
      maker: makerPubkey,
      orderPda: orderPdaPubkey
    });
    
    const transaction = new Transaction().add(instruction);
    const signature = await this.sendAndConfirm(transaction);
    
    console.log(`✅ Order filled!`);
    return signature;
  }

  /**
   * Cancel your OTC order
   */
  async cancelOrder(mint, orderPda) {
    const mintPubkey = typeof mint === 'string' ? new PublicKey(mint) : mint;
    const orderPdaPubkey = typeof orderPda === 'string' ? new PublicKey(orderPda) : orderPda;
    
    console.log(`❌ Canceling OTC order...`);
    console.log(`   Order: ${orderPdaPubkey.toString()}`);
    
    const { instruction } = await buildCancelOrderInstruction({
      program: this.program,
      mint: mintPubkey,
      maker: this.publicKey,
      orderPda: orderPdaPubkey
    });
    
    const transaction = new Transaction().add(instruction);
    const signature = await this.sendAndConfirm(transaction);
    
    console.log(`✅ Order canceled!`);
    return signature;
  }

  // ============================================================================
  // BUNDLE INFO
  // ============================================================================

  /**
   * Fetch bundle state from on-chain data
   */
  async getBundleState(mint) {
    const mintPubkey = typeof mint === 'string' ? new PublicKey(mint) : mint;
    const [bundlePda] = await deriveBundlePda(mintPubkey);
    
    const accountInfo = await this.connection.getAccountInfo(bundlePda);
    if (!accountInfo) {
      throw new Error('Bundle not found on-chain');
    }
    
    // TODO: Parse account data using Anchor IDL
    return {
      mint: mintPubkey.toString(),
      bundlePda: bundlePda.toString(),
      exists: true,
      data: accountInfo.data
    };
  }

  // ============================================================================
  // TRANSACTION HELPERS
  // ============================================================================

  /**
   * Send transaction and wait for confirmation
   */
  async sendAndConfirm(transaction) {
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = this.publicKey;
    
    transaction.sign(this.wallet);
    
    const signature = await this.connection.sendRawTransaction(
      transaction.serialize()
    );
    
    console.log(`📡 Transaction sent: ${signature}`);
    console.log(`   Confirming...`);
    
    await this.connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight
    });
    
    console.log(`✅ Transaction confirmed!`);
    return signature;
  }
}

export default BundlyAgent;
