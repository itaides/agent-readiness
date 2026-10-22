import type { HttpClient, Target } from '../types';
import { decodeBody, isRecord, memoize } from './_shared';

// Shared GraphQL endpoint discovery + one introspection query, memoized so the
// family of GraphQL checks performs at most a couple of requests per scan.

export interface GraphqlEndpoint {
  url: string;
  probeStatus: number;
  introspectable: boolean;
  types: GqlType[];
  hasSubscriptions: boolean;
  mutationFields: { name: string; description?: string; deprecated: boolean }[];
  queryFields: { name: string; description?: string; deprecated: boolean }[];
}

export interface GqlType {
  name: string;
  kind?: string;
  description?: string;
  fields?: { name: string; description?: string; isDeprecated?: boolean; type?: unknown }[];
}

const CANDIDATES = ['/graphql', '/api/graphql', '/graphql/v1', '/query', '/gql'];

const INTROSPECTION = `query ArIntrospection {
  __schema {
    queryType { name }
    mutationType { name }
    subscriptionType { name }
    types {
      name kind description
      fields { name description isDeprecated type { kind name ofType { kind name } } }
    }
  }
}`;

async function post(http: HttpClient, url: string, query: string) {
  return http.fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query }),
  });
}

async function discover(target: Target, http: HttpClient): Promise<GraphqlEndpoint | null> {
  for (const path of CANDIDATES) {
    const url = new URL(path, target.origin).toString();
    let probe;
    try { probe = await post(http, url, '{ __typename }'); } catch { continue; }
    if (probe.status === 404 || probe.status === 405) continue;
    const text = decodeBody(probe.body);
    let json: unknown;
    try { json = JSON.parse(text); } catch { continue; }
    if (!isRecord(json)) continue;
    const gqlish = isRecord(json.data) || Array.isArray(json.errors) || 'data' in json;
    if (!gqlish) continue;

    const ep: GraphqlEndpoint = {
      url,
      probeStatus: probe.status,
      introspectable: false,
      types: [],
      hasSubscriptions: false,
      mutationFields: [],
      queryFields: [],
    };

    try {
      const res = await post(http, url, INTROSPECTION);
      const body = decodeBody(res.body);
      const parsed = JSON.parse(body) as Record<string, unknown>;
      const schema = (parsed.data as Record<string, unknown> | undefined)?.__schema as Record<string, unknown> | undefined;
      if (schema && Array.isArray(schema.types)) {
        ep.introspectable = true;
        ep.types = (schema.types as unknown[]).filter(isRecord) as unknown as GqlType[];
        ep.hasSubscriptions = Boolean(schema.subscriptionType);
        const queryName = (schema.queryType as Record<string, unknown> | undefined)?.name;
        const mutName = (schema.mutationType as Record<string, unknown> | undefined)?.name;
        for (const t of ep.types) {
          const fields = Array.isArray(t.fields) ? t.fields : [];
          if (t.name === queryName) ep.queryFields = fields.map((f) => ({ name: f.name, description: f.description, deprecated: Boolean(f.isDeprecated) }));
          if (t.name === mutName) ep.mutationFields = fields.map((f) => ({ name: f.name, description: f.description, deprecated: Boolean(f.isDeprecated) }));
        }
      }
    } catch { /* introspection unavailable */ }
    return ep;
  }
  return null;
}

export function getGraphql(target: Target, http: HttpClient): Promise<GraphqlEndpoint | null> {
  return memoize(`graphql:${target.origin}`, () => discover(target, http));
}
