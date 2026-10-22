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

import { ardCatalog, ardEntriesValid, ardTrustManifest, aiCatalogPublished } from './checks/ard';
import { agentDiscoveryFile, agentPluginsRepo, agentRulesRepo } from './checks/agent-meta-files';
import noindex from './checks/noindex';
import {
  wikipediaPresence, npmSdkPackage, restSdkPackages, cliTool,
  mcpRegistryListed, registryBranding, skillsShListed, skillsShQuality,
} from './checks/external-listings';
import {
  contentNoJs, metadataCompleteness, jsonLd, jsonLdEntityLinking,
  orgSchemaCompleteness, schemaTypeBreadth,
} from './checks/html-content';
import sitemapLastmod from './checks/sitemap-lastmod';
import { botDetection, agentCrawlerReachability } from './checks/bot-reachability';
import { robotsAiPolicyQuality, robotsAgentUserPolicy } from './checks/robots-policy';
import { llmsTxtFormatting, llmsTxtLinksResolve, modularLlmsTxt } from './checks/llms-quality';
import {
  markdownUrlFallback, markdownLinkAlternate, markdownNegotiationVary,
  agentUaMarkdown, markdownFrontmatter, pageTokenBudget, codeFenceValidity,
} from './checks/markdown-quality';
import {
  agentFriendly404, redirectHygiene, pricingMd, pricingInfo, agentModeView,
} from './checks/pages';
import {
  trustAnchors, publicApiDocs, developerPortal, agentInstruction, docsAuthGate,
} from './checks/docs-surface';
import {
  axDocumentStructure, axNativeControls, axAccessibleNames,
  axFormLabeling, axTreeInjectionSafe,
} from './checks/accessibility';
import { nlwebAsk, nlwebStreaming, nlwebSchemaFeeds } from './checks/nlweb';
import { oauthSupport, scopedPermissions } from './checks/oauth-quality';
import {
  openapiSpec, publicApi, responseSchemaCoverage, apiErrorModel,
  apiVersioningPolicy, paginationShape, asyncJobPattern, batchEndpoints,
  idempotencyKeySupport, functionCallingCompat, apiSchemaAnalysis,
  jsonErrorResponses, rateLimitHeaders,
} from './checks/openapi-quality';
import {
  graphqlErrorTypeDefinition, graphqlVersioningPolicy, graphqlPaginationPattern,
  graphqlAsyncJobPattern, graphqlSchemaCompleteness, graphqlBatchMutations,
} from './checks/graphql-quality';
import mcpWellKnownDiscovery from './checks/mcp-wellknown';
import {
  mcpServer, mcpServerIdentity, mcpToolListing, mcpToolDescriptions,
  mcpParamSchemas, mcpToolNaming, mcpToolAnnotations, mcpErrorHandling,
  mcpTransportModern, mcpAuthMechanism, mcpOauthMetadata, mcpPkceS256,
  mcpResourceListing, mcpResourceQuality, mcpMultiSurfaceCoverage,
} from './checks/mcp-deep';
import { mcpAppRegistry, mcpAppsUiQuality, mcpViewDomain, mcpViewCsp } from './checks/mcp-apps';
import a2uiSupport from './checks/a2ui';
import {
  agentAuthDiscoveryMetadata, agentAuthWwwAuthenticate, agentAuthEndpointsReachable,
} from './checks/agent-auth';
import { authMdStructure, authMdEndpoints } from './checks/auth-md-quality';
import { acpSupport, acpDelegatePayment, ap2Support } from './checks/payments-emerging';
import {
  papDiscovery, papIssuerBinding, papAuthConfig, papInterfaces,
  papEndpointEnforcement, papCrossProtocol,
} from './checks/pap';
import { onboardingFriction, sandboxEnvironment } from './checks/dev-experience';
import linkHeadersDiscovery from './checks/link-headers';

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

  // Discovery surface expansion (ora.ai parity)
  ardCatalog,
  ardEntriesValid,
  ardTrustManifest,
  aiCatalogPublished,
  noindex,
  agentDiscoveryFile,
  agentPluginsRepo,
  agentRulesRepo,
  mcpRegistryListed,
  registryBranding,
  wikipediaPresence,
  npmSdkPackage,
  restSdkPackages,
  cliTool,
  skillsShListed,
  skillsShQuality,

  // Content surface
  sitemapLastmod,
  contentNoJs,
  metadataCompleteness,
  jsonLd,
  jsonLdEntityLinking,
  orgSchemaCompleteness,
  schemaTypeBreadth,
  llmsTxtFormatting,
  llmsTxtLinksResolve,
  modularLlmsTxt,
  markdownUrlFallback,
  markdownLinkAlternate,
  markdownNegotiationVary,
  markdownFrontmatter,
  pageTokenBudget,
  codeFenceValidity,
  redirectHygiene,
  agentFriendly404,
  pricingMd,
  pricingInfo,
  agentModeView,
  trustAnchors,
  publicApiDocs,
  developerPortal,
  agentInstruction,
  docsAuthGate,
  nlwebSchemaFeeds,
  mcpWellKnownDiscovery,
  linkHeadersDiscovery,

  // Bot access
  botDetection,
  agentCrawlerReachability,
  robotsAiPolicyQuality,
  robotsAgentUserPolicy,
  agentUaMarkdown,

  // Capabilities: API surface
  oauthSupport,
  scopedPermissions,
  openapiSpec,
  publicApi,
  responseSchemaCoverage,
  apiErrorModel,
  apiVersioningPolicy,
  paginationShape,
  asyncJobPattern,
  batchEndpoints,
  idempotencyKeySupport,
  functionCallingCompat,
  apiSchemaAnalysis,
  jsonErrorResponses,
  rateLimitHeaders,
  graphqlErrorTypeDefinition,
  graphqlVersioningPolicy,
  graphqlPaginationPattern,
  graphqlAsyncJobPattern,
  graphqlSchemaCompleteness,
  graphqlBatchMutations,
  onboardingFriction,
  sandboxEnvironment,
  a2uiSupport,
  nlwebAsk,
  nlwebStreaming,

  // Capabilities: deep MCP (activated by --mcp-url)
  mcpServer,
  mcpServerIdentity,
  mcpToolListing,
  mcpToolDescriptions,
  mcpParamSchemas,
  mcpToolNaming,
  mcpToolAnnotations,
  mcpErrorHandling,
  mcpTransportModern,
  mcpAuthMechanism,
  mcpOauthMetadata,
  mcpPkceS256,
  mcpResourceListing,
  mcpResourceQuality,
  mcpMultiSurfaceCoverage,
  mcpAppRegistry,
  mcpAppsUiQuality,
  mcpViewDomain,
  mcpViewCsp,

  // Capabilities: agent auth + PAP (drafts)
  agentAuthDiscoveryMetadata,
  agentAuthWwwAuthenticate,
  agentAuthEndpointsReachable,
  authMdStructure,
  authMdEndpoints,
  papDiscovery,
  papIssuerBinding,
  papAuthConfig,
  papInterfaces,
  papEndpointEnforcement,
  papCrossProtocol,

  // Commerce: emerging protocols
  acpSupport,
  acpDelegatePayment,
  ap2Support,
];

