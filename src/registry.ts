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

export const checks: Check[] = [
  robotsTxt,
  sitemap,
  linkHeaderApiCatalog,
  dnsAid,
  markdownNegotiation,
  llmsTxt,
  contentSignal,
  aiBotRules,
  botPolicyMatrix,
  webBotAuth,
  a2aAgentCard,
  agentSkills,
  apiCatalog,
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
    'link-header-api-catalog',
    'dns-aid',
    'markdown-negotiation',
    'llms-txt',
    'content-signal',
    'ai-bot-rules',
    'bot-policy-matrix',
  ],
  api: [
    'link-header-api-catalog',
    'web-bot-auth',
    'a2a-agent-card',
    'agent-skills',
    'api-catalog',
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
