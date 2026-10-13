import { describe, expect, it } from 'bun:test';
import agentsMd from '../../src/checks/agents-md';
import openapiDiscovery from '../../src/checks/openapi-discovery';
import { client, response, target } from './_helpers';

describe('agents-md', () => {
  it('passes with install+usage sections', async () => {
    const md = '# Product\n\n## Install\nnpm i x\n\n## Usage\nrun x\n';
    const http = client((url) => url.endsWith('/AGENTS.md') ? response(200, md, 'text/markdown') : response(404, '', 'text/plain'));
    expect((await agentsMd.run(target, http)).status).toBe('pass');
  });
  it('fails when absent', async () => {
    expect((await agentsMd.run(target, client(() => response(404, '', 'text/plain')))).status).toBe('fail');
  });
});

describe('openapi-discovery', () => {
  it('passes on a valid spec at /openapi.json', async () => {
    const spec = JSON.stringify({ openapi: '3.1.0', info: { title: 'API' }, paths: {} });
    const http = client((url) => url.endsWith('/openapi.json') ? response(200, spec, 'application/json') : response(404, '', 'text/plain'));
    const result = await openapiDiscovery.run(target, http);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('3.1.0');
  });
  it('fails on an SPA fallthrough', async () => {
    expect((await openapiDiscovery.run(target, client(() => response(200, '<html></html>', 'text/html')))).status).toBe('fail');
  });
});
