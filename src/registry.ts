import type { Check, SiteType } from './types';

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
import xRobotsTag from './checks/x-robots-tag';
import tdmrep from './checks/tdmrep';
import botUaDifferential from './checks/bot-ua-differential';
import { ardCatalog, ardEntriesValid, ardTrustManifest, aiCatalogPublished } from './checks/ard';
import { agentDiscoveryFile, agentPluginsRepo } from './checks/agent-meta-files';
import { mcpRegistryListed, registryBranding, wikipediaPresence, npmSdkPackage, restSdkPackages, cliTool, skillsShListed, skillsShQuality } from './checks/external-listings';
import { metadataCompleteness, jsonLdEntityLinking, orgSchemaCompleteness, schemaTypeBreadth } from './checks/html-content';
import { axDocumentStructure, axNativeControls, axAccessibleNames, axFormLabeling, axTreeInjectionSafe } from './checks/accessibility';
import { markdownFrontmatter, pageTokenBudget, codeFenceValidity } from './checks/markdown-quality';
import { llmsTxtFormatting, llmsTxtLinksResolve, modularLlmsTxt } from './checks/llms-quality';
import { agentFriendly404, redirectHygiene, pricingMd, pricingInfo, agentModeView } from './checks/pages';
import { trustAnchors, publicApiDocs, developerPortal, agentInstruction, docsAuthGate } from './checks/docs-surface';
import { nlwebAsk, nlwebStreaming, nlwebSchemaFeeds } from './checks/nlweb';
import mcpWellKnownDiscovery from './checks/mcp-wellknown';
import linkHeadersDiscovery from './checks/link-headers';
import { robotsAiPolicyQuality, robotsAgentUserPolicy } from './checks/robots-policy';
import { oauthSupport, scopedPermissions } from './checks/oauth-quality';
import { publicApi, responseSchemaCoverage, apiErrorModel, apiVersioningPolicy, paginationShape, asyncJobPattern, batchEndpoints, idempotencyKeySupport, functionCallingCompat, apiSchemaAnalysis, jsonErrorResponses, rateLimitHeaders } from './checks/openapi-quality';
import { graphqlErrorTypeDefinition, graphqlVersioningPolicy, graphqlPaginationPattern, graphqlAsyncJobPattern, graphqlSchemaCompleteness, graphqlBatchMutations } from './checks/graphql-quality';
import { onboardingFriction, sandboxEnvironment } from './checks/dev-experience';
import a2uiSupport from './checks/a2ui';
import { mcpServer, mcpServerIdentity, mcpToolListing, mcpToolDescriptions, mcpParamSchemas, mcpToolNaming, mcpToolAnnotations, mcpErrorHandling, mcpTransportModern, mcpAuthMechanism, mcpOauthMetadata, mcpPkceS256, mcpResourceListing, mcpResourceQuality, mcpMultiSurfaceCoverage } from './checks/mcp-deep';
import { mcpAppRegistry, mcpAppsUiQuality, mcpViewDomain, mcpViewCsp } from './checks/mcp-apps';
import { agentAuthDiscoveryMetadata, agentAuthWwwAuthenticate, agentAuthEndpointsReachable } from './checks/agent-auth';
import { authMdStructure, authMdEndpoints } from './checks/auth-md-quality';
import { papDiscovery, papIssuerBinding, papAuthConfig, papInterfaces, papEndpointEnforcement, papCrossProtocol } from './checks/pap';
import { acpSupport, acpDelegatePayment, ap2Support } from './checks/payments-emerging';

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
  xRobotsTag,
  tdmrep,
  botUaDifferential,
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
  // Ora-parity expansion: deterministic discovery/content/API/MCP/auth/commerce signals.
  ardCatalog,
  ardEntriesValid,
  ardTrustManifest,
  aiCatalogPublished,
  agentDiscoveryFile,
  agentPluginsRepo,
  mcpRegistryListed,
  registryBranding,
  wikipediaPresence,
  metadataCompleteness,
  jsonLdEntityLinking,
  orgSchemaCompleteness,
  schemaTypeBreadth,
  axDocumentStructure,
  axNativeControls,
  axAccessibleNames,
  axFormLabeling,
  axTreeInjectionSafe,
  markdownFrontmatter,
  pageTokenBudget,
  codeFenceValidity,
  llmsTxtFormatting,
  llmsTxtLinksResolve,
  modularLlmsTxt,
  agentFriendly404,
  redirectHygiene,
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
  robotsAiPolicyQuality,
  robotsAgentUserPolicy,
  oauthSupport,
  scopedPermissions,
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
  npmSdkPackage,
  restSdkPackages,
  cliTool,
  skillsShListed,
  skillsShQuality,
  acpSupport,
  acpDelegatePayment,
  ap2Support,
];

