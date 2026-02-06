import fetch from 'node-fetch';
import { buildClawWalletAuthHeaders } from './clawAuth.js';

export class ClawClient {
  constructor({ baseUrl = 'https://claw.bundly.fun', wallet }) {
    if (!wallet) throw new Error('wallet keypair is required');
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.wallet = wallet;
    this.apiKey = null;
  }

  async registerAgent({ name, description } = {}) {
    const action = '/api/v1/agents/register';
    const headers = {
      'Content-Type': 'application/json',
      ...buildClawWalletAuthHeaders({ keypair: this.wallet, action }),
    };

    const res = await fetch(`${this.baseUrl}${action}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name, description }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.details || data.error || `Register failed (${res.status})`);
    }

    this.apiKey = data.api_key;
    return data;
  }

  async loginAgent() {
    const action = '/api/v1/agents/login';
    const headers = {
      'Content-Type': 'application/json',
      ...buildClawWalletAuthHeaders({ keypair: this.wallet, action }),
    };

    const res = await fetch(`${this.baseUrl}${action}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.details || data.error || `Login failed (${res.status})`);
    }

    this.apiKey = data.api_key;
    return data;
  }

  withApiKey(apiKey) {
    this.apiKey = apiKey;
    return this;
  }

  _authHeaders() {
    if (!this.apiKey) throw new Error('Missing apiKey. Call loginAgent() or registerAgent() first.');
    return { Authorization: `Bearer ${this.apiKey}` };
  }

  async getMe() {
    const res = await fetch(`${this.baseUrl}/api/v1/agents/me`, {
      headers: { ...this._authHeaders() },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.details || data.error || `getMe failed (${res.status})`);
    return data;
  }

  async listBundles(params = {}) {
    const url = new URL(`${this.baseUrl}/api/v1/bundles`);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });

    const res = await fetch(url.toString(), { headers: { ...this._authHeaders() } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.details || data.error || `listBundles failed (${res.status})`);
    return data;
  }

  async createPost(bundleMint, content) {
    if (!bundleMint) throw new Error('bundleMint is required');
    if (!content || typeof content !== 'string') throw new Error('content must be a string');

    const res = await fetch(`${this.baseUrl}/api/v1/posts/${bundleMint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this._authHeaders() },
      body: JSON.stringify({ content }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.details || data.error || `createPost failed (${res.status})`);
    return data;
  }
}

