import type { Check } from './types';

import robotsTxt from './checks/robots-txt';
import sitemap from './checks/sitemap';
import linkHeaderApiCatalog from './checks/link-header-api-catalog';
import markdownNegotiation from './checks/markdown-negotiation';
import llmsTxt from './checks/llms-txt';
import contentSignal from './checks/content-signal';
import aiBotRules from './checks/ai-bot-rules';
import webBotAuth from './checks/web-bot-auth';
import agentSkills from './checks/agent-skills';
import apiCatalog from './checks/api-catalog';
import oauthAuthorizationServer from './checks/oauth-authorization-server';
import oauthProtectedResource from './checks/oauth-protected-resource';
import mcpServerCard from './checks/mcp-server-card';
import webmcp from './checks/webmcp';
import a2aAgentCard from './checks/a2a-agent-card';
import dnsAid from './checks/dns-aid';
import botPolicyMatrix from './checks/bot-policy-matrix';
import authMd from './checks/auth-md';
import ucp from './checks/ucp';
import x402 from './checks/x402';
import mpp from './checks/mpp';
import mcpServerDiscover from './checks/mcp-server-discover';
import browserAgentic from './checks/browser-agentic';
import pageHtmlQuality from './checks/page-html-quality';
import jsonLd from './checks/json-ld';
import freshnessSignals from './checks/freshness-signals';
import semanticControls from './checks/semantic-controls';
import markdownMirror from './checks/markdown-mirror';
import markdownLinkRel from './checks/markdown-link-rel';
import llmsFullTxt from './checks/llms-full-txt';
import sitemapMd from './checks/sitemap-md';
import agentsMd from './checks/agents-md';
import agentsTxt from './checks/agents-txt';
import openapiDiscovery from './checks/openapi-discovery';
import sitemapLastmod from './checks/sitemap-lastmod';
import rssAtom from './checks/rss-atom';

export const checks: Check[] = [
  robotsTxt,
  sitemap,
  sitemapLastmod,
  linkHeaderApiCatalog,
  dnsAid,
  rssAtom,
  markdownNegotiation,
  markdownMirror,
  markdownLinkRel,
  llmsTxt,
  llmsFullTxt,
  sitemapMd,
  agentsMd,
  pageHtmlQuality,
  jsonLd,
  freshnessSignals,
  semanticControls,
  contentSignal,
  aiBotRules,
  botPolicyMatrix,
  webBotAuth,
  a2aAgentCard,
  agentSkills,
  agentsTxt,
  apiCatalog,
  openapiDiscovery,
  oauthAuthorizationServer,
  oauthProtectedResource,
  mcpServerCard,
  webmcp,
  authMd,
  mcpServerDiscover,
  browserAgentic,
  ucp,
  x402,
  mpp,
];

export const PRESETS: Record<'all' | 'content' | 'api' | 'commerce', string[] | 'all'> = {
  all: 'all',
  content: [
    'robots-txt',
    'sitemap',
    'sitemap-lastmod',
    'link-header-api-catalog',
    'dns-aid',
    'rss-atom',
    'markdown-negotiation',
    'markdown-mirror',
    'markdown-link-rel',
    'llms-txt',
    'llms-full-txt',
    'sitemap-md',
    'agents-md',
    'page-html-quality',
    'json-ld',
    'freshness-signals',
    'semantic-controls',
    'content-signal',
    'ai-bot-rules',
    'bot-policy-matrix',
  ],
  api: [
    'link-header-api-catalog',
    'web-bot-auth',
    'a2a-agent-card',
    'agent-skills',
    'agents-txt',
    'api-catalog',
    'openapi-discovery',
    'oauth-authorization-server',
    'oauth-protected-resource',
    'mcp-server-card',
    'webmcp',
    'auth-md',
    'mcp-server-discover',
    'browser-agentic',
  ],
  commerce: ['ucp', 'x402', 'mpp'],
};