/** Opt-in checks that send the target's name/domain to third-party directories. */
export const EXTERNAL_LOOKUP_CHECKS = [
  'mcp-registry-listed',
  'registry-branding',
  'wikipedia-presence',
  'npm-sdk-package',
  'rest-sdk-packages',
  'cli-tool',
  'skills-sh-listed',
  'skills-sh-quality',
];

/** Deep read-only MCP checks activated by --mcp-url. */
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

/** Agent-auth + auth.md quality checks activated by --include-auth-md. */
export const AUTH_MD_CHECKS = [
  'auth-md',
  'auth-md-structure',
  'auth-md-endpoints',
  'agent-auth-discovery-metadata',
  'agent-auth-www-authenticate',
  'agent-auth-endpoints-reachable',
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
    'x-robots-tag',
    'tdmrep',
    'bot-ua-differential',
    'ard-catalog',
    'ard-entries-valid',
    'ard-trust-manifest',
    'ai-catalog-published',
    'agent-discovery-file',
    'agent-plugins-repo',
    'wikipedia-presence',
    'metadata-completeness',
    'json-ld-entity-linking',
    'org-schema-completeness',
    'schema-type-breadth',
    'ax-document-structure',
    'ax-native-controls',
    'ax-accessible-names',
    'ax-form-labeling',
    'ax-tree-injection-safe',
    'markdown-frontmatter',
    'page-token-budget',
    'code-fence-validity',
    'llms-txt-formatting',
    'llms-txt-links-resolve',
    'modular-llms-txt',
    'agent-friendly-404',
    'redirect-hygiene',
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
    'link-headers-discovery',
    'robots-ai-policy-quality',
    'robots-agent-user-policy',
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
    'auth-md-structure',
    'auth-md-endpoints',
    'mcp-server-discover',
    'browser-agentic',
    'oauth-support',
    'scoped-permissions',
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
    'onboarding-friction',
    'sandbox-environment',
    'a2ui-support',
    'nlweb-ask',
    'nlweb-streaming',
    'agent-auth-discovery-metadata',
    'agent-auth-www-authenticate',
    'agent-auth-endpoints-reachable',
    'pap-discovery',
    'pap-issuer-binding',
    'pap-auth-config',
    'pap-interfaces',
    'pap-endpoint-enforcement',
    'pap-cross-protocol',
    'mcp-registry-listed',
    'registry-branding',
    'npm-sdk-package',
    'rest-sdk-packages',
    'cli-tool',
    'skills-sh-listed',
    'skills-sh-quality',
    ...MCP_URL_CHECKS.filter((id) => id !== 'mcp-server-discover'),
  ],
  commerce: ['ucp', 'x402', 'mpp', 'acp-support', 'acp-delegate-payment', 'ap2-support'],
};

/**
 * Checks that don't apply to a site type. They aren't run, are reported as skipped with the reason,
 * and don't count toward the score. `--skip` covers any other list.
 */
export const NOT_APPLICABLE: Record<SiteType, { ids: string[]; reason: string }> = {
  full: { ids: [], reason: '' },
  content: {
    // API, auth and agent-endpoint checks: a content site (docs, blog, marketing) has nothing to publish there.
    ids: [
      'link-header-api-catalog',
      'api-catalog',
      'openapi-discovery',
      'oauth-authorization-server',
      'oauth-protected-resource',
      'a2a-agent-card',
      'mcp-server-card',
      'web-bot-auth',
      'oauth-support',
      'scoped-permissions',
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
      'onboarding-friction',
      'sandbox-environment',
      'agent-auth-discovery-metadata',
      'agent-auth-www-authenticate',
      'agent-auth-endpoints-reachable',
      'auth-md-structure',
      'auth-md-endpoints',
      'pap-discovery',
      'pap-issuer-binding',
      'pap-auth-config',
      'pap-interfaces',
      'pap-endpoint-enforcement',
      'pap-cross-protocol',
      ...MCP_URL_CHECKS,
    ],
    reason: 'Not applicable to a content site (--site-type content): no API or agent endpoint to describe',
  },
};

export const SITE_TYPES = Object.keys(NOT_APPLICABLE) as SiteType[];
