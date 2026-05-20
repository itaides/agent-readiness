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

export const checks: Check[] = [
  robotsTxt,
  sitemap,
  linkHeaderApiCatalog,
  markdownNegotiation,
  llmsTxt,
  contentSignal,
  aiBotRules,
  webBotAuth,
  agentSkills,
  apiCatalog,
  oauthAuthorizationServer,
  oauthProtectedResource,
  mcpServerCard,
  webmcp,
];

export const PRESETS: Record<'all' | 'content' | 'api', string[] | 'all'> = {
  all: 'all',
  content: [
    'robots-txt',
    'sitemap',
    'link-header-api-catalog',
    'markdown-negotiation',
    'llms-txt',
    'content-signal',
    'ai-bot-rules',
  ],
  api: [
    'link-header-api-catalog',
    'web-bot-auth',
    'agent-skills',
    'api-catalog',
    'oauth-authorization-server',
    'oauth-protected-resource',
    'mcp-server-card',
    'webmcp',
  ],
};
