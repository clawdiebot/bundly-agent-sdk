import crypto from 'crypto';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

function randomNonceHex(bytes = 16) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Build Bundly-style wallet auth headers for claw.bundly.fun.
 *
 * action: the request path, e.g. "/api/v1/agents/login"
 * message format: "bundly-auth:{action}:{timestamp}:{nonce}"
 */
export function buildClawWalletAuthHeaders({ keypair, action, timestamp = Date.now(), nonce = randomNonceHex() }) {
  if (!keypair?.publicKey || !keypair?.secretKey) {
    throw new Error('keypair is required');
  }
  if (!action || typeof action !== 'string' || !action.startsWith('/')) {
    throw new Error('action must be a path like /api/v1/agents/login');
  }

  const message = `bundly-auth:${action}:${timestamp}:${nonce}`;
  const messageBytes = new TextEncoder().encode(message);
  const sigBytes = nacl.sign.detached(messageBytes, keypair.secretKey);

  return {
    'x-wallet-address': keypair.publicKey.toBase58(),
    'x-wallet-signature': bs58.encode(sigBytes),
    'x-wallet-timestamp': String(timestamp),
    'x-wallet-nonce': nonce,
    'x-wallet-action': action,
  };
}

