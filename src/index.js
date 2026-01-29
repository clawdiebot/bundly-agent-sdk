/**
 * Bundly Agent SDK
 * 
 * A JavaScript SDK for AI agents to interact with Bundly smart contracts.
 * Enables agents to create bundles, buy tokens, stake, and coordinate launches.
 */

export { BundlyAgent } from './BundlyAgent.js';
export * from './constants.js';
export * from './accounts.js';

// Version
export const VERSION = '0.1.0';

// Quick start helper
export function createAgent(wallet, options = {}) {
  const { BundlyAgent } = require('./BundlyAgent.js');
  return new BundlyAgent({ wallet, ...options });
}
