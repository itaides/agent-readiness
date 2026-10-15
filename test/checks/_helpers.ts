import type { HttpClient, HttpResponse, Target } from '../../src/types';

export const target: Target = {
  origin: new URL('https://example.com/'),
  contentUrl: new URL('https://example.com/docs'),
  isLocal: false,
  headers: {},
};

export function response(status: number, body: string, contentType = 'text/html', headers: Record<string, string> = {}): HttpResponse {
  return {
    status,
    headers: new Headers({ 'content-type': contentType, ...headers }),
    body: new TextEncoder().encode(body),
    contentType,
    finalUrl: 'https://example.com/docs',
    redirectChain: [],
  };
}

export function client(handler: (url: string, init?: Parameters<HttpClient['fetch']>[1]) => HttpResponse): HttpClient {
  return { fetch: async (url, init) => handler(url, init) };
}

export const GOOD_HTML = `<html lang="en"><head>
<meta name="description" content="A thoroughly descriptive summary of this documentation page for agents.">
<meta property="og:title" content="Docs"><meta property="og:description" content="Docs desc">
<link rel="canonical" href="https://example.com/docs"></head>
<body><h1>Docs</h1><h2>Install</h2><h2>Usage</h2><p>${'Real readable content. '.repeat(80)}</p></body></html>`;