// Checks activated by --external-lookups (query third-party directories).
export const EXTERNAL_LOOKUP_CHECKS = [
  'wikipedia-presence',
  'npm-sdk-package',
  'rest-sdk-packages',
  'cli-tool',
  'mcp-registry-listed',
  'registry-branding',
  'skills-sh-listed',
  'skills-sh-quality',
];

// Checks activated by --mcp-url.
export const MCP_URL_CHECKS = [
  'mcp-server-discover',
  'mcp-server',
  'mcp-server-identity',
  'mcp-tool-listing',
  'mcp-tool-descriptions',
  'mcp-param-schemas',
  'mcp-tool-naming',
  'mcp-tool-annotations',
  'mcp-error-handling',
  'mcp-transport-modern',
  'mcp-auth-mechanism',
  'mcp-oauth-metadata',
  'mcp-pkce-s256',
  'mcp-resource-listing',
  'mcp-resource-quality',
  'mcp-multi-surface-coverage',
  'mcp-app-registry',
  'mcp-apps-ui-quality',
  'mcp-view-domain',
  'mcp-view-csp',
];

// Checks activated by --include-llms-txt.
export const LLMS_TXT_CHECKS = ['llms-txt', 'llms-txt-formatting', 'llms-txt-links-resolve', 'modular-llms-txt'];

