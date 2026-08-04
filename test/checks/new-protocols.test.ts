import { createHash } from 'node:crypto';
import { describe, expect, it } from 'bun:test';
import a2aAgentCard from '../../src/checks/a2a-agent-card';
import agentSkills from '../../src/checks/agent-skills';
import contentSignal from '../../src/checks/content-signal';
import mcpServerDiscover from '../../src/checks/mcp-server-discover';
import mpp from '../../src/checks/mpp';
import ucp from '../../src/checks/ucp';
import x402 from '../../src/checks/x402';
import type { HttpClient, HttpResponse, Target } from '../../src/types';

const target: Target = {
  origin: new URL('https://example.com/'),
  contentUrl: new URL('https://example.com/docs'),
  isLocal: false,
  headers: {},
};

function response(status: number, body: string, contentType = 'application/json', headers: Record<string, string> = {}): HttpResponse {
  return {
    status,
    headers: new Headers({ 'content-type': contentType, ...headers }),
    body: new TextEncoder().encode(body),
    contentType,
    finalUrl: 'https://example.com/',
    redirectChain: [],
  };
}

function client(handler: (url: string, init?: Parameters<HttpClient['fetch']>[1]) => HttpResponse): HttpClient {
  return { fetch: async (url, init) => handler(url, init) };
}

describe('new protocol checks', () => {
  it('validates a current A2A Agent Card', async () => {
    const card = {
      name: 'Example Agent', description: 'Does useful work', version: '1.0.0',
      supportedInterfaces: [{ url: 'https://example.com/a2a', protocolBinding: 'JSONRPC', protocolVersion: '1.0' }],
      capabilities: {}, defaultInputModes: ['text/plain'], defaultOutputModes: ['text/plain'],
      skills: [{ id: 'search', name: 'Search', description: 'Search docs', tags: ['docs'] }],
    };
    expect((await a2aAgentCard.run(target, client(() => response(200, JSON.stringify(card))))).status).toBe('pass');
  });

  it('validates Agent Skills v0.2 and optionally verifies the artifact digest', async () => {
    const artifact = '# Search\n';
    const digest = createHash('sha256').update(artifact).digest('hex');
    const index = {
      $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
      skills: [{ name: 'search', type: 'skill-md', description: 'Search docs', url: '/skill.md', digest: `sha256:${digest}` }],
    };
    const http = client((url) => url.endsWith('/skill.md') ? response(200, artifact, 'text/markdown') : response(200, JSON.stringify(index)));
    expect((await agentSkills.run(target, http, { verifySkillDigests: true })).status).toBe('pass');
  });

  it('accepts a valid Content-Signal response header when robots.txt has none', async () => {
    const http = client((url) => url.endsWith('/robots.txt')
      ? response(404, '', 'text/plain')
      : response(200, '# Docs', 'text/markdown', { 'content-signal': 'ai-train=no, search=yes, ai-input=yes' }));
    expect((await contentSignal.run(target, http)).status).toBe('pass');
  });

  it('validates UCP, x402, and MPP from explicit commerce scope', async () => {
    const commerceUrl = new URL('https://example.com/paid');
    const payment = Buffer.from(JSON.stringify({ x402Version: 2, accepts: [{ scheme: 'exact' }] })).toString('base64');
    const http = client((url) => url.endsWith('/.well-known/ucp')
      ? response(200, JSON.stringify({ ucp: { version: '2026-04-08', services: {}, payment_handlers: {} } }))
      : response(402, '', 'application/json', { 'payment-required': payment, 'www-authenticate': 'Payment id="challenge-1"' }));
    const options = { verifySkillDigests: false, commerceUrl };
    expect((await ucp.run(target, http, options)).status).toBe('pass');
    expect((await x402.run(target, http, options)).status).toBe('pass');
    expect((await mpp.run(target, http, options)).status).toBe('pass');
  });

  it('performs read-only MCP server discovery', async () => {
    const http = client((_url, init) => {
      expect(init?.method).toBe('POST');
      expect(init?.body).toContain('server/discover');
      return response(200, JSON.stringify({ jsonrpc: '2.0', id: 'agent-readiness-discover', result: { supportedVersions: ['2026-07-28'], capabilities: { tools: {} } } }));
    });
    const result = await mcpServerDiscover.run(target, http, { verifySkillDigests: false, mcpUrl: new URL('https://example.com/mcp') });
    expect(result.status).toBe('pass');
  });
});
