import type { Check, CheckResult, Evidence, HttpClient, Target } from '../types';
import { decodeBody, isRecord, makeResult } from './_shared';

// Checks in this file query third-party directories/registries, sending the
// target domain name to external APIs. They are opt-in via --external-lookups
// and never run for local/private targets.

const SPEC = { url: 'https://docs.npmjs.com/about-the-public-npm-registry', asOf: '2026-10-22' };

function brandOf(target: Target): string {
  const host = target.origin.hostname.toLowerCase().replace(/^www\./, '');
  return host.split('.')[0] ?? host;
}

async function getJson(http: HttpClient, url: string): Promise<{ data: unknown; evidence: Evidence } | null> {
  const res = await http.fetch(url, { headers: { Accept: 'application/json' } });
  const evidence: Evidence = {
    request: { method: 'GET', url },
    response: { status: res.status, contentType: res.contentType, bytes: res.body.length, preview: decodeBody(res.body).slice(0, 200) },
  };
  if (res.status !== 200) return null;
  try { return { data: JSON.parse(decodeBody(res.body)), evidence }; } catch { return null; }
}

function notLocal(target: Target): boolean {
  return !target.isLocal;
}

export const wikipediaPresence: Check = {
  id: 'wikipedia-presence',
  category: 'discoverability',
  title: 'Wikipedia / Wikidata entity presence',
  spec: { url: 'https://www.wikidata.org/wiki/Property:P856', asOf: '2026-10-22' },
  defaultEnabled: false,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'wikipedia-presence', category: 'discoverability' as const, title: META_TITLES['wikipedia-presence'], spec: { url: 'https://www.wikidata.org/wiki/Property:P856', asOf: '2026-10-22' } };
    if (!notLocal(target)) return makeResult(meta, 'skip', 'External lookups skipped for local targets', {});
    const brand = brandOf(target);
    const host = target.origin.hostname.toLowerCase().replace(/^www\./, '');
    const search = await getJson(http, `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(brand)}&language=en&format=json&limit=5`);
    if (!search || !isRecord(search.data) || !Array.isArray(search.data.search)) {
      return makeResult(meta, 'skip', 'Wikidata search unavailable', search?.evidence ?? {});
    }
    const candidates = (search.data.search as unknown[]).filter(isRecord);
    for (const c of candidates.slice(0, 5)) {
      const qid = c.id;
      if (typeof qid !== 'string') continue;
      const ent = await getJson(http, `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=claims|sitelinks&format=json`);
      const entities = isRecord(ent?.data) ? (ent.data as Record<string, unknown>).entities : undefined;
      const e = isRecord(entities) ? entities[qid] : undefined;
      if (!isRecord(e)) continue;
      const claims = isRecord(e.claims) ? e.claims : {};
      const p856 = Array.isArray(claims.P856) ? claims.P856 : [];
      const hasSite = p856.some((claim) => {
        const v = (claim as Record<string, unknown>)?.mainsnak as Record<string, unknown> | undefined;
        const dv = v?.datavalue as Record<string, unknown> | undefined;
        return typeof dv?.value === 'string' && (dv.value as string).toLowerCase().includes(host);
      });
      const sitelinks = isRecord(e.sitelinks) ? Object.keys(e.sitelinks) : [];
      const wiki = sitelinks.some((s) => s.endsWith('wiki'));
      if (hasSite) {
        return makeResult(meta, 'pass', `Wikidata entity ${qid} lists ${host} as official website${wiki ? ' with Wikipedia sitelink' : ' (no Wikipedia article yet)'}`, ent?.evidence ?? search.evidence);
      }
    }
    return makeResult(meta, 'warn', `No Wikidata entity found with official website ${host}`, search.evidence);
  },
};

export const npmSdkPackage: Check = {
  id: 'npm-sdk-package',
  category: 'capabilities',
  title: 'npm/PyPI SDK package',
  spec: SPEC,
  defaultEnabled: false,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'npm-sdk-package', category: 'capabilities' as const, title: 'npm/PyPI SDK package', spec: SPEC };
    if (!notLocal(target)) return makeResult(meta, 'skip', 'External lookups skipped for local targets', {});
    const brand = brandOf(target);
    const npm = await getJson(http, `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(brand)}&size=10`);
    const objects = isRecord(npm?.data) && Array.isArray(npm.data.objects) ? npm.data.objects : [];
    const match = objects.find((o) => {
      const pkg = (o as Record<string, unknown>).package as Record<string, unknown> | undefined;
      const name = typeof pkg?.name === 'string' ? pkg.name.toLowerCase() : '';
      return name === brand || name === `@${brand}/${brand}` || name.startsWith(`${brand}-`) || name.endsWith(`-${brand}`) || name === `@${brand}`;
    });
    if (match) return makeResult(meta, 'pass', 'npm package matching the brand found', npm!.evidence);
    const pypi = await getJson(http, `https://pypi.org/pypi/${encodeURIComponent(brand)}/json`);
    if (pypi && isRecord(pypi.data) && isRecord(pypi.data.info)) {
      return makeResult(meta, 'pass', `PyPI package "${brand}" exists`, pypi.evidence);
    }
    return makeResult(meta, 'warn', `No official npm/PyPI package matching "${brand}" found`, npm?.evidence ?? {});
  },
};

