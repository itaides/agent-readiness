import type { Check, CheckResult } from '../types';
import { makeResult } from './_shared';
import { getGraphql, type GraphqlEndpoint } from './_graphql';
import type { HttpClient, Target } from '../types';

const SPEC = { url: 'https://spec.graphql.org/', asOf: '2026-10-22' };

function meta(id: string, title: string) {
  return { id, category: 'capabilities' as const, title, spec: SPEC };
}

type Verdict = { status: 'pass' | 'warn'; message: string } | { status: 'skip'; message: string };

function evaluate(ep: GraphqlEndpoint | null, fn: (ep: GraphqlEndpoint) => Verdict): Verdict {
  if (!ep) return { status: 'skip', message: 'No GraphQL endpoint discovered' };
  if (!ep.introspectable) return { status: 'warn', message: 'GraphQL endpoint found but introspection is disabled — schema checks unavailable' };
  return fn(ep);
}

function make(id: string, title: string, fn: (ep: GraphqlEndpoint) => Verdict): Check {
  const m = meta(id, title);
  return {
    ...m,
    defaultEnabled: true,
    scored: false,
    async run(target: Target, http: HttpClient): Promise<CheckResult> {
      const ep = await getGraphql(target, http);
      const v = evaluate(ep, fn);
      const evidence = ep ? { request: { method: 'POST', url: ep.url }, note: `endpoint ${ep.url}` } : {};
      return makeResult(m, v.status, v.message, evidence);
    },
  };
}

export const graphqlErrorTypeDefinition = make('graphql-error-type-definition', 'GraphQL typed error model', (ep) => {
  const names = new Set(ep.types.map((t) => t.name));
  const unions = ep.types.filter((t) => t.kind === 'UNION' && /error|result/i.test(t.name));
  const userErrors = [...names].some((n) => /userErrors?|Error(s)?$/.test(n));
  if (userErrors || unions.length) return { status: 'pass', message: `Typed errors found (${userErrors ? 'userErrors' : 'error unions'})` };
  return { status: 'warn', message: 'No typed error unions or userErrors in schema' };
});

export const graphqlVersioningPolicy = make('graphql-versioning-policy', 'GraphQL versioning / deprecation policy', (ep) => {
  const deprecatedFields = ep.types.flatMap((t) => t.fields ?? []).filter((f) => f.isDeprecated).length;
  if (deprecatedFields > 0) return { status: 'pass', message: `${deprecatedFields} deprecated fields — evolution is explicit` };
  return { status: 'warn', message: 'No @deprecated usage detected — no documented evolution policy' };
});

export const graphqlPaginationPattern = make('graphql-pagination-pattern', 'GraphQL pagination pattern', (ep) => {
  const names = new Set(ep.types.map((t) => t.name));
  const connections = [...names].filter((n) => n.endsWith('Connection'));
  if (names.has('PageInfo') || connections.length) {
    return { status: 'pass', message: `Relay-style pagination (${connections.length} Connection types${names.has('PageInfo') ? ' + PageInfo' : ''})` };
  }
  const edge = [...names].some((n) => n.endsWith('Edge'));
  if (edge) return { status: 'pass', message: 'Edge-based pagination detected' };
  return { status: 'warn', message: 'No Connection/PageInfo cursor pagination in schema' };
});

export const graphqlAsyncJobPattern = make('graphql-async-job-pattern', 'GraphQL async-job pattern', (ep) => {
  const names = new Set(ep.types.map((t) => t.name));
  const jobLike = [...names].some((n) => /job|task|operation|progress|status/i.test(n));
  const asyncMut = ep.mutationFields.some((f) => /async|job|queue|enqueue|process/i.test(f.name));
  if (ep.hasSubscriptions || jobLike || asyncMut) {
    return { status: 'pass', message: ep.hasSubscriptions ? 'Subscriptions available for progress' : 'Async job types/mutations detected' };
  }
  return { status: 'warn', message: 'No subscriptions or job types for long-running work' };
});

export const graphqlSchemaCompleteness = make('graphql-schema-completeness', 'GraphQL schema description coverage', (ep) => {
  const userTypes = ep.types.filter((t) => !t.name.startsWith('__'));
  const docUnits = userTypes.length + userTypes.reduce((n, t) => n + (t.fields?.length ?? 0), 0);
  const described = userTypes.filter((t) => t.description).length
    + userTypes.reduce((n, t) => n + (t.fields ?? []).filter((f) => f.description).length, 0);
  if (docUnits === 0) return { status: 'skip', message: 'Schema exposes no user types' };
  const pct = Math.round((described / docUnits) * 100);
  if (pct >= 80) return { status: 'pass', message: `${pct}% of types/fields described` };
  return { status: 'warn', message: `${pct}% of types/fields described (<80%)` };
});

export const graphqlBatchMutations = make('graphql-batch-mutations', 'GraphQL batch mutations', (ep) => {
  const bulk = ep.mutationFields.filter((f) => /(many|batch|bulk|all)$/i.test(f.name) || /(create|update|delete)(Many|All)/i.test(f.name));
  if (bulk.length) return { status: 'pass', message: `Bulk mutations: ${bulk.slice(0, 4).map((f) => f.name).join(', ')}` };
  return { status: 'warn', message: 'No bulk mutation fields — agents must loop single mutations' };
});