// Checks activated by --include-auth-md.
export const AUTH_MD_CHECKS = [
  'auth-md',
  'auth-md-structure',
  'auth-md-endpoints',
  'agent-auth-discovery-metadata',
  'agent-auth-www-authenticate',
  'agent-auth-endpoints-reachable',
];

// Checks activated by --commerce-url.
export const COMMERCE_CHECKS = ['ucp', 'x402', 'mpp', 'acp-support', 'acp-delegate-payment', 'ap2-support'];

export const PRESETS: Record<'all' | 'content' | 'api' | 'commerce', string[] | 'all'> = {
  all: 'all',
  content: [
    'robots-txt',
    'sitemap',
    'sitemap-lastmod',
    'link-header-api-catalog',
    'link-headers-discovery',
    'dns-aid',
    'markdown-negotiation',
    'markdown-negotiation-vary',
    'markdown-url-fallback',
    'markdown-link-alternate',
    'markdown-frontmatter',
    'llms-txt',
    'llms-txt-formatting',
    'llms-txt-links-resolve',
    'modular-llms-txt',
    'content-signal',
    'ai-bot-rules',
    'bot-policy-matrix',
    'bot-detection',
    'agent-crawler-reachability',
    'robots-ai-policy-quality',
    'robots-agent-user-policy',
    'agent-ua-markdown',
    'content-no-js',
    'metadata-completeness',
    'json-ld',
    'json-ld-entity-linking',
    'org-schema-completeness',
    'schema-type-breadth',
    'noindex-directives',
    'page-token-budget',
    'code-fence-validity',
    'redirect-hygiene',
    'agent-friendly-404',
    'pricing-md',
    'pricing-info',
    'agent-mode-view',
    'trust-anchors',
    'public-api-docs',
    'developer-portal',
    'agent-instruction',
    'docs-auth-gate',
    'nlweb-schema-feeds',
    'mcp-well-known-discovery',
    'agent-discovery-file',
  ],
  api: [
    'link-header-api-catalog',
    'link-headers-discovery',
    'web-bot-auth',
    'a2a-agent-card',
    'agent-skills',
    'api-catalog',
    'oauth-authorization-server',
    'oauth-protected-resource',
    'oauth-support',
    'scoped-permissions',
    'mcp-server-card',
    'mcp-well-known-discovery',
    'webmcp',
    'auth-md',
    'auth-md-structure',
    'auth-md-endpoints',
    'agent-auth-discovery-metadata',
    'agent-auth-www-authenticate',
    'agent-auth-endpoints-reachable',
    'mcp-server-discover',
    'browser-agentic',
    'ard-catalog',
    'ard-entries-valid',
    'ard-trust-manifest',
    'ai-catalog-published',
    'openapi-spec',
    'public-api',
    'response-schema-coverage',
    'api-error-model',
    'api-versioning-policy',
    'pagination-shape',
    'async-job-pattern',
    'batch-endpoints',
    'idempotency-key-support',
    'function-calling-compat',
    'api-schema-analysis',
    'json-error-responses',
    'rate-limit-headers',
    'graphql-error-type-definition',
    'graphql-versioning-policy',
    'graphql-pagination-pattern',
    'graphql-async-job-pattern',
    'graphql-schema-completeness',
    'graphql-batch-mutations',
    'a2ui-support',
    'nlweb-ask',
    'nlweb-streaming',
    'onboarding-friction',
    'sandbox-environment',
    'pap-discovery',
    'pap-issuer-binding',
    'pap-auth-config',
    'pap-interfaces',
    'pap-endpoint-enforcement',
    'pap-cross-protocol',
    ...MCP_URL_CHECKS,
  ],
  commerce: [...COMMERCE_CHECKS],
};