export const restSdkPackages: Check = {
  id: 'rest-sdk-packages',
  category: 'capabilities',
  title: 'Multi-language SDK packages',
  spec: SPEC,
  defaultEnabled: false,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'rest-sdk-packages', category: 'capabilities' as const, title: 'Multi-language SDK packages', spec: SPEC };
    if (!notLocal(target)) return makeResult(meta, 'skip', 'External lookups skipped for local targets', {});
    const brand = brandOf(target);
    const found: string[] = [];
    const npm = await getJson(http, `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(`${brand} sdk`)}&size=10`);
    const objects = isRecord(npm?.data) && Array.isArray(npm.data.objects) ? npm.data.objects : [];
    if (objects.some((o) => {
      const pkg = (o as Record<string, unknown>).package as Record<string, unknown> | undefined;
      const name = typeof pkg?.name === 'string' ? pkg.name.toLowerCase() : '';
      return name.includes(brand);
    })) found.push('npm');
    const pypi = await getJson(http, `https://pypi.org/search/?q=${encodeURIComponent(brand)}`);
    void pypi; // PyPI has no JSON search API; try exact match instead
    const pypiExact = await getJson(http, `https://pypi.org/pypi/${encodeURIComponent(brand)}-sdk/json`);
    if (pypiExact || await getJson(http, `https://pypi.org/pypi/${encodeURIComponent(brand)}/json`)) found.push('pypi');
    if (found.length >= 2) return makeResult(meta, 'pass', `SDK packages found on: ${found.join(', ')}`, npm?.evidence ?? {});
    if (found.length === 1) return makeResult(meta, 'warn', `Only a single-ecosystem SDK found (${found[0]})`, npm?.evidence ?? {});
    return makeResult(meta, 'warn', 'No SDK packages found on npm/PyPI for this brand', npm?.evidence ?? {});
  },
};

export const cliTool: Check = {
  id: 'cli-tool',
  category: 'capabilities',
  title: 'Official CLI tool',
  spec: SPEC,
  defaultEnabled: false,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'cli-tool', category: 'capabilities' as const, title: 'Official CLI tool', spec: SPEC };
    if (!notLocal(target)) return makeResult(meta, 'skip', 'External lookups skipped for local targets', {});
    const brand = brandOf(target);
    for (const name of [brand, `${brand}-cli`, `@${brand}/cli`]) {
      const res = await getJson(http, `https://registry.npmjs.org/${encodeURIComponent(name)}`);
      const latest = isRecord(res?.data) ? (res.data['dist-tags'] as Record<string, unknown> | undefined)?.latest : undefined;
      const versions = isRecord(res?.data) ? (res.data.versions as Record<string, unknown> | undefined) : undefined;
      const v = typeof latest === 'string' && versions ? versions[latest] : undefined;
      if (isRecord(v) && (v.bin || (isRecord(v) && typeof v.bin === 'object'))) {
        return makeResult(meta, 'pass', `CLI package "${name}" on npm exposes a bin entry`, res!.evidence);
      }
    }
    return makeResult(meta, 'warn', `No CLI package found on npm for "${brand}"`, {});
  },
};

export const mcpRegistryListed: Check = {
  id: 'mcp-registry-listed',
  category: 'discoverability',
  title: 'Listed in MCP registries',
  spec: { url: 'https://registry.modelcontextprotocol.io/', asOf: '2026-10-22' },
  defaultEnabled: false,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'mcp-registry-listed', category: 'discoverability' as const, title: 'Listed in MCP registries', spec: { url: 'https://registry.modelcontextprotocol.io/', asOf: '2026-10-22' } };
    if (!notLocal(target)) return makeResult(meta, 'skip', 'External lookups skipped for local targets', {});
    const host = target.origin.hostname.toLowerCase().replace(/^www\./, '');
    const res = await getJson(http, `https://registry.modelcontextprotocol.io/v0/servers?search=${encodeURIComponent(host)}`);
    const servers = isRecord(res?.data) && Array.isArray(res.data.servers) ? res.data.servers : [];
    const hit = servers.find((s) => {
      const srv = isRecord(s) ? (s.server ?? s) : undefined;
      const text = JSON.stringify(srv ?? s).toLowerCase();
      return text.includes(host);
    });
    if (hit) return makeResult(meta, 'pass', 'Domain appears in the official MCP registry', res!.evidence);
    return makeResult(meta, 'warn', `No MCP registry entry verified against ${host}`, res?.evidence ?? {});
  },
};

export const registryBranding: Check = {
  id: 'registry-branding',
  category: 'discoverability',
  title: 'Registry entry branding',
  spec: { url: 'https://registry.modelcontextprotocol.io/', asOf: '2026-10-22' },
  defaultEnabled: false,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'registry-branding', category: 'discoverability' as const, title: 'Registry entry branding', spec: { url: 'https://registry.modelcontextprotocol.io/', asOf: '2026-10-22' } };
    if (!notLocal(target)) return makeResult(meta, 'skip', 'External lookups skipped for local targets', {});
    const host = target.origin.hostname.toLowerCase().replace(/^www\./, '');
    const res = await getJson(http, `https://registry.modelcontextprotocol.io/v0/servers?search=${encodeURIComponent(host)}`);
    const servers = isRecord(res?.data) && Array.isArray(res.data.servers) ? res.data.servers : [];
    const hit = servers.find((s) => JSON.stringify(s).toLowerCase().includes(host));
    if (!hit) return makeResult(meta, 'skip', 'No registry entry to grade', res?.evidence ?? {});
    const srv = isRecord(hit) ? ((hit.server ?? hit) as Record<string, unknown>) : {};
    const missing: string[] = [];
    if (!srv.description) missing.push('description');
    if (!srv.websiteUrl && !srv.website_url && !srv.icons) missing.push('icon/homepage');
    if (missing.length) return makeResult(meta, 'warn', `Registry entry missing: ${missing.join(', ')}`, res!.evidence);
    return makeResult(meta, 'pass', 'Registry entry has description and branding', res!.evidence);
  },
};

async function skillsSh(http: HttpClient, brand: string): Promise<{ skills: Record<string, unknown>[]; evidence: Evidence } | null> {
  for (const url of [
    `https://skills.sh/api/skills?q=${encodeURIComponent(brand)}`,
    `https://skills.sh/api/search?q=${encodeURIComponent(brand)}`,
  ]) {
    const res = await http.fetch(url, { headers: { Accept: 'application/json' } });
    const evidence: Evidence = { request: { method: 'GET', url }, response: { status: res.status, contentType: res.contentType, bytes: res.body.length } };
    if (res.status !== 200 || !/json/i.test(res.contentType)) continue;
    try {
      const data = JSON.parse(decodeBody(res.body));
      const arr = Array.isArray(data) ? data : (isRecord(data) && Array.isArray(data.skills) ? data.skills : []);
      return { skills: arr.filter(isRecord) as Record<string, unknown>[], evidence };
    } catch { continue; }
  }
  return null;
}

export const skillsShListed: Check = {
  id: 'skills-sh-listed',
  category: 'capabilities',
  title: 'Listed on skills.sh',
  spec: { url: 'https://skills.sh/', asOf: '2026-10-22' },
  defaultEnabled: false,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'skills-sh-listed', category: 'capabilities' as const, title: 'Listed on skills.sh', spec: { url: 'https://skills.sh/', asOf: '2026-10-22' } };
    if (!notLocal(target)) return makeResult(meta, 'skip', 'External lookups skipped for local targets', {});
    const res = await skillsSh(http, brandOf(target));
    if (!res) return makeResult(meta, 'skip', 'skills.sh directory lookup unavailable', {});
    if (res.skills.length) return makeResult(meta, 'pass', `${res.skills.length} skill(s) listed on skills.sh`, res.evidence);
    return makeResult(meta, 'warn', 'No skills found on skills.sh for this brand', res.evidence);
  },
};

export const skillsShQuality: Check = {
  id: 'skills-sh-quality',
  category: 'capabilities',
  title: 'skills.sh skill quality',
  spec: { url: 'https://skills.sh/', asOf: '2026-10-22' },
  defaultEnabled: false,
  scored: false,

  async run(target, http): Promise<CheckResult> {
    const meta = { id: 'skills-sh-quality', category: 'capabilities' as const, title: 'skills.sh skill quality', spec: { url: 'https://skills.sh/', asOf: '2026-10-22' } };
    if (!notLocal(target)) return makeResult(meta, 'skip', 'External lookups skipped for local targets', {});
    const res = await skillsSh(http, brandOf(target));
    if (!res || res.skills.length === 0) return makeResult(meta, 'skip', 'No skills.sh listing to grade', {});
    const described = res.skills.filter((s) => typeof s.description === 'string' && (s.description as string).length > 20);
    if (res.skills.length >= 2 && described.length === res.skills.length) {
      return makeResult(meta, 'pass', `${res.skills.length} skills with descriptive metadata`, res.evidence);
    }
    return makeResult(meta, 'warn', `${res.skills.length} skill(s) listed; ${described.length} with real descriptions`, res.evidence);
  },
};

const META_TITLES: Record<string, string> = {
  'wikipedia-presence': 'Wikipedia / Wikidata entity presence',
};
